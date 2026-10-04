create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 48),
  pronouns text not null default '' check (char_length(pronouns) <= 32),
  about text not null default '' check (char_length(about) <= 140),
  photo text not null default '' check (char_length(photo) <= 500000),
  avatar_style text not null default 'initials' check (avatar_style in ('initials','orbit','monogram')),
  avatar_tone text not null default 'paper' check (avatar_tone in ('paper','night','red','moss')),
  accent text not null default 'signal' check (accent in ('signal','blue','moss','amber','plum')),
  density text not null default 'balanced' check (density in ('roomy','balanced','compact')),
  type_scale text not null default 'standard' check (type_scale in ('small','standard','large')),
  reduced_motion boolean not null default false,
  default_storage text not null default 'local' check (default_storage in ('local','cloud')),
  theme text not null default 'system' check (theme in ('system','light','dark')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
