"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import AuthorCard from "@/components/AuthorCard";
import { AuthorCardSkeleton } from "@/components/Skeleton";
import { Author } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchAuthors = async () => {
      setLoading(true);
      const params = new URLSearchParams({ per_page: "60" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      try {
        const res = await fetch(`/api/authors?${params}`);
        const data = await res.json();
        setAuthors(data.authors ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        console.error("Failed to fetch authors:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuthors();
  }, [debouncedSearch]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span className="terminal-title ml-2">authors.exe</span>
        </div>
        
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-phosphor-amber glow-text">
              Authors
            </h1>
            {!loading && (
              <p className="text-2xs text-terminal-muted mt-0.5">
                <span className="text-phosphor-green">{total.toLocaleString()}</span> contributors
              </p>
            )}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-terminal-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search authors..."
              className={cn(
                "w-full pl-9 pr-4 py-2 rounded text-sm font-mono",
                "bg-terminal-bg border border-terminal-border",
                "text-terminal-text placeholder:text-terminal-muted",
                "focus:outline-none focus:border-phosphor-amber"
              )}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <AuthorCardSkeleton key={i} />
          ))}
        </div>
      ) : authors.length === 0 ? (
        <div className="terminal-card text-center py-12">
          <p className="text-phosphor-amber font-bold">No authors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {authors.map((author) => (
            <AuthorCard key={author.id} author={author} />
          ))}
        </div>
      )}
    </div>
  );
}
