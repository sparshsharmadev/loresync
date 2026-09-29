"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { cloudAvailable, getSupabase } from "@/lib/supabase";

function AccountMark() {
  return <span className="archive-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 5v21h17"/><path d="M14 5v15h11"/><circle cx="24.5" cy="7.5" r="2"/></svg></span>;
}

export default function AccountPage() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloudAvailable) return;
    getSupabase().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } });
        if (error) throw error;
        setStatus("A confirmation link is on its way. Follow it to open your cloud archive.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUserEmail(data.user.email ?? email);
        setStatus("You’re signed in. Your cloud archive is ready.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setUserEmail(null);
    setStatus("You’ve signed out.");
  }

  return (
    <main className="account-shell">
      <header className="account-topbar"><Link href="/" className="wordmark"><AccountMark /><span>lore<span>sync</span></span></Link><Link href="/" className="return-archive">RETURN TO THE ARCHIVE <b>↗</b></Link></header>
      <div className="account-composition">
        <section className="account-story">
          <div className="account-orbit" aria-hidden="true"><i /><i /><i /><i /><span /></div>
          <div className="chapter-line"><span>THE KEEPING PLACE</span><i /><span>02 / 02</span></div>
          <h1>Some things<br />deserve a <em>longer<br />memory.</em></h1>
          <p>A cloud archive lets your conversations travel with you. You choose what to keep, and when it leaves.</p>
          <div className="account-story-rule" />
          <span className="account-story-note">ONE YEAR, THEN LET GO.</span>
        </section>

        <section className="account-panel">
          <div className="panel-overline"><span>YOUR CLOUD ARCHIVE</span><span className="secure-seal">✳ PRIVATE</span></div>
          <h2>{userEmail ? "Welcome back." : mode === "signup" ? "Make a little room." : "Return to your archive."}</h2>
          <p className="account-intro">{userEmail ? `Signed in as ${userEmail}.` : "Keep a conversation close across the places you use LoreSync."}</p>

          {!cloudAvailable ? (
            <div className="account-setup">
              <span className="setup-index">NEXT / CONFIGURATION</span>
              <h3>The cloud door isn’t connected yet.</h3>
              <p>Set up a Supabase project, then copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code> and add its URL and publishable key. Apply the database migration before enabling cloud saves.</p>
              <Link href="/" className="account-submit">Keep exploring locally <b>↗</b></Link>
            </div>
          ) : userEmail ? (
            <div className="signed-in-state"><div className="signed-avatar">{userEmail[0]?.toUpperCase()}</div><p>Your archive is open.<br /><span>Cloud conversations are kept for one year.</span></p><Link href="/" className="account-submit">Go to workspace <b>↗</b></Link><button className="quiet-button" onClick={signOut}>Sign out</button></div>
          ) : (
            <>
              <div className="account-tabs" role="tablist" aria-label="Account action"><button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>CREATE ACCOUNT</button><button className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")}>SIGN IN</button></div>
              <form className="account-form" onSubmit={submit}>
                <label>EMAIL ADDRESS<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
                <label>PASSWORD<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} placeholder="At least 8 characters" required /></label>
                <button className="account-submit" disabled={busy}>{busy ? "ONE MOMENT…" : mode === "signup" ? "CREATE YOUR ARCHIVE" : "SIGN IN TO YOUR ARCHIVE"}<b>↗</b></button>
              </form>
            </>
          )}

          {status && <p className="account-status" role="status">{status}</p>}
          <div className="account-assurance"><span>✳</span><p>Parsed messages stay yours. Cloud archives expire after one year, and you can erase them sooner.</p></div>
        </section>
      </div>
      <footer className="account-footer"><span>LORESYNC <i>·</i> PRIVATE MEMORY ARCHIVE</span><span>MADE FOR WHAT STAYS WITH YOU</span></footer>
    </main>
  );
}
