# LoreSync brand and intellectual property notes

This document records the project's current brand assets and repository licensing. It is an operational reference, not a trademark search or legal opinion.

## Official identity

- **Product and project name:** LoreSync
- **Official spelling:** `LoreSync` (capital L and S, one word)
- **Official wordmark:** the text `LoreSync` in the Archivo display family, bold, with close tracking. Keep the whole wordmark one color; do not color only `Sync`.
- **Official logo mark:** the inline SVG exported by `BrandMark` in `apps/web/src/components/brand-mark.tsx`. It represents two message paths meeting at a shared signal, with three endpoint dots. Use the component through `Brand` in `apps/web/src/components/brand.tsx` for application lockups.
- **Official lockup:** the red logo mark beside the single-color `LoreSync` wordmark. The lockup links to the LoreSync home page in the web app.
- **Official favicon:** `apps/web/src/app/icon.svg`. Keep it visually consistent with the logo mark.

### Brand colors

| Use | Light theme | Dark theme |
| --- | --- | --- |
| Canvas | Warm paper `#E9E5DA` | Obsidian `#000000` |
| Main type | Ink `#101010` | White `#FFFFFF` |
| Signature accent | Alarm red `#ED1C24` | Alarm red `#ED1C24` |

Use the accent for the logo mark, focus states, and selected details. Keep long-form reading text high contrast. Theme-specific colors belong in the CSS custom properties in `apps/web/src/app/globals.css`.

## Usage rules

- Write the name as `LoreSync`. Use all-caps `LORESYNC` only for compact utility labels where the interface already uses uppercase metadata, not as an alternate logo.
- Use the complete mark and wordmark together for page headers and footers. Do not redraw the mark, change its proportions, recolor individual letters, add a badge or background panel, or apply effects to the lockup.
- Keep the symbol at least the cap height of the wordmark and leave clear space around the lockup equal to the symbol's endpoint-dot diameter.
- Use the wordmark as text when screen-reader context is needed; the SVG mark itself is decorative.
- WhatsApp and Discord names and marks identify supported import formats only. They remain their respective owners' marks; do not imply affiliation or endorsement.

## Code and asset licensing

The repository's `LICENSE` and `README.md` identify the software as Copyright 2026 Sparsh Sharma and license the covered project code under the Apache License, Version 2.0. Preserve the license and copyright notices when redistributing covered code. Apache-2.0 Section 6 does not provide a general license to use the licensor's trade names, trademarks, service marks, or product names; check the actual license text before relying on any exception. See the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html).

This repository does not document a separate public license grant for the LoreSync name, wordmark, or logo. Treat these brand assets as reserved project identity and ask the rights holder for written permission before using them to brand another product, suggest endorsement, or present a fork as the official LoreSync service. No trademark registration status is asserted here.

Third-party packages, fonts, platform names, and any future media retain their own licenses and terms. Check their notices separately; this document does not relicense them.

## Source of truth

The implementation files are the source of truth for the current mark and colors:

- `apps/web/src/components/brand.tsx`
- `apps/web/src/components/brand-mark.tsx`
- `apps/web/src/app/icon.svg`
- `apps/web/src/app/globals.css`
- `LICENSE`

Update this document whenever the canonical name, logo, palette, or repository license changes.
