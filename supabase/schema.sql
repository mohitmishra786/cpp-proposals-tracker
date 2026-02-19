-- ============================================================
-- C++ Proposals Explorer — Supabase Database Schema
-- Run this in the Supabase SQL editor to set up the database
-- ============================================================

-- Enable the pgvector extension for similarity search
create extension if not exists vector;

-- ============================================================
-- EMAILS TABLE — primary data store
-- ============================================================
create table if not exists emails (
  id                    uuid primary key default gen_random_uuid(),
  message_id            text unique not null,
  in_reply_to           text,
  references_ids        text[],
  subject               text not null,
  author_name           text,
  author_email          text,
  date                  timestamptz not null,
  body_clean            text,
  body_new_content      text,
  source_url            text,
  month_period          text,
  thread_root_id        text,
  thread_depth          integer default 0,
  -- 384 dims: fastembed BAAI/bge-small-en-v1.5 (default)
  -- 1536 dims: OpenAI text-embedding-3-small (set EMBEDDING_PROVIDER=openai)
  embedding             vector(384),
  created_at            timestamptz default now()
);

-- ============================================================
-- THREADS TABLE — derived from emails, one row per thread
-- ============================================================
create table if not exists threads (
  id                    uuid primary key default gen_random_uuid(),
  root_message_id       text unique not null,
  subject               text not null,
  participant_count     integer default 0,
  message_count         integer default 0,
  date_start            timestamptz,
  date_end              timestamptz,
  summary               text,
  tags                  text[],
  proposal_numbers      text[],
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ============================================================
-- AUTHORS TABLE
-- ============================================================
create table if not exists authors (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email_obfuscated      text,
  email_count           integer default 0,
  first_seen            timestamptz,
  last_seen             timestamptz,
  topic_tags            text[],
  created_at            timestamptz default now()
);

create unique index if not exists authors_name_idx on authors (name);

-- ============================================================
-- INDEXES
-- ============================================================

-- Full text search on subject + body
create index if not exists emails_fts_idx
  on emails
  using gin(to_tsvector('english',
    coalesce(subject, '') || ' ' || coalesce(body_new_content, '')
  ));

-- Vector similarity search (cosine distance)
create index if not exists emails_embedding_idx
  on emails
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Date range queries
create index if not exists emails_date_idx on emails (date);

-- Thread grouping
create index if not exists emails_thread_idx on emails (thread_root_id);

-- Author lookup
create index if not exists emails_author_idx on emails (author_name);

-- Month period for incremental ingestion
create index if not exists emails_month_idx on emails (month_period);

-- ============================================================
-- FUNCTIONS — used by API routes
-- ============================================================

-- Semantic / vector similarity search
create or replace function match_emails (
  query_embedding  vector(384),
  match_threshold  float    default 0.3,
  match_count      int      default 20,
  filter_date_from timestamptz default null,
  filter_date_to   timestamptz default null,
  filter_author    text     default null
)
returns table (
  id               uuid,
  message_id       text,
  subject          text,
  author_name      text,
  author_email     text,
  date             timestamptz,
  body_new_content text,
  source_url       text,
  thread_root_id   text,
  thread_depth     integer,
  similarity       float
)
language sql stable
as $$
  select
    e.id,
    e.message_id,
    e.subject,
    e.author_name,
    e.author_email,
    e.date,
    e.body_new_content,
    e.source_url,
    e.thread_root_id,
    e.thread_depth,
    1 - (e.embedding <=> query_embedding) as similarity
  from emails e
  where
    1 - (e.embedding <=> query_embedding) > match_threshold
    and (filter_date_from is null or e.date >= filter_date_from)
    and (filter_date_to   is null or e.date <= filter_date_to)
    and (filter_author    is null or e.author_name ilike '%' || filter_author || '%')
    and e.embedding is not null
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Full-text keyword search
create or replace function search_emails_fts (
  search_query     text,
  match_count      int      default 20,
  offset_val       int      default 0,
  filter_date_from timestamptz default null,
  filter_date_to   timestamptz default null,
  filter_author    text     default null
)
returns table (
  id               uuid,
  message_id       text,
  subject          text,
  author_name      text,
  author_email     text,
  date             timestamptz,
  body_new_content text,
  source_url       text,
  thread_root_id   text,
  thread_depth     integer,
  rank             float
)
language sql stable
as $$
  select
    e.id,
    e.message_id,
    e.subject,
    e.author_name,
    e.author_email,
    e.date,
    e.body_new_content,
    e.source_url,
    e.thread_root_id,
    e.thread_depth,
    ts_rank(
      to_tsvector('english', coalesce(e.subject,'') || ' ' || coalesce(e.body_new_content,'')),
      plainto_tsquery('english', search_query)
    ) as rank
  from emails e
  where
    to_tsvector('english', coalesce(e.subject,'') || ' ' || coalesce(e.body_new_content,''))
      @@ plainto_tsquery('english', search_query)
    and (filter_date_from is null or e.date >= filter_date_from)
    and (filter_date_to   is null or e.date <= filter_date_to)
    and (filter_author    is null or e.author_name ilike '%' || filter_author || '%')
  order by rank desc
  limit match_count
  offset offset_val;
$$;

-- Count for full-text keyword search (for pagination)
create or replace function count_emails_fts (
  search_query     text,
  filter_date_from timestamptz default null,
  filter_date_to   timestamptz default null,
  filter_author    text     default null
)
returns bigint
language sql stable
as $$
  select count(*)
  from emails e
  where
    to_tsvector('english', coalesce(e.subject,'') || ' ' || coalesce(e.body_new_content,''))
      @@ plainto_tsquery('english', search_query)
    and (filter_date_from is null or e.date >= filter_date_from)
    and (filter_date_to   is null or e.date <= filter_date_to)
    and (filter_author    is null or e.author_name ilike '%' || filter_author || '%');
$$;

-- Upsert thread stats (called after ingestion)
create or replace function upsert_thread_stats(root_id text)
returns void language plpgsql as $$
declare
  v_subject text;
  v_participant_count integer;
  v_message_count integer;
  v_date_start timestamptz;
  v_date_end timestamptz;
begin
  select
    (array_agg(subject order by date asc))[1],
    count(distinct author_name),
    count(*),
    min(date),
    max(date)
  into v_subject, v_participant_count, v_message_count, v_date_start, v_date_end
  from emails
  where thread_root_id = root_id;

  insert into threads (root_message_id, subject, participant_count, message_count, date_start, date_end)
  values (root_id, v_subject, v_participant_count, v_message_count, v_date_start, v_date_end)
  on conflict (root_message_id) do update set
    subject           = excluded.subject,
    participant_count = excluded.participant_count,
    message_count     = excluded.message_count,
    date_start        = excluded.date_start,
    date_end          = excluded.date_end,
    updated_at        = now();
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY — allow anon reads, service-role writes
-- ============================================================
alter table emails  enable row level security;
alter table threads enable row level security;
alter table authors enable row level security;

-- Public read access
create policy "Allow public read on emails"
  on emails for select using (true);

create policy "Allow public read on threads"
  on threads for select using (true);

create policy "Allow public read on authors"
  on authors for select using (true);

-- Service role can do everything (used by crawler)
create policy "Service role full access on emails"
  on emails for all using (auth.role() = 'service_role');

create policy "Service role full access on threads"
  on threads for all using (auth.role() = 'service_role');

create policy "Service role full access on authors"
  on authors for all using (auth.role() = 'service_role');
