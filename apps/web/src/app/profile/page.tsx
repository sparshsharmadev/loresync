"use client";

import Link from "next/link";
import NextImage from "next/image";
import "./profile.css";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type CSSProperties } from "react";
import { Brand } from "@/components/brand";
import { ThemeToggle, useThemePreference } from "@/components/theme-provider";
import { cloudAvailable, getSupabase } from "@/lib/supabase";
import { AccessGate } from "@/components/access-gate";
import { SiteFooter } from "@/components/site-footer";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Accent = "signal" | "blue" | "moss" | "amber" | "plum";
type Density = "roomy" | "balanced" | "compact";
type TypeScale = "small" | "standard" | "large";
type Profile = {
  username: string; displayName: string; pronouns: string; about: string; photo: string;
  avatarStyle: "initials" | "orbit" | "monogram"; avatarTone: "paper" | "night" | "red" | "moss";
  accent: Accent; density: Density; typeScale: TypeScale; reducedMotion: boolean;
  defaultStorage: "local" | "cloud";
};
const KEY = "loresync-profile-v1";
const accentOptions: { id: Accent; label: string; color: string; soft: string }[] = [
  { id: "signal", label: "Signal red", color: "#ed1c24", soft: "#f4d7d4" },
  { id: "blue", label: "Ink blue", color: "#4566c8", soft: "#dce4f8" },
  { id: "moss", label: "Field moss", color: "#5b7450", soft: "#dfe9d7" },
  { id: "amber", label: "Archive amber", color: "#b8782b", soft: "#f1e3cf" },
  { id: "plum", label: "Dusk plum", color: "#89577f", soft: "#eddfeb" },
];
const defaults: Profile = { username: "", displayName: "", pronouns: "", about: "", photo: "", avatarStyle: "initials", avatarTone: "paper", accent: "signal", density: "balanced", typeScale: "standard", reducedMotion: false, defaultStorage: "local" };
function toCloudProfile(profile: Profile, theme: string) {
  return { username: profile.username, display_name: profile.displayName, pronouns: profile.pronouns, about: profile.about, photo: profile.photo, avatar_style: profile.avatarStyle, avatar_tone: profile.avatarTone, accent: profile.accent, density: profile.density, type_scale: profile.typeScale, reduced_motion: profile.reducedMotion, default_storage: profile.defaultStorage, theme };
}
function fromCloudProfile(value: Record<string, unknown>): Profile {
  return { username: String(value.username ?? ""), displayName: String(value.display_name ?? ""), pronouns: String(value.pronouns ?? ""), about: String(value.about ?? ""), photo: String(value.photo ?? ""), avatarStyle: value.avatar_style as Profile["avatarStyle"], avatarTone: value.avatar_tone as Profile["avatarTone"], accent: value.accent as Accent, density: value.density as Density, typeScale: value.type_scale as TypeScale, reducedMotion: Boolean(value.reduced_motion), defaultStorage: value.default_storage as Profile["defaultStorage"] };
}
function initials(name: string, email: string | null) {
  const value = name.trim() || email?.split("@")[0] || "LoreSync";
  return value.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LS";
}
function applyPreferences(profile: Profile) {
  const root = document.documentElement;
  const accent = accentOptions.find((option) => option.id === profile.accent) ?? accentOptions[0];
  root.style.setProperty("--accent", accent.color);
  root.style.setProperty("--accent-soft", accent.soft);
  root.style.setProperty("--tomato", accent.color);
  root.style.setProperty("--tomato-dark", accent.color);
  root.style.setProperty("--citron", accent.color);
  root.dataset.density = profile.density;
  root.dataset.typeScale = profile.typeScale;
  root.dataset.motion = profile.reducedMotion ? "reduced" : "full";
}
function loadProfile(): Profile {
  try { const saved = window.localStorage.getItem(KEY); return saved ? { ...defaults, ...JSON.parse(saved) as Partial<Profile> } : defaults; }
  catch { return defaults; }
}
function storeProfile(profile: Profile) {
  try { window.localStorage.setItem(KEY, JSON.stringify(profile)); applyPreferences(profile); return true; }
  catch { return false; }
}
function ProfileAvatar({ profile, email, size = "large" }: { profile: Profile; email: string | null; size?: "large" | "small" }) {
  return <span className={`profile-avatar profile-avatar-${profile.avatarTone} profile-avatar-${size} profile-avatar-style-${profile.avatarStyle}`} aria-hidden="true">{profile.photo ? <NextImage src={profile.photo} alt="" width={160} height={160} unoptimized /> : profile.avatarStyle === "orbit" ? <span className="avatar-orbit"><i /><b /></span> : profile.avatarStyle === "monogram" ? <span className="avatar-monogram">L<span>S</span></span> : initials(profile.displayName, email)}</span>;
}

