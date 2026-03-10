"use client";

import { useState } from "react";

interface Alias {
  id: string;
  alias: string;
  ticket: string;
  category: string;
}

interface DayEntry {
  id: string;
  aliasId: string;
  hours: number;
}

const defaultAliases: Alias[] = [
  { id: "1", alias: "ceremonies", ticket: "TFW-6662", category: "DEV" },
  { id: "2", alias: "pm", ticket: "TFW-6366", category: "PM" },
  { id: "3", alias: "support", ticket: "TFW-6364", category: "SUPPORT" },
  { id: "4", alias: "external meetings", ticket: "TFW-6363", category: "PM" },
  { id: "5", alias: "internal meetings", ticket: "TFW-6362", category: "PM" },
  { id: "6", alias: "uno internal meetings", ticket: "TFWU-8", category: "PM" },
  { id: "7", alias: "uno external meetings", ticket: "TFWU-9", category: "PM" },
  { id: "8", alias: "uno pm", ticket: "TFWU-10", category: "PM" },
  { id: "9", alias: "uno ponty", ticket: "TFWU-13", category: "PM" },
  { id: "10", alias: "uno travel", ticket: "TFWU-14", category: "Travel" },
];

const categoryColors: Record<string, string> = {
  DEV: "bg-blue-100/60 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  PM: "bg-purple-100/60 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  SUPPORT: "bg-amber-100/60 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Travel: "bg-teal-100/60 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildStartedIso(dateStr: string, startMins: number): string {
  const h = Math.floor(startMins / 60);
  const m = startMins % 60;
  return `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000+0000`;
}

function buildAdfComment(aliasName: string) {
  return {
    version: 1,
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: aliasName }],
      },
    ],
  };
}

const DAY_START_MINS = 9 * 60; // 09:00

