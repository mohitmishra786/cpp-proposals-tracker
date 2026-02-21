"""
C++ Proposals Explorer — Web Crawler Entry Point

Usage:
  python main.py scrape                     # crawl all HTML pages
  python main.py scrape --from 2024/01      # crawl from a specific month
  python main.py mbox ./path/to/files/      # parse local mbox files
  python main.py incremental                # only fetch months newer than last crawl
"""
import argparse
import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from config import BASE_URL, OUTPUT_JSON_PATH, MAX_CONCURRENT_MONTHS
from logger import setup_logger
from mbox_parser import parse_mbox_directory
from models import RawEmail
from scraper import (
    check_robots_txt,
    crawl_month,
    get_all_month_periods,
    reconstruct_threads,
)
from storage import (
    load_crawl_state,
    read_all_emails,
    save_crawl_state,
    write_all_emails,
    write_email,
)

logger = setup_logger()

_state_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Crawl sub-commands
# ---------------------------------------------------------------------------

async def cmd_scrape(from_period: Optional[str] = None, only_period: Optional[str] = None) -> None:
    """Crawl all HTML pages in parallel, optionally starting from a given period or only a single period."""
    start = time.time()
    total_emails = 0
    errors = 0

    async with httpx.AsyncClient(
        headers={"User-Agent": "CppProposalsExplorer/1.0"},
        follow_redirects=True,
        timeout=30,
    ) as client:

        # Check robots.txt first
        allowed = await check_robots_txt(client)
        if not allowed:
            logger.error("robots_txt_disallow_crawl_aborted")
            return

        periods = await get_all_month_periods(client, from_period=from_period, only_period=only_period)
        state = load_crawl_state()
        completed = set(state.get("completed_months", []))

        # Filter out already completed months
        pending = [(p, u) for p, u in periods if p not in completed]
        logger.info("pending_months", count=len(pending), completed=len(completed))

        async def crawl_month_with_state(period: str, index_url: str) -> int:
            nonlocal errors
            try:
                count = await crawl_month(client, period, index_url)
                async with _state_lock:
                    state = load_crawl_state()
                    completed_months = set(state.get("completed_months", []))
                    completed_months.add(period)
                    state["completed_months"] = list(completed_months)
                    state["last_crawl"] = datetime.now(tz=timezone.utc).isoformat()
                    save_crawl_state(state)
                return count
            except Exception as e:
                logger.error("month_crawl_failed", period=period, error=str(e))
                errors += 1
                return 0

        # Process months in parallel batches
        for i in range(0, len(pending), MAX_CONCURRENT_MONTHS):
            batch = pending[i:i + MAX_CONCURRENT_MONTHS]
            logger.info("processing_batch", batch_num=i // MAX_CONCURRENT_MONTHS + 1, 
                       months=[p for p, _ in batch])
            results = await asyncio.gather(*[crawl_month_with_state(p, u) for p, u in batch])
            total_emails += sum(results)

    # Second pass: reconstruct threads
    logger.info("starting_thread_reconstruction")
    all_emails = read_all_emails()
    updated = reconstruct_threads(all_emails)
    write_all_emails(updated)

    unique_roots = len({e.get("thread_root_id") for e in updated if e.get("thread_root_id")})

    logger.info(
        "crawl_complete",
        total_emails=total_emails,
        total_threads=unique_roots,
        months_processed=len(pending),
        errors=errors,
        duration_seconds=round(time.time() - start, 1),
    )


async def cmd_incremental() -> None:
    """Only fetch months newer than the last completed crawl."""
    state = load_crawl_state()
    completed = state.get("completed_months", [])
    from_period: Optional[str] = None

    if completed:
        # Start from the latest completed month (re-crawl it for new emails)
        latest = sorted(completed)[-1]
        from_period = latest
        logger.info("incremental_crawl_from", period=from_period)

    await cmd_scrape(from_period=from_period)


def cmd_mbox(dir_path: str) -> None:
    """Parse local mbox files and write them to the output JSONL."""
    start = time.time()
    emails = parse_mbox_directory(dir_path)

    logger.info("writing_mbox_emails", count=len(emails))
    import asyncio as _asyncio

    async def _write_all(emails: list[RawEmail]) -> None:
        for email in emails:
            await write_email(email)

    _asyncio.run(_write_all(emails))

    # Reconstruct threads
    all_emails = read_all_emails()
    updated = reconstruct_threads(all_emails)
    write_all_emails(updated)

    unique_roots = len({e.get("thread_root_id") for e in updated if e.get("thread_root_id")})

    logger.info(
        "mbox_import_complete",
        total_emails=len(emails),
        total_threads=unique_roots,
        duration_seconds=round(time.time() - start, 1),
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="C++ Proposals Explorer — Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # scrape
    scrape_parser = subparsers.add_parser("scrape", help="Crawl all HTML archive pages")
    scrape_parser.add_argument(
        "--from",
        dest="from_period",
        metavar="YYYY/MM",
        default=None,
        help="Start crawling from this month (e.g. 2024/01)",
    )
    scrape_parser.add_argument(
        "--only",
        dest="only_period",
        metavar="YYYY/MM",
        default=None,
        help="Crawl only this specific month (e.g. 2026/02)",
    )

    # incremental
    subparsers.add_parser("incremental", help="Only fetch new emails since last crawl")

    # mbox
    mbox_parser = subparsers.add_parser("mbox", help="Parse local .mbox files")
    mbox_parser.add_argument(
        "dir_path",
        metavar="DIR",
        help="Path to directory containing .mbox files",
    )

    # log level (global)
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "scrape":
        asyncio.run(cmd_scrape(from_period=args.from_period, only_period=args.only_period))
    elif args.command == "incremental":
        asyncio.run(cmd_incremental())
    elif args.command == "mbox":
        cmd_mbox(args.dir_path)


if __name__ == "__main__":
    main()
