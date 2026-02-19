export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseServiceClient } from "@/lib/supabase";

const bodySchema = z.object({
  query: z.string().min(1).max(500),
  filters: z
    .object({
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      author: z.string().optional(),
    })
    .optional()
    .default({}),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { query, filters } = parsed.data;

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Vector similarity search
    const supabase = getSupabaseServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("match_emails", {
      query_embedding: embedding,
      match_threshold: 0.25,
      match_count: 20,
      filter_date_from: filters.date_from ?? null,
      filter_date_to: filters.date_to ?? null,
      filter_author: filters.author ?? null,
    });

    if (error) {
      console.error("[API /search/semantic] Supabase error:", error);
      return NextResponse.json({ error: "Search error" }, { status: 500 });
    }

    return NextResponse.json({
      results: data ?? [],
      query,
    });
  } catch (err) {
    console.error("[API /search/semantic] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
