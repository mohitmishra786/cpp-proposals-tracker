import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { Email, EmailNode } from "./types";

// ============================================================
// Tailwind class merge helper
// ============================================================

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ============================================================
// Date formatting
// ============================================================

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown date";
  try {
    const date = new Date(dateStr);
    return format(date, "d MMM yyyy, HH:mm 'UTC'");
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return format(date, "d MMM yyyy");
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start) return "Unknown";
  const startStr = formatDateShort(start);
  if (!end || start === end) return startStr;
  const endStr = formatDateShort(end);
  return `${startStr} – ${endStr}`;
}

// ============================================================
// Text helpers
// ============================================================

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getExcerpt(
  email: Email,
  maxLength = 200
): string {
  const body = email.body_new_content || email.body_clean || "";
  const cleaned = body
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(cleaned, maxLength);
}

/**
 * Extract C++ proposal numbers (like P1234 or P2300R1) from text.
 */
export function extractProposalNumbers(text: string): string[] {
  const matches = text.match(/\bP\d{3,4}(?:R\d+)?\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Generate a color class for an author avatar based on their name.
 */
export function getAuthorColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-indigo-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ============================================================
// Thread tree builder
// ============================================================

export function buildThreadTree(emails: Email[]): EmailNode[] {
  const byId = new Map<string, EmailNode>();
  const roots: EmailNode[] = [];

  // First pass: create all nodes
  for (const email of emails) {
    byId.set(email.message_id, { ...email, children: [] });
  }

  // Second pass: attach children to parents
  for (const email of emails) {
    const node = byId.get(email.message_id)!;
    const parentId = email.in_reply_to;

    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by date
  const sortChildren = (node: EmailNode): void => {
    node.children.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    node.children.forEach(sortChildren);
  };

  roots.forEach(sortChildren);
  roots.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return roots;
}

// ============================================================
// URL helpers
// ============================================================

export function buildShareUrl(question: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.pathname = "/ask";
  url.searchParams.set("q", question);
  return url.toString();
}

export function proposalNumberToUrl(proposal: string): string {
  // e.g. P2300R7 -> https://wg21.link/P2300R7
  return `https://wg21.link/${proposal}`;
}

// ============================================================
// Similarity score color
// ============================================================

export function getSimilarityColor(score: number): string {
  if (score >= 0.85) return "text-green-500";
  if (score >= 0.70) return "text-yellow-500";
  return "text-orange-500";
}

export function getSimilarityLabel(score: number): string {
  if (score >= 0.85) return "High relevance";
  if (score >= 0.70) return "Medium relevance";
  return "Low relevance";
}
