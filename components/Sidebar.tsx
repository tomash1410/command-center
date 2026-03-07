import Image from "next/image";

type Tab = "commands" | "todo" | "time-aliases";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "commands", label: "Automations", icon: "⚡" },
  { id: "todo", label: "To-do", icon: "✓" },
  { id: "time-aliases", label: "Time Aliases", icon: "⏱" },
];

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
      </nav>
    </>
  );
}
