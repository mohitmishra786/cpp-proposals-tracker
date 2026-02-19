<div align="center">

# C++ Proposals Explorer

*"The standard is not a destination, but a conversation."*

A searchable, AI-powered web application for the isocpp std-proposals mailing list archive.

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?style=flat-square)](https://supabase.com)

</div>

---

The C++ standardization process happens in public, but finding specific discussions can feel like archaeology. The std-proposals mailing list contains decades of debate about language features, library components, and design tradeoffs. Buried in those threads are the rationales for why `std::optional` works the way it does, why `std::string_view` does not own its data, and why `std::expected` took so long to arrive.

This application makes that knowledge searchable. Not just by keyword, but by meaning.

Most mailing list archives offer basic text search. Type a word, get a list of emails containing that word. Useful, but limited. You find the obvious matches and miss the relevant discussions that happened to use different terminology.

C++ Proposals Explorer combines three search paradigms. Keyword search finds exact matches. Semantic search understands that "memory safety" relates to "buffer overflow" and "bounds checking" even when those exact words never appear. Ask AI synthesizes answers from multiple emails, citing its sources so you can verify the conclusions.

The result is a research tool that understands C++ discussions the way a committee member would, not just the way a text indexer would.

## What It Actually Does

The application is structured around four core workflows.

**Browse Threads** shows the mailing list organized by conversation. Each thread groups related emails together, displaying participant count, message count, and date range. Sort by recent activity to see what the committee is discussing now, or by popularity to find the debates that drew the most participants.

**Keyword Search** runs traditional full-text search against email subjects and bodies. Filter by date range or author to narrow results. The search uses PostgreSQL's built-in text search capabilities, optimized with a GIN index for fast lookups across thousands of emails.

**Semantic Search** converts your query into a vector embedding and finds emails with similar meaning. Ask about "exception handling performance" and you will find discussions about zero-cost exceptions, stack unwinding overhead, and the design constraints that shaped `std::expected`, even if those exact words never appear together.

**Ask AI** is the synthesis layer. Ask a question and the system retrieves relevant emails, passes them to a language model, and generates a grounded answer with citations. Each answer links back to the source emails so you can read the original discussion and judge for yourself.

## Technical Architecture

The frontend is a Next.js 14 application using the App Router. Server components handle initial page loads, client components manage interactive elements. API routes run as serverless functions on Vercel.

```
app/
  api/           Serverless endpoints (threads, search, ask)
  page.tsx       Route handlers (App Router)
  layout.tsx     Root layout with sidebar navigation

components/      React components (SearchBar, ThreadCard, etc.)

lib/
  types.ts       TypeScript interfaces for emails, threads, authors
  supabase.ts    Database client with anon and service role keys
  rag.ts         Retrieval-augmented generation pipeline
  embeddings.ts  Vector embedding generation
```

The database is Supabase Postgres with the pgvector extension. Three tables store the core data: `emails` for individual messages, `threads` for aggregated conversation metadata, and `authors` for contributor statistics. Row-level security allows public read access while restricting writes to the service role.

Vector embeddings are stored as 384-dimensional vectors using BAAI/bge-small-en-v1.5 via HuggingFace's free API. The default configuration costs nothing to run. Switch to OpenAI embeddings for higher dimensionality at marginal cost.

The crawler is a Python application that scrapes the public Pipermail archive. It handles rate limiting, deduplication, and thread reconstruction. Run it locally for initial data load, or let the GitHub Actions workflow handle incremental updates on a daily schedule.

```
crawler/
  main.py        CLI entry point
  scraper.py     HTML archive scraper with parallel processing
  ingest.py      Embedding generation and Supabase upsert
  models.py      Pydantic data models
  storage.py     JSONL persistence and state management
```

## Search Under the Hood

Keyword search uses PostgreSQL's full-text search with a GIN index on the concatenated subject and body text. The query is parsed with `plainto_tsquery` which handles natural language input without requiring boolean operators. Results are ranked by `ts_rank` which scores based on term frequency and proximity.

Semantic search computes the cosine similarity between the query embedding and stored email embeddings. The `match_emails` RPC function accepts a match threshold and returns results ordered by similarity. Lower thresholds return more results with weaker matches. The default of 0.3 is tuned for precision over recall.

The Ask AI endpoint implements retrieval-augmented generation. First, it runs semantic search to find relevant emails. Then it constructs a prompt with the retrieved context and the user's question. The language model generates an answer that must be grounded in the provided sources. Finally, it extracts citations and returns both the answer and the source references.

Rate limiting is implemented via Upstash Redis. The `/api/ask` endpoint allows 10 requests per IP address per hour by default. This prevents abuse while keeping the service accessible for legitimate research use.

## Data Pipeline

The crawler fetches emails from the Pipermail archive, which organizes messages by month. Each month's index page lists all emails with their URLs, subjects, authors, and dates. The scraper follows each link, extracts the email content, parses the threading headers (`In-Reply-To`, `References`), and writes the result to a JSONL file.

Thread reconstruction happens after crawling. The algorithm identifies root messages (those with no `In-Reply-To` header), then builds a tree by following parent-child relationships. Each email gets a `thread_root_id` and `thread_depth` for efficient querying.

Ingestion generates embeddings and upserts to Supabase. The embedding model runs locally via fastembed by default, or via API with HuggingFace or OpenAI. Each email gets a 384-dimensional vector (or 1536 with OpenAI) stored in the `embedding` column.

The whole pipeline is idempotent. Running it twice produces the same result. Duplicate emails are silently ignored. Updated emails are replaced.

## Philosophy

*"The beginning of wisdom is the definition of terms."* — Socrates

The C++ standard is a living document shaped by thousands of discussions over decades. Understanding why a feature works the way it does often requires understanding the debates that produced it. Those debates live in the mailing list archives, but only if you can find them.

This application exists to make that knowledge accessible. Not through better indexing alone, but through better understanding. Semantic search bridges the gap between the words you think to search for and the concepts that actually matter. Ask AI turns hours of reading into minutes of synthesis.

The goal is not to replace reading the original sources. It is to help you find them in the first place.

---

MIT License
