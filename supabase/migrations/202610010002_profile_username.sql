alter table public.profiles
  add column if not exists username text not null default '' check (char_length(username) <= 24);

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username = '' or username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists profiles_username_unique_lower
  on public.profiles (lower(username))
  where username <> '';
