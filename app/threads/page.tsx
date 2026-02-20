"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Filter, ArrowUpDown, Search, X } from "lucide-react";
import ThreadCard from "@/components/ThreadCard";
import { ThreadCardSkeleton } from "@/components/Skeleton";
import { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortOption = "recent" | "active" | "popular";

const SORT_CONFIG: Record<SortOption, { label: string; tooltip: string }> = {
  recent: { label: "Recent", tooltip: "Latest activity first" },
  active: { label: "Active", tooltip: "Most messages first" },
  popular: { label: "Popular", tooltip: "Most participants first" },
};

const PER_PAGE = 20;

export default function ThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("recent");
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const observerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchThreads = useCallback(async (pageNum: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        per_page: String(PER_PAGE),
        sort,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/threads?${params}`);
      const data = await res.json();

      const newThreads: Thread[] = data.threads ?? [];
      setTotal(data.total ?? 0);
      setThreads((prev) => (reset ? newThreads : [...prev, ...newThreads]));
      setHasMore(newThreads.length === PER_PAGE);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, [sort, debouncedSearch]);

  useEffect(() => {
    setPage(1);
    setInitialLoading(true);
    fetchThreads(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, debouncedSearch]);

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchThreads(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, page, fetchThreads]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-terminal-border bg-terminal-surface flex-shrink-0 flex-wrap">
        {/* Count */}
        <div className="flex items-center gap-2 text-2xs text-terminal-muted flex-shrink-0">
          <Filter className="h-3.5 w-3.5" />
          {!initialLoading && (
            <span>
              <span className="text-phosphor-green">{total.toLocaleString()}</span> threads
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[120px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-terminal-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter threads..."
            className={cn(
              "w-full pl-7 pr-7 py-1.5 rounded text-2xs font-mono",
              "bg-terminal-bg border border-terminal-border",
              "text-terminal-text placeholder:text-terminal-muted",
              "focus:outline-none focus:border-phosphor-amber transition-colors"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-text"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-terminal-muted" />
          <div className="flex rounded border border-terminal-border overflow-hidden">
            {(Object.entries(SORT_CONFIG) as [SortOption, { label: string; tooltip: string }][]).map(([key, { label, tooltip }]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                title={tooltip}
                aria-label={`Sort by ${label}: ${tooltip}`}
                className={cn(
                  "px-3 py-1.5 text-2xs font-mono transition-all duration-150",
                  "border-r border-terminal-border last:border-r-0",
                  sort === key
                    ? "bg-phosphor-amber/10 text-phosphor-amber"
                    : "text-terminal-muted hover:text-terminal-text hover:bg-terminal-hover"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {initialLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <ThreadCardSkeleton key={i} />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 text-terminal-muted">
            <p className="text-lg font-bold text-phosphor-amber mb-2">No threads found</p>
            <p className="text-sm">
              {search ? `No results for "${search}"` : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div>
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}

            <div ref={observerRef} className="py-4">
              {loading && !initialLoading && (
                <div>
                  <ThreadCardSkeleton />
                  <ThreadCardSkeleton />
                </div>
              )}
              {!hasMore && threads.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-2xs text-terminal-muted">
                    -- end of results ({total.toLocaleString()} threads) --
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
