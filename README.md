# LoreSync

**Make room for your story.**

LoreSync turns personal chat exports into private, browsable conversation histories and relationship insights. The web app is the first client; import and analytics code lives in a shared TypeScript package for future desktop and mobile clients.

> **Early development:** WhatsApp text and Discord JSON imports can be analyzed in a browser. Local mode saves the parsed conversation in that browser's IndexedDB. Optional cloud accounts use Supabase Auth and owner-scoped Postgres rows. Cloud mode is inactive until a project is configured. Features and data handling are still changing; do not upload sensitive conversations to an unreviewed deployment.

## Product principles

- The user chooses local or cloud storage for each analysis.
- Local analysis runs in the browser and stays in IndexedDB on that device.
- Cloud mode stores parsed message text and derived analysis under the signed-in user's account; the original export file stays in the browser.
- Cloud rows use PostgreSQL row-level security so a user can access only their own analyses and messages.
- Conversations can involve people other than the uploader. Sharing features will require an explicit invitation and recipient acceptance.
- Initial analytics are deterministic. AI analysis is outside the first release scope.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Local import works without a backend account. WhatsApp exports use `.txt`; Discord exports use `.json`.

## Enable cloud accounts

1. Create a Supabase project.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (never a secret or service-role key).
3. In Supabase, enable the Cron (`pg_cron`) extension. Apply **every** SQL file in `supabase/migrations/` in filename order. The schema evolves across these migrations; stopping after the initial schema can leave cloud imports, message reads, rate limits, or profile features unavailable. Confirm each migration succeeds before deploying the matching app version. The scheduled cleanup job also requires `pg_cron`.
4. Configure email confirmation and the allowed redirect URLs in Supabase Auth for your local and deployed origins.
5. Restart the web app and create an account at `/account`.

Cloud mode parses the export in the browser and then sends normalized message rows to authenticated Next.js API routes, which validate the user's Supabase session before calling narrowly scoped database functions. It does not upload the source export file. The database requires explicit consent, makes only completed analyses readable, and expires completed conversations after one year. Incomplete uploads expire after one day. Confirm the scheduled `pg_cron` job is running and align any backup retention with this promise before production. The account deletion route also requires `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel environment variable; never expose this key to the browser.

The authenticated cloud API can list and delete a user's analyses, and read or search a conversation's messages in pages with `GET /api/analyses/{id}/messages?limit=50&q=...&sender=...&from=...&to=...&cursor=...`. Filters are optional; dates accept ISO 8601 timestamps. Results are ordered newest first. Follow `nextCursor` to continue with the same filters; page sizes can range from 1 to 100. Every request requires the user's Supabase access token, and row-level security restricts results to that user's completed, unexpired analyses.

Daily and hourly activity buckets use UTC in both local and cloud analysis so the same export produces consistent counts on every device.

## Repository layout

```text
apps/web/                 Next.js web client
apps/web/src/app/api/     Authenticated cloud archive API
packages/core/            Shared TypeScript import and analytics logic
supabase/migrations/      Database schema and row-level security policies
```

## Privacy and development

Use synthetic conversations for development. Chat exports, databases, `.env` files, and local deployment state are ignored by Git. Privacy, terms, cookie/storage, and quick-start pages are available in the web app and need review for the actual operator and jurisdiction. Before production, verify all migrations, the cleanup job and backup retention in the deployed Supabase project, configure backups and incident handling, and run a load test using representative chat sizes and the expected concurrency. No capacity target is established by the current automated checks alone.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

Copyright 2026 Sparsh Sharma. Licensed under the [Apache License, Version 2.0](LICENSE).
