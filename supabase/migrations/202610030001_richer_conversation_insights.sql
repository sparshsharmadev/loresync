-- Add deterministic timing and writing-pattern insights to cloud summaries.
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
  v_average_words numeric;
  v_median_reply integer;
  v_reply_count integer;
  v_quick_reply_percent integer;
  v_participants jsonb;
  v_daily jsonb;
  v_hourly jsonb;
  v_weekdays jsonb;
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
         count(*) filter (where has_attachment)::integer,
         coalesce(avg(array_length(regexp_split_to_array(btrim(content), '\s+'), 1))
           filter (where btrim(content) <> ''), 0)
    into v_count, v_participant_count, v_first, v_last, v_active_days, v_attachments, v_average_words
    from public.messages
    where analysis_id = p_analysis_id and owner_id = v_owner;
  if v_count = 0 then
    raise exception 'Cannot complete an empty analysis' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', participant.sender, 'count', participant.message_count)
      order by participant.message_count desc, participant.sender), '[]'::jsonb)
    into v_participants
  from (
    select sender, count(*)::integer as message_count
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
    group by sender
  ) as participant;

  select coalesce(jsonb_agg(jsonb_build_object('date', to_char(activity.day_utc, 'YYYY-MM-DD'), 'count', activity.message_count)
      order by activity.day_utc), '[]'::jsonb)
    into v_daily
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

  select coalesce(jsonb_agg(coalesce(activity.message_count, 0) order by days.day), '[]'::jsonb)
    into v_weekdays
  from generate_series(0, 6) as days(day)
  left join (
    select (extract(isodow from sent_at at time zone 'UTC')::integer - 1) as day,
           count(*)::integer as message_count
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
    group by (extract(isodow from sent_at at time zone 'UTC')::integer - 1)
  ) as activity on activity.day = days.day;

  with ordered as (
    select sent_at, sender, lag(sent_at) over (order by sent_at, id) as previous_at,
           lag(sender) over (order by sent_at, id) as previous_sender
    from public.messages where analysis_id = p_analysis_id and owner_id = v_owner
  ), replies as (
    select extract(epoch from (sent_at - previous_at)) / 60.0 as minutes
    from ordered
    where previous_at is not null and sender <> previous_sender
      and sent_at >= previous_at and sent_at <= previous_at + interval '24 hours'
  )
  select count(*)::integer,
         round(percentile_cont(0.5) within group (order by minutes))::integer,
         round(100.0 * count(*) filter (where minutes <= 60) / nullif(count(*), 0))::integer
    into v_reply_count, v_median_reply, v_quick_reply_percent
  from replies;

  v_summary := jsonb_build_object(
    'messageCount', v_count,
    'participantCount', v_participant_count,
    'participants', v_participants,
    'firstMessageAt', v_first,
    'lastMessageAt', v_last,
    'activeDays', v_active_days,
    'dailyActivity', v_daily,
    'hourlyActivity', v_hourly,
    'weekdayActivity', v_weekdays,
    'averageMessageWords', round(v_average_words, 1),
    'medianReplyMinutes', v_median_reply,
    'replyCount', v_reply_count,
    'quickReplyPercent', v_quick_reply_percent,
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

-- Existing cloud archives receive the expanded summary fields as well.
with ready as (
  select id from public.analyses where status = 'ready'
), word_stats as (
  select analysis_id,
         coalesce(avg(array_length(regexp_split_to_array(btrim(content), '\s+'), 1)
           filter (where btrim(content) <> ''), 0) as average_words
  from public.messages
  group by analysis_id
), weekday_activity as (
  select ready.id as analysis_id,
         jsonb_agg(coalesce(counts.message_count, 0) order by days.day) as activity
  from ready
  cross join generate_series(0, 6) as days(day)
  left join (
    select analysis_id, extract(isodow from sent_at at time zone 'UTC')::integer - 1 as day,
           count(*)::integer as message_count
    from public.messages group by analysis_id, extract(isodow from sent_at at time zone 'UTC')::integer - 1
  ) as counts on counts.analysis_id = ready.id and counts.day = days.day
  group by ready.id
), reply_rows as (
  select messages.analysis_id, messages.sent_at, messages.sender,
         lag(messages.sent_at) over (partition by messages.analysis_id order by messages.sent_at, messages.id) as previous_at,
         lag(messages.sender) over (partition by messages.analysis_id order by messages.sent_at, messages.id) as previous_sender
  from public.messages as messages
  join ready on ready.id = messages.analysis_id
), replies as (
  select analysis_id, extract(epoch from (sent_at - previous_at)) / 60.0 as minutes
  from reply_rows
  where previous_at is not null and sender <> previous_sender
    and sent_at >= previous_at and sent_at <= previous_at + interval '24 hours'
), reply_stats as (
  select analysis_id, count(*)::integer as reply_count,
         round(percentile_cont(0.5) within group (order by minutes))::integer as median_reply,
         round(100.0 * count(*) filter (where minutes <= 60) / nullif(count(*), 0))::integer as quick_reply_percent
  from replies group by analysis_id
), metrics as (
  select ready.id as analysis_id,
         coalesce(weekday_activity.activity, '[0,0,0,0,0,0,0]'::jsonb) as weekday_activity,
         coalesce(word_stats.average_words, 0) as average_words,
         reply_stats.median_reply,
         coalesce(reply_stats.reply_count, 0) as reply_count,
         reply_stats.quick_reply_percent
  from ready
  left join weekday_activity on weekday_activity.analysis_id = ready.id
  left join word_stats on word_stats.analysis_id = ready.id
  left join reply_stats on reply_stats.analysis_id = ready.id
)
update public.analyses as analyses set summary = coalesce(analyses.summary, '{}'::jsonb) || jsonb_build_object(
  'weekdayActivity', metrics.weekday_activity,
  'averageMessageWords', round(metrics.average_words, 1),
  'medianReplyMinutes', metrics.median_reply,
  'replyCount', metrics.reply_count,
  'quickReplyPercent', metrics.quick_reply_percent
)
from metrics
where analyses.id = metrics.analysis_id;