export default function TimeLogTab() {
  const [aliases, setAliases] = useState<Alias[]>(defaultAliases);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<Alias, "id">>({ alias: "", ticket: "", category: "" });
  const [showAddRow, setShowAddRow] = useState(false);
  const [newForm, setNewForm] = useState<Omit<Alias, "id">>({ alias: "", ticket: "", category: "" });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<DayEntry[]>([{ id: uid(), aliasId: "", hours: 0 }]);

  // --- Alias CRUD ---
  function startEdit(a: Alias) {
    setEditingId(a.id);
    setEditForm({ alias: a.alias, ticket: a.ticket, category: a.category });
  }

  function saveEdit(id: string) {
    setAliases((prev) => prev.map((a) => (a.id === id ? { ...a, ...editForm } : a)));
    setEditingId(null);
  }

  function deleteAlias(id: string) {
    setAliases((prev) => prev.filter((a) => a.id !== id));
  }

  function addAlias() {
    if (!newForm.alias || !newForm.ticket) return;
    setAliases((prev) => [...prev, { id: uid(), ...newForm }]);
    setNewForm({ alias: "", ticket: "", category: "" });
    setShowAddRow(false);
  }

  // --- Day entries ---
  function addEntry() {
    setEntries((prev) => [...prev, { id: uid(), aliasId: "", hours: 0 }]);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, field: keyof Omit<DayEntry, "id">, value: string | number) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  // --- Calculator ---
  const totalHours = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const overUnder = totalHours - 7.5;

  let cursor = DAY_START_MINS;
  const schedule = entries
    .filter((e) => Number(e.hours) > 0 && e.aliasId)
    .map((e) => {
      const alias = aliases.find((a) => a.id === e.aliasId);
      const startMins = cursor;
      const durationMins = Number(e.hours) * 60;
      cursor = startMins + durationMins;
      return {
        alias: alias?.alias ?? "Unknown",
        ticket: alias?.ticket ?? "—",
        category: alias?.category ?? "—",
        start: minsToTime(startMins),
        end: minsToTime(cursor),
        hours: e.hours,
        startMins,
        durationSeconds: Math.round(durationMins * 60),
      };
    });

  const inputClass =
    "w-full rounded bg-zinc-800 px-2 py-1 text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600";

  return (
    <div className="flex flex-col gap-10 max-w-4xl">

      {/* ── Section 1: Aliases ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Time Aliases</h2>
          {!showAddRow && (
            <button
              onClick={() => setShowAddRow(true)}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              + Add alias
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-4 py-3 text-left font-semibold text-zinc-400">Alias</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-400">Ticket</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-400">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((a, i) => (
                <tr
                  key={a.id}
                  className={`border-b border-zinc-800/60 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}`}
                >
                  {editingId === a.id ? (
                    <>
                      <td className="px-3 py-2"><input className={inputClass} value={editForm.alias} onChange={(e) => setEditForm((f) => ({ ...f, alias: e.target.value }))} /></td>
                      <td className="px-3 py-2"><input className={`${inputClass} font-mono`} value={editForm.ticket} onChange={(e) => setEditForm((f) => ({ ...f, ticket: e.target.value }))} /></td>
                      <td className="px-3 py-2"><input className={inputClass} value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => saveEdit(a.id)} className="mr-3 text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-zinc-300">{a.alias}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{a.ticket}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${categoryColors[a.category] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {a.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(a)} className="mr-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Edit</button>
                        <button onClick={() => deleteAlias(a.id)} className="text-xs text-red-500 hover:text-red-400 transition-colors">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {showAddRow && (
                <tr className="border-b border-zinc-700 bg-zinc-900/60">
                  <td className="px-3 py-2"><input placeholder="alias name" className={inputClass} value={newForm.alias} onChange={(e) => setNewForm((f) => ({ ...f, alias: e.target.value }))} /></td>
                  <td className="px-3 py-2"><input placeholder="TFW-0000" className={`${inputClass} font-mono`} value={newForm.ticket} onChange={(e) => setNewForm((f) => ({ ...f, ticket: e.target.value }))} /></td>
                  <td className="px-3 py-2"><input placeholder="DEV / PM / SUPPORT" className={inputClass} value={newForm.category} onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))} /></td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={addAlias} className="mr-3 text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">Add</button>
                    <button onClick={() => { setShowAddRow(false); setNewForm({ alias: "", ticket: "", category: "" }); }} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: Log a Day ── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Log a Day</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-5 flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-xs text-zinc-600">{i + 1}</span>
                <select
                  value={entry.aliasId}
                  onChange={(e) => updateEntry(entry.id, "aliasId", e.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="">Select alias…</option>
                  {aliases.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.alias} — {a.ticket}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="7.5"
                  step="0.25"
                  placeholder="hrs"
                  value={entry.hours || ""}
                  onChange={(e) => updateEntry(entry.id, "hours", parseFloat(e.target.value) || 0)}
                  className="w-20 shrink-0 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-600"
                />
                <span className="w-6 shrink-0 text-xs text-zinc-500">hrs</span>
                <button
                  onClick={() => removeEntry(entry.id)}
                  disabled={entries.length === 1}
                  className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
            <button onClick={addEntry} className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              + Add entry
            </button>
            <span className={`text-sm font-medium tabular-nums ${totalHours > 7.5 ? "text-red-600 dark:text-red-400" : totalHours === 7.5 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
              {totalHours.toFixed(2)} / 7.5 hrs
              {overUnder > 0.001 && <span className="ml-1 text-red-600 dark:text-red-400">(+{overUnder.toFixed(2)})</span>}
              {overUnder < -0.001 && <span className="ml-1 text-amber-600 dark:text-amber-400">({overUnder.toFixed(2)})</span>}
            </span>
          </div>
        </div>
      </section>

      {/* ── Section 3: Time Calculator ── */}

      <section>
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Time Calculator</h2>
        {schedule.length === 0 ? (
          <p className="text-sm text-zinc-600">Fill in entries above to see the stacked schedule.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-3 text-left font-semibold text-zinc-400">Alias</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-400">Ticket</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-400">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-400">Start</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-400">End</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-400">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, i) => (
                    <tr key={i} className={`border-b border-zinc-800/60 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}`}>
                      <td className="px-4 py-3 text-zinc-300">{row.alias}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{row.ticket}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${categoryColors[row.category] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{row.start}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{row.end}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-300">{row.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
                <span>09:00</span>
                <span className={totalHours >= 7.5 ? "text-emerald-600 font-medium dark:text-emerald-400" : ""}>
                  {totalHours.toFixed(2)} / 7.5 hrs
                </span>
                <span>16:30</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    totalHours > 7.5 ? "bg-red-500" : totalHours === 7.5 ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min((totalHours / 7.5) * 100, 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Section 4: Jira Preview ── */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-zinc-100">Jira Preview</h2>
        <p className="mb-4 text-xs text-zinc-500">Read-only — review the payloads before logging.</p>
        {schedule.length === 0 ? (
          <p className="text-sm text-zinc-600">Fill in entries above to preview the Jira payloads.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {schedule.map((row, i) => {
              const started = buildStartedIso(date, row.startMins);
              const adf = buildAdfComment(row.category);
              return (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-800/50 px-4 py-2.5">
                    <span className="font-mono text-sm font-semibold text-zinc-100">{row.ticket}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-sm text-zinc-400">{row.alias}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
                    <div className="bg-zinc-900 px-4 py-3">
                      <p className="mb-1 text-xs text-zinc-500">timeSpentSeconds</p>
                      <p className="font-mono text-sm text-zinc-200">{row.durationSeconds}</p>
                    </div>
                    <div className="bg-zinc-900 px-4 py-3">
                      <p className="mb-1 text-xs text-zinc-500">started</p>
                      <p className="font-mono text-sm text-zinc-200">{started}</p>
                    </div>
                    <div className="bg-zinc-900 px-4 py-3">
                      <p className="mb-1 text-xs text-zinc-500">duration (hrs)</p>
                      <p className="font-mono text-sm text-zinc-200">{row.hours}h</p>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="mb-1.5 text-xs text-zinc-500">comment (ADF)</p>
                    <pre className="overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300 leading-relaxed">
                      {JSON.stringify(adf, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
