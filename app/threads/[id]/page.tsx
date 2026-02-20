import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles, ExternalLink, MessageSquare, Users, Calendar } from "lucide-react";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildThreadTree, formatDateRange } from "@/lib/utils";
import ThreadTree from "@/components/ThreadTree";
import { Email, Thread } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getThreadData(rootMessageId: string) {
  const supabase = getSupabaseServiceClient();

  const [threadResult, emailsResult] = await Promise.all([
    supabase
      .from("threads")
      .select("*")
      .eq("root_message_id", rootMessageId)
      .single(),
    supabase
      .from("emails")
      .select("*")
      .eq("thread_root_id", rootMessageId)
      .order("date", { ascending: true }),
  ]);

  return {
    thread: threadResult.data as Thread | null,
    emails: (emailsResult.data ?? []) as Email[],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const supabase = getSupabaseServiceClient();
  const { data: dataRaw } = await supabase
    .from("threads")
    .select("subject")
    .eq("root_message_id", decodedId)
    .single();

  const data = dataRaw as { subject: string } | null;

  return {
    title: data?.subject ?? "Thread",
    description: `C++ std-proposals thread: ${data?.subject ?? ""}`,
  };
}

export default async function ThreadPage({ params }: PageProps) {
  const { id } = await params;
  const rootMessageId = decodeURIComponent(id);
  const { thread, emails } = await getThreadData(rootMessageId);

  if (!thread && emails.length === 0) {
    notFound();
  }

  const tree = buildThreadTree(emails);

  return (
    <div className="w-full px-4 py-6">
      {thread && (
        <div className="terminal-panel mb-6">
          <div className="terminal-header">
            <div className="flex items-center gap-1.5">
              <div className="terminal-dot terminal-dot-red" />
              <div className="terminal-dot terminal-dot-yellow" />
              <div className="terminal-dot terminal-dot-green" />
            </div>
            <span className="terminal-title ml-2">thread.exe</span>
          </div>

          <div className="p-4 sm:p-6">
            <h1 className="text-lg font-bold text-phosphor-amber glow-text mb-3">
              {thread.subject}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-2xs text-terminal-muted mb-4">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-phosphor-green">{thread.message_count}</span>
                <span>emails</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span className="text-phosphor-cyan">{thread.participant_count}</span>
                <span>participants</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateRange(thread.date_start, thread.date_end)}
              </span>
            </div>

            {thread.proposal_numbers && thread.proposal_numbers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {thread.proposal_numbers.map((p) => (
                  <a
                    key={p}
                    href={`https://wg21.link/${p}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="terminal-badge terminal-badge-amber hover:bg-phosphor-amber/20 transition-colors"
                  >
                    {p}
                    <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                  </a>
                ))}
              </div>
            )}

            {thread.summary && (
              <div className="flex gap-3 p-4 rounded border border-phosphor-green/20 bg-phosphor-green/5">
                <Sparkles className="h-4 w-4 text-phosphor-green flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-2xs font-bold text-phosphor-green mb-1 uppercase tracking-wider">
                    AI Summary
                  </p>
                  <p className="text-sm text-terminal-text leading-relaxed">
                    {thread.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ThreadTree roots={tree} />
    </div>
  );
}
