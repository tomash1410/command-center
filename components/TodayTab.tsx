"use client";

import { useState, useEffect } from "react";

interface CalendarEvent {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string[];
}

interface Email {
  subject: string;
  from: string;
  date: string;
  mailbox: string;
  isRead: boolean;
}

const BRIDGE = "http://localhost:3333";
const JIRA_LIMIT = 5;
const CACHE_KEY = "today_cache";

// ── Helpers ───────────────────────────────────────────────────────────────────

function senderName(from: string): string {
  // "Name <email>" or "\"Name\" <email>" → "Name"
  const match = from.match(/^"?([^"<]+?)"?\s*</);
  if (match) return match[1].trim();
  return from.replace(/<[^>]+>/, "").trim() || from;
}

function fmtTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isTeams(location: string): boolean {
  return location.toLowerCase().includes("microsoft teams");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label, timestamp }: { label: string; timestamp?: Date | null }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</h3>
      {timestamp && (
        <span className="text-xs text-zinc-700">
          Updated {timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function MeetingCard({ event }: { event: CalendarEvent }) {
  const teams = isTeams(event.location);
  const start = fmtTime(event.startTime);
  const end = fmtTime(event.endTime);

  return (
    <div className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      {/* Time column */}
      <div className="w-14 shrink-0 text-right">
        <p className="font-mono text-sm font-medium text-zinc-200">{start}</p>
        {end && end !== start && (
          <p className="font-mono text-xs text-zinc-600">{end}</p>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{event.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {teams && (
            <span className="rounded border border-indigo-800 bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
              Teams
            </span>
          )}
          {event.location && !teams && (
            <span className="truncate text-xs text-zinc-500">{event.location}</span>
          )}
          {event.location && teams && (
            <span className="truncate text-xs text-zinc-600">Microsoft Teams</span>
          )}
          {event.attendees.length > 0 && (
            <span className="text-xs text-zinc-700">
              {event.attendees.length} {event.attendees.length === 1 ? "attendee" : "attendees"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailCard({ email, muted = false }: { email: Email; muted?: boolean }) {
  const name = senderName(email.from);
  const subject = muted ? email.subject.replace(/^\[JIRA\]\s*/, "") : email.subject;

  if (muted) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-zinc-800/50 bg-zinc-950 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-xs font-medium text-zinc-500">{name}</p>
            <span className="shrink-0 text-xs text-zinc-700">{fmtTime(email.date)}</span>
          </div>
          <p className="truncate text-xs text-zinc-600">{subject}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-zinc-200">{name}</p>
          <span className="shrink-0 text-xs text-zinc-600">{fmtTime(email.date)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-400">{subject}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Cache {
  events: CalendarEvent[];
  emails: Email[];
  fetchedAt: string; // ISO string
}

function loadCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function saveCache(events: CalendarEvent[], emails: Email[]) {
  try {
    const cache: Cache = { events, emails, fetchedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full or unavailable */ }
}

export default function TodayTab() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [calError, setCalError] = useState(false);
  const [mailError, setMailError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAllJira, setShowAllJira] = useState(false);

  useEffect(() => {
    const cache = loadCache();
    if (cache) {
      setEvents(cache.events);
      setEmails(cache.emails);
      setLastUpdated(new Date(cache.fetchedAt));
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchAll() {
    setRefreshing(true);
    setCalError(false);
    setMailError(false);

    let calDone = false;
    let mailDone = false;
    let freshEvents: CalendarEvent[] = events ?? [];
    let freshEmails: Email[] = emails ?? [];

    function maybeSave() {
      if (calDone && mailDone) {
        saveCache(freshEvents, freshEmails);
        setRefreshing(false);
      }
    }

    fetch(`${BRIDGE}/calendar`, { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((d) => {
        freshEvents = Array.isArray(d) ? d : [];
        setEvents(freshEvents);
        setLastUpdated(new Date());
      })
      .catch(() => setCalError(true))
      .finally(() => { calDone = true; maybeSave(); });

    fetch(`${BRIDGE}/mail`, { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((d) => {
        freshEmails = Array.isArray(d) ? d : [];
        setEmails(freshEmails);
      })
      .catch(() => setMailError(true))
      .finally(() => { mailDone = true; maybeSave(); });
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const realEmails = (emails ?? []).filter((e) => !e.subject.startsWith("[JIRA]"));
  const jiraEmails = (emails ?? []).filter((e) =>  e.subject.startsWith("[JIRA]"));
  const visibleJira = showAllJira ? jiraEmails : jiraEmails.slice(0, JIRA_LIMIT);
  const jiraHidden  = Math.max(0, jiraEmails.length - JIRA_LIMIT);

  function Spinner() {
    return (
      <svg className="h-3.5 w-3.5 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }

  return (
    <div className="flex flex-col gap-10">

      {/* ── TODAY'S MEETINGS ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Today&apos;s Meetings</h3>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-zinc-700">
                Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchAll}
              disabled={refreshing}
              title="Refresh"
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
            >
              <svg className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-5.3M20 15a9 9 0 01-15 5.3" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {calError ? (
          <p className="text-sm text-amber-600">Could not reach bridge — is it running?</p>
        ) : events === null ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600"><Spinner /> Fetching calendar…</div>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-600">No meetings scheduled for today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event, i) => (
              <MeetingCard key={i} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* ── UNREAD EMAILS ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader label="Unread Emails" />
        {mailError ? (
          <p className="text-sm text-amber-600">Could not reach bridge — is it running?</p>
        ) : emails === null ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600"><Spinner /> Fetching mail…</div>
        ) : emails.length === 0 ? (
          <p className="text-sm text-zinc-600">No unread emails.</p>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Real emails — prominent */}
            {realEmails.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {realEmails.map((email, i) => (
                  <EmailCard key={i} email={email} />
                ))}
              </div>
            )}

            {realEmails.length === 0 && (
              <p className="text-sm text-zinc-600">No non-Jira emails.</p>
            )}

            {/* Jira notifications — muted, collapsible */}
            {jiraEmails.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-700">
                  Jira notifications ({jiraEmails.length})
                </p>
                <div className="flex flex-col gap-1">
                  {visibleJira.map((email, i) => (
                    <EmailCard key={i} email={email} muted />
                  ))}
                  {!showAllJira && jiraHidden > 0 && (
                    <button
                      onClick={() => setShowAllJira(true)}
                      className="mt-1 text-left text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      + {jiraHidden} more Jira notification{jiraHidden !== 1 ? "s" : ""}
                    </button>
                  )}
                  {showAllJira && jiraEmails.length > JIRA_LIMIT && (
                    <button
                      onClick={() => setShowAllJira(false)}
                      className="mt-1 text-left text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </section>

    </div>
  );
}
