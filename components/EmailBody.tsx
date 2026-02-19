"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn, proposalNumberToUrl } from "@/lib/utils";

interface EmailBodyProps {
  body: string;
  className?: string;
}

interface ParsedSegment {
  type: "text" | "quoted";
  content: string;
}

function parseBodySegments(body: string): ParsedSegment[] {
  const lines = body.split("\n");
  const segments: ParsedSegment[] = [];
  let current: ParsedSegment | null = null;

  for (const line of lines) {
    const isQuoted = line.trimStart().startsWith(">");
    const type = isQuoted ? "quoted" : "text";

    if (!current || current.type !== type) {
      if (current) segments.push(current);
      current = { type, content: line };
    } else {
      current.content += "\n" + line;
    }
  }
  if (current) segments.push(current);
  return segments;
}

function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(
    /(\bhttps?:\/\/[^\s<>"]+|P\d{3,4}(?:R\d+)?\b)/g
  );

  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-phosphor-amber hover:text-phosphor-amberBright underline break-all"
        >
          {part}
          <ExternalLink className="inline ml-0.5 h-2.5 w-2.5" />
        </a>
      );
    }
    if (part.match(/^P\d{3,4}(?:R\d+)?$/)) {
      return (
        <a
          key={i}
          href={proposalNumberToUrl(part)}
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-badge terminal-badge-amber hover:bg-phosphor-amber/20"
        >
          {part}
          <ExternalLink className="h-2 w-2 ml-0.5" />
        </a>
      );
    }
    return part;
  });
}

function QuotedBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const lines = content.split("\n").filter((l) => l.trim());
  const lineCount = lines.length;

  return (
    <div className="my-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-2xs text-terminal-muted hover:text-phosphor-amber transition-colors touch-target"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {open ? "Hide" : "Show"} {lineCount} quoted line{lineCount !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-1 pl-3 border-l-2 border-terminal-border text-terminal-muted text-xs whitespace-pre-wrap font-mono">
          {content}
        </div>
      )}
    </div>
  );
}

function TextBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const result: React.ReactNode[] = [];
  let codeBuffer: string[] = [];

  const flushCode = (i: number) => {
    if (codeBuffer.length > 0) {
      result.push(
        <pre
          key={`code-${i}`}
          className="my-2 p-3 rounded border border-terminal-border bg-terminal-bg text-xs font-mono overflow-x-auto text-terminal-text"
        >
          {codeBuffer.join("\n")}
        </pre>
      );
      codeBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const isCodeLike =
      line.startsWith("    ") ||
      line.startsWith("\t") ||
      /^[a-zA-Z_][a-zA-Z0-9_]*\s*[\(\{<]/.test(line.trim());

    if (isCodeLike && line.trim().length > 0) {
      codeBuffer.push(line);
    } else {
      flushCode(i);
      if (line.trim() === "") {
        result.push(<br key={`br-${i}`} />);
      } else {
        result.push(
          <p key={`p-${i}`} className="my-1 leading-relaxed break-words text-sm text-terminal-text">
            {linkifyText(line)}
          </p>
        );
      }
    }
  });
  flushCode(lines.length);

  return <div>{result}</div>;
}

export default function EmailBody({ body, className }: EmailBodyProps) {
  if (!body) return null;

  const segments = parseBodySegments(body);

  return (
    <div className={cn("leading-relaxed", className)}>
      {segments.map((seg, i) =>
        seg.type === "quoted" ? (
          <QuotedBlock key={i} content={seg.content} />
        ) : (
          <TextBlock key={i} content={seg.content} />
        )
      )}
    </div>
  );
}
