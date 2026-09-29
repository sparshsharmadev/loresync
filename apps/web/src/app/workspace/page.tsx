"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { ChatMessage, ChatSummary } from "@loresync/core";
import { deleteCloudAnalysis, loadCloudAnalyses, saveCloudAnalysis, type CloudAnalysisRecord } from "@/lib/cloud-store";
import { deleteLocalAnalysis, loadLocalAnalyses, saveLocalAnalysis, type SavedAnalysis } from "@/lib/local-store";
import { cloudAvailable, getSupabase } from "@/lib/supabase";

type Mode = "local" | "cloud";
type Platform = "whatsapp" | "discord";

function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function shortCount(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function platformLabel(platform: Platform) {
  return platform === "whatsapp" ? "WhatsApp" : "Discord";
}

function ArchiveMark() {
  return <span className="archive-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 5v21h17"/><path d="M14 5v15h11"/><circle cx="24.5" cy="7.5" r="2"/></svg></span>;
}

function OrbitArtwork() {
  return (
    <div className="orbit-art" aria-hidden="true">
      <div className="orbit-wash" />
      <svg className="orbit-svg" viewBox="0 0 520 380" fill="none">
        <circle cx="286" cy="185" r="46" className="orbit-core" />
        <circle cx="286" cy="185" r="86" className="orbit-ring orbit-ring-a" />
        <circle cx="286" cy="185" r="132" className="orbit-ring orbit-ring-b" />
        <circle cx="286" cy="185" r="177" className="orbit-ring orbit-ring-c" />
        <path d="M109 185h354M286 8v354" className="orbit-axis" />
        <path d="M165 90c42-39 100-61 161-57" className="orbit-arc" />
        <path d="M416 267c-37 44-91 72-151 78" className="orbit-arc orbit-arc-muted" />
        <circle cx="165" cy="90" r="5" className="orbit-node orbit-node-one" />
        <circle cx="410" cy="111" r="4" className="orbit-node orbit-node-two" />
        <circle cx="222" cy="309" r="5" className="orbit-node orbit-node-three" />
        <circle cx="286" cy="185" r="9" className="orbit-sun" />
        <path d="M274 185h24M286 173v24" className="orbit-cross" />
        <circle cx="286" cy="185" r="21" className="orbit-pulse" />
      </svg>
      <div className="orbit-caption orbit-caption-top"><span>01 / A PRIVATE ATLAS</span><span>LOCAL FIRST</span></div>
      <div className="orbit-caption orbit-caption-bottom"><span>EVERY CONVERSATION</span><span>HAS A SHAPE</span></div>
      <div className="orbit-side-note">A SMALL UNIVERSE<br />MADE OF WORDS</div>
      <div className="orbit-index">26° 12′ N<br />80° 21′ E</div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("local");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activePlatform, setActivePlatform] = useState<Platform>("whatsapp");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [localAnalyses, setLocalAnalyses] = useState<SavedAnalysis[]>([]);
  const [cloudAnalyses, setCloudAnalyses] = useState<CloudAnalysisRecord[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    loadLocalAnalyses().then(setLocalAnalyses).catch(() => setStatus("This browser could not open local storage."));
    if (!cloudAvailable) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (!session) setCloudAnalyses([]);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!cloudAvailable || !userEmail) {
      return;
    }
    let cancelled = false;
    loadCloudAnalyses()
      .then((analyses) => { if (!cancelled) setCloudAnalyses(analyses); })
      .catch(() => { if (!cancelled) setStatus("Could not load your cloud conversations."); });
    return () => { cancelled = true; };
  }, [userEmail]);

  function selectFile(next: File | null) {
    if (!next) return;
    const extension = next.name.split(".").pop()?.toLowerCase();
    if (!(extension === "txt" || extension === "json")) {
      setFile(null);
      setStatus("Choose a WhatsApp .txt or Discord .json export.");
      return;
    }
    if (next.size > 25 * 1024 * 1024) {
      setFile(null);
      setStatus("This export is over 25 MB. Streaming import for larger exports is still being built.");
      return;
    }
    setFile(next);
    setStatus("");
    setSummary(null);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function analyze() {
    if (!file || (mode === "cloud" && (!cloudAvailable || !userEmail))) return;
    setBusy(true);
    setStatus(mode === "local" ? "Reading your export on this device…" : "Preparing your cloud analysis…");
    try {
      const text = await file.text();
      const result = await new Promise<{ messages: ChatMessage[]; summary: ChatSummary }>((resolve, reject) => {
        const worker = new Worker(new URL("../../lib/import.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ ok: boolean; messages?: ChatMessage[]; summary?: ChatSummary; error?: string }>) => {
          worker.terminate();
          if (!event.data.ok || !event.data.messages || !event.data.summary) reject(new Error(event.data.error ?? "Could not analyze this export."));
          else resolve({ messages: event.data.messages, summary: event.data.summary });
        };
        worker.onerror = () => { worker.terminate(); reject(new Error("The import worker stopped unexpectedly.")); };
        worker.postMessage({ name: file.name, text });
      });
      const platform = result.messages[0].platform;
      const title = file.name.replace(/\.(txt|json)$/i, "");
      setSummary(result.summary);
      setActiveTitle(title);
      setActivePlatform(platform);
      if (mode === "local") {
        const saved: SavedAnalysis = { id: crypto.randomUUID(), title, platform, summary: result.summary, messages: result.messages, savedAt: new Date().toISOString() };
        await saveLocalAnalysis(saved);
        setActiveAnalysisId(saved.id);
        setLocalAnalyses((previous) => [saved, ...previous]);
        setStatus("Your story is ready. The export and analysis are saved in this browser only.");
      } else {
        const saved = await saveCloudAnalysis(title, platform, result.messages, consent);
        setActiveAnalysisId(saved.id);
        setSummary(saved.summary);
        setCloudAnalyses(await loadCloudAnalyses());
        setStatus("Cloud analysis saved. The original export stayed in your browser.");
      }
      setFile(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not analyze this export.");
      setSummary(null);
    } finally {
      setBusy(false);
    }
  }

  function openLocal(analysis: SavedAnalysis) {
    setSummary(analysis.summary);
    setActiveTitle(analysis.title);
    setActivePlatform(analysis.platform);
    setActiveAnalysisId(analysis.id);
  }

  async function removeLocal(id: string) {
    if (!window.confirm("Delete this conversation and its local analysis from this browser?")) return;
    await deleteLocalAnalysis(id);
    setLocalAnalyses(await loadLocalAnalyses());
    if (activeAnalysisId === id) { setSummary(null); setActiveTitle(""); setActiveAnalysisId(null); }
  }

  async function removeCloud(id: string) {
    if (!window.confirm("Delete this conversation and all of its cloud messages? This cannot be undone.")) return;
    try {
      await deleteCloudAnalysis(id);
      setCloudAnalyses((rows) => rows.filter((row) => row.id !== id));
      if (activeAnalysisId === id) { setSummary(null); setActiveTitle(""); setActiveAnalysisId(null); }
      setStatus("Cloud analysis deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete this cloud analysis.");
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setSummary(null);
    setActiveTitle("");
    setActiveAnalysisId(null);
    setStatus("");
    setConsent(false);
  }

  const activity = summary?.dailyActivity.slice(-42) ?? [];
  const maxDay = Math.max(1, ...activity.map((day) => day.count));
  const analysisCount = mode === "local" ? localAnalyses.length : cloudAnalyses.length;

  return (
    <div className="archive-app">
      <aside className="archive-rail">
        <Link href="/" className="wordmark"><ArchiveMark /><span>lore<span>sync</span></span></Link>
        <div className="rail-kicker">WORKSPACE</div>
        <nav className="rail-nav" aria-label="Workspace">
          <a className="rail-link active" href="#top"><span className="rail-glyph">⌂</span><span>Overview</span><span className="rail-active-dot" /></a>
          <a className="rail-link" href="#import"><span className="rail-glyph">＋</span><span>New analysis</span></a>
          <a className="rail-link" href="#saved"><span className="rail-glyph">◷</span><span>Conversations</span><span className="rail-counter">{analysisCount.toString().padStart(2, "0")}</span></a>
        </nav>
        <div className="rail-lower">
          <div className="rail-constellation" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span /></div>
          <p className="rail-note">Your conversations,<br />with a little more context.</p>
          <div className="rail-status"><span className="status-light" /><span>{mode === "local" ? "STORED ON THIS DEVICE" : "CLOUD ARCHIVE"}</span></div>
          <Link href="/account" className="rail-account"><span className="account-monogram">{userEmail?.[0]?.toUpperCase() ?? "S"}</span><span className="rail-account-copy"><b>{userEmail ?? "Personal archive"}</b><small>{userEmail ? "Your account" : "Local workspace"}</small></span><span className="account-arrow">↗</span></Link>
        </div>
        <div className="rail-version">LORESYNC <span>—</span> FIELD NOTES Nº 01</div>
      </aside>

      <div className="archive-main">
        <header className="archive-topbar">
          <div className="topbar-crumb"><span>LORESYNC</span><i>/</i><b>{summary ? activeTitle : "WORKSPACE"}</b></div>
          <div className="topbar-tools"><span className="vault-indicator"><i />{mode === "local" ? "ON-DEVICE VAULT" : "CLOUD VAULT"}</span><span className="topbar-rule" /><Link href="/account" className="topbar-profile" aria-label="Account settings">{userEmail?.[0]?.toUpperCase() ?? "↗"}</Link></div>
        </header>

        <main className="archive-content" id="top">
          <section className="hero-stage">
            <div className="hero-copy">
              <div className="chapter-line"><span>YOUR CONVERSATION WORKSPACE</span></div>
              <h1>The shape of<br />your <em>conversations.</em></h1>
              <p>See when you talk, who keeps the thread going, and how your chats change over time.</p>
            </div>
            <div className="hero-art-wrap"><OrbitArtwork /></div>
            <div className="hero-edge-note">A PRIVATE PLACE<br />TO REMEMBER</div>
          </section>

          <section className="import-section" id="import">
            <div className="section-overline"><span>START WITH A CHAT</span><span>PRIVATE BY DEFAULT</span></div>
            <div className="import-heading"><div><h2>Analyze a conversation</h2><p>Upload a WhatsApp or Discord export to see its patterns.</p></div><span className="section-mark">＋</span></div>

            <div className="import-workbench">
              <div className="workbench-main">
                <label className={`file-portal ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                  <input type="file" accept=".txt,.json,text/plain,application/json" onChange={onFileInput} />
                  <div className="portal-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8v22m0-22 8 8m-8-8-8 8" /><path d="M10 29v9h28v-9" /></svg></div>
                  <div className="portal-copy"><b>{file ? file.name : "Place the conversation here"}</b><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to open` : "Drop an export, or browse your device"}</span></div>
                  <span className="portal-choose">{file ? "CHANGE FILE" : "BROWSE FILES"}<b>↗</b></span>
                  <div className="portal-formats"><span><i className="format-symbol whatsapp">w</i><b>WHATSAPP</b> .txt</span><i className="format-separator" /><span><i className="format-symbol discord">d</i><b>DISCORD</b> .json</span><i className="format-separator" /><span>UP TO 25 MB</span></div>
                </label>
                <div className="import-action-row"><p><span className="privacy-spark">✳</span>{mode === "local" ? "Parsed here. Stored here. Yours to remove." : "Only parsed messages are saved. The export file stays here."}</p><button className="open-button" onClick={analyze} disabled={!file || busy || (mode === "cloud" && (!cloudAvailable || !userEmail || !consent))}>{busy ? <><i className="button-spinner" /> Analyzing…</> : <>Analyze conversation <span>↗</span></>}</button></div>
                {status && <p className="import-status" role="status">{status}</p>}
              </div>

              <aside className="storage-choice" role="radiogroup" aria-label="Choose where this conversation is stored">
                <div className="storage-label">CHOOSE ITS HOME <span>?</span></div>
                <button className={`storage-option ${mode === "local" ? "selected" : ""}`} onClick={() => changeMode("local")} role="radio" aria-checked={mode === "local"}>
                  <span className="storage-symbol local-symbol">⌂</span><span className="storage-copy"><b>This device</b><small>Private · no account needed</small></span><i className="storage-radio" />
                </button>
                <button className={`storage-option ${mode === "cloud" ? "selected" : ""}`} onClick={() => changeMode("cloud")} role="radio" aria-checked={mode === "cloud"}>
                  <span className="storage-symbol cloud-symbol">↗</span><span className="storage-copy"><b>My cloud archive</b><small>Sync · account required</small></span><i className="storage-radio" />
                </button>
                {mode === "cloud" && (!cloudAvailable || !userEmail) && <div className="cloud-gate"><span>{!cloudAvailable ? "Cloud keys not connected yet." : "Sign in before opening a cloud archive."}</span><Link href="/account">{!cloudAvailable ? "Setup" : "Account"} ↗</Link></div>}
                {mode === "cloud" && cloudAvailable && userEmail && <label className="consent-note"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to save parsed messages here for one year. The source export is never sent.</span></label>}
                <div className="storage-footnote"><span>✳</span><p>Local mode keeps everything in this browser. Cloud mode gives you a year to revisit it, with deletion always in your hands.</p></div>
              </aside>
            </div>
          </section>

          {summary && (
            <section className="story-section" aria-live="polite">
              <div className="section-overline"><span>02 / THE READING</span><span>{platformLabel(activePlatform).toUpperCase()} · {mode === "local" ? "ON THIS DEVICE" : "CLOUD ARCHIVE"}</span></div>
              <div className="story-title-row"><div><div className="eyebrow">A FIRST LOOK INSIDE</div><h2>{activeTitle}</h2></div><span className="story-date">{formatDate(summary.firstMessageAt)} <i>—</i> {formatDate(summary.lastMessageAt)}</span></div>
              <div className="story-metrics">
                <article><span>MESSAGES KEPT</span><strong>{shortCount(summary.messageCount)}</strong><small>words sent into the world</small></article>
                <article><span>VOICES HERE</span><strong>{summary.participantCount.toString().padStart(2, "0")}</strong><small>distinct participants</small></article>
                <article><span>DAYS SHARED</span><strong>{shortCount(summary.activeDays)}</strong><small>with a message in them</small></article>
                <article><span>ATTACHMENTS</span><strong>{shortCount(summary.attachmentCount)}</strong><small>media markers found</small></article>
              </div>
              <div className="story-visuals">
                <article className="rhythm-panel">
                  <div className="visual-heading"><div><span>THE CONVERSATION, IN TIME</span><h3>Some days leave a longer echo.</h3></div><span className="visual-stamp">UTC · LAST {activity.length} ACTIVE DAYS</span></div>
                  <div className="rhythm-chart" aria-label="Daily message activity over time">{activity.map((day, index) => <div className="rhythm-column" key={day.date} title={`${formatDate(day.date)} · ${day.count} messages`}><i className={index % 7 === 0 ? "warm" : ""} style={{ height: `${Math.max(3, (day.count / maxDay) * 100)}%` }} /></div>)}</div>
                  <div className="rhythm-dates"><span>{activity[0] ? formatDate(activity[0].date) : "—"}</span><span>{activity[activity.length - 1] ? formatDate(activity[activity.length - 1].date) : "—"}</span></div>
                </article>
                <article className="voices-panel">
                  <div className="visual-heading"><div><span>THE PEOPLE IN IT</span><h3>Every voice, its own cadence.</h3></div><span className="voice-seal">↗</span></div>
                  <div className="voice-list">{summary.participants.slice(0, 5).map((person, index) => <div className="voice-row" key={person.name}><span className={`voice-dot voice-${index % 4}`} /><span className="voice-name">{person.name}</span><span className="voice-share"><i style={{ width: `${Math.max(2, (person.count / summary.messageCount) * 100)}%` }} /></span><span className="voice-count">{shortCount(person.count)}</span></div>)}</div>
                </article>
              </div>
              <p className="story-footnote"><span>i</span> Charts show message activity and participant counts. LoreSync does not label sentiment or relationship health.</p>
            </section>
          )}

          <section className="collection-section" id="saved">
            <div className="section-overline"><span>SAVED CONVERSATIONS</span><span>{mode === "local" ? "STORED IN THIS BROWSER" : "STORED IN YOUR ACCOUNT"}</span></div>
            <div className="collection-heading"><div><h2>Your conversations</h2><p>Open a previous analysis or start a new one.</p></div><span className="collection-count">{analysisCount.toString().padStart(2, "0")} <small>SAVED</small></span></div>
            {analysisCount === 0 ? (
                <div className="empty-collection"><div className="empty-graphic" aria-hidden="true"><span /><i /><b /></div><div><span className="eyebrow">GET STARTED</span><h3>No conversations yet</h3><p>Upload an export to create your first analysis.</p></div><a href="#import">Upload a chat <b>↑</b></a></div>
            ) : (
                <div className="archive-list">{mode === "local" ? localAnalyses.map((analysis, index) => <article className="archive-row" key={analysis.id}><span className="archive-number">{String(index + 1).padStart(2, "0")}</span><span className={`archive-platform ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "W" : "D"}</span><button className="archive-open" onClick={() => openLocal(analysis)}><b>{analysis.title}</b><small>{platformLabel(analysis.platform)} <i>·</i> {formatDate(analysis.summary.firstMessageAt)} — {formatDate(analysis.summary.lastMessageAt)}</small></button><span className="archive-size">{shortCount(analysis.summary.messageCount)} <small>MESSAGES</small></span><button className="archive-delete" onClick={() => removeLocal(analysis.id)} aria-label={`Delete ${analysis.title}`}>×</button></article>) : cloudAnalyses.map((analysis, index) => <article className="archive-row" key={analysis.id}><span className="archive-number">{String(index + 1).padStart(2, "0")}</span><span className={`archive-platform ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "W" : "D"}</span><button className="archive-open" onClick={() => { setSummary(analysis.summary); setActiveTitle(analysis.title); setActivePlatform(analysis.platform); setActiveAnalysisId(analysis.id); }}><b>{analysis.title}</b><small>{platformLabel(analysis.platform)} <i>·</i> Expires {formatDate(analysis.expires_at)}</small></button><span className="archive-size">{shortCount(analysis.message_count)} <small>MESSAGES</small></span><button className="archive-delete" onClick={() => removeCloud(analysis.id)} aria-label={`Delete ${analysis.title}`}>×</button></article>)}</div>
            )}
          </section>

          <footer className="archive-footer"><span>LORESYNC <i>·</i> A PLACE FOR WHAT STAYS WITH YOU</span><span><span className="footer-live" /> PRIVATE BY DEFAULT <i>·</i> <Link href="/account">ACCOUNT & ACCESS ↗</Link></span></footer>
        </main>
      </div>
    </div>
  );
}
