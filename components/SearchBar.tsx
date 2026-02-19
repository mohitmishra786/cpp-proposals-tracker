"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_QUERIES = [
  "Why was reflection not included in C++23?",
  "Arguments for and against contracts in C++20",
  "What happened with the executors proposal?",
];

const STORAGE_KEY = "cpp-explorer-recent-searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(q: string): void {
  try {
    const existing = getRecentSearches().filter((s) => s !== q);
    const updated = [q, ...existing].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

interface ThreadSuggestion {
  root_message_id: string;
  subject: string;
}

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  mode?: "global" | "threads";
}

export default function SearchBar({
  placeholder = "search threads, emails, or ask ai...",
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ThreadSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/threads?search=${encodeURIComponent(q)}&per_page=5`
      );
      const data = await res.json();
      setSuggestions(data.threads ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSubmit = (q: string, destination: "search" | "ask" = "search") => {
    if (!q.trim()) return;
    saveRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());
    setOpen(false);
    setQuery(q);
    if (destination === "ask") {
      router.push(`/ask?q=${encodeURIComponent(q.trim())}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(query);
    }
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showSuggestions = query.length > 0 && suggestions.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-terminal-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full pl-9 pr-9 py-2 rounded text-sm font-mono",
            "bg-terminal-bg border border-terminal-border",
            "text-terminal-text placeholder:text-terminal-muted",
            "focus:outline-none focus:border-phosphor-amber focus:shadow-glow-amber",
            "transition-all"
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-phosphor-amber touch-target flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (showRecent || showSuggestions || query.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded border border-terminal-border bg-terminal-surface shadow-lg overflow-hidden">
          {showRecent && (
            <div>
              <p className="px-3 py-1.5 text-2xs uppercase tracking-widest text-terminal-muted border-b border-terminal-border">
                Recent
              </p>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-terminal-hover transition-colors touch-target"
                >
                  <Clock className="h-3.5 w-3.5 text-terminal-muted flex-shrink-0" />
                  <span className="truncate text-terminal-text">{s}</span>
                </button>
              ))}
            </div>
          )}

          {showSuggestions && (
            <div>
              <p className="px-3 py-1.5 text-2xs uppercase tracking-widest text-terminal-muted border-b border-terminal-border border-t">
                Threads
              </p>
              {suggestions.map((s) => (
                <button
                  key={s.root_message_id}
                  onClick={() =>
                    router.push(
                      `/threads/${encodeURIComponent(s.root_message_id)}`
                    )
                  }
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-terminal-hover transition-colors touch-target"
                >
                  <Search className="h-3.5 w-3.5 text-terminal-muted flex-shrink-0" />
                  <span className="truncate text-terminal-text">
                    {s.subject}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-terminal-border">
            {query && (
              <button
                onClick={() => handleSubmit(query)}
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-terminal-hover transition-colors touch-target"
              >
                <Search className="h-3.5 w-3.5 text-phosphor-amber flex-shrink-0" />
                <span className="text-terminal-text">
                  Search for{" "}
                  <span className="text-phosphor-amber font-bold">&quot;{query}&quot;</span>
                </span>
              </button>
            )}
            <button
              onClick={() => handleSubmit(query || EXAMPLE_QUERIES[0], "ask")}
              className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-terminal-hover transition-colors touch-target"
            >
              <Sparkles className="h-3.5 w-3.5 text-phosphor-green flex-shrink-0" />
              <span className="text-terminal-text">
                {query ? (
                  <>
                    Ask AI: <span className="text-phosphor-green font-bold">&quot;{query}&quot;</span>
                  </>
                ) : (
                  "Ask AI a question"
                )}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
