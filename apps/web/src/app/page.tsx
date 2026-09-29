"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { ChatMessage, ChatSummary } from "@loresync/core";
import { deleteCloudAnalysis, saveCloudAnalysis } from "@/lib/cloud-store";
import { deleteLocalAnalysis, loadLocalAnalyses, saveLocalAnalysis, type SavedAnalysis } from "@/lib/local-store";
import { cloudAvailable, getSupabase } from "@/lib/supabase";

type Mode = "local" | "cloud";
type CloudAnalysis = { id: string; title: string; platform: "whatsapp" | "discord"; message_count: number; summary: ChatSummary; created_at: string; expires_at: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatRange(first: string, last: string) {
  return `${formatDate(first)} — ${formatDate(last)}`;
}

function shortCount(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("local");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activePlatform, setActivePlatform] = useState<"whatsapp" | "discord">("whatsapp");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [localAnalyses, setLocalAnalyses] = useState<SavedAnalysis[]>([]);
  const [cloudAnalyses, setCloudAnalyses] = useState<CloudAnalysis[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    loadLocalAnalyses().then(setLocalAnalyses).catch(() => setStatus("This browser could not open local storage."));
    if (!cloudAvailable) return;
    const supabase = getSupabase();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setUserEmail(user?.email ?? null);
      if (!user) return;
      const { data: rows } = await supabase.from("analyses").select("id,title,platform,message_count,summary,created_at,expires_at").order("created_at", { ascending: false });
      if (rows) setCloudAnalyses(rows as CloudAnalysis[]);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  function selectFile(next: File | null) {
    if (!next) return;
    const extension = next.name.split(".").pop()?.toLowerCase();
    if (!(["txt", "json"].includes(extension ?? ""))) {
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
    setMessages([]);
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
    if (!file) return;
    if (mode === "cloud" && (!cloudAvailable || !userEmail)) return;
    setBusy(true);
    setStatus(mode === "local" ? "Reading your export on this device…" : "Preparing your cloud analysis…");
    try {
      const text = await file.text();
      const result = await new Promise<{ messages: ChatMessage[]; summary: ChatSummary }>((resolve, reject) => {
        const worker = new Worker(new URL("../lib/import.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ ok: boolean; messages?: ChatMessage[]; summary?: ChatSummary; error?: string }>) => {
          worker.terminate();
          if (!event.data.ok || !event.data.messages || !event.data.summary) reject(new Error(event.data.error ?? "Could not analyze this export."));
          else resolve({ messages: event.data.messages, summary: event.data.summary });
        };
        worker.onerror = () => { worker.terminate(); reject(new Error("The import worker stopped unexpectedly.")); };
        worker.postMessage({ name: file.name, text });
      });
      const platform = result.messages[0].platform;
      setSummary(result.summary);
      setMessages(result.messages);
      setActivePlatform(platform);
      setActiveTitle(file.name.replace(/\.(txt|json)$/i, ""));
      if (mode === "local") {
        const saved: SavedAnalysis = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.(txt|json)$/i, ""),
          platform,
          summary: result.summary,
          messages: result.messages,
          savedAt: new Date().toISOString(),
        };
        await saveLocalAnalysis(saved);
        setActiveAnalysisId(saved.id);
        setLocalAnalyses((previous) => [saved, ...previous]);
        setStatus("Analysis ready. Your export and results are saved in this browser only.");
      } else {
        const savedId = await saveCloudAnalysis(file.name.replace(/\.(txt|json)$/i, ""), platform, result.messages, result.summary);
        setActiveAnalysisId(savedId);
        const supabase = getSupabase();
        const { data: rows } = await supabase.from("analyses").select("id,title,platform,message_count,summary,created_at,expires_at").order("created_at", { ascending: false });
        if (rows) setCloudAnalyses(rows as CloudAnalysis[]);
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

  async function openLocal(analysis: SavedAnalysis) {
    setSummary(analysis.summary);
    setMessages(analysis.messages);
    setActiveTitle(analysis.title);
    setActivePlatform(analysis.platform);
    setActiveAnalysisId(analysis.id);
    setFile(null);
  }

  async function removeLocal(id: string) {
    if (!window.confirm("Delete this conversation and its local analysis from this browser?")) return;
    await deleteLocalAnalysis(id);
    const rows = await loadLocalAnalyses();
    setLocalAnalyses(rows);
      if (activeAnalysisId === id) {
      setSummary(null);
      setMessages([]);
      setActiveTitle("");
    }
  }

  async function removeCloud(id: string) {
    if (!window.confirm("Delete this conversation and all of its cloud messages? This cannot be undone.")) return;
    try {
      await deleteCloudAnalysis(id);
      setCloudAnalyses((rows) => rows.filter((row) => row.id !== id));
      if (activeAnalysisId === id) {
        setSummary(null);
        setMessages([]);
        setActiveTitle("");
      }
      setStatus("Cloud analysis deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete this cloud analysis.");
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setSummary(null);
    setMessages([]);
    setActiveTitle("");
    setActiveAnalysisId(null);
    setStatus("");
    setConsent(false);
  }

  const bars = summary?.dailyActivity.slice(-42) ?? [];
  const maxDay = Math.max(1, ...bars.map((item) => item.count));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark"><span className="brand-mark">l</span> loresync</Link>
        <div className="side-label">YOUR SPACE</div>
        <a className="side-link active" href="#workspace"><span className="side-icon">◫</span> Workspace</a>
        <a className="side-link" href="#import"><span className="side-icon">＋</span> Import a chat</a>
        <a className="side-link" href="#saved"><span className="side-icon">⌁</span> Saved analyses <span className="side-count">{mode === "local" ? localAnalyses.length : cloudAnalyses.length}</span></a>
        <div className="side-spacer" />
        <div className="privacy-card">
          <div className="privacy-symbol">✳</div>
          <div className="privacy-title">Your conversations, your call.</div>
          <p>Choose where each analysis lives. Switch modes any time.</p>
          <a href="#privacy">How privacy works <span>↗</span></a>
        </div>
        <Link href="/account" className="profile-link"><span className="profile-avatar">{userEmail?.[0]?.toUpperCase() ?? "S"}</span><span><b>{userEmail ?? "Personal workspace"}</b><small>{userEmail ? "Cloud account" : "No account needed"}</small></span><span className="profile-more">···</span></Link>
      </aside>

      <main className="main-content" id="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{summary ? activeTitle : "Overview"}</strong></div>
          <div className="top-actions"><span className="secure-label"><i /> Private workspace</span><Link href="/account" className="avatar-link">{userEmail?.[0]?.toUpperCase() ?? "↗"}</Link></div>
        </header>

        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">A LITTLE MORE CONTEXT</div>
              <h1>Make room for <em>your story.</em></h1>
              <p className="welcome-copy">Turn the conversations that matter into a timeline you can return to.</p>
            </div>
            <div className="date-stamp"><span className="stamp-orbit">◎</span><span>EST. IN THE MOMENTS<br /><b>YOU KEEP</b></span></div>
          </section>

          <section className="import-panel" id="import">
            <div className="panel-heading">
              <div><div className="eyebrow">START WITH A CHAT</div><h2>Bring a conversation in</h2></div>
              <span className="step-marker">01 <i /> 02</span>
            </div>
            <div className="mode-switch" role="tablist" aria-label="Choose where your analysis is saved">
              <button className={mode === "local" ? "mode-option selected" : "mode-option"} onClick={() => changeMode("local")} role="tab" aria-selected={mode === "local"}>
                <span className="mode-glyph local-glyph">⌂</span><span className="mode-text"><b>Keep it on this device</b><small>Private analysis · no account</small></span><span className="radio-mark" />
              </button>
              <button className={mode === "cloud" ? "mode-option selected" : "mode-option"} onClick={() => changeMode("cloud")} role="tab" aria-selected={mode === "cloud"}>
                <span className="mode-glyph cloud-glyph">↗</span><span className="mode-text"><b>Save to my cloud workspace</b><small>Sync across devices · account needed</small></span><span className="radio-mark" />
              </button>
            </div>

            {mode === "cloud" && (!cloudAvailable || !userEmail) && (
              <div className="cloud-gate">
                <span className="lock-mark">⌑</span>
                <div><b>{!cloudAvailable ? "Cloud workspace is not connected yet" : "Sign in to use cloud mode"}</b><p>{!cloudAvailable ? "Your local analysis is ready to use. Cloud signup becomes available after the project’s database keys are configured." : "Sign in before importing. You’ll review the cloud storage details before anything leaves this browser."}</p></div>
                <Link href="/account" className="small-link">{!cloudAvailable ? "Setup details" : "Open account"} ↗</Link>
              </div>
            )}

            {mode === "cloud" && cloudAvailable && userEmail && (
              <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I understand parsed message text and analysis will be saved to my account for one year, then deleted. The original export file stays on this device.</span></label>
            )}

            <label className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input type="file" accept=".txt,.json,text/plain,application/json" onChange={onFileInput} />
              <span className="upload-icon">{file ? "✓" : "↑"}</span>
              <span className="drop-title">{file ? file.name : "Drop your export here"}</span>
              <span className="drop-subtitle">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze` : "or choose a file from your device · up to 25 MB"}</span>
              <span className="browse-button">{file ? "Choose another" : "Choose export"}</span>
              <span className="format-hint"><b>WHATSAPP</b> .txt <i /> <b>DISCORD</b> .json</span>
            </label>
            <div className="import-footer">
              <p className="privacy-inline"><span>✳</span>{mode === "local" ? "Local mode: the export never leaves this browser." : "Cloud mode: parsed messages stay for one year; the source file stays here."}</p>
              <button className="analyze-button" onClick={analyze} disabled={!file || busy || (mode === "cloud" && (!cloudAvailable || !userEmail || !consent))}>{busy ? <><span className="button-spinner" /> Analyzing…</> : <>Analyze conversation <span>↗</span></>}</button>
            </div>
            {status && <p className="status-message" role="status">{status}</p>}
          </section>

          {summary && (
            <section className="analysis-section" aria-live="polite">
              <div className="section-heading"><div><div className="eyebrow">THE BIG PICTURE</div><h2>{activeTitle}</h2></div><span className="platform-chip">{activePlatform === "whatsapp" ? "WhatsApp" : "Discord"} · {mode === "local" ? "On this device" : "Cloud workspace"}</span></div>
              <div className="metrics-grid">
                <article className="metric-card"><span className="metric-label">MESSAGES</span><strong>{shortCount(summary.messageCount)}</strong><small>across your export</small></article>
                <article className="metric-card"><span className="metric-label">PEOPLE</span><strong>{summary.participantCount}</strong><small>distinct senders</small></article>
                <article className="metric-card"><span className="metric-label">ACTIVE DAYS</span><strong>{shortCount(summary.activeDays)}</strong><small>days with a message</small></article>
                <article className="metric-card"><span className="metric-label">MEDIA MARKERS</span><strong>{shortCount(summary.attachmentCount)}</strong><small>attachments referenced</small></article>
              </div>
              <div className="insights-grid">
                <article className="insight-card activity-card"><div className="card-title-row"><div><span className="metric-label">WHEN YOU TALKED</span><h3>A rhythm, over time</h3></div><span className="activity-period">LAST {bars.length} ACTIVE DAYS</span></div>
                  <div className="activity-chart" aria-label={`${bars.length} days of message activity`}>{bars.map((day) => <div className="activity-bar" key={day.date} title={`${formatDate(day.date)} · ${day.count} messages`}><i style={{ height: `${Math.max(4, (day.count / maxDay) * 100)}%` }} /></div>)}</div>
                  <div className="chart-caption"><span>{bars[0] ? formatDate(bars[0].date) : "—"}</span><span>{bars[bars.length - 1] ? formatDate(bars[bars.length - 1].date) : "—"}</span></div>
                </article>
                <article className="insight-card people-card"><div className="card-title-row"><div><span className="metric-label">IN THE CONVERSATION</span><h3>The voices in here</h3></div><span className="people-icon">↗</span></div>
                  <div className="participant-list">{summary.participants.slice(0, 5).map((person, index) => <div className="participant" key={person.name}><span className={`person-dot person-${index % 4}`} /> <span className="person-name">{person.name}</span><span className="person-count">{shortCount(person.count)}</span><span className="person-share"><i style={{ width: `${Math.round((person.count / summary.messageCount) * 100)}%` }} /></span></div>)}</div>
                </article>
              </div>
              <p className="date-range-note">From <b>{formatRange(summary.firstMessageAt, summary.lastMessageAt)}</b>. Your full chat stays attached to this analysis.</p>
            </section>
          )}

          <section className="saved-section" id="saved">
            <div className="section-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Saved analyses</h2></div><span className="section-count">{mode === "local" ? localAnalyses.length : cloudAnalyses.length} {mode === "local" ? "on this device" : "in your cloud"}</span></div>
            {(mode === "local" ? localAnalyses.length === 0 : cloudAnalyses.length === 0) ? (
              <div className="empty-saved"><span className="empty-orbit">◎</span><div><b>No saved stories yet</b><p>Your imported conversations will find a home here.</p></div><a href="#import">Import your first chat <span>↗</span></a></div>
            ) : (
              <div className="saved-list">{mode === "local" ? localAnalyses.map((analysis) => <article className="saved-row" key={analysis.id}><button className="saved-open" onClick={() => openLocal(analysis)}><span className={`platform-icon ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "w" : "d"}</span><span className="saved-copy"><b>{analysis.title}</b><small>{analysis.platform === "whatsapp" ? "WhatsApp" : "Discord"} · {formatRange(analysis.summary.firstMessageAt, analysis.summary.lastMessageAt)}</small></span><span className="saved-messages">{shortCount(analysis.summary.messageCount)} messages</span></button><button className="remove-analysis" onClick={() => removeLocal(analysis.id)} aria-label={`Delete ${analysis.title}`}>×</button></article>) : cloudAnalyses.map((analysis) => <article className="saved-row" key={analysis.id}><button className="saved-open" onClick={() => { setSummary(analysis.summary); setMessages([]); setActiveTitle(analysis.title); setActivePlatform(analysis.platform); setActiveAnalysisId(analysis.id); }}><span className={`platform-icon ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "w" : "d"}</span><span className="saved-copy"><b>{analysis.title}</b><small>{analysis.platform === "whatsapp" ? "WhatsApp" : "Discord"} · expires {formatDate(analysis.expires_at)}</small></span><span className="saved-messages">{shortCount(analysis.message_count)} messages</span></button><button className="remove-analysis" onClick={() => removeCloud(analysis.id)} aria-label={`Delete ${analysis.title}`}>×</button></article>)}</div>
            )}
          </section>

          <footer className="footer-note" id="privacy"><span>Made for the moments between the messages.</span><span><i /> Private by default · <Link href="/account">Account settings ↗</Link></span></footer>
        </div>
      </main>
    </div>
  );
}
