export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

interface EmailPartial {
  id: string;
  message_id: string;
  subject: string;
  date: string;
  body_new_content: string | null;
  source_url: string | null;
  thread_root_id: string | null;
  thread_depth: number;
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ name: string }> }
) {
  const params = await props.params;
  try {
    const name = decodeURIComponent(params.name);
    const supabase = getSupabaseServiceClient();

    // Fetch author
    const { data: author, error: authorError } = await supabase
      .from("authors")
      .select("*")
      .eq("name", name)
      .single();

    if (authorError || !author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }

    // Fetch their emails (most recent first, limit 50)
    const { data: emailsRaw, error: emailsError } = await supabase
      .from("emails")
      .select(
        "id, message_id, subject, date, body_new_content, source_url, thread_root_id, thread_depth"
      )
      .eq("author_name", name)
      .order("date", { ascending: false })
      .limit(50);

    if (emailsError) {
      console.error("[API /authors/:name] Emails error:", emailsError);
    }

    const emails = (emailsRaw ?? []) as unknown as EmailPartial[];

    // Fetch the threads they participated in
    const rootIdSet = new Set(
      emails.map((e) => e.thread_root_id).filter(Boolean) as string[]
    );
    const threadRootIds = Array.from(rootIdSet);

    let threads: unknown[] = [];
    if (threadRootIds.length > 0) {
      const { data: threadData } = await supabase
        .from("threads")
        .select("id, root_message_id, subject, message_count, participant_count, date_start, date_end, tags")
        .in("root_message_id", threadRootIds.slice(0, 20))
        .order("date_end", { ascending: false });
      threads = threadData ?? [];
    }

    return NextResponse.json(
      {
        author,
        emails,
        threads,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[API /authors/:name] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
