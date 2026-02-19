import { createClient } from "@supabase/supabase-js";
import { Email, Thread, Author } from "./types";

// ============================================================
// Database type definitions matching the Supabase schema
// ============================================================

export interface Database {
  public: {
    Tables: {
      emails: {
        Row: Email;
        Insert: Omit<Email, "id" | "created_at">;
        Update: Partial<Omit<Email, "id" | "created_at">>;
      };
      threads: {
        Row: Thread;
        Insert: Omit<Thread, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Thread, "id" | "created_at">>;
      };
      authors: {
        Row: Author;
        Insert: Omit<Author, "id" | "created_at">;
        Update: Partial<Omit<Author, "id" | "created_at">>;
      };
    };
    Functions: {
      match_emails: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          filter_date_from?: string | null;
          filter_date_to?: string | null;
          filter_author?: string | null;
        };
        Returns: {
          id: string;
          message_id: string;
          subject: string;
          author_name: string | null;
          author_email: string | null;
          date: string;
          body_new_content: string | null;
          source_url: string | null;
          thread_root_id: string | null;
          thread_depth: number;
          similarity: number;
        }[];
      };
      search_emails_fts: {
        Args: {
          search_query: string;
          match_count?: number;
          offset_val?: number;
          filter_date_from?: string | null;
          filter_date_to?: string | null;
          filter_author?: string | null;
        };
        Returns: {
          id: string;
          message_id: string;
          subject: string;
          author_name: string | null;
          author_email: string | null;
          date: string;
          body_new_content: string | null;
          source_url: string | null;
          thread_root_id: string | null;
          thread_depth: number;
          rank: number;
        }[];
      };
    };
  };
}

// ============================================================
// Client creation
// ============================================================

// Use SupabaseClient without generic to avoid complex type gymnastics
// with partial Database definitions. We cast query results as needed.
type UnTypedSupabaseClient = ReturnType<typeof createClient>;

let _anonClient: UnTypedSupabaseClient | null = null;
let _serviceClient: UnTypedSupabaseClient | null = null;

/**
 * Public (anon key) client — safe to use in client components.
 * Only exposes data that row-level security allows.
 */
export function getSupabaseClient(): UnTypedSupabaseClient {
  if (!_anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    _anonClient = createClient(url, key);
  }
  return _anonClient;
}

/**
 * Service role client — only use in server-side code (API routes).
 * Bypasses row-level security. Never expose to the browser.
 */
export function getSupabaseServiceClient(): UnTypedSupabaseClient {
  if (!_serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    _serviceClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _serviceClient;
}
