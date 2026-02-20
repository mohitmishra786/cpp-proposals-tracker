export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { Thread } from "@/lib/types";
import { cacheGet, cacheSet } from "@/lib/ratelimit";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["recent", "active", "popular"]).optional(),
  search: z.string().optional(),
});

const CACHE_TTL = 86400; // 24 hours

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { page, per_page, sort = "recent", search } = parsed.data;
    const offset = (page - 1) * per_page;

    // Check Redis cache first (skip cache when search filter is present to keep results fresh)
    if (!search) {
      const cacheKey = `threads:${sort}:${page}:${per_page}`;
      const cached = await cacheGet<{ threads: Thread[]; total: number }>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, page, per_page });
      }
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from("threads")
      .select("*", { count: "exact" });

    if (search) {
      query = query.ilike("subject", `%${search}%`);
    }

    if (sort === "recent") {
      query = query.order("date_end", { ascending: false, nullsFirst: false });
    } else if (sort === "active") {
      query = query.order("message_count", { ascending: false });
    } else if (sort === "popular") {
      query = query.order("participant_count", { ascending: false });
    }

    query = query.range(offset, offset + per_page - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[API /threads] Supabase error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const threads = (data ?? []) as Thread[];
    const total = count ?? 0;

    // Cache unsearched pages for 24 hours
    if (!search) {
      const cacheKey = `threads:${sort}:${page}:${per_page}`;
      await cacheSet(cacheKey, { threads, total }, CACHE_TTL);
    }

    return NextResponse.json({ threads, total, page, per_page });
  } catch (err) {
    console.error("[API /threads] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