function ProfileContent() {
  const { theme, setTheme } = useThemePreference();
  const themeRef = useRef(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  const [profile, setProfile] = useState<Profile>(defaults);
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudDatabaseReady, setCloudDatabaseReady] = useState<boolean | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const saved = loadProfile();
    // Hydrate browser-only preferences after the server's stable default render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(saved); applyPreferences(saved); setLoaded(true);
    if (!cloudAvailable) return;
    const supabase = getSupabase();
    let alive = true;
    const syncAccount = async (token: string | undefined, accountEmail: string | null, accountUsername = "") => {
      if (!alive) return;
      setEmail(accountEmail);
      if (!token) { setCloudEnabled(false); return; }
      try {
        const response = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) { if (alive && response.status === 503) { setCloudDatabaseReady(false); setStatus(result.error); } return; }
        if (alive) setCloudDatabaseReady(true);
        if (result.profile && alive) {
          const remote = fromCloudProfile(result.profile as Record<string, unknown>);
          const local = loadProfile();
          const hasLocalIdentity = Boolean(local.displayName || local.about || local.photo || local.pronouns);
          const merged = {
            ...remote,
            username: remote.username || local.username || accountUsername,
            ...(hasLocalIdentity ? { displayName: remote.displayName || local.displayName, pronouns: remote.pronouns || local.pronouns, about: remote.about || local.about, photo: remote.photo || local.photo } : {}),
            accent: local.accent !== defaults.accent ? local.accent : remote.accent,
            density: local.density !== defaults.density ? local.density : remote.density,
            typeScale: local.typeScale !== defaults.typeScale ? local.typeScale : remote.typeScale,
            reducedMotion: local.reducedMotion !== defaults.reducedMotion ? local.reducedMotion : remote.reducedMotion,
            defaultStorage: local.defaultStorage !== defaults.defaultStorage ? local.defaultStorage : remote.defaultStorage,
          };
          setProfile(merged); storeProfile(merged); setTheme((result.profile.theme === "light" || result.profile.theme === "dark") ? result.profile.theme : "system"); setCloudEnabled(true);
          setStatus("Your cloud profile is synced on this device.");
        } else if (alive) {
          const local = { ...loadProfile(), username: loadProfile().username || accountUsername };
          const response = await fetch("/api/profile", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(toCloudProfile(local, themeRef.current)) });
          const saved = await response.json();
          if (!response.ok) { if (response.status === 503) setCloudDatabaseReady(false); setStatus(saved.error || "Could not sync profile."); return; }
          setProfile(local); storeProfile(local); setCloudEnabled(true); setCloudDatabaseReady(true); setStatus("Your profile now syncs automatically with your account.");
        }
      } catch { if (alive) setStatus("Could not check cloud profile sync. Your local profile is safe."); }
    };
    supabase.auth.getSession().then(({ data }) => syncAccount(data.session?.access_token, data.session?.user.email ?? null, String(data.session?.user.user_metadata?.username ?? "")));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void syncAccount(session?.access_token, session?.user.email ?? null, String(session?.user.user_metadata?.username ?? "")); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [setTheme]);
  async function persistCloud(nextProfile = profile, nextTheme = theme) {
    const { data } = await getSupabase().auth.getSession(); const token = data.session?.access_token;
    if (!token) throw new Error("Sign in again to sync your profile.");
    const response = await fetch("/api/profile", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(toCloudProfile(nextProfile, nextTheme)) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Cloud profile could not be saved.");
  }
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    const next = { ...profile, [key]: value }; setProfile(next);
    if (key !== "username" && key !== "displayName" && key !== "pronouns" && key !== "about") {
      setStatus(storeProfile(next) ? "Preference saved on this device." : "Could not save. This browser may be out of storage space.");
      if (cloudEnabled) void persistCloud(next).then(() => setStatus("Preference saved on this device and synced." )).catch((error) => setStatus(error instanceof Error ? `${error.message} Local copy is saved.` : "Cloud sync failed. Local copy is saved."));
    }
  }
  function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const ok = storeProfile(profile);
    setStatus(ok ? "Profile saved on this device." : "Could not save. This browser may be out of storage space.");
    if (ok && cloudEnabled) void persistCloud(profile).then(() => setStatus("Profile saved and synced to your cloud account.")).catch((error) => setStatus(error instanceof Error ? `${error.message} Local copy is saved.` : "Cloud sync failed. Local copy is saved."));
    if (ok) setSavedAt(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date()));
  }
  function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus("Choose an image file for your profile picture."); return; }
    const objectUrl = URL.createObjectURL(file); const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(objectUrl); setStatus("Could not prepare that image."); return; }
      const crop = Math.min(image.width, image.height);
      context.drawImage(image, (image.width-crop)/2, (image.height-crop)/2, crop, crop, 0, 0, 320, 320);
      URL.revokeObjectURL(objectUrl); update("photo", canvas.toDataURL("image/jpeg", .78));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); setStatus("That image could not be opened."); }; image.src = objectUrl;
  }
  function exportPreferences() {
    const blob = new Blob([JSON.stringify({ product: "LoreSync", exportedAt: new Date().toISOString(), theme, profile }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "loresync-profile-settings.json"; anchor.click(); URL.revokeObjectURL(url); setStatus("Your settings file has been downloaded.");
  }
  function resetPreferences() {
    window.localStorage.removeItem(KEY); setTheme("system");
    for (const property of ["--accent", "--accent-soft", "--tomato", "--tomato-dark", "--citron"]) document.documentElement.style.removeProperty(property);
    delete document.documentElement.dataset.density; delete document.documentElement.dataset.typeScale; delete document.documentElement.dataset.motion;
    setProfile(defaults); setConfirmReset(false); setStatus("Profile and appearance preferences reset. Your conversations are untouched.");
  }
  const activeAccent = accentOptions.find((option) => option.id === profile.accent) ?? accentOptions[0];

  return (
    <main className="profile-page">
      <header className="profile-header"><Brand className="wordmark" markClassName="archive-mark" /><div className="profile-header-nav"><span className="profile-breadcrumb">PROFILE <i>/</i> PERSONALIZE</span><ThemeToggle /><Link href="/workspace" className="profile-return">WORKSPACE <b>↗</b></Link></div></header>
      <section className="profile-masthead"><div className="profile-mast-copy"><span className="eyebrow">YOUR SPACE, YOUR SHAPE <i>·</i> 03 / 03</span><h1>A little more<br /><em>like you.</em></h1><p>Set your name, shape the interface, and choose how LoreSync feels when you come back.</p></div><div className="profile-preview"><span className="profile-preview-label">YOUR PROFILE AT A GLANCE</span><ProfileAvatar profile={profile} email={email} /><div className="profile-preview-name">{profile.displayName.trim() || (email ? email.split("@")[0] : "Your name")}<small>{profile.pronouns || email || "LOCAL PROFILE"}</small></div><span className="profile-preview-accent" style={{ background: activeAccent.color }} /><span className="profile-preview-note">PREVIEW · ONLY YOU SEE THIS</span></div></section>
      <div className="profile-layout">
        <nav className="profile-index" aria-label="Profile sections"><span>IN THIS SPACE</span><a href="#identity">01 <b>Identity</b></a><a href="#appearance">02 <b>Appearance</b></a><a href="#workspace-preferences">03 <b>Workspace</b></a><a href="#privacy">04 <b>Privacy & data</b></a><Link href="/account">Account & sign-in ↗</Link></nav>
        <div className="profile-sections">
          <section className="profile-section" id="identity"><div className="profile-section-heading"><span>01 / THE PERSON HERE</span><small>PRIVATE · DEVICE COPY + ACCOUNT SYNC</small><h2>Make it yours.</h2><p>Your local copy stays available in this browser, and profile details sync privately to your account for other devices.</p></div>
            <form className="identity-form" onSubmit={saveIdentity}><div className="identity-avatar-control"><ProfileAvatar profile={profile} email={email} /><div><button type="button" className="outline-action" onClick={() => avatarInput.current?.click()}>{profile.photo ? "Change picture" : "Add a picture"} <b>↗</b></button>{profile.photo && <button type="button" className="text-action" onClick={() => update("photo", "")}>Remove picture</button>}<input ref={avatarInput} type="file" accept="image/*" onChange={onAvatarChange} hidden /><small>Square crop · optimized in this browser</small></div></div>
              <div className="profile-fields"><label>USERNAME<input required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" value={profile.username} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} placeholder="your_name" /><small>3–24 characters · lowercase letters, numbers, underscores</small></label><label>DISPLAY NAME<input maxLength={48} value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} placeholder="What should we call you?" /></label><label>PRONOUNS <span>OPTIONAL</span><input maxLength={32} value={profile.pronouns} onChange={(event) => setProfile((current) => ({ ...current, pronouns: event.target.value }))} placeholder="e.g. they / them" /></label><label className="profile-bio-field">A NOTE TO YOURSELF <span>OPTIONAL</span><textarea maxLength={140} rows={3} value={profile.about} onChange={(event) => setProfile((current) => ({ ...current, about: event.target.value }))} placeholder="A small reminder about what you want this space to be." /><small>{profile.about.length}/140</small></label></div>
              <div className="identity-form-footer"><span>{savedAt ? `LAST SAVED · ${savedAt}` : "NOTHING HERE IS PUBLIC"}</span><button className="profile-primary" type="submit">Save profile <b>↗</b></button></div></form>
            <div className="avatar-customization"><div><b>Avatar treatment</b><small>Choose a simple mark when you do not use a photo.</small></div><div className="avatar-style-options">{(["initials", "orbit", "monogram"] as const).map((style) => <button key={style} className={profile.avatarStyle === style ? "selected" : ""} onClick={() => update("avatarStyle", style)} aria-pressed={profile.avatarStyle === style}><ProfileAvatar profile={{ ...profile, photo: "", avatarStyle: style }} email={email} size="small" /><span>{style}</span></button>)}</div></div>
          </section>
          <section className="profile-section" id="appearance"><div className="profile-section-heading"><span>02 / THE ATMOSPHERE</span><small>PERSONALIZE THE READING ROOM</small><h2>Set the tone.</h2><p>Choose a canvas and accent that make long visits easier on your eyes.</p></div>
            <div className="preference-row theme-preference"><div className="preference-copy"><b>Color theme</b><small>Use your system setting or choose one directly.</small></div><div className="theme-choices">{(["system", "light", "dark"] as const).map((choice) => <button key={choice} className={theme === choice ? "selected" : ""} onClick={() => { setTheme(choice); if (cloudEnabled) void persistCloud(profile, choice).then(() => setStatus("Theme saved and synced.")).catch(() => setStatus("Theme saved here; cloud sync could not complete.")); }} aria-pressed={theme === choice}><i className={`theme-swatch theme-${choice}`} />{choice === "system" ? "System" : choice === "light" ? "Light" : "Dark"}</button>)}</div></div>
            <div className="preference-row"><div className="preference-copy"><b>Accent color</b><small>Applied to controls and highlights. The LoreSync logo stays its official red.</small></div><div className="accent-choices" role="radiogroup" aria-label="Accent color">{accentOptions.map((option) => <button key={option.id} style={{ "--swatch": option.color } as CSSProperties} className={profile.accent === option.id ? "selected" : ""} onClick={() => update("accent", option.id)} role="radio" aria-checked={profile.accent === option.id} aria-label={option.label} title={option.label}><i /></button>)}</div><span className="choice-caption">{activeAccent.label}</span></div>
            <div className="preference-row"><div className="preference-copy"><b>Interface spacing</b><small>Set how much breathing room appears between controls and content.</small></div><div className="segmented-options">{(["roomy", "balanced", "compact"] as const).map((value) => <button key={value} className={profile.density === value ? "selected" : ""} onClick={() => update("density", value)} aria-pressed={profile.density === value}>{value}</button>)}</div></div>
            <div className="preference-row"><div className="preference-copy"><b>Reading size</b><small>Adjust interface text size across LoreSync.</small></div><div className="segmented-options type-options">{(["small", "standard", "large"] as const).map((value) => <button key={value} className={profile.typeScale === value ? "selected" : ""} onClick={() => update("typeScale", value)} aria-pressed={profile.typeScale === value}>{value === "small" ? "A−" : value === "large" ? "A+" : "A"}<span>{value}</span></button>)}</div></div>
            <label className="switch-row"><span className="preference-copy"><b>Reduce motion</b><small>Turn off non-essential movement and transitions.</small></span><input type="checkbox" checked={profile.reducedMotion} onChange={(event) => update("reducedMotion", event.target.checked)} /><i aria-hidden="true" /></label>
          </section>
          <section className="profile-section" id="workspace-preferences"><div className="profile-section-heading"><span>03 / THE WORKSPACE</span><small>HOW YOU LIKE TO BEGIN</small><h2>Make the first step easy.</h2><p>Choose your usual starting point. You can change the storage choice any time before an import.</p></div>
            <div className="workspace-choice-grid"><button className={`workspace-choice ${profile.defaultStorage === "local" ? "selected" : ""}`} onClick={() => update("defaultStorage", "local")} aria-pressed={profile.defaultStorage === "local"}><span className="workspace-choice-icon">⌂</span><b>This device</b><small>Private · saved in this browser.</small><i>{profile.defaultStorage === "local" ? "✓ SELECTED" : "LOCAL"}</i></button><button className={`workspace-choice ${profile.defaultStorage === "cloud" ? "selected" : ""}`} onClick={() => update("defaultStorage", "cloud")} aria-pressed={profile.defaultStorage === "cloud"}><span className="workspace-choice-icon">↗</span><b>My cloud archive</b><small>{cloudAvailable ? "Sync across devices with your account." : "Cloud setup is not connected yet."}</small><i>{profile.defaultStorage === "cloud" ? "✓ SELECTED" : "OPTIONAL"}</i></button></div>
            <div className="profile-inline-link"><span>Account, password, and cloud archive access</span><Link href="/account">Manage account ↗</Link></div>
          </section>
          <section className="profile-section" id="privacy"><div className="profile-section-heading"><span>04 / YOUR CONTROL</span><small>PORTABLE, PRIVATE, REVERSIBLE</small><h2>Nothing hidden.</h2><p>Your profile saves on this device and syncs automatically to your private account, so your name, picture, bio, and settings follow you.</p></div>
            <div className="privacy-ledger"><div><span>PROFILE</span><b>{loaded ? "DEVICE COPY" : "LOADING"}</b><small>Name, avatar and appearance settings</small></div><div><span>ACCOUNT</span><b>{email ? "SIGNED IN" : "SIGNED OUT"}</b><small>{email ?? "Sign in to access your private profile."}</small></div><div><span>CLOUD DATABASE</span><b>{!cloudAvailable ? "NOT CONNECTED" : cloudDatabaseReady === true ? "READY" : cloudDatabaseReady === false ? "MIGRATIONS NEEDED" : "CHECKING"}</b><small>{cloudDatabaseReady === false ? "Apply the SQL files in supabase/migrations to enable cloud storage." : "Cloud conversations and profile settings are private to your account."}</small></div></div>
            <div className="profile-inline-link cloud-profile-control"><span>{cloudEnabled ? "Automatic private profile sync is active." : email ? "Cloud sync is waiting for database setup." : "Sign in to sync your profile."}</span></div>
            <div className="privacy-actions"><button className="outline-action" onClick={exportPreferences}>Download my settings <b>↓</b></button><button className="text-action reset-action" onClick={() => setConfirmReset(true)}>Reset profile & preferences</button></div>
          </section>
        </div>
      </div>
      <SiteFooter compact />
      {status && <div className="profile-toast" role="status">{status}</div>}
      <ConfirmDialog open={confirmReset} eyebrow="PROFILE SETTINGS · THIS DEVICE" title="Reset your profile settings?" description="Your profile and appearance preferences on this device will return to their defaults. Saved conversations and your account will stay as they are." confirmLabel="Reset settings" tone="danger" onCancel={() => setConfirmReset(false)} onConfirm={resetPreferences} />
    </main>
  );
}

export default function ProfilePage() {
  return <AccessGate><ProfileContent /></AccessGate>;
}
