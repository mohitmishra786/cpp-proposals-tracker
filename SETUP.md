# Setup Guide

## Prerequisites

- Node.js 18 or later
- Python 3.11 or later (for crawler)
- A Supabase account
- API keys for Groq, HuggingFace, and optionally OpenAI/Anthropic

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/cpp-proposals-tracker.git
cd cpp-proposals-tracker

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

Create a `.env.local` file with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `HUGGINGFACE_API_KEY` | Yes | HuggingFace API key for embeddings |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `OPENAI_API_KEY` | No | OpenAI key (if using OpenAI embeddings) |
| `ANTHROPIC_API_KEY` | No | Anthropic key (if using Claude for Ask AI) |
| `EMBEDDING_PROVIDER` | No | `hf` (default) or `openai` |
| `LLM_PROVIDER` | No | `groq` (default) or `anthropic` |

## Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Navigate to the SQL Editor in your Supabase dashboard
3. Run the contents of `supabase/schema.sql` to create tables, indexes, and functions
4. Copy the project URL and keys from Settings > API into your `.env.local`

## Crawler Setup

```bash
cd crawler

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (or create .env in crawler/)
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key
export HUGGINGFACE_API_KEY=hf_...

# Run initial crawl
python main.py scrape

# Generate embeddings and upload to Supabase
python ingest.py
```

The initial crawl takes 30-60 minutes depending on your connection and the archive size. The ingest process takes another 10-20 minutes for embedding generation.

## GitHub Actions

The repository includes a workflow for automated daily crawling. To enable it:

1. Go to your repository Settings > Secrets and variables > Actions
2. Add the following repository secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `GROQ_API_KEY`
   - `HUGGINGFACE_API_KEY`

The workflow runs at 2:00 AM UTC daily and performs incremental crawling of new emails.

## Verification

After setup, verify everything works:

```bash
# Check API endpoints
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/threads?per_page=5
curl http://localhost:3000/api/authors?per_page=5

# Build for production
npm run build
npm run start
```

All APIs should return JSON responses with data from your Supabase database.
