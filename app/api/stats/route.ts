export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const [emailsResult, threadsResult, authorsResult] = await Promise.all([
      supabase
        .from("emails")
        .select("date", { count: "exact", head: false })
        .order("date", { ascending: true })
        .limit(1),
      supabase.from("threads").select("*", { count: "exact", head: true }),
      supabase.from("authors").select("*", { count: "exact", head: true }),
    ]);

    // Get date range with separate queries
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

    const { data: lastThreadRaw } = await supabase
      .from("threads")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const firstEmail = firstEmailRaw as { date: string } | null;
    const lastEmail = lastEmailRaw as { date: string } | null;
    const lastThread = lastThreadRaw as { updated_at: string } | null;

    return NextResponse.json(
      {
        total_emails: emailsResult.count ?? 0,
        total_threads: threadsResult.count ?? 0,
        total_authors: authorsResult.count ?? 0,
        date_start: firstEmail?.date ?? null,
        date_end: lastEmail?.date ?? null,
        last_updated: lastThread?.updated_at ?? null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (err) {
    console.error("[API /stats] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
