"use client";

import { useState } from "react";
import type { SprintIssue, SprintStatusResponse } from "@/app/api/jira/sprint-status/route";

export type { SprintStatusResponse };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtHours(seconds: number): string {
  const h = seconds / 3600;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function relativeDate(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  let cls = "border-zinc-700 text-zinc-400";
  if (/done|delivered|closed|complete/i.test(status))
    cls = "border-emerald-300 bg-emerald-100/60 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  else if (/progress|development|review|testing|staging|pilot/i.test(status))
    cls = "border-blue-300 bg-blue-100/60 text-blue-600 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function IssueLink({ issue }: { issue: SprintIssue }) {
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs font-medium text-blue-600 hover:text-blue-500 hover:underline whitespace-nowrap dark:text-blue-400 dark:hover:text-blue-300"
    >
      {issue.key}
    </a>
  );
}

type MetricFn = (issue: SprintIssue) => string;

function FlagTable({ issues, metric }: { issues: SprintIssue[]; metric: MetricFn }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-xs font-semibold text-zinc-500">
          <th className="pb-2 pr-3 font-semibold">Key</th>
          <th className="pb-2 pr-3 font-semibold">Summary</th>
          <th className="pb-2 pr-3 font-semibold">Assignee</th>
          <th className="pb-2 pr-3 font-semibold">Status</th>
          <th className="pb-2 text-right font-semibold">Metric</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/60">
        {issues.map((issue) => (
          <tr key={issue.key}>
            <td className="py-2.5 pr-3 align-top"><IssueLink issue={issue} /></td>
            <td className="py-2.5 pr-3 align-top text-zinc-300 leading-snug max-w-xs">
              <span className="line-clamp-2">{issue.summary}</span>
            </td>
            <td className="py-2.5 pr-3 align-top text-zinc-400 whitespace-nowrap text-xs">
              {issue.assignee ?? <span className="text-zinc-600">—</span>}
            </td>
            <td className="py-2.5 pr-3 align-top"><StatusPill status={issue.status} /></td>
            <td className="py-2.5 align-top text-right text-xs text-zinc-500 whitespace-nowrap">
              {metric(issue)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface FlagSectionProps {
  dot: string;
  label: string;
  description: string;
  issues: SprintIssue[];
  metric: MetricFn;
}

function FlagSection({ dot, label, description, issues, metric }: FlagSectionProps) {
  const [open, setOpen] = useState(true);
  if (issues.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span>{dot}</span>
          <span className="text-sm font-semibold text-zinc-200">{label}</span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {issues.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">{description}</span>
          <svg
            className={`h-4 w-4 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-zinc-800 px-4 pb-4 pt-3">
          <FlagTable issues={issues} metric={metric} />
        </div>
      )}
    </div>
  );
}

// ── SprintContent — used by AutomationsTab ────────────────────────────────────

export function SprintContent({
  result,
  error,
  loading,
  cachedAt,
  onRun,
}: {
  result: SprintStatusResponse | null;
  error: string | null;
  loading: boolean;
  cachedAt: string | null;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 className="font-semibold text-zinc-100">Sprint Status</h2>
          {result && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {result.sprint.name} · {result.summary.done}/{result.summary.total} done
              {cachedAt && (
                <span className="ml-2 text-zinc-600">
                  · cached {new Date(cachedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center gap-3 py-6 text-sm text-zinc-500">
            <svg className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Fetching sprint data…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Failed to fetch sprint status</p>
            <p className="mt-1 font-mono text-xs text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && !result && (
          <p className="text-sm text-zinc-600">Click Run to fetch the active sprint status.</p>
        )}

        {!loading && result && (() => {
          const { sprint, summary, flags } = result;

          const flaggedKeys = new Set([
            ...flags.overEstimate,
            ...flags.staleInReview,
            ...flags.staleInProgress,
            ...flags.notStarted,
            ...flags.noAssignee,
          ].map((i) => i.key));
          const flaggedCount = flaggedKeys.size;

          const hasFlags =
            flaggedCount > 0 ||
            flags.addedMidSprint.length > 0;

          return (
            <div className="flex flex-col gap-6">
              {/* Sprint header card */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{sprint.name}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    sprint.daysRemaining === 0
                      ? "bg-red-100/60 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      : sprint.daysRemaining <= 3
                      ? "bg-amber-100/60 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {sprint.daysRemaining === 0 ? "Last day" : `${sprint.daysRemaining}d remaining`}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-xs text-zinc-600">
                    <span>Sprint elapsed</span>
                    <span>{sprint.percentElapsed}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-zinc-500 transition-all" style={{ width: `${sprint.percentElapsed}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Total",          value: summary.total,      cls: "border-zinc-700 text-zinc-300" },
                    { label: "✅ Done",        value: summary.done,       cls: "border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400" },
                    { label: "🔄 In Progress", value: summary.inProgress, cls: "border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400" },
                    { label: "⬜ To Do",       value: summary.toDo,       cls: "border-zinc-700 text-zinc-500" },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`rounded-md border px-3 py-1.5 text-xs ${cls}`}>
                      <span className="font-semibold">{value}</span>
                      <span className="ml-1.5 text-zinc-600">{label}</span>
                    </div>
                  ))}
                </div>

                <p className={`mt-3 text-sm ${flaggedCount > 0 ? "text-zinc-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {flaggedCount > 0
                    ? `${flaggedCount} ticket${flaggedCount !== 1 ? "s" : ""} flagged for attention`
                    : "✅ Sprint looking healthy"}
                </p>

                {summary.storyPointsTotal > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-zinc-600">
                      <span>Story points</span>
                      <span>{summary.storyPointsDone} / {summary.storyPointsTotal} pts</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 dark:bg-emerald-700 transition-all"
                        style={{ width: `${Math.round((summary.storyPointsDone / summary.storyPointsTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* End-of-sprint warning */}
              {sprint.daysRemaining <= 1 && summary.toDo > 0 && (
                <div className={`rounded-lg border px-5 py-4 ${
                  sprint.daysRemaining === 0
                    ? "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                    : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  <p className="text-sm font-semibold">
                    {sprint.daysRemaining === 0
                      ? `🚨 Sprint ends today — ${summary.toDo} ticket${summary.toDo !== 1 ? "s" : ""} still not started`
                      : `⚠️ Last day of sprint — ${summary.toDo} ticket${summary.toDo !== 1 ? "s" : ""} still not started`}
                  </p>
                </div>
              )}

              {/* Flags */}
              {hasFlags && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Flags</h3>
                  <FlagSection dot="🔴" label="Over Estimate" description="Logged more time than estimated" issues={flags.overEstimate}
                    metric={(i) => i.timeSpent !== null && i.timeOriginalEstimate !== null ? `${fmtHours(i.timeSpent)} logged / ${fmtHours(i.timeOriginalEstimate)} est` : "—"} />
                  <FlagSection dot="🟠" label="Stuck in Review" description="No movement in review/testing for 2+ days" issues={flags.staleInReview}
                    metric={(i) => i.lastStatusChange ? `${daysSince(i.lastStatusChange)}d in ${i.status}` : i.status} />
                  <FlagSection dot="🟡" label="Stale in Progress" description="In progress but no updates for 2+ days" issues={flags.staleInProgress}
                    metric={(i) => `${daysSince(i.lastUpdated)}d since update`} />
                  <FlagSection dot="⚪" label="Not Started" description="Sprint >50% done, these haven't been touched" issues={flags.notStarted}
                    metric={(i) => i.status} />
                  <FlagSection dot="👤" label="No Assignee" description="Nobody's on these" issues={flags.noAssignee}
                    metric={(i) => i.status} />
                  <FlagSection dot="➕" label="Added Mid-Sprint" description="Scope creep candidates" issues={flags.addedMidSprint}
                    metric={(i) => `Added ${relativeDate(i.created)}`} />
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
