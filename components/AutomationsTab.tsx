"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import WeeklyDigest from "@/components/WeeklyDigest";
import TimeLogTab from "@/components/TimeLogTab";
import { SprintContent } from "@/components/SprintStatusTab";
import type { SprintStatusResponse } from "@/components/SprintStatusTab";

// ── Triage ────────────────────────────────────────────────────────────────────

interface Ticket {
  key: string;
  summary: string;
  status: string;
  updated: string;
  assignee: string | null;
  lastCommentAuthor: string;
}

interface TriageResult {
  fetchedAt: string;
  totalOpen: number;
  newToday: { count: number; tickets: Ticket[] };
  needsResponse: { count: number; tickets: Ticket[] };
  goneQuiet: { count: number; tickets: Ticket[] };
}

function ageLabel(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("assigned to support")) return "bg-blue-100/60 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
  if (s.includes("assigned to customer")) return "bg-amber-100/60 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  if (s.includes("staging") || s.includes("uat")) return "bg-purple-100/60 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300";
  if (s.includes("backlog")) return "bg-zinc-700 text-zinc-300";
  if (s.includes("3rd party") || s.includes("waiting for")) return "bg-orange-100/60 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
  if (s.includes("under investigation")) return "bg-red-100/60 text-red-700 dark:bg-red-900/50 dark:text-red-300";
  if (s.includes("on hold") || s.includes("flagged")) return "bg-yellow-100/60 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300";
  if (s.includes("in sprint") || s.includes("development")) return "bg-emerald-100/60 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
  return "bg-zinc-800 text-zinc-400";
}

