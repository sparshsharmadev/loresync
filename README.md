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
3. Enable the Supabase Cron (`pg_cron`) extension, then apply `supabase/migrations/202609290001_initial_schema.sql` to the project database. The migration schedules daily deletion of cloud analyses after one year.
4. Configure email confirmation and the allowed redirect URLs in Supabase Auth for your local and deployed origins.
5. Restart the web app and create an account at `/account`.

Cloud mode parses the export in the browser and then sends normalized message rows to Supabase. It does not upload the source export file. Cloud analyses expire after one year and the migration schedules daily deletion. Confirm scheduled job runs and align any backup retention with this promise before production.

## Repository layout

```text
apps/web/                 Next.js web client
packages/core/            Shared TypeScript import and analytics logic
supabase/migrations/      Database schema and row-level security policies
```

## Privacy and development

Use synthetic conversations for development. Chat exports, databases, `.env` files, and local deployment state are ignored by Git. Before production, add automated deletion/retention controls, review upload and account flows, establish a privacy policy and terms, and configure backups and incident handling.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

Copyright 2026 Sparsh Sharma. Licensed under the [Apache License, Version 2.0](LICENSE).
