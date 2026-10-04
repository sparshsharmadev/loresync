import type { Metadata } from "next";
import { LegalLayout } from "@/app/legal-layout";

export const metadata: Metadata = {
  title: "Privacy · LoreSync",
  description: "How LoreSync handles chat exports, account details, and conversation analyses.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy", title: "Privacy · LoreSync", description: "Learn what LoreSync processes, where analyses are stored, and how to delete them." },
};

export default function PrivacyPage() {
  return <LegalLayout eyebrow="YOUR DATA, IN PLAIN LANGUAGE" title="Privacy, with the details left in." intro="LoreSync helps you look back at your own chat exports. This notice explains what the current app processes, where it is stored, and what choices you have.">
    <p><b>In brief:</b> Local analyses are processed in your browser and saved in that browser’s IndexedDB. If cloud mode is configured and you choose it, parsed messages and analysis are sent to your account’s database after you confirm. The original export file is not sent to LoreSync’s cloud database.</p>
    <h2>What the app handles</h2><p>When you import a WhatsApp text export or Discord JSON export, your browser parses it and creates message records and summaries such as message counts, participants, dates, and activity. The app does not run sentiment scoring or generate relationship judgments.</p>
    <ul><li><b>Local mode:</b> the parsed messages and analysis stay in IndexedDB on the device and browser where you imported them. Deleting browser site data can remove them.</li><li><b>Cloud mode:</b> after explicit confirmation, parsed message rows and analysis are stored under your signed-in account using Supabase and PostgreSQL row-level security. The source export remains in your browser. Completed cloud analyses expire after one year; unfinished imports expire after one day, subject to the configured scheduled deletion job.</li><li><b>Account and profile:</b> Supabase Auth handles sign-in. Profile information and preferences may be stored in browser local storage and, if cloud profile sync is configured, in your account database.</li></ul>
    <h2>Why data is used</h2><p>Conversation data is used to create the views you request, display saved analyses, and support deletion and account features. LoreSync does not currently use chat content for advertising or AI model training.</p>
    <h2>Who can access it</h2><p>In local mode, anyone who can use your unlocked device and browser profile may be able to access local data. In cloud mode, access is limited by the signed-in account and database access policies. Infrastructure providers process data as needed to run the service. Do not upload sensitive exports to an unreviewed deployment.</p>
    <h2>Your choices</h2><p>You choose local or cloud storage for each import. You can delete a local analysis from the workspace or a cloud analysis from your archive. You can also remove locally stored data by clearing the browser’s site data. Account deletion and provider-side backups may require additional handling in a deployed service; review that deployment’s instructions.</p>
    <h2>Retention and security</h2><p>Cloud analyses are scheduled to expire after one year, and incomplete uploads after one day. This depends on the deployment’s database migrations and scheduled job being configured and running. Account profile data is retained while the account remains active unless removed. No online service can promise perfect security; keep exports private and use a device you trust.</p>
    <h2>Children and other people in your chats</h2><p>Exports can contain personal information about people other than you. Import only data you have the right to use and consider the privacy of everyone represented in it. LoreSync is not designed for children to create accounts.</p>
    <h2>Changes and questions</h2><p>This notice may change as the product develops. For a deployment-specific privacy contact, use the contact channel published by that deployment’s operator. This early-access build does not yet provide a universal support address.</p>
  </LegalLayout>;
}
