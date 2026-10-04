"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-provider";
import { useEffect, useState } from "react";
import type { CSSProperties, ChangeEvent, DragEvent } from "react";
import { buildDeepConversationReading, summarizeMessages, type ChatMessage, type ChatSummary, type DeepConversationReading } from "@loresync/core";
import { deleteCloudAnalysis, loadCloudAnalyses, loadCloudMessages, saveCloudAnalysis, type CloudAnalysisRecord } from "@/lib/cloud-store";
import { deleteLocalAnalysis, loadLocalAnalyses, saveLocalAnalysis, type SavedAnalysis } from "@/lib/local-store";
import { cloudAvailable, getSupabase } from "@/lib/supabase";
import { AccessGate } from "@/components/access-gate";
import { SiteFooter } from "@/components/site-footer";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Mode = "local" | "cloud";
type Platform = "whatsapp" | "discord";
type TimelineWindow = "30d" | "90d" | "all";
type PendingConfirmation = { kind: "local" | "cloud"; id: string; title: string };

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

function formatReplyTime(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${Math.round(hours * 10) / 10} hr` : `${Math.round(hours / 24 * 10) / 10} days`;
}

function formatAverageReplyTime(minutes: number | null | undefined) {
  if (minutes == null) return "No reply pattern yet";
  if (minutes < 60) return `${minutes} min avg reply`;
  if (minutes < 24 * 60) return `${(minutes / 60).toFixed(1)} hr avg reply`;
  return `${(minutes / 1440).toFixed(1)} day avg reply`;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function WorkspaceContent({ initialView = "home" }: { initialView?: "home" | "import" }) {
  const [mode, setMode] = useState<Mode>("local");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyStage, setBusyStage] = useState<"reading" | "analyzing" | "saving" | null>(null);
  const [status, setStatus] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [deepReading, setDeepReading] = useState<DeepConversationReading | null>(null);
  const [compareVoices, setCompareVoices] = useState<[string, string]>(["", ""]);
  const [deepScanStatus, setDeepScanStatus] = useState("");
  const [deepScanning, setDeepScanning] = useState(false);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [messageQuery, setMessageQuery] = useState("");
  const [messageSender, setMessageSender] = useState("");
  const [messageFrom, setMessageFrom] = useState("");
  const [messageTo, setMessageTo] = useState("");
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>("all");
  const [selectedHeatCell, setSelectedHeatCell] = useState<{ day: number; hour: number } | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [activePlatform, setActivePlatform] = useState<Platform>("whatsapp");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [localAnalyses, setLocalAnalyses] = useState<SavedAnalysis[]>([]);
  const [cloudAnalyses, setCloudAnalyses] = useState<CloudAnalysisRecord[]>([]);
  const [cloudNextCursor, setCloudNextCursor] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState("");
  const [loadingMoreCloud, setLoadingMoreCloud] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cloudCopyConsent, setCloudCopyConsent] = useState(false);
  const [cloudCopyStatus, setCloudCopyStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    loadLocalAnalyses().then(setLocalAnalyses).catch(() => setStatus("This browser could not open local storage.")).finally(() => setLocalLoading(false));
    try {
      const preferred = JSON.parse(window.localStorage.getItem("loresync-profile-v1") ?? "null")?.defaultStorage;
      // Hydrate the browser preference after the stable server render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (preferred === "local" || preferred === "cloud") setMode(preferred);
    } catch { /* Keep the private local default if preferences cannot be read. */ }
    if (!cloudAvailable) { setCloudLoading(false); setAuthReady(true); return; }
    let alive = true;
    const supabase = getSupabase();
    const syncSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!alive) return;
      setUserEmail(session?.user.email ?? null);
      setAuthReady(true);
      if (!session) { setCloudLoading(false); return; }
      try {
        const response = await fetch("/api/profile", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("profile" in result)) return;
        const profile = (result as { profile?: { default_storage?: unknown } | null }).profile;
        const preferred = profile?.default_storage;
        if (!alive || (preferred !== "local" && preferred !== "cloud")) return;
        setMode(preferred);
        try {
          const localProfile = JSON.parse(window.localStorage.getItem("loresync-profile-v1") ?? "null");
          window.localStorage.setItem("loresync-profile-v1", JSON.stringify({ ...(localProfile && typeof localProfile === "object" ? localProfile : {}), defaultStorage: preferred }));
        } catch { /* Cloud remains the source of truth when this browser cannot persist preferences. */ }
      } catch { /* Keep the local choice when the account preference cannot be reached. */ }
    };
    supabase.auth.getSession().then(({ data }) => { void syncSession(data.session); }).catch(() => { if (alive) { setAuthReady(true); setCloudLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
      if (!session) { setCloudAnalyses([]); setCloudNextCursor(null); setCloudError(""); setCloudLoading(false); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!cloudAvailable || !authReady || !userEmail) {
      // Auth state determines whether the cloud list is still loading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (authReady && !userEmail) setCloudLoading(false);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    setCloudError("");
    loadCloudAnalyses()
      .then((page) => { if (!cancelled) { setCloudAnalyses(page.analyses); setCloudNextCursor(page.nextCursor); } })
      .catch(() => { if (!cancelled) setCloudError("Could not load your cloud conversations. Your archive is still safely stored."); })
      .finally(() => { if (!cancelled) setCloudLoading(false); });
    return () => { cancelled = true; };
  }, [authReady, userEmail]);

  useEffect(() => {
    if (mode !== "cloud" || !activeAnalysisId) return;
    if (messageQuery.trim().length > 0 && messageQuery.trim().length < 3) {
      const timer = window.setTimeout(() => {
        setMessageLoading(false);
        setMessageError("Search needs at least three characters in cloud mode.");
        setActiveMessages([]);
        setMessageCursor(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setMessageLoading(true);
      setMessageError("");
      loadCloudMessages(activeAnalysisId, { query: messageQuery.trim(), sender: messageSender, from: messageFrom ? `${messageFrom}T00:00:00.000Z` : undefined, to: messageTo ? `${messageTo}T23:59:59.999Z` : undefined })
        .then((page) => {
          if (!cancelled) { setActiveMessages(page.messages); setMessageCursor(page.nextCursor); }
        })
        .catch((error) => {
          if (!cancelled) setMessageError(error instanceof Error ? error.message : "Could not load conversation messages.");
        })
        .finally(() => { if (!cancelled) setMessageLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [mode, activeAnalysisId, messageQuery, messageSender, messageFrom, messageTo]);

  async function loadMoreCloud() {
    if (!cloudNextCursor || loadingMoreCloud) return;
    setLoadingMoreCloud(true);
    try {
      const page = await loadCloudAnalyses(cloudNextCursor);
      setCloudAnalyses((current) => [...current, ...page.analyses.filter((next) => !current.some((row) => row.id === next.id))]);
      setCloudNextCursor(page.nextCursor);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load the next archive page.");
    } finally {
      setLoadingMoreCloud(false);
    }
  }

  async function retryCloudLoad() {
    setCloudError("");
    setCloudLoading(true);
    try {
      const page = await loadCloudAnalyses();
      setCloudAnalyses(page.analyses);
      setCloudNextCursor(page.nextCursor);
    } catch {
      setCloudError("Could not load your cloud conversations. Your archive is still safely stored.");
    } finally {
      setCloudLoading(false);
    }
  }

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
    setDeepReading(null);
    setDeepScanStatus("");
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
    setBusyStage("reading");
    setStatus(mode === "local" ? "Reading your export on this device…" : "Preparing your cloud analysis…");
    try {
      const text = await file.text();
      setBusyStage("analyzing");
      setStatus(`Read ${(file.size / 1024 / 1024).toFixed(1)} MB. Analyzing messages on this device…`);
      const result = await new Promise<{ messages: ChatMessage[]; summary: ChatSummary; deepReading: DeepConversationReading }>((resolve, reject) => {
        const worker = new Worker(new URL("../../lib/import.worker.ts", import.meta.url), { type: "module" });
        let timeout: number;
        const stopWorker = () => { window.clearTimeout(timeout); worker.terminate(); };
        const armTimeout = () => {
          window.clearTimeout(timeout);
          timeout = window.setTimeout(() => { stopWorker(); reject(new Error("Analysis stopped responding after two minutes. Refresh the page and try the export again.")); }, 120_000);
        };
        armTimeout();
        worker.onmessage = (event: MessageEvent<{ ok?: boolean; progress?: string; messages?: ChatMessage[]; summary?: ChatSummary; deepReading?: DeepConversationReading; error?: string }>) => {
          if (event.data.progress) {
            setStatus(event.data.progress);
            armTimeout();
            return;
          }
          stopWorker();
          if (!event.data.ok || !event.data.messages || !event.data.summary || !event.data.deepReading) reject(new Error(event.data.error ?? "Could not analyze this export."));
          else resolve({ messages: event.data.messages, summary: event.data.summary, deepReading: event.data.deepReading });
        };
        worker.onerror = () => { stopWorker(); reject(new Error("The import worker stopped unexpectedly. Try exporting the chat again and re-uploading it.")); };
        worker.postMessage({ name: file.name, text });
      });
      const platform = result.messages[0].platform;
      const title = file.name.replace(/\.(txt|json)$/i, "");
      setSummary(result.summary);
      setDeepReading(result.deepReading);
      setDeepScanStatus("Patterns found on this device from the full conversation.");
      // Keep the complete parse result out of React state in cloud mode. The
      // cloud archive view loads messages in pages after the save completes;
      // rendering a 100k+ message array here can lock up the whole tab.
      setActiveMessages(mode === "local" ? result.messages : []);
      setActiveTitle(title);
      setActivePlatform(platform);
      setBusyStage("saving");
      if (mode === "local") {
        const saved: SavedAnalysis = { id: crypto.randomUUID(), title, platform, summary: result.summary, messages: result.messages, savedAt: new Date().toISOString() };
        await saveLocalAnalysis(saved);
        setActiveAnalysisId(saved.id);
        setLocalAnalyses((previous) => [saved, ...previous]);
        setStatus("Your story is ready. The export and analysis are saved in this browser only.");
      } else {
        const saved = await saveCloudAnalysis(title, platform, result.messages, consent, (count, total, retryAfterMs) => {
          setStatus(retryAfterMs
            ? `Cloud archive is busy. Resuming in about ${Math.ceil(retryAfterMs / 1000)} seconds · ${count.toLocaleString()} of ${total.toLocaleString()} saved…`
            : `Saving messages to your cloud archive · ${count.toLocaleString()} of ${total.toLocaleString()}…`);
        });
        setActiveAnalysisId(saved.id);
        setSummary(saved.summary);
        setStatus("Cloud analysis saved. The original export stayed in your browser.");
        setFile(null);
        try {
          const page = await loadCloudAnalyses();
          setCloudAnalyses(page.analyses);
          setCloudNextCursor(page.nextCursor);
          setCloudError("");
        } catch {
          // The analysis is already persisted; a failed archive refresh must not present it as a failed import.
          setCloudError("Your analysis was saved, but the archive list could not refresh. Reload the page to see it.");
        }
        return;
      }
      setFile(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not analyze this export.");
      setSummary(null);
    } finally {
      setBusy(false);
      setBusyStage(null);
    }
  }

  function openLocal(analysis: SavedAnalysis) {
    setSummary(summarizeMessages(analysis.messages));
    setDeepReading(buildDeepConversationReading(analysis.messages));
    setDeepScanStatus("Patterns found on this device from the full conversation.");
    setActiveMessages(analysis.messages);
    setMessageQuery("");
    setMessageSender("");
    setMessageFrom("");
    setMessageTo("");
    setMessageError("");
    setActiveTitle(analysis.title);
    setActivePlatform(analysis.platform);
    setActiveAnalysisId(analysis.id);
  }

  function openCloud(analysis: CloudAnalysisRecord) {
    setSummary(analysis.summary);
    setDeepReading(null);
    setDeepScanStatus("");
    setActiveMessages([]);
    setMessageQuery("");
    setMessageSender("");
    setMessageFrom("");
    setMessageTo("");
    setMessageCursor(null);
    setMessageError("");
    setActiveTitle(analysis.title);
    setActivePlatform(analysis.platform);
    setActiveAnalysisId(analysis.id);
  }

  async function saveCurrentLocalToCloud() {
    if (!activeTitle || !activeMessages.length || !cloudCopyConsent || !cloudAvailable || !userEmail || busy) return;
    setBusy(true);
    setCloudCopyStatus("Preparing your cloud copy…");
    try {
      await saveCloudAnalysis(activeTitle, activePlatform, activeMessages, cloudCopyConsent, (count, total, retryAfterMs) => {
        setCloudCopyStatus(retryAfterMs
          ? `Cloud archive is busy. Resuming in about ${Math.ceil(retryAfterMs / 1000)} seconds · ${count.toLocaleString()} of ${total.toLocaleString()} saved…`
          : `Saving ${count.toLocaleString()} of ${total.toLocaleString()} messages…`);
      });
      setCloudCopyConsent(false);
      setCloudCopyStatus("Cloud copy saved. Open My cloud archive in another browser to find it.");
      try {
        const page = await loadCloudAnalyses();
        setCloudAnalyses(page.analyses);
        setCloudNextCursor(page.nextCursor);
        setCloudError("");
      } catch {
        setCloudError("Your cloud copy was saved, but the archive list could not refresh. Reload the page to see it.");
      }
    } catch (error) {
      setCloudCopyStatus(error instanceof Error ? error.message : "Could not save this cloud copy.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreMessages() {
    if (mode !== "cloud" || !activeAnalysisId || !messageCursor || messageLoading) return;
    setMessageLoading(true);
    try {
      const page = await loadCloudMessages(activeAnalysisId, { query: messageQuery.trim(), sender: messageSender, cursor: messageCursor, from: messageFrom ? `${messageFrom}T00:00:00.000Z` : undefined, to: messageTo ? `${messageTo}T23:59:59.999Z` : undefined });
      setActiveMessages((current) => [...current, ...page.messages]);
      setMessageCursor(page.nextCursor);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not load more messages.");
    } finally {
      setMessageLoading(false);
    }
  }

  function focusMessageExplorer() {
    window.setTimeout(() => document.getElementById("message-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function exploreDay(day: string) {
    const index = activity.findIndex((item) => item.date === day);
    if (index >= 0) setReplayIndex(index);
    setMessageFrom(day);
    setMessageTo(day);
    setMessageQuery("");
    focusMessageExplorer();
  }

  function exploreDateRange(day: string) {
    const index = activity.findIndex((item) => item.date === day);
    if (index >= 0) setReplayIndex(index);
    const anchor = messageFrom || day;
    setMessageFrom(anchor < day ? anchor : day);
    setMessageTo(anchor > day ? anchor : day);
    setMessageQuery("");
    focusMessageExplorer();
  }

  function exploreMonth(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const monthStart = `${month}-01`;
    setMessageFrom(cutoffActivityDate && cutoffActivityDate > monthStart ? cutoffActivityDate : monthStart);
    setMessageTo(latestActivityDate && latestActivityDate < lastDay ? latestActivityDate : lastDay);
    setMessageQuery("");
    focusMessageExplorer();
  }

  function exploreVoice(sender: string) {
    setMessageSender(sender);
    setMessageQuery("");
    focusMessageExplorer();
  }

  function exploreTerm(term: string) {
    setMessageQuery(term);
    setMessageSender("");
    setMessageFrom("");
    setMessageTo("");
    focusMessageExplorer();
  }

  function clearMessageFilters() {
    setMessageFrom("");
    setMessageTo("");
    setMessageSender("");
    setMessageQuery("");
  }

  async function scanCloudForPatterns() {
    if (mode !== "cloud" || !activeAnalysisId || deepScanning) return;
    setDeepScanning(true);
    setDeepScanStatus("Reading the full cloud archive in this browser…");
    try {
      const allMessages: ChatMessage[] = [];
      let cursor: string | undefined;
      let nextCursor: string | null = null;
      do {
        const page = await loadCloudMessages(activeAnalysisId, { cursor, limit: 100 });
        allMessages.push(...page.messages);
        nextCursor = page.nextCursor;
        cursor = page.nextCursor ?? undefined;
        setDeepScanStatus(`Reading the full cloud archive in this browser… ${allMessages.length.toLocaleString()} messages`);
      } while (nextCursor);
      if (!allMessages.length) throw new Error("No messages were returned for this conversation.");
      setSummary(summarizeMessages(allMessages));
      setDeepReading(buildDeepConversationReading(allMessages));
      setDeepScanStatus(`Patterns calculated from all ${allMessages.length.toLocaleString()} messages in this browser.`);
    } catch (error) {
      setDeepScanStatus(error instanceof Error ? error.message : "Could not scan the full cloud archive.");
    } finally {
      setDeepScanning(false);
    }
  }

  async function confirmRemoval() {
    if (!pendingConfirmation) return;
    const { id, kind } = pendingConfirmation;
    try {
      if (kind === "local") {
        await deleteLocalAnalysis(id);
        setLocalAnalyses(await loadLocalAnalyses());
      } else {
        await deleteCloudAnalysis(id);
        setCloudAnalyses((rows) => rows.filter((row) => row.id !== id));
      }
      if (activeAnalysisId === id) { setSummary(null); setDeepReading(null); setDeepScanStatus(""); setActiveMessages([]); setActiveTitle(""); setActiveAnalysisId(null); }
      if (kind === "cloud") setStatus("Cloud analysis deleted.");
      setPendingConfirmation(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not delete this ${kind} conversation.`);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setSummary(null);
    setDeepReading(null);
    setDeepScanStatus("");
    setActiveMessages([]);
    setMessageQuery("");
    setMessageSender("");
    setMessageFrom("");
    setMessageTo("");
    setMessageCursor(null);
    setMessageError("");
    setActiveTitle("");
    setActiveAnalysisId(null);
    setStatus("");
    setConsent(false);
    setCloudCopyConsent(false);
    setCloudCopyStatus("");
  }

  const allDailyActivity = summary?.dailyActivity ?? [];
  const latestActivityDate = allDailyActivity.at(-1)?.date;
  const cutoffActivityDate = latestActivityDate && timelineWindow !== "all"
    ? (() => { const date = new Date(`${latestActivityDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - Number.parseInt(timelineWindow, 10)); return date.toISOString().slice(0, 10); })()
    : "";
  const timelineDays = cutoffActivityDate ? allDailyActivity.filter((day) => day.date >= cutoffActivityDate) : allDailyActivity;
  const activity = timelineDays;
  const replayDay = activity[Math.min(replayIndex, Math.max(0, activity.length - 1))];
  const previousReplayDay = replayIndex > 0 ? activity[replayIndex - 1] : undefined;
  const replayChange = replayDay && previousReplayDay ? Math.round((replayDay.count - previousReplayDay.count) / Math.max(1, previousReplayDay.count) * 100) : null;
  useEffect(() => {
    if (!replayPlaying || activity.length < 2) return;
    const timer = window.setInterval(() => setReplayIndex((index) => index >= activity.length - 1 ? 0 : index + 1), 850);
    return () => window.clearInterval(timer);
  }, [replayPlaying, activity.length]);
  const maxDay = Math.max(1, ...activity.map((day) => day.count));
  const weekdayActivity = summary?.weekdayActivity ?? [];
  const peakWeekday = weekdayActivity.length ? weekdayActivity.indexOf(Math.max(...weekdayActivity)) : -1;
  const hourlyActivity = summary?.hourlyActivity ?? [];
  const maxHour = Math.max(1, ...hourlyActivity);
  const monthlyActivity = timelineDays.reduce<{ month: string; count: number }[]>((months, day) => {
    const month = day.date.slice(0, 7);
    const previous = months[months.length - 1];
    if (previous?.month === month) previous.count += day.count;
    else months.push({ month, count: day.count });
    return months;
  }, []);
  const maxMonth = Math.max(1, ...monthlyActivity.map((month) => month.count));
  const monthLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
  const deepMaxWord = Math.max(1, ...(deepReading?.commonWords.map((item) => item.count) ?? []));
  const deepMaxLength = Math.max(1, ...(deepReading?.messageLengths.map((item) => item.count) ?? []));
  const selectedHeatDay = selectedHeatCell && deepReading ? selectedHeatCell.day : -1;
  const selectedHeatHour = selectedHeatCell && deepReading ? selectedHeatCell.hour : -1;
  const selectedHeatCount = selectedHeatDay >= 0 && selectedHeatHour >= 0 ? deepReading?.weekdayHours[selectedHeatDay]?.[selectedHeatHour] ?? 0 : 0;
  const selectedHeatDate = selectedHeatDay >= 0 && selectedHeatHour >= 0 ? deepReading?.weekdayHourPeakDates[selectedHeatDay]?.[selectedHeatHour] ?? null : null;
  const compareVoiceOptions = deepReading?.participantStyles ?? [];
  const compareVoiceA = compareVoiceOptions.find((person) => person.name === compareVoices[0]);
  const compareVoiceB = compareVoiceOptions.find((person) => person.name === compareVoices[1]);
  const visibleMessages = mode === "local"
    ? activeMessages.filter((message) => (!messageSender || message.sender === messageSender)
      && (!messageQuery.trim() || message.content.toLocaleLowerCase().includes(messageQuery.trim().toLocaleLowerCase()))
      && (!messageFrom || message.timestamp.slice(0, 10) >= messageFrom)
      && (!messageTo || message.timestamp.slice(0, 10) <= messageTo))
      .slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50)
    : activeMessages.slice(0, 50);
  const analysisCount = mode === "local" ? localAnalyses.length : cloudAnalyses.length;
  const analysisLoading = mode === "local" ? localLoading : cloudLoading;
  const busyLabel = busyStage === "reading" ? "Reading file" : busyStage === "analyzing" ? "Finding the conversation’s shape" : "Saving your analysis";

  return (
    <div className={`archive-app ${initialView === "import" ? "is-import-workspace" : "is-home-workspace"}`}>
      <aside className="archive-rail">
        <Brand className="wordmark" markClassName="archive-mark" />
        <div className="rail-kicker">WORKSPACE</div>
        <nav className="rail-nav" aria-label="Workspace">
          <Link className={`rail-link ${initialView === "home" ? "active" : ""}`} href="/workspace#top"><span className="rail-glyph">⌂</span><span>Overview</span>{initialView === "home" && <span className="rail-active-dot" />}</Link>
          <Link className={`rail-link ${initialView === "import" ? "active" : ""}`} href="/workspace/import"><span className="rail-glyph">＋</span><span>New analysis</span>{initialView === "import" && <span className="rail-active-dot" />}</Link>
          <Link className="rail-link" href="/workspace#saved"><span className="rail-glyph">◷</span><span>Conversations</span><span className="rail-counter">{analysisCount.toString().padStart(2, "0")}</span></Link>
        </nav>
        <div className="rail-lower">
          <div className="rail-constellation" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span /></div>
          <p className="rail-note">Your conversations,<br />with a little more context.</p>
          <div className="rail-status"><span className="status-light" /><span>{mode === "local" ? "STORED ON THIS DEVICE" : "CLOUD ARCHIVE"}</span></div>
        </div>
        <div className="rail-version">LoreSync <span>—</span> FIELD NOTES Nº 01</div>
      </aside>

      <div className="archive-main">
        <header className="archive-topbar">
          <div className="topbar-crumb"><span>LoreSync</span><i>/</i><b>{summary ? activeTitle : "WORKSPACE"}</b></div>
          <div className="topbar-tools"><span className="vault-indicator"><i />{mode === "local" ? "ON-DEVICE VAULT" : "CLOUD VAULT"}</span><span className="topbar-rule" /><ThemeToggle /><Link href="/profile" className="profile-home-button"><span>{userEmail?.[0]?.toUpperCase() ?? "S"}</span><b>Profile</b></Link></div>
        </header>

        <main className="archive-content" id="top">
          <section className={`hero-stage ${initialView === "import" ? "import-hero" : ""}`}>
            <div className="hero-copy">
              <div className="chapter-line"><span>{initialView === "import" ? "01 / MAKE A PRIVATE READING" : "YOUR CONVERSATION WORKSPACE"}</span></div>
              <h1>{initialView === "import" ? <>Bring the conversation<br /><em>back into view.</em></> : <>The shape of<br />your <em>conversations.</em></>}</h1>
              <p>{initialView === "import" ? "Start with an export. Choose where it lives. Take your time with what it holds." : "See when you talk, who keeps the thread going, and how your chats change over time."}</p>
            </div>
            {initialView === "home" && <><div className="hero-art-wrap"><OrbitArtwork /></div><div className="hero-edge-note">A PRIVATE PLACE<br />TO REMEMBER</div></>}
          </section>

          {initialView === "home" && <section className="new-chat-invitation"><div><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h2>Every conversation<br /><em>has its own rhythm.</em></h2></div><div className="invitation-action"><p>Bring in a chat export and look back at the moments, voices, and days that made it yours.</p><Link href="/workspace/import" className="invitation-link">Start with a chat <span>↗</span></Link></div></section>}

          {initialView === "import" && <section className="import-section editorial-import" id="import">
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
                <div className="import-action-row"><p><span className="privacy-spark">✳</span>{mode === "local" ? "Parsed here. Stored here. Yours to remove." : "Only parsed messages are saved. The export file stays here."}</p><button className="open-button" onClick={analyze} disabled={!file || busy || (mode === "cloud" && (!cloudAvailable || !userEmail || !consent))} aria-busy={busy}>{busy ? <><i className="button-spinner" /> {busyLabel}…</> : <>Analyze conversation <span>↗</span></>}</button></div>
                {busy && <div className="import-progress" role="status" aria-live="polite"><div className="import-progress-track"><i /></div><span>{busyLabel} · keep this page open</span></div>}
                {status && <p className="import-status" role="status">{status}</p>}
              </div>

              <aside className="storage-choice" role="radiogroup" aria-label="Choose where this conversation is stored">
                <div className="storage-label">CHOOSE ITS HOME <span>?</span></div>
                <button className={`storage-option ${mode === "local" ? "selected" : ""}`} onClick={() => changeMode("local")} role="radio" aria-checked={mode === "local"}>
                  <span className="storage-symbol local-symbol">⌂</span><span className="storage-copy"><b>This device</b><small>Private · stored in this browser</small></span><i className="storage-radio" />
                </button>
                <button className={`storage-option ${mode === "cloud" ? "selected" : ""}`} onClick={() => changeMode("cloud")} role="radio" aria-checked={mode === "cloud"}>
                  <span className="storage-symbol cloud-symbol">↗</span><span className="storage-copy"><b>My cloud archive</b><small>{userEmail ? "Sync across browsers with your account" : "Sign in to sync across browsers"}</small></span><i className="storage-radio" />
                </button>
                {mode === "cloud" && (!cloudAvailable || !userEmail) && <div className="cloud-gate"><span>{!cloudAvailable ? "Cloud keys not connected yet." : "Sign in before opening a cloud archive."}</span><Link href="/account">{!cloudAvailable ? "Setup" : "Account"} ↗</Link></div>}
                {mode === "cloud" && cloudAvailable && userEmail && <label className="consent-note"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to save parsed messages here for one year. The source export is never sent.</span></label>}
                <div className="storage-footnote"><span>✳</span><p>Local mode keeps everything in this browser. Cloud mode gives you a year to revisit it, with deletion always in your hands.</p></div>
              </aside>
            </div>
          </section>}

          {summary && (
            <section className="story-section" aria-live="polite">
              <div className="section-overline"><span>02 / THE READING</span><span>{platformLabel(activePlatform).toUpperCase()} · {mode === "local" ? "ON THIS DEVICE" : "CLOUD ARCHIVE"}</span></div>
              <div className="story-title-row"><div><div className="eyebrow">A FIRST LOOK INSIDE</div><h2>{activeTitle}</h2></div><span className="story-date">{formatDate(summary.firstMessageAt)} <i>—</i> {formatDate(summary.lastMessageAt)}</span></div>
              {mode === "local" && activeAnalysisId && activeMessages.length > 0 && <div className="cloud-copy-panel">
                <div><span className="eyebrow">KEEP THIS CHAT WITH YOUR ACCOUNT</span><h3>Open it from another browser.</h3><p>This conversation is currently stored only in this browser. Save a separate cloud copy to see it wherever you sign in.</p></div>
                {cloudAvailable && userEmail ? <div className="cloud-copy-actions"><label><input type="checkbox" checked={cloudCopyConsent} onChange={(event) => setCloudCopyConsent(event.target.checked)} /><span>I agree to save these parsed messages in my cloud archive for one year. The original export stays on this device.</span></label><button type="button" className="open-button" onClick={saveCurrentLocalToCloud} disabled={!cloudCopyConsent || busy}>{busy ? "SAVING CLOUD COPY…" : "SAVE A CLOUD COPY ↗"}</button>{cloudCopyStatus && <p role="status">{cloudCopyStatus}</p>}</div> : <div className="cloud-copy-actions"><p>{!cloudAvailable ? "Cloud storage is not configured for this app." : "Sign in to make this chat available in another browser."}</p><Link href={!cloudAvailable ? "/account" : "/account"}>Account & cloud setup ↗</Link></div>}
              </div>}
              <div className="story-metrics">
                <article><span>MESSAGES KEPT</span><strong>{shortCount(summary.messageCount)}</strong><small>words sent into the world</small></article>
                <article><span>VOICES HERE</span><strong>{summary.participantCount.toString().padStart(2, "0")}</strong><small>distinct participants</small></article>
                <article><span>DAYS SHARED</span><strong>{shortCount(summary.activeDays)}</strong><small>with a message in them</small></article>
                <article><span>ATTACHMENTS</span><strong>{shortCount(summary.attachmentCount)}</strong><small>media markers found</small></article>
              </div>
              <div className="story-metrics story-deep-metrics">
                <article><span>MEDIAN REPLY</span><strong>{formatReplyTime(summary.medianReplyMinutes)}</strong><small>{summary.replyCount ?? 0} back-and-forths · gaps under 24 hours</small></article>
                <article><span>REPLIES WITHIN AN HOUR</span><strong>{summary.quickReplyPercent == null ? "—" : `${summary.quickReplyPercent}%`}</strong><small>{summary.replyCount ? "of observed replies" : "not enough reply pairs yet"}</small></article>
                <article><span>WORDS PER MESSAGE</span><strong>{summary.averageMessageWords?.toFixed(1) ?? "—"}</strong><small>average across non-empty messages</small></article>
                <article><span>BUSIEST WEEKDAY</span><strong>{peakWeekday >= 0 ? weekdayLabels[peakWeekday] : "—"}</strong><small>{peakWeekday >= 0 ? `${shortCount(weekdayActivity[peakWeekday])} messages` : "weekday pattern unavailable"}</small></article>
              </div>
              <div className="timeline-toolbar">
                <div><span>EXPLORE THE ARCHIVE</span><b>{timelineWindow === "all" ? "All available activity" : `Last ${timelineWindow === "30d" ? "30" : "90"} days of activity`}</b></div>
                <div className="timeline-window-buttons" role="group" aria-label="Choose the timeline window">
                  {([{ value: "30d", label: "30 DAYS" }, { value: "90d", label: "90 DAYS" }, { value: "all", label: "ALL TIME" }] as const).map((option) => <button type="button" key={option.value} aria-pressed={timelineWindow === option.value} onClick={() => setTimelineWindow(option.value)}>{option.label}</button>)}
                </div>
                <p>Choose a window, then select a day, month, or voice. Shift-click a second day to explore a date range.</p>
              </div>
              <div className="story-visuals">
                <article className="rhythm-panel">
                  <div className="visual-heading"><div><span>THE CONVERSATION, IN TIME</span><h3>Some days leave a longer echo.</h3></div><span className="visual-stamp">UTC · {activity.length} ACTIVE DAYS</span></div>
                  {replayDay && <div className="timeline-replay" aria-label="Conversation time travel controls">
                    <div className="replay-readout"><div><span>NOW EXPLORING</span><b>{formatDate(replayDay.date)}</b><small>{shortCount(replayDay.count)} messages {replayChange == null ? "· first active day" : `· ${replayChange > 0 ? "+" : ""}${replayChange}% vs previous active day`}</small></div><button type="button" className={`replay-play ${replayPlaying ? "is-playing" : ""}`} onClick={() => { if (replayIndex >= activity.length - 1 && !replayPlaying) setReplayIndex(0); setReplayPlaying((playing) => !playing); }} disabled={activity.length < 2} aria-label={replayPlaying ? "Pause conversation replay" : "Play conversation replay"}>{replayPlaying ? "Ⅱ" : "▶"}<span>{replayPlaying ? "PAUSE" : "PLAY THE YEARS"}</span></button></div>
                    <div className="replay-scrubber"><button type="button" onClick={() => { setReplayPlaying(false); setReplayIndex((index) => Math.max(0, index - 1)); }} disabled={replayIndex <= 0} aria-label="Previous active day">←</button><input type="range" min="0" max={Math.max(0, activity.length - 1)} value={Math.min(replayIndex, activity.length - 1)} onChange={(event) => { setReplayPlaying(false); setReplayIndex(Number(event.target.value)); }} aria-label="Move through active days" /><button type="button" onClick={() => { setReplayPlaying(false); setReplayIndex((index) => Math.min(activity.length - 1, index + 1)); }} disabled={replayIndex >= activity.length - 1} aria-label="Next active day">→</button></div>
                    <div className="replay-footer"><span>{activity[0] ? formatDate(activity[0].date) : "—"}</span><button type="button" onClick={() => exploreDay(replayDay.date)}>OPEN THIS DAY’S MESSAGES ↗</button><span>{activity.at(-1) ? formatDate(activity.at(-1)!.date) : "—"}</span></div>
                  </div>}
                  <div className="rhythm-scroll"><div className="rhythm-chart" aria-label="Daily message activity by participant over time" style={{ minWidth: `${Math.max(180, activity.length * 9)}px` }}>{activity.map((day, index) => <button type="button" className={`rhythm-column ${index === replayIndex ? "is-replay-day" : ""} ${messageFrom && messageTo && messageFrom <= day.date && messageTo >= day.date ? "is-selected" : ""}`} key={day.date} title={`${formatDate(day.date)} · ${day.count} messages. Click to open this day; Shift-click to set a range.`} aria-label={`Explore ${day.count} messages from ${formatDate(day.date)}`} aria-pressed={index === replayIndex} onClick={(event) => { setReplayPlaying(false); if (event.shiftKey && messageFrom) exploreDateRange(day.date); else exploreDay(day.date); }}><i style={{ height: `${Math.max(3, (day.count / maxDay) * 100)}%` }}>{day.participants?.length ? day.participants.map((participant) => <span key={participant.name} className={`timeline-speaker-segment speaker-tone-${Math.max(0, summary.participants.findIndex((item) => item.name === participant.name)) % 5}`} style={{ height: `${participant.count / day.count * 100}%` }} title={`${participant.name}: ${participant.count}`} />) : <span className="timeline-speaker-segment speaker-tone-0" style={{ height: "100%" }} />}</i></button>)}</div></div>
                  <div className="rhythm-dates"><span>{activity[0] ? formatDate(activity[0].date) : "—"}</span><span>{activity[activity.length - 1] ? formatDate(activity[activity.length - 1].date) : "—"}</span></div>
                  <div className="timeline-speaker-legend">{summary.participants.slice(0, 5).map((person, index) => <span key={person.name}><i className={`speaker-tone-${index}`} />{person.name}</span>)}</div>
                </article>
                <article className="voices-panel">
                  <div className="visual-heading"><div><span>THE PEOPLE IN IT</span><h3>Every voice, its own cadence.</h3></div><span className="voice-seal">↗</span></div>
                  <div className="voice-list">{summary.participants.slice(0, 5).map((person, index) => <button type="button" className={`voice-row ${messageSender === person.name ? "is-selected" : ""}`} key={person.name} aria-pressed={messageSender === person.name} onClick={() => exploreVoice(person.name)} title={`Open messages from ${person.name}`}><span className={`voice-dot voice-${index % 4}`} /><span className="voice-name">{person.name}</span><span className="voice-share"><i style={{ width: `${Math.max(2, (person.count / summary.messageCount) * 100)}%` }} /></span><span className="voice-count">{shortCount(person.count)}</span></button>)}</div>
                </article>
                <article className="pattern-panel">
                  <div className="visual-heading"><div><span>WEEKLY RHYTHM</span><h3>When the conversation finds time.</h3></div><span className="visual-stamp">UTC · ALL MESSAGES</span></div>
                  {weekdayActivity.length === 7 ? <div className="weekday-chart" aria-label="Message activity by weekday">{weekdayActivity.map((count, index) => <div className="weekday-column" key={weekdayLabels[index]} title={`${weekdayLabels[index]} · ${count} messages`}><i style={{ height: `${Math.max(3, (count / Math.max(1, ...weekdayActivity)) * 100)}%` }} /><span>{weekdayLabels[index]}</span></div>)}</div> : <p className="pattern-unavailable">Weekday patterns are available for newly analyzed conversations.</p>}
                </article>
                <article className="pattern-panel">
                  <div className="visual-heading"><div><span>HOUR OF DAY</span><h3>Some hours bring more words.</h3></div><span className="visual-stamp">UTC · 24 HOURS</span></div>
                  <div className="hour-chart" aria-label="Message activity by hour">{hourlyActivity.map((count, hour) => <div className="hour-column" key={hour} title={`${String(hour).padStart(2, "0")}:00 · ${count} messages`}><i style={{ height: `${Math.max(3, (count / maxHour) * 100)}%` }} />{hour % 6 === 0 && <span>{String(hour).padStart(2, "0")}</span>}</div>)}</div>
                  <p className="pattern-caption">Time of day is shown in UTC so the same archive reads consistently across devices.</p>
                </article>
              </div>
              <p className="story-footnote"><span>i</span> Charts show message activity and participant counts. LoreSync does not label sentiment or relationship health.</p>
              <section className="deep-reading" aria-label="Deeper conversation patterns">
                <div className="deep-reading-heading">
                  <div><span className="eyebrow">03 / THE FIELD NOTES</span><h3>A conversation has more than one shape.</h3><p>Patterns in timing, language, and the things you passed between you.</p></div>
                  {mode === "cloud" && !deepReading && <button type="button" className="deep-scan-button" onClick={scanCloudForPatterns} disabled={deepScanning}>{deepScanning ? <><i className="button-spinner" /> SCANNING…</> : <>SCAN ALL {shortCount(summary.messageCount)} MESSAGES ↗</>}</button>}
                </div>
                {deepScanStatus && <p className="deep-scan-status" role="status">{deepScanStatus}</p>}
                {!deepReading ? <div className="deep-empty"><span>✳</span><p>{mode === "cloud" ? "Run a private full-archive scan to reveal phrase, session, and link patterns. Messages are analyzed in this browser." : "The deeper reading is being prepared for this conversation."}</p></div> : <>
                  <div className="deep-signal-strip">
                    <article><span>CONVERSATION SESSIONS</span><b>{shortCount(deepReading.sessions.count)}</b><small>separated by gaps of six hours or more</small></article>
                    <article><span>LONGEST SESSION</span><b>{shortCount(deepReading.sessions.longestMessages)} <i>msgs</i></b><small>messages in one continuous stretch</small></article>
                    <article><span>AVERAGE SESSION</span><b>{deepReading.sessions.averageMessages.toFixed(1)} <i>msgs</i></b><small>per continuous stretch</small></article>
                    <article><span>SHARED DOMAINS</span><b>{shortCount(deepReading.sharedLinks.length)}</b><small>distinct link sources found locally</small></article>
                  </div>
                  <div className="deep-grid">
                    <article className="deep-panel deep-heatmap-panel">
                      <div className="visual-heading"><div><span>WHEN THE THREAD IS ALIVE</span><h4>A week, hour by hour.</h4></div><span className="visual-stamp">UTC · {shortCount(summary.messageCount)} MSGS</span></div>
                      <div className="heatmap-wrap" aria-label="Interactive message activity heatmap by weekday and hour, in UTC"><div className="heatmap-hours"><span>DAY</span>{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour % 6 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}</div>{deepReading.weekdayHours.map((hours, day) => <div className="heatmap-row" key={weekdayLabels[day]}><span>{weekdayLabels[day]}</span>{hours.map((count, hour) => <button type="button" key={hour} className={selectedHeatCell?.day === day && selectedHeatCell.hour === hour ? "is-selected" : ""} aria-label={`${weekdayLabels[day]} at ${String(hour).padStart(2, "0")}:00 UTC, ${count} messages`} aria-pressed={selectedHeatCell?.day === day && selectedHeatCell.hour === hour} title={`${weekdayLabels[day]} ${String(hour).padStart(2, "0")}:00 UTC · ${shortCount(count)} messages`} style={{ "--heat": count ? 0.12 + 0.88 * count / Math.max(1, ...deepReading.weekdayHours.flat()) : 0 } as CSSProperties} onClick={() => setSelectedHeatCell({ day, hour })} disabled={count === 0} />)}</div>)}</div>
                      {selectedHeatCell && <div className="heatmap-inspector" aria-live="polite"><div><span>SELECTED WINDOW</span><b>{weekdayLabels[selectedHeatDay]} · {String(selectedHeatHour).padStart(2, "0")}:00–{String((selectedHeatHour + 1) % 24).padStart(2, "0")}:00 UTC</b><small>{shortCount(selectedHeatCount)} messages · {summary.messageCount ? (selectedHeatCount / summary.messageCount * 100).toFixed(1) : "0.0"}% of this conversation</small></div>{selectedHeatDate ? <button type="button" onClick={() => exploreDay(selectedHeatDate)}>OPEN BUSIEST MATCHING DAY · {formatDate(selectedHeatDate)} ↗</button> : <small>No messages in this window.</small>}</div>}
                      <div className="heatmap-legend"><span>QUIETER</span><i /><i /><i /><i /><span>BUSIER</span></div>
                    </article>
                    <article className="deep-panel deep-month-panel">
                      <div className="visual-heading"><div><span>THE LONG ARC</span><h4>When this story gathered.</h4></div><span className="visual-stamp">BY MONTH</span></div>
                      {monthlyActivity.length ? <><div className="month-chart" aria-label="Monthly messages by participant">{monthlyActivity.map((month) => { const participantCounts = deepReading.monthlyParticipants.filter((entry) => entry.month === month.month); return <button type="button" className={`month-column ${messageFrom.startsWith(month.month) && messageTo.startsWith(month.month) ? "is-selected" : ""}`} key={month.month} title={`${monthLabel(month.month)} · ${shortCount(month.count)} messages. Open this month.`} aria-label={`Open ${shortCount(month.count)} messages from ${monthLabel(month.month)}`} aria-pressed={messageFrom.startsWith(month.month) && messageTo.startsWith(month.month)} onClick={() => exploreMonth(month.month)}><b>{shortCount(month.count)}</b><i className="month-stack" style={{ height: `${Math.max(3, month.count / maxMonth * 100)}%` }}>{participantCounts.map((participant) => <span key={participant.sender} className={`speaker-tone-${Math.max(0, summary.participants.findIndex((item) => item.name === participant.sender)) % 5}`} style={{ height: `${participant.count / month.count * 100}%` }} title={`${participant.sender}: ${shortCount(participant.count)} messages`} />)}</i><span>{monthLabel(month.month)}</span></button>; })}</div><div className="month-legend">{summary.participants.slice(0, 5).map((person, index) => <span key={person.name}><i className={`speaker-tone-${index}`} />{person.name}</span>)}</div></> : <p className="pattern-unavailable">Monthly activity is not available for this archive.</p>}
                    </article>
                    <article className="deep-panel deep-language-panel">
                      <div className="visual-heading"><div><span>WORDS THAT RETURN</span><h4>A small vocabulary of your own.</h4></div><span className="visual-stamp">REPEATED WORDS</span></div>
                      {deepReading.commonWords.length ? <div className="word-field">{deepReading.commonWords.map((item) => <button type="button" key={item.word} onClick={() => exploreTerm(item.word)} style={{ "--word-size": `${12 + item.count / deepMaxWord * 18}px` } as CSSProperties} title={`Find messages containing “${item.word}” · ${item.count} uses`}>{item.word}<sup>{item.count}</sup></button>)}</div> : <p className="pattern-unavailable">No repeated words stood out in this export.</p>}
                    </article>
                    <article className="deep-panel deep-phrases-panel">
                      <div className="visual-heading"><div><span>PHRASES IN ORBIT</span><h4>Words that often travel together.</h4></div><span className="visual-stamp">ADJACENT PAIRS</span></div>
                      {deepReading.repeatedPhrases.length ? <ol className="phrase-list">{deepReading.repeatedPhrases.slice(0, 8).map((item, index) => <li key={item.phrase}><span>{String(index + 1).padStart(2, "0")}</span><button type="button" onClick={() => exploreTerm(item.phrase)} title={`Find messages containing “${item.phrase}”`}>{item.phrase}</button><i>× {item.count}</i></li>)}</ol> : <p className="pattern-unavailable">Repeated adjacent word pairs will appear here when a phrase occurs more than once.</p>}
                    </article>
                    <article className="deep-panel deep-length-panel">
                      <div className="visual-heading"><div><span>MESSAGE TEXTURE</span><h4>Quick notes, long passages.</h4></div><span className="visual-stamp">WORDS PER MESSAGE</span></div>
                      <div className="length-chart">{deepReading.messageLengths.map((bucket) => <div className="length-row" key={bucket.label}><span>{bucket.label}</span><i><b style={{ width: `${bucket.count / deepMaxLength * 100}%` }} /></i><strong>{shortCount(bucket.count)}</strong></div>)}</div>
                    </article>
                    <article className="deep-panel deep-voices-panel">
                      <div className="visual-heading"><div><span>WRITING CADENCE</span><h4>Each voice has its own pace.</h4></div><span className="visual-stamp">WORDS / MSG</span></div>
                      <div className="cadence-list">{deepReading.participantStyles.slice(0, 8).map((person, index) => <button type="button" className="cadence-row" key={person.name} onClick={() => exploreVoice(person.name)} title={`Explore ${person.name}'s ${person.sessionStarts} session starts and reply cadence`}><span className={`voice-dot voice-${index % 4}`} /><b>{person.name}</b><span>{shortCount(person.count)} msgs · {person.sessionStarts} starts</span><strong>{person.averageWords.toFixed(1)} <i>words · {formatAverageReplyTime(person.averageResponseMinutes)}</i></strong></button>)}</div>
                    </article>
                    {compareVoiceOptions.length > 1 && <article className="deep-panel deep-compare-panel">
                      <div className="visual-heading"><div><span>VOICE AGAINST VOICE</span><h4>Compare two conversation styles.</h4></div><span className="visual-stamp">YOUR ARCHIVE · PRIVATE</span></div>
                      <div className="compare-selectors">
                        <label><span>FIRST VOICE</span><select value={compareVoices[0]} onChange={(event) => setCompareVoices((current) => [event.target.value, current[1]])}><option value="">Choose a voice</option>{compareVoiceOptions.map((person) => <option key={person.name} value={person.name}>{person.name}</option>)}</select></label>
                        <span className="compare-mark" aria-hidden="true">↔</span>
                        <label><span>SECOND VOICE</span><select value={compareVoices[1]} onChange={(event) => setCompareVoices(([first]) => [first, event.target.value])}><option value="">Choose a voice</option>{compareVoiceOptions.map((person) => <option key={person.name} value={person.name}>{person.name}</option>)}</select></label>
                      </div>
                      {compareVoiceA && compareVoiceB && compareVoiceA.name !== compareVoiceB.name ? <div className="compare-results">
                        {[{ person: compareVoiceA, color: "one" }, { person: compareVoiceB, color: "two" }].map(({ person, color }) => <div className="compare-person" key={person.name}>
                          <div className="compare-person-heading"><b>{person.name}</b><button type="button" onClick={() => exploreVoice(person.name)}>OPEN MESSAGES ↗</button></div>
                          <div className="compare-share" aria-label={`${person.name}: ${Math.round(person.count / Math.max(1, summary.messageCount) * 100)} percent of messages`}><i className={`compare-share-fill ${color}`} style={{ width: `${Math.max(2, person.count / Math.max(1, summary.messageCount) * 100)}%` }} /></div>
                          <div className="compare-stat-grid"><span><b>{shortCount(person.count)}</b> messages</span><span><b>{person.averageWords.toFixed(1)}</b> words / message</span><span><b>{formatAverageReplyTime(person.averageResponseMinutes).replace(" avg reply", "")}</b> typical reply</span><span><b>{person.sessionStarts}</b> conversation starts</span></div>
                        </div>)}
                      </div> : <p className="compare-prompt">Choose two different voices to compare their share of the conversation, message length, reply pace, and session starts.</p>}
                    </article>}
                    <article className="deep-panel deep-links-panel">
                      <div className="visual-heading"><div><span>THINGS PASSED ALONG</span><h4>Links shared between you.</h4></div><span className="visual-stamp">DOMAIN ONLY</span></div>
                      {deepReading.sharedLinks.length ? <div className="domain-list">{deepReading.sharedLinks.map((item) => <div key={item.domain}><span>↗</span><b>{item.domain}</b><small>{item.count} {item.count === 1 ? "link" : "links"}</small></div>)}</div> : <p className="pattern-unavailable">No links found. URLs stay on this device; LoreSync does not visit or scrape linked websites.</p>}
                    </article>
                  </div>
                  <p className="deep-privacy-note"><span>✳</span> The language patterns and link domains above are calculated from message text in this browser. LoreSync does not open shared links or infer feelings, intent, or relationship health.</p>
                </>}
              </section>
              <section className="message-explorer" id="message-explorer" aria-label="Search conversation messages">
                <div className="explorer-heading"><div><span className="eyebrow">THE ARCHIVE, IN YOUR WORDS</span><h3>Find a moment in the conversation.</h3></div><div className="explorer-context"><span>{mode === "local" ? "ON THIS DEVICE" : "PRIVATE CLOUD ARCHIVE"}</span>{(messageFrom || messageTo || messageSender || messageQuery) && <><small>{[messageFrom && (messageFrom === messageTo ? formatDate(messageFrom) : `${formatDate(messageFrom)} – ${formatDate(messageTo || messageFrom)}`), messageSender, messageQuery && `“${messageQuery}”`].filter(Boolean).join(" · ")}</small><button type="button" onClick={clearMessageFilters}>CLEAR FILTERS <b>×</b></button></>}</div></div>
                <div className="explorer-controls">
                  <label><span>SEARCH MESSAGES</span><input type="search" value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} placeholder="A word, phrase, or name" /></label>
                  <label><span>VOICE</span><select value={messageSender} onChange={(event) => setMessageSender(event.target.value)}><option value="">Everyone</option>{summary.participants.map((person) => <option value={person.name} key={person.name}>{person.name}</option>)}</select></label>
                  <p>{mode === "local" ? "Search runs in this browser." : "Cloud search needs at least 3 characters."}</p>
                </div>
                {messageError && <p className="explorer-error" role="alert">{messageError}</p>}
                {messageLoading && <p className="explorer-loading" role="status">Looking through messages…</p>}
                {!messageLoading && !messageError && visibleMessages.length === 0 && <p className="explorer-empty">{messageQuery || messageSender ? "No messages match those filters." : "No messages to show."}</p>}
                {visibleMessages.length > 0 && <div className="message-list">{visibleMessages.map((message, index) => <article className="message-item" key={(message as ChatMessage & { id?: string }).id ?? `${message.timestamp}-${message.sender}-${index}`}><div className="message-meta"><b>{message.sender}</b><time dateTime={message.timestamp}>{formatMessageTime(message.timestamp)}</time></div><p>{message.content || (message.hasAttachment ? "Attachment shared" : "(No text)")}</p>{message.hasAttachment && <span className="message-attachment">ATTACHMENT</span>}</article>)}</div>}
                {mode === "cloud" && messageCursor && <button className="message-load-more" type="button" onClick={loadMoreMessages} disabled={messageLoading}>{messageLoading ? "LOADING…" : "LOAD OLDER MESSAGES"}</button>}
                {mode === "local" && visibleMessages.length === 50 && <p className="explorer-loading">Showing the 50 most recent matches. Refine your search to narrow the list.</p>}
              </section>
            </section>
          )}

          {initialView === "home" && <section className="collection-section" id="saved">
            <div className="section-overline"><span>SAVED CONVERSATIONS</span><span>{mode === "local" ? "STORED IN THIS BROWSER" : "STORED IN YOUR ACCOUNT"}</span></div>
            <div className="collection-heading"><div><h2>Your conversations</h2><p>Open a previous analysis or start a new one.</p></div><span className="collection-count">{analysisCount.toString().padStart(2, "0")}{mode === "cloud" && cloudNextCursor ? "+" : ""} <small>{mode === "cloud" && cloudNextCursor ? "LOADED" : "SAVED"}</small></span></div>
            {analysisLoading ? <div className="archive-skeleton-list" aria-label="Loading saved conversations" aria-busy="true">{[0, 1, 2].map((item) => <div className="archive-skeleton-row" key={item}><i /><span><b /><small /></span><em /></div>)}</div> : mode === "cloud" && cloudError ? (
                <div className="archive-load-error" role="alert"><p>{cloudError}</p><button type="button" onClick={retryCloudLoad}>Try again</button></div>
            ) : analysisCount === 0 ? (
                <div className="empty-collection"><div className="empty-graphic" aria-hidden="true"><span /><i /><b /></div><div><span className="eyebrow">GET STARTED</span><h3>No conversations yet</h3><p>Upload an export to create your first analysis.</p></div><Link href="/workspace/import">Start a chat <b>↗</b></Link></div>
            ) : (
                <><div className="archive-list">{mode === "local" ? localAnalyses.map((analysis, index) => <article className="archive-row" key={analysis.id}><span className="archive-number">{String(index + 1).padStart(2, "0")}</span><span className={`archive-platform ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "W" : "D"}</span><button className="archive-open" onClick={() => openLocal(analysis)}><b>{analysis.title}</b><small>{platformLabel(analysis.platform)} <i>·</i> {formatDate(analysis.summary.firstMessageAt)} — {formatDate(analysis.summary.lastMessageAt)}</small></button><span className="archive-size">{shortCount(analysis.summary.messageCount)} <small>MESSAGES</small></span><button className="archive-delete" onClick={() => setPendingConfirmation({ kind: "local", id: analysis.id, title: analysis.title })} aria-label={`Delete ${analysis.title}`}>×</button></article>) : cloudAnalyses.map((analysis, index) => <article className="archive-row" key={analysis.id}><span className="archive-number">{String(index + 1).padStart(2, "0")}</span><span className={`archive-platform ${analysis.platform}`}>{analysis.platform === "whatsapp" ? "W" : "D"}</span><button className="archive-open" onClick={() => openCloud(analysis)}><b>{analysis.title}</b><small>{platformLabel(analysis.platform)} <i>·</i> Expires {formatDate(analysis.expires_at)}</small></button><span className="archive-size">{shortCount(analysis.message_count)} <small>MESSAGES</small></span><button className="archive-delete" onClick={() => setPendingConfirmation({ kind: "cloud", id: analysis.id, title: analysis.title })} aria-label={`Delete ${analysis.title}`}>×</button></article>)}</div>{mode === "cloud" && cloudNextCursor && <button type="button" className="archive-load-more" onClick={loadMoreCloud} disabled={loadingMoreCloud}>{loadingMoreCloud ? "LOADING…" : "LOAD MORE CONVERSATIONS"}</button>}</>
            )}
          </section>}

          <SiteFooter compact />
        </main>
      </div>
      <ConfirmDialog
        open={pendingConfirmation !== null}
        eyebrow={pendingConfirmation?.kind === "cloud" ? "CLOUD ARCHIVE · PERMANENT ACTION" : "THIS DEVICE · LOCAL ACTION"}
        title={pendingConfirmation ? `Delete “${pendingConfirmation.title}”?` : "Delete conversation?"}
        description={pendingConfirmation?.kind === "cloud"
          ? "This permanently removes the conversation and all of its cloud messages from your account. You cannot undo this."
          : "This removes the saved analysis and messages from this browser. Your account and any separate cloud copy stay untouched."}
        confirmLabel={pendingConfirmation?.kind === "cloud" ? "Delete from cloud" : "Delete from device"}
        tone="danger"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}

export function WorkspaceClient({ initialView = "home" }: { initialView?: "home" | "import" }) {
  return <AccessGate allowLocal><WorkspaceContent initialView={initialView} /></AccessGate>;
}
