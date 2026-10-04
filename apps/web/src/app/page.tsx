import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-provider";
import { SiteFooter } from "@/components/site-footer";

function ThreadFigure() {
  return (
    <figure className="thread-figure">
      <div className="thread-topline"><span><i /> AN ILLUSTRATIVE CHAT</span><span>MESSAGE RHYTHM / 01</span></div>
      <svg viewBox="0 0 760 370" role="img" aria-label="Illustration of two voices crossing a shared timeline">
        <defs><pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" className="thread-grid" /></pattern></defs>
        <rect x="16" y="18" width="728" height="316" fill="url(#grid)" />
        <path d="M36 285H731M36 93H731M36 188H731" className="thread-guide" />
        <path d="M38 227C72 227 78 189 110 189S153 251 183 251 224 153 259 153 306 208 334 208 374 112 408 112 452 236 481 236 525 171 554 171 595 221 625 221 681 133 727 133" className="thread-line thread-a" />
        <path d="M38 151C70 151 78 218 109 218s40-92 73-92 41 67 76 67 44 71 75 71 37-92 74-92 42-37 73-37 41 115 72 115 41-54 73-54 55 46 102 46" className="thread-line thread-b" />
        <g className="thread-nodes-a"><circle cx="110" cy="189" r="5"/><circle cx="183" cy="251" r="4"/><circle cx="259" cy="153" r="5"/><circle cx="334" cy="208" r="4"/><circle cx="408" cy="112" r="5"/><circle cx="481" cy="236" r="4"/><circle cx="554" cy="171" r="5"/><circle cx="625" cy="221" r="4"/><circle cx="727" cy="133" r="5"/></g>
        <g className="thread-nodes-b"><circle cx="109" cy="218" r="4"/><circle cx="182" cy="126" r="5"/><circle cx="258" cy="193" r="4"/><circle cx="333" cy="264" r="5"/><circle cx="407" cy="172" r="4"/><circle cx="480" cy="135" r="5"/><circle cx="552" cy="250" r="4"/><circle cx="625" cy="196" r="5"/><circle cx="727" cy="242" r="4"/></g>
        <g className="thread-captions"><text x="38" y="311">A CHAT TAKES ITS OWN COURSE</text><text x="730" y="311" textAnchor="end">TIME →</text><text x="40" y="78">VOICE A</text><text x="40" y="174">VOICE B</text></g>
      </svg>
      <figcaption><span><i className="thread-key-a" /> TWO VOICES</span><span><i className="thread-key-b" /> ONE SHARED TIMELINE</span><span>ILLUSTRATION — NOT REAL CHAT DATA</span></figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a></nav>
        <div className="landing-header-actions"><ThemeToggle /><Link className="landing-open" href="/account">Sign in <span>↗</span></Link></div>
      </header>

      <section className="landing-hero">
        <div className="landing-kicker"><span>CONVERSATIONS, WITH CONTEXT</span><span>WHATSAPP · DISCORD</span></div>
        <div className="landing-grid">
          <div className="landing-copy">
            <div className="landing-detonation">
              <p className="landing-eyebrow">A BETTER WAY TO LOOK BACK</p>
              <h1>Who was there.<br />When you spoke.<br /><em>How it changed.</em></h1>
            </div>
            <p className="landing-lede">A private, visual reading of your chat history: its timing, participation, and the days you shared.</p>
            <div className="landing-actions"><Link className="landing-button" href="/workspace/import">Analyze on this device <span>↗</span></Link><span>Start locally without an account. Sign in only for cloud sync.</span></div>
          </div>
          <ThreadFigure />
        </div>
        <div className="landing-foot"><span>YOUR CHAT, ON YOUR TERMS.</span><span>NO SENTIMENT SCORES. NO RELATIONSHIP VERDICTS.</span></div>
      </section>

      <section className="landing-method" id="how-it-works">
        <div className="method-intro">
          <p className="landing-eyebrow">THREE WAYS INTO THE SAME CHAT</p>
          <h2>Details you can see.<br /><em>Patterns you can follow.</em></h2>
          <p>Every view comes from the export itself: message dates, participants, and activity over time.</p>
        </div>
        <div className="method-rows">
          <article><span>01</span><h3>When you talked</h3><p>Follow daily message activity across the life of a conversation.</p><b>↗</b></article>
          <article><span>02</span><h3>Who showed up</h3><p>Compare participant message counts and see how the conversation is shared.</p><b>↗</b></article>
          <article><span>03</span><h3>How long it lasted</h3><p>See the date range, active days, and attachment markers in the export.</p><b>↗</b></article>
        </div>
      </section>

      <section className="landing-privacy" id="privacy">
        <div className="privacy-label"><span className="privacy-glyph">⌂</span><span>YOUR CHAT IS PERSONAL</span></div>
        <div className="privacy-copy"><h2>Your export<br /><em>stays on your device.</em></h2><p>Analysis happens in your browser. Keep parsed messages on this device, or choose cloud storage for an account-backed archive. The original export file stays in your browser.</p><Link href="/guide">See how it works <span>↗</span></Link></div>
        <div className="privacy-facts"><article><span>01 / START LOCAL</span><p>Try an analysis in this browser without creating an account.</p></article><article><span>02 / YOUR CHOICE</span><p>Choose device storage or cloud storage for each conversation. Delete it whenever you like.</p></article></div>
      </section>

      <SiteFooter />
    </main>
  );
}
