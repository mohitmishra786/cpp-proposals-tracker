"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import ThreadCard from "@/components/ThreadCard";
import { ThreadCardSkeleton } from "@/components/Skeleton";
import { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortOption = "recent" | "active" | "popular";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recent",
  active: "Active",
  popular: "Popular",
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
  const observerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

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
  }, [sort]);

  useEffect(() => {
    setPage(1);
    setInitialLoading(true);
    fetchThreads(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

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
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-terminal-muted">
          <Filter className="h-4 w-4" />
          {!initialLoading && (
            <span>
              <span className="text-phosphor-green">{total.toLocaleString()}</span> threads
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-terminal-muted" />
          <div className="flex rounded border border-terminal-border overflow-hidden text-2xs">
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={cn(
                  "px-3 py-2 transition-all touch-target",
                  sort === key
                    ? "bg-phosphor-amber/10 text-phosphor-amber border-r border-terminal-border last:border-r-0"
                    : "text-terminal-muted hover:text-terminal-text hover:bg-terminal-hover"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {initialLoading ? (
          <div className="p-4 space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <ThreadCardSkeleton key={i} />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 text-terminal-muted">
            <p className="text-lg font-bold text-phosphor-amber mb-2">No threads found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="p-4 space-y-0">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}

            <div ref={observerRef} className="py-4">
              {loading && !initialLoading && (
                <div className="space-y-0">
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
