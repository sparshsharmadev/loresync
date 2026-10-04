create or replace function public.append_analysis_messages(
  p_analysis_id uuid,
  p_batch_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_platform text;
  v_status text;
  v_message jsonb;
  v_hash text;
  v_prior_hash text;
  v_prior_count integer;
  v_inserted integer;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_batch_id is null or p_messages is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) < 1 or jsonb_array_length(p_messages) > 10000
     or octet_length(p_messages::text) > 1400000 then
    raise exception 'Invalid message batch' using errcode = '22023';
  end if;

  select platform, status into v_platform, v_status
    from public.analyses
    where id = p_analysis_id and owner_id = v_owner
    for update;
  if not found or v_status <> 'uploading' then
    raise exception 'Analysis unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.analyses
    where id = p_analysis_id and created_at < clock_timestamp() - interval '1 day'
  ) then
    raise exception 'Analysis upload expired' using errcode = '22023';
  end if;

  v_hash := encode(digest(p_messages::text, 'sha256'), 'hex');
  select payload_hash, inserted_count into v_prior_hash, v_prior_count
    from public.analysis_import_batches
    where analysis_id = p_analysis_id and batch_id = p_batch_id and owner_id = v_owner;
  if found then
    if v_prior_hash <> v_hash then
      raise exception 'Batch identifier was already used for different content' using errcode = '22023';
    end if;
    return v_prior_count;
  end if;

  for v_message in select value from jsonb_array_elements(p_messages)
  loop
    if jsonb_typeof(v_message) <> 'object'
       or jsonb_typeof(v_message->'timestamp') <> 'string'
       or jsonb_typeof(v_message->'sender') <> 'string'
       or jsonb_typeof(v_message->'content') <> 'string'
       or jsonb_typeof(v_message->'hasAttachment') <> 'boolean' then
      raise exception 'Invalid message shape' using errcode = '22023';
    end if;
    perform (v_message->>'timestamp')::timestamptz;
    if btrim(v_message->>'sender') = '' or char_length(v_message->>'sender') > 200
       or char_length(v_message->>'content') > 100000
       or jsonb_typeof(v_message->'rawId') not in ('string', 'null')
       or char_length(coalesce(v_message->>'rawId', '')) > 200 then
      raise exception 'Invalid message fields' using errcode = '22023';
    end if;
  end loop;

  insert into public.analysis_import_batches(analysis_id, batch_id, owner_id, payload_hash)
  values (p_analysis_id, p_batch_id, v_owner, v_hash);

  insert into public.messages (
    analysis_id, owner_id, sent_at, sender, content, platform, has_attachment, source_id
  )
  select p_analysis_id, v_owner, message."timestamp", btrim(message.sender), message.content,
         v_platform, message."hasAttachment", nullif(message."rawId", '')
  from jsonb_to_recordset(p_messages) as message(
    "timestamp" timestamptz,
    sender text,
    content text,
    "hasAttachment" boolean,
    "rawId" text
  );
  get diagnostics v_inserted = row_count;
  update public.analysis_import_batches set inserted_count = v_inserted
    where analysis_id = p_analysis_id and batch_id = p_batch_id and owner_id = v_owner;
  return v_inserted;
end;
$$;
