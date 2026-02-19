# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

C++ Proposals Explorer — a searchable, AI-powered web application for the isocpp std-proposals mailing list archive. Built with Next.js 14 (App Router) on the frontend and Python for the crawler.

---

## Build / Lint / Test Commands

### Next.js Frontend

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build (runs TypeScript check + lint)
npm run lint         # ESLint with next/core-web-vitals
npm run start        # Start production server
```

There is no test suite configured. All TypeScript must pass strict mode with no `any` types.

### Python Crawler

```bash
cd crawler
pip install -r requirements.txt

python main.py scrape                    # Full crawl
python main.py scrape --from 2024/01     # Crawl from specific month
python main.py incremental               # Only new emails
python main.py mbox ./path/to/files/     # Import local mbox files

python ingest.py                         # Embed + upsert to Supabase
python ingest.py --summarize             # Also generate thread summaries
python ingest.py --provider openai       # Use OpenAI embeddings
```

---

## Code Style Guidelines

### TypeScript / Next.js

**Imports**
- Use path alias `@/*` for imports from project root
- Order: React/Next imports → third-party → local components → lib utilities
- Example: `import { cn } from "@/lib/utils";`

**Types**
- Strict mode enabled — no `any` types allowed
- Use explicit return types for exported functions
- Define interfaces in `lib/types.ts` for shared types
- Use Zod for API request validation (see `app/api/ask/route.ts`)

**Naming Conventions**
- Components: PascalCase files matching component name (`SearchBar.tsx`)
- Functions: camelCase (`formatDate`, `buildThreadTree`)
- Constants: SCREAMING_SNAKE_CASE for truly constant values
- CSS classes: use Tailwind utility classes via `cn()` helper

**Components**
- Use `"use client"` directive for client components
- Functional components with named exports: `export default function Foo() {}`
- Destructure props in function signature
- Use Radix UI primitives for interactive components (dialog, dropdown, tabs)

**API Routes**
- Export `dynamic = "force-dynamic"` for routes that should not be cached
- Use Zod schemas for request body validation
- Return `NextResponse.json()` with appropriate status codes
- Log errors with `console.error("[API /route] Description:", err)`

**Error Handling**
- Use try/catch in async functions
- Return user-friendly error messages, not raw errors
- Handle null/undefined with optional chaining and nullish coalescing

### Python / Crawler

**Imports**
- Standard library → third-party → local modules
- Group imports with blank lines between sections

**Types**
- Use Pydantic models for data validation (`models.py`)
- Type hints required for function signatures
- Use `Optional[T]` for nullable values

**Naming Conventions**
- Functions: snake_case (`parse_email_page`, `crawl_month`)
- Classes: PascalCase (`RawEmail`)
- Constants: SCREAMING_SNAKE_CASE (`BASE_URL`, `MAX_RETRIES`)
- Private functions: prefix with underscore (`_write_all`)

**Logging**
- Use structlog via `logger = setup_logger()`
- Log with keyword arguments: `logger.info("action_complete", count=5, duration=1.2)`
- Never log API keys or secrets

**Async Patterns**
- Use `asyncio.run()` for entry points
- Use `httpx.AsyncClient` for HTTP requests
- Use semaphores for concurrency control
- Apply `@retry` decorator from tenacity for transient failures

**Error Handling**
- Catch specific exceptions, not bare `except:`
- Log errors with context: `logger.error("action_failed", url=url, error=str(e))`
- Return `None` or empty collections rather than raising for recoverable errors

---

## Architecture

```
app/
├── api/           # Serverless API routes (Next.js)
├── page.tsx       # Page components (App Router)
└── layout.tsx     # Root layout with sidebar, theme

components/        # React components (SearchBar, ThreadCard, etc.)

lib/
├── types.ts       # Shared TypeScript interfaces
├── utils.ts       # Utility functions (cn, formatDate, etc.)
├── supabase.ts    # Database client setup
├── rag.ts         # RAG pipeline for Ask AI
└── embeddings.ts  # OpenAI embedding generation

crawler/
├── main.py        # CLI entry point
├── scraper.py     # HTML archive scraper
├── ingest.py      # Embedding + Supabase ingestion
├── models.py      # Pydantic data models
└── config.py      # Environment configuration
```

---

## Database

- Supabase Postgres with pgvector extension
- Tables: `emails`, `threads`, `authors`
- Vector similarity search via `match_emails` RPC function
- Full-text search via `search_emails_fts` RPC function

Schema defined in `supabase/schema.sql`.

---

## Environment Variables

Required for frontend (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Additional for crawler:
- `GROQ_API_KEY`
- `EMBEDDING_PROVIDER` (default: `fastembed`)
- `LLM_PROVIDER` (default: `groq`)

---

## Key Patterns

**Tailwind Styling**
- Use custom color palette: `brand-*` for accent, `surface-*` for neutral
- Dark mode via `dark:` prefix and `next-themes`
- Merge classes with `cn()` from `lib/utils.ts`

**Rate Limiting**
- API routes use Upstash Redis via `checkAskRateLimit()` in `lib/ratelimit.ts`
- Return 429 status with retry headers when exceeded

**Thread Building**
- `buildThreadTree()` in `lib/utils.ts` converts flat email list to nested tree
- Uses `in_reply_to` and `message_id` for parent-child relationships
