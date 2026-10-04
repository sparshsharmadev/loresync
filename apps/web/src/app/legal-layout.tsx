import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-provider";
import { SiteFooter } from "@/components/site-footer";

export function LegalLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="legal-page">
    <header className="legal-header"><Brand className="wordmark" markClassName="archive-mark" /><nav><Link href="/guide">How to use</Link><ThemeToggle /><Link className="legal-back" href="/workspace">Workspace ↗</Link></nav></header>
    <div className="legal-shell"><aside className="legal-index"><span>LORESYNC / FIELD GUIDE</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies & storage</Link><Link href="/guide">How to use</Link><p>Early access · Updated October 1, 2026</p></aside><article className="legal-document"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="legal-intro">{intro}</p><div className="legal-body">{children}</div><p className="legal-disclaimer">LoreSync is in early development. This page describes the product as it currently works and should be reviewed for your jurisdiction before public launch.</p></article></div>
    <SiteFooter compact />
  </main>;
}
