"""
Embedding ingestion pipeline (Agent 2).

Reads the output JSONL from the crawler, embeds each email,
and upserts everything into Supabase.

Usage:
  python ingest.py                   # ingest all emails from output/emails.jsonl
  python ingest.py --summarize       # also generate thread summaries
  python ingest.py --batch-size 50   # override batch size
  python ingest.py --provider openai # use OpenAI embeddings instead of fastembed
"""
import argparse
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from typing import Optional

# OpenAI client (used for embeddings when EMBEDDING_PROVIDER=openai,
# and for Groq LLM calls via the OpenAI-compatible SDK)
from openai import AsyncOpenAI

# Anthropic client (fallback LLM, used when LLM_PROVIDER=anthropic)
from anthropic import AsyncAnthropic

import tiktoken
from supabase import create_client, Client as SupabaseClient

from config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_SUMMARY_MODEL,
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_PROVIDER,
    FASTEMBED_MODEL,
    GROQ_API_KEY,
    GROQ_SUMMARY_MODEL,
    LLM_PROVIDER,
    MAX_EMBEDDING_TOKENS,
    OPENAI_API_KEY,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_EMBEDDING_DIMENSIONS,
    OUTPUT_JSON_PATH,
    SUPABASE_SERVICE_KEY,
    SUPABASE_URL,
)
from logger import setup_logger
from storage import read_all_emails

logger = setup_logger()

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

# OpenAI-compatible client pointing at Groq (primary LLM)
groq_client = AsyncOpenAI(
    api_key=GROQ_API_KEY or "no-key",
    base_url="https://api.groq.com/openai/v1",
)

# Standard OpenAI client (used for embeddings if EMBEDDING_PROVIDER=openai)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY or "no-key")

# Anthropic client (fallback LLM)
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY or "no-key")


def get_supabase() -> SupabaseClient:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# Token counting and truncation (only used for OpenAI embeddings)
# ---------------------------------------------------------------------------

_encoder: Optional[tiktoken.Encoding] = None


def get_encoder() -> tiktoken.Encoding:
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.encoding_for_model("text-embedding-3-small")
    return _encoder


def truncate_to_tokens(text: str, max_tokens: int = MAX_EMBEDDING_TOKENS) -> tuple[str, int]:
    """Truncate text to at most max_tokens tokens. Returns (truncated_text, token_count)."""
    enc = get_encoder()
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text, len(tokens)
    truncated = enc.decode(tokens[:max_tokens])
    return truncated, max_tokens


def build_embedding_text(email: dict) -> str:
    """Build the text to embed for a single email."""
    subject = email.get("subject", "") or ""
    body = email.get("body_new_content", "") or email.get("body_clean", "") or ""
    return f"{subject}\n\n{body}".strip()


# ---------------------------------------------------------------------------
# Embedding backends
# ---------------------------------------------------------------------------

