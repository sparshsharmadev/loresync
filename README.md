# LoreSync

**Turn chat history into insights, stories, and shared memories.**

LoreSync is an open-source conversation intelligence and memory platform. The long-term goal is to help people understand their conversations through relationship analytics, interactive timelines, memorable moments, and story-like recaps.

> **Project status: early development.** This public repository currently contains the project overview and license while the prototype is reviewed for release. Signup, account-based uploads, cloud processing, local-only analysis, and shared workspaces are not implemented yet. Do not use a hosted instance with sensitive conversations.

## What exists today

An unpublished local prototype has WhatsApp text and Discord JSON parsers, a SQLite-backed analytics API, and a Flask interface for dashboards, search, conversation replay, bookmarks, and milestones. It was built around one local dataset and is being reviewed before any source is added to this public repository.

Personal chat exports, populated databases, deployment credentials, and real conversation examples are intentionally excluded from this public repository.

## Product direction

- Rebuild the web experience for individual accounts and user-owned analyses.
- Support a browser-only mode where chat content stays on the user's device, alongside an optional cloud mode.
- Add explicit invitations and recipient acceptance before sharing a cloud analysis.
- Keep analytics deterministic in the first public product release; AI features are not planned for that release.
- Prepare shared application foundations for future desktop and mobile clients.
- Explore iMessage and Telegram imports after the current WhatsApp and Discord import paths are productized.

## Development

The existing prototype is not yet packaged for clean, public setup. Reproducible setup instructions and synthetic fixtures will be added as the multi-user application is built. No application source or real chat data is included in this repository yet.

## Privacy

Chat exports can contain highly personal information about multiple people. Keep exports and generated databases out of Git, use synthetic data for development, and review any deployment's data handling before uploading conversations. See `.gitignore` for files excluded from local version control.

## Contributing

LoreSync is being prepared for public development. Please open an issue to discuss substantial product or architecture changes before starting a large contribution. Contributions are subject to the license below.

## License

Copyright 2026 Sparsh Sharma. Licensed under the [Apache License, Version 2.0](LICENSE).
