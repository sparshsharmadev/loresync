import type { Metadata } from "next";
import { LegalLayout } from "@/app/legal-layout";

export const metadata: Metadata = {
  title: "Cookies & browser storage · LoreSync",
  description: "A clear explanation of cookies and browser storage used by LoreSync.",
  alternates: { canonical: "/cookies" },
  openGraph: { url: "/cookies", title: "Cookies & browser storage · LoreSync", description: "Learn how LoreSync uses browser storage and authentication cookies." },
};

export default function CookiesPage() {
  return <LegalLayout eyebrow="NO MYSTERY MEAT STORAGE" title="Cookies & browser storage." intro="LoreSync currently relies on browser storage for core features. The app source does not include advertising or analytics tags that set tracking cookies.">
    <h2>Cookies</h2><p>The current app does not intentionally set advertising or analytics cookies. Authentication is provided by Supabase Auth, which persists the session in browser storage through its client library. A hosting provider or a future deployment may use strictly necessary cookies for security or delivery; check that deployment’s notice for provider-specific details.</p>
    <h2>Other browser storage</h2><ul><li><b>IndexedDB:</b> stores local conversation analyses and parsed messages you choose to keep on this device.</li><li><b>Local storage:</b> keeps appearance and profile preferences and may hold the persisted sign-in session for Supabase Auth.</li><li><b>Browser memory:</b> holds the selected export while it is being parsed. The source export is not uploaded to the cloud archive.</li></ul>
    <h2>Your controls</h2><p>Delete a local conversation from the workspace, sign out to end your session, or use your browser settings to clear LoreSync site data. Clearing site data may also sign you out and remove local conversations and preferences. Cloud analyses are managed separately in the workspace and expire under the retention schedule described in the privacy notice.</p>
    <h2>Future changes</h2><p>If optional analytics, advertising, or other non-essential tracking is added, this page and the product’s controls should be updated before it is used.</p>
  </LegalLayout>;
}
