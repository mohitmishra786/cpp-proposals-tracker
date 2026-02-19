export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildThreadTree } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rootMessageId = decodeURIComponent(params.id);
    const supabase = getSupabaseServiceClient();

    // Fetch the thread metadata
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .select("*")
      .eq("root_message_id", rootMessageId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Fetch all emails in this thread
    const { data: emails, error: emailsError } = await supabase
      .from("emails")
      .select(
        "id, message_id, in_reply_to, references_ids, subject, author_name, author_email, date, body_clean, body_new_content, source_url, month_period, thread_root_id, thread_depth, created_at"
      )
      .eq("thread_root_id", rootMessageId)
      .order("date", { ascending: true });

    if (emailsError) {
      console.error("[API /threads/:id] Supabase error:", emailsError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Build the tree structure
    const tree = buildThreadTree(emails ?? []);

    return NextResponse.json(
      {
        thread,
        emails: emails ?? [],
        tree,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[API /threads/:id] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
