import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`site-footer ${compact ? "site-footer-compact" : ""}`}>
      <div className="site-footer-main">
        <div className="site-footer-brand"><Brand className="wordmark" markClassName="archive-mark" /><p>A quieter way to look back at the conversations that made a life.</p></div>
        <nav className="site-footer-links" aria-label="Product and legal">
          <div><span>LEARN</span><Link href="/guide">How to use LoreSync</Link><Link href="/account">Account & sign-in</Link></div>
          <div><span>YOUR RIGHTS</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies & browser storage</Link></div>
        </nav>
      </div>
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} LoreSync · Early access</span><span>Built for the chats that matter.</span></div>
    </footer>
  );
}