function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) return <p className="py-3 text-sm text-zinc-600">None.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-xs font-semibold text-zinc-500">
          <th className="pb-2 pr-4 font-semibold">Jira</th>
          <th className="pb-2 pr-4 font-semibold">Description</th>
          <th className="pb-2 pr-4 font-semibold">Last Comment Author</th>
          <th className="pb-2 pr-4 font-semibold">Status</th>
          <th className="pb-2 text-right font-semibold">Updated</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/60">
        {tickets.map((t) => (
          <tr key={t.key}>
            <td className="py-2.5 pr-4 align-top">
              <a
                href={`https://imaginet.atlassian.net/browse/${t.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-medium text-blue-600 hover:text-blue-500 hover:underline whitespace-nowrap dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t.key}
              </a>
            </td>
            <td className="py-2.5 pr-4 align-top text-zinc-300 leading-snug">{t.summary}</td>
            <td className="py-2.5 pr-4 align-top text-zinc-400 whitespace-nowrap">{t.lastCommentAuthor || "—"}</td>
            <td className="py-2.5 pr-4 align-top">
              <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${statusBadgeClass(t.status)}`}>{t.status}</span>
            </td>
            <td className="py-2.5 align-top text-right text-xs text-zinc-500 whitespace-nowrap">{ageLabel(t.updated)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TriageSection({ title, count, tickets, accent }: {
  title: string; count: number; tickets: Ticket[]; accent: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accent}`}>{count}</span>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}

function TriageContent({ result, error, loading, onRun }: {
  result: TriageResult | null; error: string | null; loading: boolean; onRun: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 className="font-semibold text-zinc-100">Daily Triage Summary</h2>
          {result && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {result.totalOpen} open · fetched {new Date(result.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Fetching…" : result ? "Refresh" : "Run"}
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
          {!loading && !error && !result && (
            <p className="text-sm text-zinc-600">Run the triage to fetch the latest open TFWS tickets.</p>
          )}
          {result && (
            <div className="flex flex-col gap-8">
              <TriageSection title="New Today" count={result.newToday.count} tickets={result.newToday.tickets} accent="bg-emerald-100/60 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" />
              <TriageSection title="Needs Our Response" count={result.needsResponse.count} tickets={result.needsResponse.tickets} accent="bg-amber-100/60 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" />
              <TriageSection title="Gone Quiet (7+ days)" count={result.goneQuiet.count} tickets={result.goneQuiet.tickets} accent="bg-zinc-700 text-zinc-300" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Release Notes ─────────────────────────────────────────────────────────────

interface ReleaseNotesResult {
  sprint: string;
  total: number;
  returned: number;
  summary: string;
  generatedAt?: string;
  fromCache?: boolean;
  sprintStartDate?: string | null;
  sprintEndDate?: string | null;
}

interface SprintHistoryEntry {
  number: string;
  sprint: string;
  total: number;
  returned: number;
  generatedAt: string;
  sprintStartDate?: string | null;
  sprintEndDate?: string | null;
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const RELEASE_STEPS = [
  { label: "Fetching Done tickets from Jira", detail: "Querying sprint data" },
  { label: "Loading ticket details, comments and sub-tasks", detail: "Fetching enriched data in parallel" },
  { label: "Sending context to Claude", detail: "Generating stakeholder-ready notes" },
  { label: "Finalising output", detail: "Almost there…" },
];

function ReleaseLoadingPanel({ step, elapsed }: { step: number; elapsed: number }) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-100">Generating Release Notes</span>
        </div>
        <span className="tabular-nums text-xs text-zinc-500">{elapsed}s</span>
      </div>
      <ol className="flex flex-col gap-4">
        {RELEASE_STEPS.map((s, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <li key={i} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300" : active ? "bg-blue-100/60 text-blue-700 dark:bg-blue-800 dark:text-blue-300" : "bg-zinc-800 text-zinc-600"
              }`}>
                {done ? "✓" : i + 1}
              </span>
              <div>
                <p className={`text-sm font-medium ${done ? "text-zinc-500" : active ? "text-zinc-100" : "text-zinc-600"}`}>{s.label}</p>
                {active && <p className="mt-0.5 text-xs text-zinc-500">{s.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ReleaseNotesContent({ result, error, loading, step, elapsed, sprintNumber, setSprintNumber, history, historyLoading, onRun, onRegenerate, onLoadSprint }: {
  result: ReleaseNotesResult | null; error: string | null; loading: boolean;
  step: number; elapsed: number;
  sprintNumber: string; setSprintNumber: (v: string) => void;
  history: SprintHistoryEntry[]; historyLoading: boolean;
  onRun: () => void; onRegenerate: () => void; onLoadSprint: (num: string) => void;
}) {
  const activeSprint = result?.sprint.replace("TFW Sprint ", "");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-zinc-100">Sprint Release Notes</h2>
          <input
            type="text"
            placeholder="Sprint #"
            value={sprintNumber}
            onChange={(e) => setSprintNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRun()}
            className="w-24 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
          />
          {result && !loading && (
            <p className="text-xs text-zinc-500">
              {result.sprint} · {result.returned} tickets
              {result.fromCache && <span className="ml-2 text-zinc-600">· cached</span>}
              {result.generatedAt && <span className="ml-2 text-zinc-600">· {new Date(result.generatedAt).toLocaleDateString()}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && !loading && (
            <button onClick={onRegenerate} disabled={loading} title="Discard cached result and re-generate from Jira" className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              Re-generate (overwrite cached)
            </button>
          )}
          <button onClick={onRun} disabled={loading || !sprintNumber.trim()} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {loading ? "Running…" : "Generate for current sprint"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* History sidebar */}
        <div className="flex w-48 shrink-0 flex-col border-r border-zinc-800">
          <p className="shrink-0 px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">History</p>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {historyLoading && <p className="px-2 py-3 text-xs text-zinc-600">Loading…</p>}
            {!historyLoading && history.length === 0 && <p className="px-2 py-3 text-xs text-zinc-600">No saved sprints yet.</p>}
            {!historyLoading && history.map((entry) => {
              const isActive = entry.number === activeSprint;
              const startFmt = fmtDate(entry.sprintStartDate);
              const endFmt = fmtDate(entry.sprintEndDate);
              const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null;
              return (
                <button
                  key={entry.number}
                  onClick={() => onLoadSprint(entry.number)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors mb-1 ${
                    isActive ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  <p className="text-sm font-medium">Sprint {entry.number}</p>
                  {dateRange && <p className="text-xs text-zinc-500">{dateRange}</p>}
                  <p className="text-xs text-zinc-600">{new Date(entry.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes content */}
        <div className="flex-1 overflow-y-auto">
          {loading && <ReleaseLoadingPanel step={step} elapsed={elapsed} />}
          {!loading && error && <div className="m-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
          {!loading && !error && !result && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-600">Enter a sprint number and click Run.</p>
            </div>
          )}
          {!loading && result && (
            <div className="px-8 py-6">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="mb-3 mt-6 text-lg font-bold text-zinc-100 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-2 mt-5 text-base font-semibold text-zinc-200 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-1 mt-4 text-sm font-semibold text-zinc-300 first:mt-0">{children}</h3>,
                  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-zinc-300">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 space-y-1 pl-4">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 space-y-1 pl-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-zinc-300 list-disc">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                  em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
                  code: ({ children }) => <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-300">{children}</code>,
                  pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-lg bg-zinc-800 p-4 text-xs">{children}</pre>,
                  hr: () => <hr className="my-4 border-zinc-800" />,
                  blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-zinc-700 pl-4 text-zinc-500">{children}</blockquote>,
                }}
              >
                {result.summary}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Weekly Sheets ─────────────────────────────────────────────────────────────

interface WeeklySheetsResult {
  success: boolean;
  dateRange: string;
  row: (string | number)[];
  writtenAt?: string;
}

function WeeklySheetsContent({ result, error, loading, onRun }: {
  result: WeeklySheetsResult | null; error: string | null; loading: boolean; onRun: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 className="font-semibold text-zinc-100">Weekly Sheets Update</h2>
          {result && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {result.writtenAt
                ? `Last run ${new Date(result.writtenAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${result.dateRange}`
                : `Last written: ${result.dateRange}`}
            </p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>
          )}
          {!loading && !error && !result && (
            <p className="text-sm text-zinc-600">Click Run to fetch current Jira stats and append a new row to the Google Sheet.</p>
          )}
          {result && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 text-base">✓</span>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Row written successfully</span>
              </div>
              <p className="mb-4 text-xs text-zinc-400">Week: <span className="text-zinc-200">{result.dateRange}</span></p>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <tbody className="divide-y divide-zinc-800/60">
                    {result.row.map((val, i) => {
                      const labels = [
                        "Date Range",
                        "Assigned to Customer",
                        "Assigned to Support",
                        "In Backlog",
                        "On Hold / Flagged",
                        "In Sprint for Dev",
                        "On Staging for UAT",
                        "Open but Blocked",
                        "Ready for Go-Live",
                        "Under Investigation",
                        "Waiting for 3rd Party",
                        "Closed - No Further Action",
                        "Done / Delivered",
                        null, // empty separator col
                        "Total Open",
                        "Created (7d)",
                        "Resolved (7d)",
                        "Updated (7d)",
                      ];
                      if (val === "") return null;
                      return (
                        <tr key={i}>
                          <td className="py-1.5 pr-6 text-zinc-500">{labels[i] ?? `Col ${String.fromCharCode(65 + i)}`}</td>
                          <td className="py-1.5 font-mono text-zinc-300">{String(val)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function PlaceholderContent({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center border-b border-zinc-800 px-6 py-4">
        <h2 className="font-semibold text-zinc-100">{title}</h2>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-zinc-500">{description}</p>
            <p className="mt-1 text-xs text-zinc-700">Not yet implemented</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const SPRINT_CACHE_KEY = "sprint_status_cache";

type AutomationTab = "triage" | "release" | "digest" | "sheets" | "timelog" | "sprint";

const TABS: { id: AutomationTab; label: string }[] = [
  { id: "triage",  label: "Daily Triage" },
  { id: "sprint",  label: "Sprint Status" },
  { id: "release", label: "Sprint Release Notes" },
  { id: "digest",  label: "Weekly Digest" },
  { id: "sheets",  label: "Weekly Sheets" },
  { id: "timelog", label: "Log My Time" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function AutomationsTab() {
  const [activeTab, setActiveTab] = useState<AutomationTab>("triage");

  // Triage
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);

  // Release notes
  const [sprintNumber, setSprintNumber] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseResult, setReleaseResult] = useState<ReleaseNotesResult | null>(null);
  const [releaseStep, setReleaseStep] = useState(0);
  const [releaseElapsed, setReleaseElapsed] = useState(0);
  const releaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Weekly sheets
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsResult, setSheetsResult] = useState<WeeklySheetsResult | null>(null);

  // Sprint status
  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [sprintResult, setSprintResult] = useState<SprintStatusResponse | null>(null);
  const [sprintCachedAt, setSprintCachedAt] = useState<string | null>(null);

  // History
  const [sprintHistory, setSprintHistory] = useState<SprintHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Step progression
  useEffect(() => {
    if (releaseLoading) {
      setReleaseStep(0);
      setReleaseElapsed(0);
      const timers = [
        setTimeout(() => setReleaseStep(1), 2500),
        setTimeout(() => setReleaseStep(2), 12000),
        setTimeout(() => setReleaseStep(3), 32000),
      ];
      const interval = setInterval(() => setReleaseElapsed((s) => s + 1), 1000);
      releaseTimers.current = [...timers, interval as unknown as ReturnType<typeof setTimeout>];
      return () => { timers.forEach(clearTimeout); clearInterval(interval); };
    } else {
      releaseTimers.current.forEach(clearTimeout);
      setReleaseStep(0);
      setReleaseElapsed(0);
    }
  }, [releaseLoading]);

  // Auto-load cached data on mount
  useEffect(() => {
    // Load cached triage
    fetch("/api/jira/triage?cached=true")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setTriageResult(data); })
      .catch(() => {});

    // Load last weekly sheets run from KV
    fetch("/api/sheets/weekly-update")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSheetsResult(data); })
      .catch(() => {});

    // Load most recent sprint release notes
    loadHistory().then((sprints) => {
      if (sprints.length > 0) loadCachedSprint(String(sprints[0].number));
    });

    // Load cached sprint status from localStorage
    try {
      const raw = localStorage.getItem(SPRINT_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { data: SprintStatusResponse; cachedAt: string };
        setSprintResult(cached.data);
        setSprintCachedAt(cached.cachedAt);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory(): Promise<SprintHistoryEntry[]> {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/jira/release-notes/history");
      const data = await res.json();
      const sprints: SprintHistoryEntry[] = data.sprints ?? [];
      setSprintHistory(sprints);
      return sprints;
    } catch {
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }

  async function runTriage() {
    setTriageLoading(true);
    setTriageError(null);
    setActiveTab("triage");
    try {
      const res = await fetch("/api/jira/triage");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setTriageResult(data);
    } catch (err) {
      setTriageError((err as Error).message);
    } finally {
      setTriageLoading(false);
    }
  }

  async function runReleaseNotes(force = false) {
    if (!sprintNumber.trim()) return;
    setReleaseLoading(true);
    setReleaseError(null);
    setReleaseResult(null);
    setActiveTab("release");
    try {
      const params = new URLSearchParams({ sprint: sprintNumber.trim() });
      if (force) params.set("force", "true");
      const res = await fetch(`/api/jira/release-notes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setReleaseResult(data);
      loadHistory();
    } catch (err) {
      setReleaseError((err as Error).message);
    } finally {
      setReleaseLoading(false);
    }
  }

  async function runSprintStatus() {
    setSprintLoading(true);
    setSprintError(null);
    setActiveTab("sprint");
    try {
      const res = await fetch("/api/jira/sprint-status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const cachedAt = new Date().toISOString();
      setSprintResult(data);
      setSprintCachedAt(cachedAt);
      try {
        localStorage.setItem(SPRINT_CACHE_KEY, JSON.stringify({ data, cachedAt }));
      } catch { /* ignore */ }
    } catch (err) {
      setSprintError((err as Error).message);
    } finally {
      setSprintLoading(false);
    }
  }

  async function runWeeklySheets() {
    setSheetsLoading(true);
    setSheetsError(null);
    setActiveTab("sheets");
    try {
      const res = await fetch("/api/sheets/weekly-update", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setSheetsResult(data);
    } catch (err) {
      setSheetsError((err as Error).message);
    } finally {
      setSheetsLoading(false);
    }
  }

  async function loadCachedSprint(num: string) {
    const sprintNum = String(num);
    setSprintNumber(sprintNum);
    setReleaseLoading(true);
    setReleaseError(null);
    setReleaseResult(null);
    try {
      const res = await fetch(`/api/jira/release-notes?sprint=${encodeURIComponent(sprintNum)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setReleaseResult(data);
    } catch (err) {
      setReleaseError((err as Error).message);
    } finally {
      setReleaseLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-r border-zinc-800 last:border-r-0 ${
              activeTab === tab.id
                ? "bg-zinc-900 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "triage" && (
          <TriageContent result={triageResult} error={triageError} loading={triageLoading} onRun={runTriage} />
        )}
        {activeTab === "sprint" && (
          <SprintContent result={sprintResult} error={sprintError} loading={sprintLoading} cachedAt={sprintCachedAt} onRun={runSprintStatus} />
        )}
        {activeTab === "release" && (
          <ReleaseNotesContent
            result={releaseResult}
            error={releaseError}
            loading={releaseLoading}
            step={releaseStep}
            elapsed={releaseElapsed}
            sprintNumber={sprintNumber}
            setSprintNumber={setSprintNumber}
            history={sprintHistory}
            historyLoading={historyLoading}
            onRun={() => runReleaseNotes(true)}
            onRegenerate={() => runReleaseNotes(true)}
            onLoadSprint={loadCachedSprint}
          />
        )}
        {activeTab === "digest" && <WeeklyDigest />}
        {activeTab === "sheets" && (
          <WeeklySheetsContent result={sheetsResult} error={sheetsError} loading={sheetsLoading} onRun={runWeeklySheets} />
        )}
        {activeTab === "timelog" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TimeLogTab />
          </div>
        )}
      </div>
    </div>
  );
}
