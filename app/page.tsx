"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TimeLogTab from "@/components/TimeLogTab";
import AutomationsTab from "@/components/AutomationsTab";
import TodayTab from "@/components/TodayTab";

type Tab = "commands" | "today" | "todo" | "time-aliases";


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


const tabTitles: Record<Tab, string> = {
  commands: "Automations",
  today: "Today",
  todo: "To-do",
  "time-aliases": "Time Aliases",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("today");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-zinc-800 px-4 py-4 md:px-8 md:py-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold text-zinc-100 md:text-xl">{tabTitles[activeTab]}</h1>
            {activeTab === "today" && (
              <span className="text-sm text-zinc-500">
                {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            )}
          </div>
        </header>
        {activeTab === "commands" ? (
          <div className="flex flex-1 overflow-hidden p-3 pb-20 md:p-6 md:pb-6">
            <AutomationsTab />
          </div>
        ) : (
          <div className="overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
            {activeTab === "today"        && <TodayTab />}
            {activeTab === "todo"         && <TodoTab />}
            {activeTab === "time-aliases" && <TimeLogTab />}
          </div>
        )}
      </main>
    </div>
  );
}
