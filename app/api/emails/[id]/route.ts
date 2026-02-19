export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { Email } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const messageId = decodeURIComponent(params.id);
    const supabase = getSupabaseServiceClient();

    // Fetch the email itself
    const { data: emailRaw, error } = await supabase
      .from("emails")
      .select("*")
      .eq("message_id", messageId)
      .single();

    if (error || !emailRaw) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const email = emailRaw as unknown as Email;

    // Fetch parent email (if it is a reply)
    let parent: Email | null = null;
    if (email.in_reply_to) {
      const { data: parentData } = await supabase
        .from("emails")
        .select("*")
        .eq("message_id", email.in_reply_to)
        .single();
      parent = (parentData as unknown as Email) ?? null;
    }

    // Fetch immediate children (replies to this email)
    const { data: childrenRaw } = await supabase
      .from("emails")
      .select("*")
      .eq("in_reply_to", messageId)
      .order("date", { ascending: true });
    const children = childrenRaw as unknown as Email[] | null;

    return NextResponse.json(
      {
        email,
        parent,
        children: children ?? [],
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[API /emails/:id] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
