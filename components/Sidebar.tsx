"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Search,
  Sparkles,
  Users,
  BarChart2,
  Menu,
  X,
  Terminal,
  Heart,
  Coffee,
  Github,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/threads", label: "Threads", icon: MessageSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask AI", icon: Sparkles },
  { href: "/authors", label: "Authors", icon: Users },
  { href: "/stats", label: "Stats", icon: BarChart2 },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const navContent = (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/threads"
            ? pathname === "/" || pathname.startsWith("/threads")
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "nav-link touch-target",
              active && "nav-link-active"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs uppercase tracking-wider">{label}</span>
          </Link>
        );
      })}

      {/* Support toggle */}
      <div>
        <button
          onClick={() => setSupportOpen((v) => !v)}
          className={cn(
            "nav-link touch-target w-full text-left",
            supportOpen && "text-phosphor-amber"
          )}
        >
          <Heart className="h-4 w-4 flex-shrink-0 text-red-400" />
          <span className="text-xs uppercase tracking-wider flex-1">Support</span>
        </button>

        {supportOpen && (
          <div className="ml-7 mt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <a
              href="https://buymeacoffee.com/mohitmishra7"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-2xs",
                "text-terminal-muted hover:text-phosphor-amber",
                "hover:bg-terminal-hover transition-colors duration-150"
              )}
            >
              <Coffee className="h-3 w-3 text-yellow-500 flex-shrink-0" />
              Buy Me a Coffee
            </a>
            <a
              href="https://github.com/sponsors/mohitmishra786"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-2xs",
                "text-terminal-muted hover:text-phosphor-amber",
                "hover:bg-terminal-hover transition-colors duration-150"
              )}
            >
              <Github className="h-3 w-3 text-terminal-text flex-shrink-0" />
              GitHub Sponsors
            </a>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col w-56 flex-shrink-0",
          "border-r border-terminal-border",
          "bg-terminal-surface h-screen sticky top-0",
          className
        )}
      >
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
        </div>

        <div className="px-4 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded border border-phosphor-amber/30 bg-phosphor-amber/10 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-phosphor-amber" />
            </div>
            <div>
              <p className="text-sm font-bold text-phosphor-amber glow-text leading-tight">
                C++ Proposals
              </p>
              <p className="text-2xs text-terminal-muted uppercase tracking-widest">
                Explorer v2.0
              </p>
            </div>
          </div>
        </div>

        {navContent}

        <div className="px-4 py-3 border-t border-terminal-border">
          <p className="text-2xs text-terminal-muted leading-relaxed">
            Archive of{" "}
            <a
              href="https://lists.isocpp.org/std-proposals/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-phosphor-amber hover:underline"
            >
              isocpp std-proposals
            </a>
          </p>
        </div>
      </aside>

      <button
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded terminal-panel touch-target"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-phosphor-amber" />
        ) : (
          <Menu className="h-5 w-5 text-terminal-text" />
        )}
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-60 z-50 flex flex-col",
          "border-r border-terminal-border",
          "bg-terminal-surface",
          "transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
        </div>

        <div className="px-4 py-4 border-b border-terminal-border mt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded border border-phosphor-amber/30 bg-phosphor-amber/10 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-phosphor-amber" />
            </div>
            <div>
              <p className="text-sm font-bold text-phosphor-amber glow-text leading-tight">
                C++ Proposals
              </p>
              <p className="text-2xs text-terminal-muted uppercase tracking-widest">
                Explorer v2.0
              </p>
            </div>
          </div>
        </div>
        {navContent}
      </aside>
    </>
  );
}
