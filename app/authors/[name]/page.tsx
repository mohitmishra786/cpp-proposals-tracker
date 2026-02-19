import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Calendar, MessageSquare, ExternalLink } from "lucide-react";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { cn, formatDateShort, formatDateRange, getAuthorColor, getInitials, truncate } from "@/lib/utils";
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

  const colorClass = getAuthorColor(author.name);
  const initials = getInitials(author.name);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Author header */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            "text-white font-bold text-xl flex-shrink-0",
            colorClass
          )}
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-1">
            {author.name}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-surface-500 dark:text-surface-400">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {author.email_count.toLocaleString()} emails
            </span>
            {author.first_seen && author.last_seen && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Active {formatDateRange(author.first_seen, author.last_seen)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Threads */}
      {threads.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Threads ({threads.length})
          </h2>
          <div className="space-y-2">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/threads/${encodeURIComponent(thread.root_message_id)}`}
                className="block p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
              >
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-1">
                  {thread.subject}
                </p>
                <div className="flex gap-3 text-xs text-surface-400">
                  <span>{thread.message_count} messages</span>
                  <span>{formatDateRange(thread.date_start, thread.date_end)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent emails */}
      {emails && emails.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Recent Emails ({emails.length})
          </h2>
          <div className="space-y-2">
            {(emails as EmailRow[]).map((email) => {
              const excerpt = email.body_new_content
                ? truncate(email.body_new_content.replace(/\n+/g, " ").trim(), 200)
                : "";

              return (
                <div
                  key={email.message_id}
                  className="p-3 rounded-lg border border-surface-200 dark:border-surface-700"
                >
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {email.subject}
                    </p>
                    <span className="text-xs text-surface-400 flex-shrink-0">
                      {formatDateShort(email.date)}
                    </span>
                  </div>
                  {excerpt && (
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
                      {excerpt}
                    </p>
                  )}
                  <div className="flex gap-3">
                    {email.thread_root_id && (
                      <Link
                        href={`/threads/${encodeURIComponent(email.thread_root_id)}`}
                        className="text-xs text-brand-500 hover:text-brand-600"
                      >
                        View thread
                      </Link>
                    )}
                    {email.source_url && (
                      <a
                        href={email.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-xs text-surface-400 hover:text-surface-600"
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
