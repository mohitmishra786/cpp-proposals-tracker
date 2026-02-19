"use client";

import Link from "next/link";
import { Mail, Calendar } from "lucide-react";
import { Author } from "@/lib/types";
import { cn, formatDateShort } from "@/lib/utils";

interface AuthorCardProps {
  author: Author;
  className?: string;
}

export default function AuthorCard({ author, className }: AuthorCardProps) {
  const firstYear = author.first_seen
    ? new Date(author.first_seen).getFullYear()
    : null;
  const lastYear = author.last_seen
    ? new Date(author.last_seen).getFullYear()
    : null;

  const yearsActive =
    firstYear && lastYear
      ? firstYear === lastYear
        ? String(firstYear)
        : `${firstYear}–${lastYear}`
      : null;

  return (
    <Link
      href={`/authors/${encodeURIComponent(author.name)}`}
      className={cn(
        "terminal-card",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded border border-phosphor-amber/30 bg-phosphor-amber/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-phosphor-amber">
            {author.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-phosphor-amber truncate">
            {author.name}
          </h3>
          {yearsActive && (
            <p className="text-2xs text-terminal-muted">
              Active {yearsActive}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-2xs text-terminal-muted">
        <span className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          <span className="text-phosphor-green">{author.email_count.toLocaleString()}</span>
          <span>emails</span>
        </span>
        {author.last_seen && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateShort(author.last_seen)}
          </span>
        )}
      </div>

      {author.topic_tags && author.topic_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {author.topic_tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="terminal-badge"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
