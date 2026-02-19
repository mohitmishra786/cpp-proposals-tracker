export const dynamic = "force-dynamic";

import { Metadata } from "next";
import {
  Mail,
  MessageSquare,
  Users,
  Calendar,
  Database,
  Github,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Stats & About",
  description: "Statistics and information about the C++ Proposals Explorer",
};

async function getStats() {
  const supabase = getSupabaseServiceClient();

  const [emailsCount, threadsCount, authorsCount] = await Promise.all([
    supabase.from("emails").select("*", { count: "exact", head: true }),
    supabase.from("threads").select("*", { count: "exact", head: true }),
    supabase.from("authors").select("*", { count: "exact", head: true }),
  ]);

  const { data: firstEmailRaw } = await supabase
    .from("emails")
    .select("date")
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const { data: lastEmailRaw } = await supabase
    .from("emails")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const firstEmail = firstEmailRaw as { date: string } | null;
  const lastEmail = lastEmailRaw as { date: string } | null;

  return {
    total_emails: emailsCount.count ?? 0,
    total_threads: threadsCount.count ?? 0,
    total_authors: authorsCount.count ?? 0,
    date_start: firstEmail?.date ?? null,
    date_end: lastEmail?.date ?? null,
  };
}

export default async function StatsPage() {
  const stats = await getStats();

  const statItems = [
    {
      icon: Mail,
      label: "Emails archived",
      value: stats.total_emails.toLocaleString(),
      color: "text-phosphor-amber",
      bg: "bg-phosphor-amber/10",
    },
    {
      icon: MessageSquare,
      label: "Discussion threads",
      value: stats.total_threads.toLocaleString(),
      color: "text-phosphor-green",
      bg: "bg-phosphor-green/10",
    },
    {
      icon: Users,
      label: "Unique contributors",
      value: stats.total_authors.toLocaleString(),
      color: "text-phosphor-cyan",
      bg: "bg-phosphor-cyan/10",
    },
    {
      icon: Calendar,
      label: "Archive period",
      value:
        stats.date_start && stats.date_end
          ? `${formatDateShort(stats.date_start)} – ${formatDateShort(stats.date_end)}`
          : "—",
      color: "text-terminal-text",
      bg: "bg-terminal-hover",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <div className="flex items-center gap-1.5">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
          </div>
          <span className="terminal-title ml-2">stats.exe</span>
        </div>
        
        <div className="p-4 sm:p-6">
          <h1 className="text-lg font-bold text-phosphor-amber glow-text mb-2">
            Stats & About
          </h1>
          <p className="text-sm text-terminal-muted mb-6">
            C++ Proposals Explorer is an open-source tool for exploring the{" "}
            <a
              href="https://lists.isocpp.org/std-proposals/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-phosphor-amber hover:text-phosphor-amberBright underline"
            >
              isocpp std-proposals mailing list
            </a>{" "}
            archive using AI-powered search and synthesis.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {statItems.map(({ icon: Icon, label, value, color, bg }) => (
              <div
                key={label}
                className="terminal-card"
              >
                <div className={`inline-flex p-2 rounded border border-terminal-border ${bg} mb-3`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xl font-bold text-phosphor-amber mb-0.5 glow-text">
                  {value}
                </p>
                <p className="text-2xs text-terminal-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <span className="terminal-title">how_it_works</span>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          {[
            {
              icon: Database,
              title: "Crawling",
              desc: "A Python crawler runs daily via GitHub Actions, scraping the public Pipermail HTML archive at lists.isocpp.org. Each email is parsed, cleaned, and stored in Supabase Postgres.",
            },
            {
              icon: Sparkles,
              title: "AI embeddings",
              desc: "Every email is embedded using HuggingFace BAAI/bge-small-en-v1.5 model. These 384-dimensional vectors are stored in pgvector and enable semantic similarity search.",
            },
            {
              icon: MessageSquare,
              title: "RAG answers",
              desc: "When you ask a question, the app retrieves the most relevant emails using hybrid (vector + full-text) search, then asks Groq LLaMA to synthesize an answer with citations.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded border border-terminal-border bg-terminal-hover flex items-center justify-center mt-0.5">
                <Icon className="h-4 w-4 text-phosphor-amber" />
              </div>
              <div>
                <p className="font-bold text-sm text-phosphor-amber mb-0.5">
                  {title}
                </p>
                <p className="text-2xs text-terminal-muted leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="terminal-panel mb-6">
        <div className="terminal-header">
          <span className="terminal-title">tech_stack</span>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {[
              "Next.js 14",
              "TypeScript",
              "Tailwind CSS",
              "Supabase + pgvector",
              "Upstash Redis",
              "HuggingFace Embeddings",
              "Groq LLaMA",
              "Python + httpx",
              "Vercel",
              "GitHub Actions",
            ].map((tech) => (
              <span
                key={tech}
                className="terminal-badge terminal-badge-amber"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://github.com/your-org/cpp-proposals-explorer"
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-btn terminal-btn-primary"
        >
          <Github className="h-4 w-4" />
          View on GitHub
        </a>
        <a
          href="https://lists.isocpp.org/std-proposals/"
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-btn"
        >
          <ExternalLink className="h-4 w-4" />
          Original Archive
        </a>
      </div>
    </div>
  );
}
