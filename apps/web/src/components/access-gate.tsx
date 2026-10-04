"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cloudAvailable, getSupabase } from "@/lib/supabase";

export function AccessGate({ children, allowLocal = false }: { children: ReactNode; allowLocal?: boolean }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!cloudAvailable) {
      if (!allowLocal) router.replace("/account");
      return;
    }
    const supabase = getSupabase();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      else if (allowLocal) setReady(true);
      else {
        const next = `${pathname}${window.location.search}`;
        router.replace(`/account?next=${encodeURIComponent(next)}`);
      }
    }).catch(() => router.replace(`/account?next=${encodeURIComponent(pathname)}`));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setReady(true);
      else {
        setReady(allowLocal);
        if (!allowLocal) router.replace(`/account?next=${encodeURIComponent(pathname)}`);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [allowLocal, pathname, router]);

  if (!ready && !(allowLocal && !cloudAvailable)) return <main className="access-gate" aria-live="polite"><span className="eyebrow">PRIVATE BY DEFAULT</span><p>Checking your account…</p></main>;
  return children;
}
