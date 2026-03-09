"use client";

import { useState, useEffect } from "react";

interface DigestResult {
  weekEnding: string;
  totalOpen: number;
  newThisWeek: number;
  byStatus: { status: string; count: number }[];
  themes: string[];
  generatedAt: string;
}

export default function WeeklyDigest() {
  const [result, setResult] = useState<DigestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/digest/weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setResult(data); })
      .catch(() => {});
  }, []);

  async function runDigest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/digest/weekly", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 className="font-semibold text-zinc-100">Weekly Digest</h2>
          {result && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Generated {new Date(result.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <button
          onClick={runDigest}
          disabled={loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Running…" : result ? "Refresh" : "Run now"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Fetching tickets and generating themes…
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && !result && (
          <p className="text-sm text-zinc-600">
            Click &ldquo;Run now&rdquo; to fetch current TFWS ticket stats and identify this week&rsquo;s themes.
          </p>
        )}

        {!loading && result && (
          <div className="max-w-xl space-y-6">
            {/* Title block */}
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                TFWS Support Desk — Weekly Summary
              </h3>
              <p className="mt-0.5 text-sm text-zinc-500">Week ending {result.weekEnding}</p>
            </div>

            {/* By status */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Open tickets by status
              </p>
              <ul className="flex flex-col gap-1">
                {result.byStatus.map(({ status, count }) => (
                  <li key={status} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-zinc-400">{status}</span>
                    <span className="tabular-nums font-semibold text-zinc-200">{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Totals */}
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-zinc-500">Total open</p>
                <p className="text-2xl font-bold tabular-nums text-zinc-100">{result.totalOpen}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">New this week</p>
                <p className="text-2xl font-bold tabular-nums text-zinc-100">{result.newThisWeek}</p>
              </div>
            </div>

            {/* Themes */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Notable themes this week
              </p>
              <ul className="flex flex-col gap-1.5">
                {result.themes.map((theme, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
