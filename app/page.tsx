"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

type Tab = "commands" | "todo" | "time-aliases";

const commands = [
  {
    id: "daily-triage",
    title: "Daily Triage Summary",
    description:
      "Fetches open TFWS Jira tickets and identifies new today, needs response, and gone quiet (7+ days). Posts to Slack.",
    badge: "Jira + Slack",
  },
  {
    id: "weekly-digest",
    title: "Weekly Digest",
    description:
      "Counts tickets by status, identifies themes, and posts a formatted summary to Slack.",
    badge: "Jira + Slack",
  },
  {
    id: "weekly-sheets",
    title: "Weekly Sheets Update",
    description: "Updates the Google Sheet with weekly ticket stats.",
    badge: "Jira + Sheets",
  },
  {
    id: "release-notes",
    title: "Sprint Release Notes",
    description:
      "Pulls done tickets from a TFW sprint, groups by type, and formats release notes for stakeholders.",
    badge: "Jira + Claude",
  },
  {
    id: "log-time",
    title: "Log My Time",
    description:
      "Logs time to Jira worklogs across multiple tickets with ADF comment format.",
    badge: "Jira",
  },
];

const todoItems = [
  { label: "Concept defined and scoped", done: true, section: "Setup" },
  { label: "Stack decided", done: true, section: "Setup" },
  { label: "GitHub repo created", done: true, section: "Setup" },
  { label: "Next.js app scaffolded", done: true, section: "Setup" },
  { label: "Vercel connected", done: true, section: "Setup" },
  { label: "CLAUDE.md added to repo root", done: true, section: "UI Skeleton" },
  { label: "Folder structure set up (app/api/, components/)", done: true, section: "UI Skeleton" },
  { label: "Dark theme + layout shell", done: false, section: "UI Skeleton" },
  { label: "Commands tab — static UI", done: false, section: "UI Skeleton" },
  { label: "To-do tab — static UI", done: false, section: "UI Skeleton" },
  { label: "Time Aliases tab — static UI", done: false, section: "UI Skeleton" },
  { label: "Push to GitHub → confirm auto-deploy to Vercel", done: false, section: "UI Skeleton" },
  { label: "Jira — fetch TFWS tickets", done: false, section: "API Integrations" },
  { label: "Jira — post worklogs (time logging)", done: false, section: "API Integrations" },
  { label: "Slack — post triage summary", done: false, section: "API Integrations" },
  { label: "Google Sheets — weekly stats update", done: false, section: "API Integrations" },
  { label: "Anthropic — summarisation / release notes", done: false, section: "API Integrations" },
  { label: ".env.local set up locally", done: false, section: "Environment" },
  { label: "All keys added to Vercel dashboard", done: false, section: "Environment" },
];

const timeAliases = [
  { alias: "ceremonies", ticket: "TFW-6662", category: "DEV" },
  { alias: "pm", ticket: "TFW-6366", category: "PM" },
  { alias: "support", ticket: "TFW-6364", category: "SUPPORT" },
  { alias: "external meetings", ticket: "TFW-6363", category: "PM" },
  { alias: "internal meetings", ticket: "TFW-6362", category: "PM" },
  { alias: "uno internal meetings", ticket: "TFWU-8", category: "PM" },
  { alias: "uno external meetings", ticket: "TFWU-9", category: "PM" },
  { alias: "uno pm", ticket: "TFWU-10", category: "PM" },
  { alias: "uno ponty", ticket: "TFWU-13", category: "PM" },
  { alias: "uno travel", ticket: "TFWU-14", category: "Travel" },
];

function CommandsTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {commands.map((cmd) => (
        <div
          key={cmd.id}
          className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">{cmd.title}</h3>
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {cmd.badge}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400">{cmd.description}</p>
          <button
            disabled
            className="mt-auto w-full rounded-md bg-zinc-800 py-2 text-sm font-medium text-zinc-500 cursor-not-allowed"
          >
            Run
          </button>
        </div>
      ))}
    </div>
  );
}

function TodoTab() {
  const sections = Array.from(new Set(todoItems.map((i) => i.section)));
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <div key={section}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {section}
          </h3>
          <ul className="flex flex-col gap-2">
            {todoItems
              .filter((i) => i.section === section)
              .map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                      item.done
                        ? "border-emerald-700 bg-emerald-900/40 text-emerald-400"
                        : "border-zinc-700 bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span className={item.done ? "text-zinc-500 line-through" : "text-zinc-300"}>
                    {item.label}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TimeAliasesTab() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-zinc-400">Alias</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-400">Ticket</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-400">Category</th>
          </tr>
        </thead>
        <tbody>
          {timeAliases.map((row, i) => (
            <tr
              key={row.ticket}
              className={`border-b border-zinc-800/60 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}`}
            >
              <td className="px-4 py-3 text-zinc-300">{row.alias}</td>
              <td className="px-4 py-3 font-mono text-zinc-400">{row.ticket}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {row.category}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tabTitles: Record<Tab, string> = {
  commands: "Commands",
  todo: "To-do",
  "time-aliases": "Time Aliases",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("commands");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-zinc-800 px-8 py-5">
          <h1 className="text-xl font-semibold text-zinc-100">{tabTitles[activeTab]}</h1>
        </header>
        <div className="p-8">
          {activeTab === "commands" && <CommandsTab />}
          {activeTab === "todo" && <TodoTab />}
          {activeTab === "time-aliases" && <TimeAliasesTab />}
        </div>
      </main>
    </div>
  );
}
