"use client";

import { useState } from "react";
import { Search, Zap, AlertCircle } from "lucide-react";
import { cn, formatDateShort, truncate } from "@/lib/utils";
import Link from "next/link";

type SearchMode = "keyword" | "semantic";

interface SearchResult {
  id: string;
  message_id: string;
  subject: string;
  author_name: string | null;
  date: string;
  body_new_content: string | null;
  source_url: string | null;
  thread_root_id: string | null;
  rank?: number;
  similarity?: number;
}

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [author, setAuthor] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      let res: Response;

      if (mode === "keyword") {
        const params = new URLSearchParams({ q: query });
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        if (author) params.set("author", author);
        res = await fetch(`/api/search/keyword?${params}`);
      } else {
        res = await fetch("/api/search/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            filters: {
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined,
              author: author || undefined,
            },
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? `Search failed (${res.status}). Please try again.`);
        setResults([]);
        return;
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setTotal(data.total ?? data.results?.length ?? 0);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Network error — please check your connection and try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-6">
      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span className="terminal-title ml-2">search.exe</span>
        </div>

        <div className="p-4 sm:p-6">
          <h1 className="text-lg font-bold text-phosphor-amber glow-text mb-4">
            Search Archive
          </h1>

          <div className="flex rounded border border-terminal-border p-0.5 mb-4 w-fit">
            {(["keyword", "semantic"] as SearchMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded text-2xs uppercase tracking-wider transition-all",
                  mode === m
                    ? "bg-phosphor-amber/10 text-phosphor-amber"
                    : "text-terminal-muted hover:text-terminal-text"
                )}
              >
                {m === "semantic" && <Zap className="h-3 w-3" />}
                {m === "keyword" && <Search className="h-3 w-3" />}
                {m}
              </button>
            ))}
          </div>

          <p className="text-2xs text-terminal-muted mb-4">
            {mode === "keyword"
              ? "Search by exact words and phrases"
              : "Search by meaning — find conceptually related emails"}
          </p>

          <div className="flex gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={mode === "keyword" ? "contracts C++20 objections" : "Arguments against value semantics"}
              className="terminal-input flex-1"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="terminal-btn terminal-btn-primary"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-2xs text-terminal-muted mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="terminal-input text-2xs py-1.5"
              />
            </div>
            <div>
              <label className="block text-2xs text-terminal-muted mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="terminal-input text-2xs py-1.5"
              />
            </div>
            <div>
              <label className="block text-2xs text-terminal-muted mb-1">Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Filter by name"
                className="terminal-input text-2xs py-1.5"
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="terminal-card">
              <div className="h-4 bg-terminal-border rounded w-3/4 mb-2" />
              <div className="h-3 bg-terminal-border rounded w-1/3 mb-2" />
              <div className="h-3 bg-terminal-border rounded w-full mb-1" />
              <div className="h-3 bg-terminal-border rounded w-5/6" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="terminal-panel p-4 flex items-start gap-3 border-red-500/30">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400 mb-0.5">Search Error</p>
            <p className="text-2xs text-terminal-muted">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <div className="terminal-card text-center py-12">
          <Search className="h-8 w-8 mx-auto mb-3 text-terminal-muted" />
          <p className="font-bold text-phosphor-amber mb-2">No results found</p>
          <p className="text-sm text-terminal-muted">Try different keywords or broader search terms</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p className="text-2xs text-terminal-muted mb-3">
            <span className="text-phosphor-green">{total.toLocaleString()}</span>{" "}
            result{total !== 1 ? "s" : ""}
            {mode === "semantic" && (
              <span className="ml-2 text-phosphor-cyan">(ranked by similarity)</span>
            )}
          </p>
          <div className="space-y-3">
            {results.map((result) => {
              const excerpt = result.body_new_content
                ? truncate(result.body_new_content.replace(/\n+/g, " ").trim(), 250)
                : "";

              return (
                <div key={result.message_id} className="terminal-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-phosphor-amber mb-1 leading-snug">
                        {result.subject}
                      </h3>
                      <div className="flex flex-wrap gap-3 text-2xs text-terminal-muted mb-2">
                        <span className="text-phosphor-cyan">{result.author_name ?? "Unknown"}</span>
                        <span>{formatDateShort(result.date)}</span>
                      </div>
                      {excerpt && (
                        <p className="text-2xs text-terminal-muted leading-relaxed line-clamp-3">
                          {excerpt}
                        </p>
                      )}
                    </div>

                    {result.similarity !== undefined && (
                      <div className="flex-shrink-0 text-right">
                        <span className="text-sm font-bold text-phosphor-green">
                          {Math.round(result.similarity * 100)}%
                        </span>
                        <p className="text-2xs text-terminal-muted">match</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-3 pt-3 border-t border-terminal-border">
                    {result.thread_root_id && (
                      <Link
                        href={`/threads/${encodeURIComponent(result.thread_root_id)}`}
                        className="text-2xs text-phosphor-amber hover:text-phosphor-amberBright font-medium"
                      >
                        View thread
                      </Link>
                    )}
                    {result.source_url && (
                      <a
                        href={result.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-terminal-muted hover:text-phosphor-cyan"
                      >
                        Original
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
