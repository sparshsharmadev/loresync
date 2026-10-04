"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-provider";
import { cloudAvailable, getSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function continueToApp() {
    const requested = new URLSearchParams(window.location.search).get("next");
    const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/workspace";
    router.replace(destination);
  }

  useEffect(() => {
    // Read the URL after hydration so the server and browser render the same initial form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecovering(new URLSearchParams(window.location.search).get("recovery") === "1");
    if (!cloudAvailable) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setAccountUsername(String(data.user?.user_metadata?.username ?? ""));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAccountUsername(String(session?.user.user_metadata?.username ?? ""));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (recovering) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovering(false);
        router.replace("/account");
        setStatus("Password updated. You can use it next time you sign in.");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account`, data: { username: username.toLowerCase(), display_name: "" } } });
        if (error) throw error;
        if (data.session) {
          setUserEmail(data.user?.email ?? email);
          setStatus("Your account is ready. Opening your private workspace…");
          continueToApp();
        } else {
          setStatus("A confirmation link is on its way. Follow it to open your cloud archive.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUserEmail(data.user.email ?? email);
        setAccountUsername(String(data.user.user_metadata?.username ?? username));
        setStatus("You’re signed in. Opening your workspace…");
        continueToApp();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!email) { setStatus("Enter your email first and we’ll send a reset link."); return; }
    setBusy(true); setStatus("");
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account?recovery=1` });
      if (error) throw error;
      setStatus("If an account exists for that email, a password reset link is on its way.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send the reset link. Try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      setUserEmail(null);
      setStatus("You’ve signed out.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

  return (
    <main className="account-shell">
      <header className="account-topbar"><Brand className="wordmark" markClassName="archive-mark" /><div className="account-topbar-actions"><ThemeToggle /><Link href="/" className="return-archive">RETURN TO THE ARCHIVE <b>↗</b></Link></div></header>
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
          <h2>{recovering ? "Choose a new password." : userEmail ? "Welcome back." : mode === "signup" ? "Make a little room." : "Return to your archive."}</h2>
          <p className="account-intro">{userEmail ? `Signed in as ${userEmail}.` : recovering ? "Choose a strong password for your account." : "Sign in to your private workspace and pick up where you left off."}</p>

          {!cloudAvailable ? (
            <div className="account-setup">
              <span className="setup-index">NEXT / CONFIGURATION</span>
              <h3>The cloud door isn’t connected yet.</h3>
              <p>Set up a Supabase project, then copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code> and add its URL and publishable key. Apply the database migration before enabling cloud saves.</p>
              <p className="account-setup-note">Workspace access is paused until cloud sign-in is configured.</p>
            </div>
          ) : recovering ? (
            <form className="account-form recovery-form" onSubmit={submit}>
              <label>NEW PASSWORD<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "HIDE" : "SHOW"}</button></span></label>
              <button className="account-submit" disabled={busy}>{busy ? "SAVING…" : "UPDATE PASSWORD"}<b>↗</b></button>
              <button type="button" className="quiet-button" onClick={() => { setRecovering(false); router.replace("/account"); }}>Back to sign in</button>
            </form>
          ) : userEmail ? (
            <div className="signed-in-state">
              <div className="account-user-card"><div className="signed-avatar">{(accountUsername || userEmail)[0]?.toUpperCase()}</div><div className="account-user-copy"><b>{accountUsername ? `@${accountUsername}` : "Your LoreSync account"}</b><span>{userEmail}</span></div><small>READY</small></div>
              <p className="signed-welcome">Your private archive is ready.<span>Cloud conversations are kept for one year.</span></p>
              <div className="signed-in-actions"><Link href="/workspace" className="account-submit">Open workspace <b>↗</b></Link><Link href="/profile" className="signed-profile-link">Edit your profile <b>↗</b></Link><Link href="/account/delete" className="signed-profile-link">Delete cloud account <b>↗</b></Link></div>
              <div className="account-session-footer"><span>PRIVATE ACCOUNT</span><button className="quiet-button" onClick={signOut}>Sign out</button></div>
            </div>
          ) : (
            <>
              <div className="account-tabs" role="tablist" aria-label="Account action"><button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setStatus(""); setPassword(""); }}>CREATE ACCOUNT</button><button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setStatus(""); setPassword(""); }}>SIGN IN</button></div>
              <form className="account-form" onSubmit={submit}>
                {mode === "signup" && <label>USERNAME<input type="text" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" placeholder="your_name" required /><small>3–24 characters · lowercase letters, numbers, underscores</small></label>}
                <label>EMAIL ADDRESS<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
                <label>PASSWORD<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "HIDE" : "SHOW"}</button></span></label>
                {mode === "signin" && <button type="button" className="forgot-password" onClick={sendPasswordReset} disabled={busy}>Forgot password?</button>}
                <button className="account-submit" disabled={busy}>{busy ? "ONE MOMENT…" : mode === "signup" ? "CREATE YOUR ARCHIVE" : "SIGN IN TO YOUR ARCHIVE"}<b>↗</b></button>
              </form>
            </>
          )}

          {status && <p className="account-status" role="status">{status}</p>}
          {!userEmail && !recovering && <div className="account-utility-footer"><div className="account-assurance"><span>✳</span><p>Parsed messages stay yours. Cloud archives expire after one year, and you can erase them sooner.</p></div><Link href="/profile" className="profile-account-link"><span>YOUR SPACE</span><b>Personalize your LoreSync profile <i>↗</i></b></Link></div>}
        </section>
      </div>
      <SiteFooter compact />
    </main>
  );
}
