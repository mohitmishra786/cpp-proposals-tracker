"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Search, Share2, Check, ChevronRight, Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn, buildShareUrl } from "@/lib/utils";
import SourceCard from "./SourceCard";
import { AskResponse } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "What arguments were made against adding contracts to C++20?",
  "Why was std::expected chosen over expected<T, E>?",
  "What is the status of static reflection for C++?",
  "How did the discussion around executors evolve?",
  "What objections were raised about spaceship operator?",
];

export default function AskInterface() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [question, setQuestion] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q !== question) {
      setQuestion(q);
      handleAsk(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAsk = async (q: string = question) => {
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    router.replace(`/ask?q=${encodeURIComponent(q.trim())}`, { scroll: false });

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error ?? "Rate limit exceeded. Please wait a moment.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const data: AskResponse = await res.json();
      setResult(data);
    } catch {
      setError("Failed to connect. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = buildShareUrl(question);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the URL
    }
  };

  return (
    <div className="w-full px-4 py-6 sm:py-8">
      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span className="terminal-title ml-2">ask_ai.exe</span>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded border border-phosphor-green/30 bg-phosphor-green/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-phosphor-green" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-phosphor-amber glow-text">
                Ask the Archive
              </h1>
              <p className="text-2xs text-terminal-muted">
                Query the C++ std-proposals mailing list with AI
              </p>
            </div>
          </div>

          <div className="relative mb-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAsk();
                }
              }}
              placeholder="What arguments were made against adding contracts to C++20?"
              rows={3}
              className={cn(
                "terminal-input resize-none",
                "pr-24"
              )}
            />
            <button
              onClick={() => handleAsk()}
              disabled={loading || !question.trim()}
              className={cn(
                "absolute bottom-3 right-3",
                "terminal-btn terminal-btn-primary"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask
            </button>
          </div>
          <p className="text-2xs text-terminal-muted text-right">
            ⌘+Enter to submit
          </p>
        </div>
      </div>

      {!result && !loading && (
        <div className="mb-6">
          <p className="text-2xs uppercase tracking-widest text-terminal-muted mb-3">
            Example questions
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuestion(q);
                  handleAsk(q);
                }}
                className="terminal-btn text-left"
              >
                <ChevronRight className="h-3 w-3 text-phosphor-amber flex-shrink-0" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="terminal-panel p-4 sm:p-6">
          <div className="flex items-center gap-2 text-sm text-terminal-muted mb-4">
            <div className="h-3 w-3 rounded-full bg-phosphor-green animate-ping" />
            <span>Searching through archived discussions...</span>
          </div>
          <div className="space-y-2">
            <div className="loading-bar w-full" />
            <div className="loading-bar w-5/6" />
            <div className="loading-bar w-4/5" />
            <div className="loading-bar w-full" />
            <div className="loading-bar w-3/4" />
          </div>
        </div>
      )}

      {error && (
        <div className="terminal-panel p-4 border-retro-error text-retro-error">
          <span className="text-2xs uppercase tracking-widest">error:</span>{" "}
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="terminal-panel">
            <div className="terminal-header">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-phosphor-green" />
                <span className="terminal-title">ai_response</span>
              </div>
              <button
                onClick={handleShare}
                className="terminal-btn text-2xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-phosphor-green" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="h-3 w-3" />
                    Share
                  </>
                )}
              </button>
            </div>

            <div className="p-4 sm:p-6 prose-amber max-w-none">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
          </div>

          {result.sources.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-phosphor-amber mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Source Emails ({result.sources.length})
              </h3>
              <div className="grid gap-3">
                {result.sources.map((source) => (
                  <SourceCard key={source.message_id} source={source} />
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => {
                setResult(null);
                setQuestion("");
                router.replace("/ask");
              }}
              className="text-sm text-phosphor-amber hover:text-phosphor-amberBright underline"
            >
              Ask another question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
