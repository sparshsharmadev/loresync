import type { Metadata } from "next";
import { LegalLayout } from "@/app/legal-layout";
import { ImportGuide } from "@/components/import-guide";

export const metadata: Metadata = { title: "How to use LoreSync", description: "A short guide to importing and reading your chat export in LoreSync." };

export default function GuidePage() {
  return <LegalLayout eyebrow="START HERE · 01—04" title="A small guide to looking back." intro="Bring an export, choose where it lives, and read a few clear patterns. Your chat remains yours throughout.">
    <ImportGuide />
    <h2>Before you begin</h2><p>Use an export you have permission to analyze. WhatsApp exports should be plain-text `.txt`; Discord exports should be `.json`. The current file-size limit is 25 MB. Attachments themselves are not imported; the analysis can count markers present in the text.</p>
  </LegalLayout>;
}
