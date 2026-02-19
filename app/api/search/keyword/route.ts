export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase";

const querySchema = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(20),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  author: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get("q"),
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
      date_from: searchParams.get("date_from") ?? undefined,
      date_to: searchParams.get("date_to") ?? undefined,
      author: searchParams.get("author") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { q, page, per_page, date_from, date_to, author } = parsed.data;
    const offset = (page - 1) * per_page;
    const supabase = getSupabaseServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("search_emails_fts", {
      search_query: q,
      match_count: per_page,
      offset_val: offset,
      filter_date_from: date_from ?? null,
      filter_date_to: date_to ?? null,
      filter_author: author ?? null,
    });

    if (error) {
      console.error("[API /search/keyword] Supabase error:", error);
      return NextResponse.json({ error: "Search error" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: countData } = await (supabase as any).rpc("count_emails_fts", {
      search_query: q,
      filter_date_from: date_from ?? null,
      filter_date_to: date_to ?? null,
      filter_author: author ?? null,
    }).catch(() => ({ data: null }));

    const total = countData ?? (data?.length ?? 0);

    return NextResponse.json({
      results: data ?? [],
      total,
      query: q,
      page,
      per_page,
    });
  } catch (err) {
    console.error("[API /search/keyword] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
