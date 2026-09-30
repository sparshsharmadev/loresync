-- Match the archive and message queries' owner filters, stable order, and substring search.
create index if not exists analyses_owner_created_id_idx
  on public.analyses (owner_id, created_at desc, id desc);

drop index if exists public.analyses_owner_created_idx;

create index if not exists messages_analysis_time_id_idx
  on public.messages (analysis_id, sent_at desc, id desc);

drop index if exists public.messages_analysis_time_idx;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index if not exists messages_content_trgm_idx
  on public.messages using gin (content extensions.gin_trgm_ops);
