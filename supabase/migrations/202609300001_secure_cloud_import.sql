-- Make cloud imports transactional at the application level, owner-scoped,
-- consent-recorded, and automatically expiring. Existing rows remain readable.

alter table public.analyses
  add column if not exists status text not null default 'ready',
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

alter table public.analyses drop constraint if exists analyses_status_check;
alter table public.analyses
  add constraint analyses_status_check check (status in ('uploading', 'ready'));

drop policy if exists "Owners manage their analyses" on public.analyses;
drop policy if exists "Owners manage their messages" on public.messages;
drop policy if exists "Owners read ready analyses" on public.analyses;
drop policy if exists "Owners read ready messages" on public.messages;

alter table public.analyses enable row level security;
alter table public.messages enable row level security;

revoke all on table public.analyses from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
grant select on table public.analyses to authenticated;
grant select on table public.messages to authenticated;

create policy "Owners read ready analyses"
  on public.analyses for select to authenticated
  using (auth.uid() = owner_id and status = 'ready' and expires_at > now());

create policy "Owners read ready messages"
  on public.messages for select to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.analyses
      where analyses.id = messages.analysis_id
        and analyses.owner_id = auth.uid()
        and analyses.status = 'ready'
        and analyses.expires_at > now()
    )
  );

create or replace function public.begin_analysis(
  p_title text,
  p_platform text,
  p_consent_accepted boolean,
  p_consent_version text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_consent_accepted is distinct from true then
    raise exception 'Cloud storage consent is required' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'Invalid title' using errcode = '22023';
  end if;
  if p_platform not in ('whatsapp', 'discord') then
    raise exception 'Unsupported platform' using errcode = '22023';
  end if;
  if p_consent_version is distinct from 'cloud-v1' then
    raise exception 'Unsupported consent version' using errcode = '22023';
  end if;

  insert into public.analyses (
    owner_id, title, platform, status, consented_at, consent_version, expires_at
  ) values (
    v_owner, btrim(p_title), p_platform, 'uploading', clock_timestamp(), p_consent_version,
    clock_timestamp() + interval '1 day'
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.append_analysis_messages(
  p_analysis_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := auth.uid();
  v_platform text;
  v_status text;
  v_message jsonb;
  v_timestamp timestamptz;
  v_sender text;
  v_content text;
  v_inserted integer := 0;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_messages is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) < 1 or jsonb_array_length(p_messages) > 250 then
    raise exception 'Invalid message batch size' using errcode = '22023';
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

  for v_message in select value from jsonb_array_elements(p_messages)
  loop
    if jsonb_typeof(v_message) <> 'object'
       or jsonb_typeof(v_message->'timestamp') <> 'string'
       or jsonb_typeof(v_message->'sender') <> 'string'
       or jsonb_typeof(v_message->'content') <> 'string'
       or jsonb_typeof(v_message->'hasAttachment') <> 'boolean' then
      raise exception 'Invalid message shape' using errcode = '22023';
    end if;
    v_timestamp := (v_message->>'timestamp')::timestamptz;
    v_sender := btrim(v_message->>'sender');
    v_content := v_message->>'content';
    if v_sender = '' or char_length(v_sender) > 200 or char_length(v_content) > 100000 then
      raise exception 'Message field exceeds its limit' using errcode = '22023';
    end if;
    if jsonb_typeof(v_message->'rawId') not in ('string', 'null')
       or char_length(coalesce(v_message->>'rawId', '')) > 200 then
      raise exception 'Invalid source identifier' using errcode = '22023';
    end if;

    insert into public.messages (
      analysis_id, owner_id, sent_at, sender, content, platform, has_attachment, source_id
    ) values (
      p_analysis_id, v_owner, v_timestamp, v_sender, v_content, v_platform,
      (v_message->>'hasAttachment')::boolean, nullif(v_message->>'rawId', '')
    );
    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end;
$$;

create or replace function public.complete_analysis(p_analysis_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
  v_count integer;
  v_participant_count integer;
  v_first timestamptz;
  v_last timestamptz;
  v_active_days integer;
  v_attachments integer;
  v_participants jsonb;
  v_daily jsonb;
  v_hourly jsonb;
  v_summary jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select status into v_status from public.analyses
    where id = p_analysis_id and owner_id = v_owner for update;
  if not found or v_status <> 'uploading' then
    raise exception 'Analysis unavailable' using errcode = 'P0002';
  end if;

  select count(*)::integer, count(distinct sender)::integer, min(sent_at), max(sent_at),
         count(distinct (sent_at at time zone 'UTC')::date)::integer,
         count(*) filter (where has_attachment)::integer
    into v_count, v_participant_count, v_first, v_last, v_active_days, v_attachments
    from public.messages
    where analysis_id = p_analysis_id and owner_id = v_owner;
  if v_count = 0 then
    raise exception 'Cannot complete an empty analysis' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('name', participant.sender, 'count', participant.message_count)
      order by participant.message_count desc, participant.sender), '[]'::jsonb
  ) into v_participants
  from (
    select sender, count(*)::integer as message_count
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
    group by sender
  ) as participant;

  select coalesce(
    jsonb_agg(jsonb_build_object('date', to_char(activity.day_utc, 'YYYY-MM-DD'), 'count', activity.message_count)
      order by activity.day_utc), '[]'::jsonb
  ) into v_daily
  from (
    select (sent_at at time zone 'UTC')::date as day_utc, count(*)::integer as message_count
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
    group by (sent_at at time zone 'UTC')::date
  ) as activity;

  select coalesce(jsonb_agg(coalesce(activity.message_count, 0) order by hours.hour), '[]'::jsonb)
    into v_hourly
  from generate_series(0, 23) as hours(hour)
  left join (
    select extract(hour from sent_at at time zone 'UTC')::integer as hour, count(*)::integer as message_count
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
    group by extract(hour from sent_at at time zone 'UTC')::integer
  ) as activity on activity.hour = hours.hour;

  v_summary := jsonb_build_object(
    'messageCount', v_count,
    'participantCount', v_participant_count,
    'participants', v_participants,
    'firstMessageAt', v_first,
    'lastMessageAt', v_last,
    'activeDays', v_active_days,
    'dailyActivity', v_daily,
    'hourlyActivity', v_hourly,
    'attachmentCount', v_attachments
  );

  update public.analyses set
    message_count = v_count,
    participant_count = v_participant_count,
    first_message_at = v_first,
    last_message_at = v_last,
    summary = v_summary,
    status = 'ready',
    expires_at = clock_timestamp() + interval '1 year'
  where id = p_analysis_id and owner_id = v_owner;
  return v_summary;
end;
$$;

create or replace function public.delete_own_analysis(p_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  delete from public.analyses where id = p_analysis_id and owner_id = v_owner;
  return found;
end;
$$;

revoke all on function public.begin_analysis(text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.append_analysis_messages(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_analysis(uuid) from public, anon, authenticated;
revoke all on function public.delete_own_analysis(uuid) from public, anon, authenticated;
grant execute on function public.begin_analysis(text, text, boolean, text) to authenticated;
grant execute on function public.append_analysis_messages(uuid, jsonb) to authenticated;
grant execute on function public.complete_analysis(uuid) to authenticated;
grant execute on function public.delete_own_analysis(uuid) to authenticated;

create extension if not exists pg_cron;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('loresync-expire-cloud-analyses', 'loresync-cloud-retention')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'loresync-cloud-retention',
    '0 3 * * *',
    $job$delete from public.analyses
         where expires_at <= now()
            or (status = 'uploading' and created_at <= now() - interval '1 day')$job$
  );
end
$$;
