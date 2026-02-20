import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Calendar, MessageSquare, ExternalLink, ArrowLeft } from "lucide-react";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { cn, formatDateShort, formatDateRange, getInitials, truncate } from "@/lib/utils";
import { Author, Thread } from "@/lib/types";

interface PageProps {
  params: Promise<{ name: string }>;
}

interface EmailRow {
  id: string;
  message_id: string;
  subject: string;
  date: string;
  body_new_content: string | null;
  source_url: string | null;
  thread_root_id: string | null;
  thread_depth: number;
}

// Generate a consistent deterministic color class from author name
function getAvatarColor(name: string): string {
  const colors = [
    "bg-phosphor-amber/20 border-phosphor-amber/40 text-phosphor-amber",
    "bg-phosphor-green/20 border-phosphor-green/40 text-phosphor-green",
    "bg-phosphor-cyan/20 border-phosphor-cyan/40 text-phosphor-cyan",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return {
    title: decodedName,
    description: `${decodedName}'s contributions to the C++ std-proposals mailing list`,
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const supabase = getSupabaseServiceClient();

  const { data: authorRaw } = await supabase
    .from("authors")
    .select("*")
    .eq("name", decodedName)
    .single();

  const author = authorRaw as Author | null;
  if (!author) notFound();

  const { data: emailsRaw } = await supabase
    .from("emails")
    .select("id, message_id, subject, date, body_new_content, source_url, thread_root_id, thread_depth")
    .eq("author_name", decodedName)
    .order("date", { ascending: false })
    .limit(50);
  const emails = (emailsRaw ?? []) as EmailRow[];

  const threadRootIds = Array.from(new Set(
    emails.map((e) => e.thread_root_id).filter(Boolean) as string[]
  ));

  let threads: Thread[] = [];
  if (threadRootIds.length > 0) {
    const { data } = await supabase
      .from("threads")
      .select("*")
      .in("root_message_id", threadRootIds.slice(0, 20))
      .order("date_end", { ascending: false });
    threads = (data ?? []) as Thread[];
  }

  const initials = getInitials(author.name);
  const avatarColor = getAvatarColor(author.name);

  return (
    <div className="w-full px-4 py-6">
      {/* Back */}
      <Link
        href="/authors"
        className={cn(
          "inline-flex items-center gap-1.5 text-2xs text-terminal-muted hover:text-phosphor-amber",
          "transition-colors mb-6"
        )}
      >
        <ArrowLeft className="h-3 w-3" />
        All authors
      </Link>

      {/* Author header panel */}
      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span className="terminal-title ml-2">author.exe</span>
        </div>

        <div className="p-4 sm:p-6 flex items-start gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded border flex items-center justify-center flex-shrink-0",
              "font-bold text-lg",
              avatarColor
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-phosphor-amber glow-text mb-1 truncate">
              {author.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-2xs text-terminal-muted">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="text-phosphor-green">{author.email_count.toLocaleString()}</span>
                {" "}emails
              </span>
              {author.first_seen && author.last_seen && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Active {formatDateRange(author.first_seen, author.last_seen)}
                </span>
              )}
            </div>
            {author.topic_tags && author.topic_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {author.topic_tags.map((tag) => (
                  <span key={tag} className="terminal-badge terminal-badge-amber">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Threads */}
      {threads.length > 0 && (
        <div className="terminal-panel mb-6">
          <div className="terminal-header">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-phosphor-amber" />
              <span className="terminal-title">threads</span>
              <span className="text-phosphor-green text-2xs">({threads.length})</span>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/threads/${encodeURIComponent(thread.root_message_id)}`}
                className={cn(
                  "block p-3 rounded border border-terminal-border",
                  "hover:border-phosphor-amber/40 hover:bg-retro-panelHover",
                  "transition-all duration-200"
                )}
              >
                <p className="text-sm font-medium text-phosphor-amber mb-1 leading-snug">
                  {thread.subject}
                </p>
                <div className="flex flex-wrap gap-3 text-2xs text-terminal-muted">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-phosphor-green">{thread.message_count}</span> msgs
                  </span>
                  <span>{formatDateRange(thread.date_start, thread.date_end)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent emails */}
      {emails.length > 0 && (
        <div className="terminal-panel">
          <div className="terminal-header">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-phosphor-amber" />
              <span className="terminal-title">recent emails</span>
              <span className="text-phosphor-green text-2xs">({emails.length})</span>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {(emails as EmailRow[]).map((email) => {
              const excerpt = email.body_new_content
                ? truncate(email.body_new_content.replace(/\n+/g, " ").trim(), 200)
                : "";

              return (
                <div
                  key={email.message_id}
                  className={cn(
                    "p-3 rounded border border-terminal-border",
                    "hover:border-phosphor-amber/20 hover:bg-retro-panelHover",
                    "transition-all duration-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-sm font-medium text-phosphor-amber truncate leading-snug">
                      {email.subject}
                    </p>
                    <span className="text-2xs text-terminal-muted flex-shrink-0">
                      {formatDateShort(email.date)}
                    </span>
                  </div>
                  {excerpt && (
                    <p className="text-2xs text-terminal-muted mb-2 leading-relaxed line-clamp-2">
                      {excerpt}
                    </p>
                  )}
                  <div className="flex gap-3 pt-2 border-t border-terminal-border">
                    {email.thread_root_id && (
                      <Link
                        href={`/threads/${encodeURIComponent(email.thread_root_id)}`}
                        className="text-2xs text-phosphor-amber hover:text-phosphor-amberBright font-medium transition-colors"
                      >
                        View thread
                      </Link>
                    )}
                    {email.source_url && (
                      <a
                        href={email.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-2xs text-terminal-muted hover:text-phosphor-cyan transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
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
