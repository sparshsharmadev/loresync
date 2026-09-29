"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { cloudAvailable, getSupabase } from "@/lib/supabase";

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        setStatus("Check your inbox to confirm your email, then come back here to sign in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUserEmail(data.user.email ?? email);
        setStatus("You’re signed in. Your cloud workspace is ready.");
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
    <main className="account-page">
      <Link href="/" className="wordmark"><span className="brand-mark">l</span> loresync</Link>
      <section className="account-card">
        <div className="eyebrow">YOUR CLOUD WORKSPACE</div>
        <h1>{userEmail ? "You’re all set." : mode === "signup" ? "Keep the story close." : "Welcome back."}</h1>
        <p className="account-copy">
          {userEmail ? `Signed in as ${userEmail}.` : "Create an account to keep analyses synced and available across devices."}
        </p>
        {!cloudAvailable ? (
          <div className="setup-note">
            <strong>Cloud mode needs a Supabase project.</strong>
            <p>Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code>, then add your project URL and publishable key. Apply the SQL migration in <code>supabase/migrations</code> before enabling uploads.</p>
            <p>Local-only analysis works without an account or network connection.</p>
          </div>
        ) : userEmail ? (
          <div className="account-actions">
            <Link href="/" className="primary-button">Go to your workspace <span>↗</span></Link>
            <button className="text-button" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Account action">
              <button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>Create account</button>
              <button className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")}>Sign in</button>
            </div>
            <form onSubmit={submit} className="auth-form">
              <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></label>
              <button className="primary-button" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"} <span>↗</span></button>
            </form>
          </>
        )}
        {status && <p className="form-status" role="status">{status}</p>}
        <div className="account-foot"><span>Private by design</span><span>·</span><span>You control what stays</span></div>
      </section>
      <Link href="/" className="back-link">← Back to LoreSync</Link>
    </main>
  );
}
