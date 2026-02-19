"use client";

import Link from "next/link";
import { ExternalLink, User, Calendar } from "lucide-react";
import { SourceEmail } from "@/lib/types";
import { cn, formatDateShort } from "@/lib/utils";

interface SourceCardProps {
  source: SourceEmail;
  className?: string;
}

export default function SourceCard({ source, className }: SourceCardProps) {
  const scorePercent = Math.round(source.relevance_score * 100);
  const scoreColor = source.relevance_score >= 0.7 ? "text-phosphor-green" : source.relevance_score >= 0.5 ? "text-phosphor-amber" : "text-terminal-muted";

  return (
    <div
      className={cn(
        "terminal-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-phosphor-amber truncate mb-1">
            {source.subject}
          </h4>

          <div className="flex flex-wrap items-center gap-3 text-2xs text-terminal-muted mb-2">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="text-phosphor-cyan">{source.author_name ?? "Unknown"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateShort(source.date)}
            </span>
          </div>

          {source.excerpt && (
            <p className="text-2xs text-terminal-muted line-clamp-3 leading-relaxed">
              {source.excerpt}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <span className={cn("text-sm font-bold", scoreColor)}>
            {scorePercent}%
          </span>
          <p className="text-2xs text-terminal-muted">
            relevance
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-terminal-border">
        <Link
          href={`/threads/${encodeURIComponent(source.message_id)}`}
          className="text-2xs text-phosphor-amber hover:text-phosphor-amberBright font-medium"
        >
          View thread
        </Link>
        {source.source_url && (
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-2xs text-terminal-muted hover:text-phosphor-cyan"
          >
            <ExternalLink className="h-3 w-3" />
            Original
          </a>
        )}
      </div>
    </div>
  );
}
