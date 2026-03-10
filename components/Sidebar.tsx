import Image from "next/image";
import { useTheme } from "@/components/ThemeProvider";

type Tab = "commands" | "today" | "todo";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "today",    label: "Today",       icon: "◉" },
  { id: "commands", label: "Automations", icon: "⚡" },
  { id: "todo",     label: "To-do",       icon: "✓" },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 w-full"
    >
      {theme === "dark" ? (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Light mode
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
          Dark mode
        </>
      )}
    </button>
  );
}

function MobileThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-zinc-500 transition-colors"
      title="Toggle theme"
    >
      <span className="text-lg leading-none">{theme === "dark" ? "☀️" : "🌙"}</span>
      Theme
    </button>
  );
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-center border-b border-zinc-800 px-5 py-4">
          <Image src="/logo.png" alt="Command Centre logo" width={60} height={60} priority className="rounded-xl" />
        </div>
        <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-5">
          <span className="text-lg font-semibold tracking-tight text-zinc-100">
            Tom's Command Centre
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-zinc-800 p-3">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post" className="mt-1">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-800 bg-zinc-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <MobileThemeToggle />
      </nav>
    </>
  );
}
