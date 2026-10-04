"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "loresync-storage-notice-dismissed-v1";

export function StorageNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Read dismissal state after hydration to avoid a server/client markup mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setVisible(window.localStorage.getItem(KEY) !== "yes"); }
    catch { setVisible(true); }
  }, []);
  function dismiss() {
    try { window.localStorage.setItem(KEY, "yes"); } catch { /* Keep the notice dismissible for this session. */ }
    setVisible(false);
  }
  if (!visible) return null;
  return <aside className="storage-notice" aria-label="Browser storage notice"><div><b>About browser storage</b><p>LoreSync uses device storage for preferences and local chats. Learn what that means in our <Link href="/cookies">cookies & storage note</Link>.</p></div><button type="button" onClick={dismiss} aria-label="Dismiss browser storage notice">Got it <span>×</span></button></aside>;
}
