"use client";

import Link from "next/link";
import { MessageSquare, Users, Calendar, ChevronRight } from "lucide-react";
import { Thread } from "@/lib/types";
import { cn, formatDateRange } from "@/lib/utils";

interface ThreadCardProps {
  thread: Thread;
  active?: boolean;
  onClick?: () => void;
}

export default function ThreadCard({ thread, active, onClick }: ThreadCardProps) {
  const proposals = thread.proposal_numbers ?? [];
  const tags = thread.tags ?? [];

  return (
    <Link
      href={`/threads/${encodeURIComponent(thread.root_message_id)}`}
      onClick={onClick}
      className={cn(
        "terminal-card",
        active && "terminal-card-active"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-phosphor-amber leading-snug line-clamp-2 flex-1">
          {thread.subject}
        </h3>
        <ChevronRight className="h-4 w-4 text-terminal-muted flex-shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-2xs text-terminal-muted mb-2">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span className="text-phosphor-green">{thread.message_count}</span>
          <span>msgs</span>
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span className="text-phosphor-cyan">{thread.participant_count}</span>
          <span>parts</span>
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDateRange(thread.date_start, thread.date_end)}</span>
        </span>
      </div>

      {thread.summary && (
        <p className="text-2xs text-terminal-muted line-clamp-2 mb-2 font-normal">
          {thread.summary}
        </p>
      )}

      {(proposals.length > 0 || tags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {proposals.map((p) => (
            <span
              key={p}
              className="terminal-badge terminal-badge-amber"
            >
              {p}
            </span>
          ))}
          {tags.slice(0, 3).map((tag) => (
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