async def embed_batch_openai(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using OpenAI text-embedding-3-small (1536 dims)."""
    response = await openai_client.embeddings.create(
        model=OPENAI_EMBEDDING_MODEL,
        input=texts,
        dimensions=OPENAI_EMBEDDING_DIMENSIONS,
    )
    return [item.embedding for item in response.data]


def embed_batch_fastembed(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts using fastembed (local, no API key).
    Model: BAAI/bge-small-en-v1.5  →  384 dimensions
    """
    from fastembed import TextEmbedding  # lazy import — only needed when used

    model = TextEmbedding(model_name=FASTEMBED_MODEL)
    embeddings = list(model.embed(texts))
    return [emb.tolist() for emb in embeddings]


# ---------------------------------------------------------------------------
# Unified embedding entry point
# ---------------------------------------------------------------------------

async def embed_emails(
    emails: list[dict],
    batch_size: int = EMBEDDING_BATCH_SIZE,
    provider: str = EMBEDDING_PROVIDER,
) -> list[dict]:
    """
    Embed all emails and attach embedding to each dict. Returns updated list.

    provider="fastembed"  — local fastembed (default, 384 dims)
    provider="openai"     — OpenAI API (1536 dims)
    """
    total = len(emails)
    total_tokens = 0
    logger.info("starting_embedding", total_emails=total, provider=provider)

    for batch_start in range(0, total, batch_size):
        batch = emails[batch_start: batch_start + batch_size]

        if provider == "openai":
            texts = []
            token_counts = []
            for email in batch:
                raw_text = build_embedding_text(email)
                text, n_tokens = truncate_to_tokens(raw_text)
                texts.append(text)
                token_counts.append(n_tokens)
            try:
                embeddings = await embed_batch_openai(texts)
                for email, embedding in zip(batch, embeddings):
                    email["embedding"] = embedding
                total_tokens += sum(token_counts)
            except Exception as e:
                logger.error("embedding_batch_failed_openai",
                             batch_start=batch_start, error=str(e))

        else:  # fastembed (default)
            texts = [build_embedding_text(e) for e in batch]
            try:
                embeddings = embed_batch_fastembed(texts)
                for email, embedding in zip(batch, embeddings):
                    email["embedding"] = embedding
            except Exception as e:
                logger.error("embedding_batch_failed_fastembed",
                             batch_start=batch_start, error=str(e))

        batch_num = batch_start // batch_size + 1
        total_batches = (total + batch_size - 1) // batch_size
        logger.info(
            "embedding_batch_complete",
            batch_number=batch_num,
            total_batches=total_batches,
            emails_embedded=min(batch_start + batch_size, total),
            provider=provider,
        )

    return emails


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def email_to_db_row(email: dict) -> dict:
    """Convert a raw email dict to a Supabase-compatible row."""
    return {
        "message_id": email.get("message_id", ""),
        "in_reply_to": email.get("in_reply_to"),
        "references_ids": email.get("references", []),
        "subject": email.get("subject", ""),
        "author_name": email.get("author_name"),
        "author_email": email.get("author_email_obfuscated"),
        "date": email.get("date"),
        "body_clean": email.get("body_clean"),
        "body_new_content": email.get("body_new_content"),
        "source_url": email.get("source_url"),
        "month_period": email.get("month_period"),
        "thread_root_id": email.get("thread_root_id"),
        "thread_depth": email.get("thread_depth", 0),
        "embedding": email.get("embedding"),
    }


async def upsert_emails(emails: list[dict], supabase: SupabaseClient) -> int:
    """Upsert emails into Supabase in batches. Returns count of upserted rows."""
    UPSERT_BATCH = 500
    total_upserted = 0

    for i in range(0, len(emails), UPSERT_BATCH):
        batch = emails[i: i + UPSERT_BATCH]
        rows = [email_to_db_row(e) for e in batch]
        try:
            result = supabase.table("emails").upsert(
                rows,
                on_conflict="message_id",
            ).execute()
            total_upserted += len(rows)
            logger.info("upserted_batch",
                        batch_start=i, count=len(rows), total=total_upserted)
        except Exception as e:
            logger.error("upsert_failed", batch_start=i, error=str(e))

    return total_upserted


async def upsert_authors(emails: list[dict], supabase: SupabaseClient) -> None:
    """Aggregate author stats and upsert into authors table."""
    from collections import defaultdict

    author_data: dict[str, dict] = defaultdict(lambda: {
        "email_count": 0,
        "first_seen": None,
        "last_seen": None,
        "email_obfuscated": None,
    })

    for email in emails:
        name = email.get("author_name", "Unknown")
        date_str = email.get("date")
        if isinstance(date_str, str):
            try:
                date = datetime.fromisoformat(date_str)
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
            except Exception:
                date = None
        elif isinstance(date_str, datetime):
            date = date_str
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
        else:
            date = None

        d = author_data[name]
        d["email_count"] += 1
        d["email_obfuscated"] = d["email_obfuscated"] or email.get("author_email_obfuscated")

        if date:
            if d["first_seen"] is None or date < d["first_seen"]:
                d["first_seen"] = date
            if d["last_seen"] is None or date > d["last_seen"]:
                d["last_seen"] = date

    rows = [
        {
            "name": name,
            "email_obfuscated": data["email_obfuscated"],
            "email_count": data["email_count"],
            "first_seen": data["first_seen"].isoformat() if data["first_seen"] else None,
            "last_seen": data["last_seen"].isoformat() if data["last_seen"] else None,
        }
        for name, data in author_data.items()
        if name and name != "Unknown"
    ]

    UPSERT_BATCH = 100
    for i in range(0, len(rows), UPSERT_BATCH):
        batch = rows[i: i + UPSERT_BATCH]
        try:
            supabase.table("authors").upsert(
                batch,
                on_conflict="name",
            ).execute()
        except Exception as e:
            logger.error("author_upsert_failed", batch_start=i, error=str(e))

    logger.info("authors_upserted", count=len(rows))


# ---------------------------------------------------------------------------
# Thread stats
# ---------------------------------------------------------------------------

async def rebuild_thread_stats(supabase: SupabaseClient, emails: list[dict]) -> None:
    """Rebuild thread summary stats for all unique thread_root_ids."""
    root_ids = list({e.get("thread_root_id") for e in emails if e.get("thread_root_id")})
    logger.info("rebuilding_thread_stats", thread_count=len(root_ids))

    for root_id in root_ids:
        try:
            supabase.rpc("upsert_thread_stats", {"root_id": root_id}).execute()
        except Exception as e:
            logger.warning("thread_stats_failed", root_id=root_id, error=str(e))


# ---------------------------------------------------------------------------
# Thread summarization (LLM)
# Primary:  Groq (llama-3.1-8b-instant) — fast and free
# Fallback: Anthropic Claude Haiku       — set LLM_PROVIDER=anthropic
# ---------------------------------------------------------------------------

SUMMARY_PROMPT = """You are summarizing a C++ standardization mailing list discussion thread.

Thread subject: {subject}
Number of emails: {count}
Date range: {start} to {end}
Participants: {names}

Email contents (new content only, no quoted text):
{concatenated_new_content}

Write a 3 to 5 sentence summary that covers:
1. What the thread is about
2. The main positions or arguments made
3. Whether consensus was reached or the discussion is ongoing
4. Any proposal numbers mentioned (like P1234 or P2300R1)

Be factual and concise. Do not editorialize."""


def extract_proposal_numbers(text: str) -> list[str]:
    """Extract C++ proposal numbers like P1234 or P2300R1 from text."""
    return re.findall(r"\bP\d{3,4}(?:R\d+)?\b", text)


async def summarize_thread_groq(thread_emails: list[dict]) -> Optional[str]:
    """Generate a thread summary using Groq (llama-3.1-8b-instant)."""
    if not thread_emails:
        return None

    thread_emails_sorted = sorted(thread_emails, key=lambda e: e.get("date", ""))
    subject = thread_emails_sorted[0].get("subject", "")
    names = list({e.get("author_name", "Unknown") for e in thread_emails_sorted})[:10]

    start_str = thread_emails_sorted[0].get("date", "")
    end_str = thread_emails_sorted[-1].get("date", "")

    content_parts = []
    total_chars = 0
    for e in thread_emails_sorted:
        body = e.get("body_new_content", "") or ""
        if total_chars + len(body) > 12000:
            remaining = 12000 - total_chars
            if remaining > 100:
                content_parts.append(f"[{e.get('author_name', '?')}]: {body[:remaining]}...")
            break
        content_parts.append(f"[{e.get('author_name', '?')}]: {body}")
        total_chars += len(body)

    prompt = SUMMARY_PROMPT.format(
        subject=subject,
        count=len(thread_emails),
        start=start_str,
        end=end_str,
        names=", ".join(names),
        concatenated_new_content="\n\n---\n\n".join(content_parts),
    )

    try:
        response = await groq_client.chat.completions.create(
            model=GROQ_SUMMARY_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content if response.choices else None
    except Exception as e:
        logger.warning("summarize_thread_failed_groq", subject=subject, error=str(e))
        return None


async def summarize_thread_anthropic(thread_emails: list[dict]) -> Optional[str]:
    """Generate a thread summary using Anthropic Claude Haiku (fallback)."""
    if not thread_emails:
        return None

    thread_emails_sorted = sorted(thread_emails, key=lambda e: e.get("date", ""))
    subject = thread_emails_sorted[0].get("subject", "")
    names = list({e.get("author_name", "Unknown") for e in thread_emails_sorted})[:10]

    start_str = thread_emails_sorted[0].get("date", "")
    end_str = thread_emails_sorted[-1].get("date", "")

    content_parts = []
    total_chars = 0
    for e in thread_emails_sorted:
        body = e.get("body_new_content", "") or ""
        if total_chars + len(body) > 12000:
            remaining = 12000 - total_chars
            if remaining > 100:
                content_parts.append(f"[{e.get('author_name', '?')}]: {body[:remaining]}...")
            break
        content_parts.append(f"[{e.get('author_name', '?')}]: {body}")
        total_chars += len(body)

    prompt = SUMMARY_PROMPT.format(
        subject=subject,
        count=len(thread_emails),
        start=start_str,
        end=end_str,
        names=", ".join(names),
        concatenated_new_content="\n\n---\n\n".join(content_parts),
    )

    try:
        message = await anthropic_client.messages.create(
            model=ANTHROPIC_SUMMARY_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text if message.content else None
    except Exception as e:
        logger.warning("summarize_thread_failed_anthropic", subject=subject, error=str(e))
        return None


async def summarize_thread(thread_emails: list[dict]) -> Optional[str]:
    """Route thread summarization to the configured LLM provider."""
    if LLM_PROVIDER == "anthropic":
        return await summarize_thread_anthropic(thread_emails)
    return await summarize_thread_groq(thread_emails)


async def generate_thread_summaries(emails: list[dict], supabase: SupabaseClient) -> None:
    """Generate AI summaries for all threads and store in Supabase."""
    from collections import defaultdict

    threads: dict[str, list[dict]] = defaultdict(list)
    for email in emails:
        root_id = email.get("thread_root_id")
        if root_id:
            threads[root_id].append(email)

    logger.info("generating_thread_summaries", thread_count=len(threads),
                llm_provider=LLM_PROVIDER)

    for root_id, thread_emails in threads.items():
        try:
            summary = await summarize_thread(thread_emails)
            if not summary:
                continue

            # Extract proposal numbers from all email bodies
            all_text = " ".join(
                e.get("body_new_content", "") + " " + e.get("subject", "")
                for e in thread_emails
            )
            proposals = list(set(extract_proposal_numbers(all_text)))

            supabase.table("threads").update({
                "summary": summary,
                "proposal_numbers": proposals,
            }).eq("root_message_id", root_id).execute()

        except Exception as e:
            logger.error("thread_summary_failed", root_id=root_id, error=str(e))

    logger.info("thread_summaries_complete")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

async def run(batch_size: int, summarize: bool, provider: str) -> None:
    start = time.time()

    logger.info("loading_emails", path=OUTPUT_JSON_PATH)
    emails = read_all_emails()
    logger.info("emails_loaded", count=len(emails))

    if not emails:
        logger.error("no_emails_to_ingest")
        return

    # Embed
    emails = await embed_emails(emails, batch_size=batch_size, provider=provider)

    # Upsert to Supabase
    supabase = get_supabase()
    upserted = await upsert_emails(emails, supabase)
    logger.info("emails_upserted", count=upserted)

    # Authors
    await upsert_authors(emails, supabase)

    # Thread stats
    await rebuild_thread_stats(supabase, emails)

    # Optional: thread summaries
    if summarize:
        await generate_thread_summaries(emails, supabase)

    logger.info(
        "ingestion_complete",
        total_emails=len(emails),
        duration_seconds=round(time.time() - start, 1),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest emails into Supabase with embeddings")
    parser.add_argument("--batch-size", type=int, default=EMBEDDING_BATCH_SIZE)
    parser.add_argument("--summarize", action="store_true",
                        help="Generate AI thread summaries (slow, uses API credits)")
    parser.add_argument(
        "--provider",
        choices=["fastembed", "openai"],
        default=EMBEDDING_PROVIDER,
        help="Embedding provider: fastembed (default, local) or openai (requires OPENAI_API_KEY)",
    )
    args = parser.parse_args()
    asyncio.run(run(batch_size=args.batch_size, summarize=args.summarize, provider=args.provider))


if __name__ == "__main__":
    main()
