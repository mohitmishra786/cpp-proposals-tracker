"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare } from "lucide-react";
import { EmailNode } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import EmailBody from "./EmailBody";

const MAX_VISUAL_DEPTH = 5;

interface EmailCardProps {
  node: EmailNode;
  depth: number;
  isRoot?: boolean;
}

function EmailCard({ node, depth, isRoot }: EmailCardProps) {
  const [expanded, setExpanded] = useState(depth < 3 || isRoot);
  const [showChildren, setShowChildren] = useState(depth < 3);
  const hasChildren = node.children.length > 0;
  const body = node.body_new_content || node.body_clean || "";

  return (
    <div
      className={cn(
        "relative",
        depth > 0 && "ml-4 pl-4 border-l border-terminal-border"
      )}
    >
      <div
        className={cn(
          "terminal-card",
          isRoot && "border-phosphor-amber/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded border border-phosphor-amber/30 bg-phosphor-amber/10 flex items-center justify-center text-xs font-bold text-phosphor-amber flex-shrink-0">
            {node.author_name?.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") ?? "?"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-bold text-sm text-phosphor-amber">
                {node.author_name ?? "Unknown"}
              </span>
              <span className="text-2xs text-terminal-muted">
                {formatDate(node.date)}
              </span>
              {node.source_url && (
                <a
                  href={node.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs text-terminal-muted hover:text-phosphor-cyan flex items-center gap-0.5"
                  title="View original email"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {!isRoot && node.subject && (
              <p className="text-2xs text-terminal-muted truncate">
                {node.subject}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hasChildren && (
              <span className="flex items-center gap-0.5 text-2xs text-terminal-muted">
                <MessageSquare className="h-3 w-3" />
                {node.children.length}
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-terminal-muted hover:text-phosphor-amber touch-target"
              aria-label={expanded ? "Collapse email" : "Expand email"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {expanded && body && (
          <div className="mt-3 pt-3 border-t border-terminal-border">
            <EmailBody body={body} />
          </div>
        )}
      </div>

      {hasChildren && (
        <div>
          {depth >= MAX_VISUAL_DEPTH ? (
            <div>
              <button
                onClick={() => setShowChildren(!showChildren)}
                className="mb-2 text-2xs text-phosphor-amber hover:text-phosphor-amberBright flex items-center gap-1"
              >
                {showChildren ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {node.children.length} more {node.children.length === 1 ? "reply" : "replies"}
              </button>
              {showChildren &&
                node.children.map((child) => (
                  <EmailCard
                    key={child.message_id}
                    node={child}
                    depth={0}
                  />
                ))}
            </div>
          ) : (
            showChildren &&
            node.children.map((child) => (
              <EmailCard
                key={child.message_id}
                node={child}
                depth={depth + 1}
              />
            ))
          )}
          {!showChildren && depth < MAX_VISUAL_DEPTH && (
            <button
              onClick={() => setShowChildren(true)}
              className="mb-2 ml-4 text-2xs text-phosphor-amber hover:text-phosphor-amberBright flex items-center gap-1"
            >
              <ChevronRight className="h-3 w-3" />
              Show {node.children.length} {node.children.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ThreadTreeProps {
  roots: EmailNode[];
}

export default function ThreadTree({ roots }: ThreadTreeProps) {
  if (roots.length === 0) {
    return (
      <div className="terminal-card text-center py-12">
        <p className="text-terminal-muted">No emails in this thread.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((root, i) => (
        <EmailCard key={root.message_id} node={root} depth={0} isRoot={i === 0} />
      ))}
    </div>
  );
}
