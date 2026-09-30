"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-provider";
import { cloudAvailable, getSupabase } from "@/lib/supabase";
import styles from "./page.module.css";

export default function DeleteAccountPage() {
  const [ready, setReady] = useState(!cloudAvailable);
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!cloudAvailable) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    }).catch(() => setReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE") { setStatus('Type "DELETE" exactly to confirm.'); return; }
    setBusy(true); setStatus("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
        cache: "no-store",
      });
      const result: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not delete the account. Please try again.");
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete the account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-shell">
      <header className="account-topbar"><Brand className="wordmark" markClassName="archive-mark" /><div className="account-topbar-actions"><ThemeToggle /><Link href="/account" className="return-archive">BACK TO ACCOUNT <b>↗</b></Link></div></header>
      <div className={styles.page}>
        <span className="panel-overline">ACCOUNT CONTROL · PERMANENT ACTION</span>
        <h1>Delete your cloud account.</h1>
        {!ready ? <p role="status">Checking your session…</p> : !cloudAvailable ? <p>Cloud accounts are not configured for this deployment.</p> : !signedIn ? <p>Sign in before requesting account deletion. <Link href="/account?next=%2Faccount%2Fdelete">Sign in</Link></p> : (
          <>
            <p>This permanently removes your LoreSync cloud account, profile, and cloud conversations. Your local browser archive stays on this device.</p>
            <form onSubmit={submit} className={styles.form}>
              <label>ACCOUNT PASSWORD<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
              <label>TYPE DELETE TO CONFIRM<input type="text" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></label>
              <button className={styles.deleteButton} type="submit" disabled={busy}>{busy ? "DELETING ACCOUNT…" : "PERMANENTLY DELETE ACCOUNT"}</button>
            </form>
          </>
        )}
        {status && <p className={styles.status} role="status">{status}</p>}
      </div>
      <SiteFooter compact />
    </main>
  );
}
