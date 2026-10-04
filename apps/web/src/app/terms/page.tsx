import type { Metadata } from "next";
import { LegalLayout } from "@/app/legal-layout";

export const metadata: Metadata = {
  title: "Terms · LoreSync",
  description: "Terms for using the early access LoreSync conversation analysis app.",
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms", title: "Terms · LoreSync", description: "Terms and expectations for using the early access LoreSync app." },
};

export default function TermsPage() {
  return <LegalLayout eyebrow="A FEW CLEAR EXPECTATIONS" title="Terms of use." intro="These terms cover use of the LoreSync web app in its current early-access form. A deployment may provide additional terms that apply to it.">
    <h2>Using LoreSync</h2><p>You may use LoreSync only in compliance with applicable law and these terms. You are responsible for your account, device, and activity performed through them. Keep your sign-in details private and tell the deployment operator if you believe an account has been compromised.</p>
    <h2>Your conversations</h2><p>You keep your rights in chat exports and content you provide. You confirm that you have the rights and permissions needed to import and analyze that material, including respecting the privacy and rights of other participants. Do not upload unlawful content, data you are not authorized to use, or content that violates another person’s rights.</p>
    <h2>Local and cloud storage</h2><p>Local analyses are stored in the browser on your device and can be removed from the workspace or by clearing site data. Cloud storage is optional, requires sign-in and a separate confirmation at import, and stores parsed messages and derived analysis rather than the original export file. Cloud analyses are intended to expire after one year, but the deletion schedule depends on the deployment’s configuration. You can request deletion from the workspace.</p>
    <h2>Early access and availability</h2><p>The app is under active development. Features, formats, and interfaces may change, and service availability is not guaranteed. Keep your own copy of any source material you need. Analyses are descriptive summaries of exported data; they are not advice, a complete record, or an assessment of any relationship.</p>
    <h2>Acceptable use</h2><p>Do not interfere with the service, attempt unauthorized access, abuse another person’s account, or use the app to violate the law. We may restrict access to protect the service or users.</p>
    <h2>Warranty and liability</h2><p>To the extent permitted by applicable law, LoreSync is provided on an “as available” basis without warranties that it will be uninterrupted, error-free, or suitable for a particular purpose. Nothing in these terms limits rights or remedies that cannot lawfully be limited. To the extent permitted by law, the service operator is not liable for indirect or consequential losses arising from use of an early-access service.</p>
    <h2>Changes</h2><p>These terms may be updated as LoreSync develops. Continued use after updated terms are published means the updated terms apply where allowed by law. If you do not agree, stop using the service and delete your saved analyses.</p>
    <p className="legal-note">This is an early-access product summary, not a substitute for deployment-specific legal terms. The operator and governing-law details must be supplied for each public deployment.</p>
  </LegalLayout>;
}
