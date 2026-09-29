create extension if not exists pgcrypto;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  platform text not null check (platform in ('whatsapp', 'discord')),
  message_count integer not null default 0 check (message_count >= 0),
  participant_count integer not null default 0 check (participant_count >= 0),
  first_message_at timestamptz,
  last_message_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null,
  sender text not null,
  content text not null default '',
  platform text not null check (platform in ('whatsapp', 'discord')),
  has_attachment boolean not null default false,
  source_id text,
  created_at timestamptz not null default now()
);

create index if not exists analyses_owner_created_idx on public.analyses(owner_id, created_at desc);
create index if not exists analyses_expiry_idx on public.analyses(expires_at);
create index if not exists messages_analysis_time_idx on public.messages(analysis_id, sent_at);
create index if not exists messages_owner_analysis_idx on public.messages(owner_id, analysis_id);

alter table public.analyses enable row level security;
alter table public.messages enable row level security;

create policy "Owners manage their analyses"
  on public.analyses for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage their messages"
  on public.messages for all
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.analyses
      where analyses.id = messages.analysis_id
        and analyses.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.analyses
      where analyses.id = messages.analysis_id
        and analyses.owner_id = auth.uid()
    )
  );

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'loresync-expire-cloud-analyses') then
    perform cron.schedule(
      'loresync-expire-cloud-analyses',
      '0 3 * * *',
      'delete from public.analyses where expires_at <= now()'
    );
  end if;
end
$$;
