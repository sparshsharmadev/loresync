-- Make chunk retries safe and enforce write limits even when callers invoke RPCs directly.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.analysis_import_batches (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  batch_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  created_at timestamptz not null default now(),
  primary key (analysis_id, batch_id)
);
alter table public.analysis_import_batches enable row level security;
revoke all on table public.analysis_import_batches from anon, authenticated;

create or replace function public.consume_api_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_bucket timestamptz;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  -- Each app API write is also counted in the API layer. Keep this layer at 2x the user-facing limits.
  v_limit := case p_action
    when 'analyses.create' then 20
    when 'messages.append' then 120
    when 'analysis.complete' then 20
    else null
  end;
  if v_limit is null then
    raise exception 'Unsupported rate-limit action' using errcode = '22023';
  end if;
  v_bucket := to_timestamp(floor(extract(epoch from clock_timestamp()) / 60) * 60);
  insert into public.api_rate_limits(user_id, action, bucket_start, request_count)
  values (v_user_id, p_action, v_bucket, 1)
  on conflict (user_id, action, bucket_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;
  delete from public.api_rate_limits
    where user_id = v_user_id and bucket_start < v_bucket - interval '1 day';
  return v_count <= v_limit;
end;
$$;

create or replace function public.enforce_analysis_write_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' and new.status = 'uploading' then
    v_action := 'analyses.create';
  elsif tg_op = 'UPDATE' and old.status is distinct from 'ready' and new.status = 'ready' then
    v_action := 'analysis.complete';
  else
    return new;
  end if;
  if not public.consume_api_rate_limit(v_action) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', detail = 'RATE_LIMITED';
  end if;
  return new;
end;
$$;

drop trigger if exists analyses_enforce_write_limit on public.analyses;
create trigger analyses_enforce_write_limit
  before insert or update of status on public.analyses
  for each row execute function public.enforce_analysis_write_limit();
revoke all on function public.enforce_analysis_write_limit() from public, anon, authenticated;

create or replace function public.enforce_message_batch_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.consume_api_rate_limit('messages.append') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', detail = 'RATE_LIMITED';
  end if;
  return null;
end;
$$;

drop trigger if exists messages_enforce_batch_limit on public.messages;
create trigger messages_enforce_batch_limit
  before insert on public.messages
  for each statement execute function public.enforce_message_batch_limit();
revoke all on function public.enforce_message_batch_limit() from public, anon, authenticated;

revoke all on function public.append_analysis_messages(uuid, jsonb) from public, anon, authenticated;
drop function public.append_analysis_messages(uuid, jsonb);

create function public.append_analysis_messages(
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
     or jsonb_array_length(p_messages) < 1 or jsonb_array_length(p_messages) > 250
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

revoke all on function public.append_analysis_messages(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_analysis_messages(uuid, uuid, jsonb) to authenticated;
