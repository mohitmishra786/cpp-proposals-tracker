// ============================================================
// Shared TypeScript types for the C++ Proposals Explorer
// ============================================================

export interface Email {
  id: string;
  message_id: string;
  in_reply_to: string | null;
  references_ids: string[];
  subject: string;
  author_name: string | null;
  author_email: string | null;
  date: string; // ISO string
  body_clean: string | null;
  body_new_content: string | null;
  source_url: string | null;
  month_period: string | null;
  thread_root_id: string | null;
  thread_depth: number;
  created_at: string;
}

export interface EmailWithSimilarity extends Email {
  similarity?: number;
  rank?: number;
}

export interface EmailNode extends Email {
  children: EmailNode[];
}

export interface Thread {
  id: string;
  root_message_id: string;
  subject: string;
  participant_count: number;
  message_count: number;
  date_start: string | null;
  date_end: string | null;
  summary: string | null;
  tags: string[] | null;
  proposal_numbers: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Author {
  id: string;
  name: string;
  email_obfuscated: string | null;
  email_count: number;
  first_seen: string | null;
  last_seen: string | null;
  topic_tags: string[] | null;
  created_at: string;
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  author?: string;
}

export interface SearchResult {
  email: EmailWithSimilarity;
  thread: Thread | null;
}

export interface SourceEmail {
  message_id: string;
  subject: string;
  author_name: string | null;
  date: string;
  excerpt: string;
  source_url: string | null;
  relevance_score: number;
}

export interface AskResponse {
  answer: string;
  sources: SourceEmail[];
  thread_ids: string[];
  query_id: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface StatsResponse {
  total_emails: number;
  total_threads: number;
  total_authors: number;
  date_start: string | null;
  date_end: string | null;
  last_updated: string | null;
}
