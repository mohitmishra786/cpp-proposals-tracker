export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(["email_count", "recent"]).optional(),
  search: z.string().optional(),
});

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
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const { page, per_page, sort = "email_count", search } = parsed.data;
    const offset = (page - 1) * per_page;
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from("authors")
      .select("*", { count: "exact" });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (sort === "email_count") {
      query = query.order("email_count", { ascending: false });
    } else {
      query = query.order("last_seen", { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + per_page - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[API /authors] Supabase error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(
      {
        authors: data ?? [],
        total: count ?? 0,
        page,
        per_page,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[API /authors] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
