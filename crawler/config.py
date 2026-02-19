import os

BASE_URL = "https://lists.isocpp.org/std-proposals"
CRAWL_DELAY_SECONDS = 0        # no delay by default
MAX_CONCURRENT_REQUESTS = 10   # parallel requests
MAX_CONCURRENT_MONTHS = 3      # crawl multiple months in parallel
REQUEST_TIMEOUT = 30
MAX_RETRIES = 5
RETRY_DELAY_BASE = 0.5         # base delay for retries, doubles each time
OUTPUT_DIR = "output"
OUTPUT_JSON_PATH = os.path.join(OUTPUT_DIR, "emails.jsonl")
STATE_FILE_PATH = os.path.join(OUTPUT_DIR, "crawl_state.json")
USER_AGENT = (
    "CppProposalsExplorer/1.0 "
    "(open source archive tool; https://github.com/your-org/cpp-proposals-explorer)"
)
START_YEAR = 2025
START_MONTH = 1

# Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# OpenAI (fallback / optional — set EMBEDDING_PROVIDER=openai to use)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Anthropic (fallback / optional — set LLM_PROVIDER=anthropic to use)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Groq (primary LLM provider)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ---- Embedding configuration --------------------------------
# EMBEDDING_PROVIDER controls which backend is used:
#   "fastembed"  (default) — local, no API key, BAAI/bge-small-en-v1.5, 384 dims
#   "openai"               — requires OPENAI_API_KEY, text-embedding-3-small, 1536 dims
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "fastembed")

# fastembed settings (used when EMBEDDING_PROVIDER=fastembed)
FASTEMBED_MODEL = "BAAI/bge-small-en-v1.5"
FASTEMBED_DIMENSIONS = 384

# OpenAI embedding settings (used when EMBEDDING_PROVIDER=openai)
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_EMBEDDING_DIMENSIONS = 1536

# Shared alias used by ingest.py — resolves to the active provider's dims
EMBEDDING_DIMENSIONS = (
    FASTEMBED_DIMENSIONS
    if EMBEDDING_PROVIDER == "fastembed"
    else OPENAI_EMBEDDING_DIMENSIONS
)

EMBEDDING_BATCH_SIZE = 100
MAX_EMBEDDING_TOKENS = 8000   # used only for OpenAI token-truncation

# ---- LLM configuration (summarization) ----------------------
# LLM_PROVIDER controls which backend is used:
#   "groq"       (default) — llama-3.3-70b-versatile / llama-3.1-8b-instant
#   "anthropic"            — claude-haiku-4-5
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "groq")

# Groq model IDs
GROQ_SUMMARY_MODEL = "llama-3.1-8b-instant"   # fast + cheap for summaries
GROQ_COMPLEX_MODEL = "llama-3.3-70b-versatile" # better reasoning

# Anthropic model (fallback)
ANTHROPIC_SUMMARY_MODEL = "claude-haiku-4-5"
