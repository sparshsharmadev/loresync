-- Atomic per-account limits for authenticated, write-heavy API routes.
-- Authenticated users can execute the function, but cannot select or modify its counters.
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('analyses.create', 'messages.append', 'analysis.complete')),
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action, bucket_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
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

  v_limit := case p_action
    when 'analyses.create' then 10
    when 'messages.append' then 60
    when 'analysis.complete' then 10
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

  -- Opportunistic cleanup is bounded by the indexed bucket_start column.
  delete from public.api_rate_limits
    where user_id = v_user_id and bucket_start < v_bucket - interval '1 day';
  return v_count <= v_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
