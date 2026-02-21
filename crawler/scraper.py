"""
HTML scraper for the isocpp std-proposals Pipermail archive.
"""
import asyncio
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import (
    BASE_URL,
    CRAWL_DELAY_SECONDS,
    MAX_CONCURRENT_REQUESTS,
    MAX_CONCURRENT_MONTHS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_DELAY_BASE,
    START_MONTH,
    START_YEAR,
    USER_AGENT,
)
from logger import setup_logger
from models import RawEmail
from storage import write_email

logger = setup_logger()

_semaphore: Optional[asyncio.Semaphore] = None


def get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    return _semaphore


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT,
    )


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=RETRY_DELAY_BASE, min=0.5, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError)),
)
async def fetch_with_retry(client: httpx.AsyncClient, url: str) -> str:
    async with get_semaphore():
        logger.info("fetching_url", url=url)
        response = await client.get(url)
        response.raise_for_status()
        if CRAWL_DELAY_SECONDS > 0:
            await asyncio.sleep(CRAWL_DELAY_SECONDS)
        return response.text


# ---------------------------------------------------------------------------
# robots.txt check
# ---------------------------------------------------------------------------

async def check_robots_txt(client: httpx.AsyncClient) -> bool:
    """Return True if we are allowed to crawl the archive."""
    robots_url = "https://lists.isocpp.org/robots.txt"
    try:
        resp = await client.get(robots_url, timeout=10)
        if resp.status_code == 404:
            return True  # No robots.txt — crawling allowed
        text = resp.text
        # Simple check: look for Disallow: /std-proposals
        for line in text.splitlines():
            line = line.strip().lower()
            if line.startswith("disallow:") and "std-proposals" in line:
                logger.warning("robots_txt_disallow", url=robots_url)
                return False
        return True
    except Exception as e:
        logger.warning("robots_txt_fetch_failed", error=str(e))
        return True  # Allow on error


# ---------------------------------------------------------------------------
# Index page parsing
# ---------------------------------------------------------------------------

def parse_month_links(html: str) -> list[str]:
    """
    Extract all monthly archive links from the main index page.
    Links look like: /std-proposals/2024/03/
    """
    soup = BeautifulSoup(html, "lxml")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Match patterns like 2024/03/ or 2018/01/
        if re.match(r"\d{4}/\d{2}/?$", href.strip("/")):
            links.append(href)
    return links


def parse_email_links(html: str, month_url: str) -> list[str]:
    """
    Extract all individual email links from a month's index page.
    """
    soup = BeautifulSoup(html, "lxml")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Match numeric email IDs like 0001.php or msg00001.html
        if re.match(r"(msg)?\d+\.(php|html?)$", href):
            full_url = urljoin(month_url, href)
            links.append(full_url)
    return list(dict.fromkeys(links))  # deduplicate preserving order


# ---------------------------------------------------------------------------
# Email page parsing
# ---------------------------------------------------------------------------

def parse_header_value(soup: BeautifulSoup, label: str) -> Optional[str]:
    """Find a header value from the header table by label text."""
    # Common patterns: <b>From:</b>, <strong>Subject:</strong>, or table rows
    for b_tag in soup.find_all(["b", "strong"]):
        if label.lower() in b_tag.get_text().lower():
            # Value is usually the next sibling text
            parent = b_tag.parent
            if parent:
                text = parent.get_text()
                # Strip the label part
                after = text[text.lower().find(label.lower()) + len(label):]
                return after.strip().strip(":").strip()
    return None


def parse_email_date(date_str: str) -> Optional[datetime]:
    """Try multiple date formats used by Pipermail."""
    import email.utils
    if not date_str:
        return None
    try:
        return email.utils.parsedate_to_datetime(date_str)
    except Exception:
        pass
    # Try common formats
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%d %b %Y %H:%M:%S %z",
        "%B %d, %Y %I:%M %p",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def obfuscate_email(email_str: str) -> str:
    """Replace the domain part with [at] domain [dot] com style."""
    if "@" in email_str:
        local, domain = email_str.rsplit("@", 1)
        # Already obfuscated by Pipermail (" at " replacement)
        return email_str
    return email_str


def parse_author_name(from_str: str) -> str:
    """Extract display name from From header like 'John Doe <john at example.com>'."""
    import email.utils as eu
    name, _ = eu.parseaddr(from_str)
    if name:
        return name.strip()
    # Pipermail obfuscates as "John Doe john at example.com"
    # Remove the email-like trailing part
    cleaned = re.sub(r"\s+\S+\s+at\s+\S+", "", from_str).strip()
    return cleaned or from_str.strip()


def parse_references(refs_str: str) -> list[str]:
    """Split a References header into individual message IDs."""
    if not refs_str:
        return []
    # Message IDs are wrapped in < >
    ids = re.findall(r"<[^>]+>", refs_str)
    return [i.strip() for i in ids if i.strip()]


def strip_quoted_lines(body: str) -> str:
    """
    Remove lines that start with > (quoted text).
    Keep separator lines like 'On [date], [person] wrote:'.
    """
    lines = body.splitlines()
    result = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith(">"):
            continue
        result.append(line)
    return "\n".join(result)


def extract_new_content_only(body: str) -> str:
    """
    Return only the lines the current author wrote.
    Removes all > quoted lines and 'On ... wrote:' attribution lines.
    """
    lines = body.splitlines()
    result = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith(">"):
            continue
        # Skip common attribution patterns
        if re.match(r"^On .{5,100} wrote:?\s*$", stripped):
            continue
        result.append(line)
    # Collapse excessive blank lines
    text = "\n".join(result)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_comment_headers(html: str) -> dict[str, str]:
    """
    Extract email metadata from HTML comments.
    The isocpp archive embeds headers as:
      <!-- sent="Mon, 29 Dec 2025 00:59:12 +0000" -->
      <!-- name="John Doe" -->
      <!-- email="john_at_[hidden]" -->
      <!-- id="<msgid@host>" -->
      <!-- inreplyto="<parentid@host>" -->
      <!-- references="<ref1> <ref2>" -->
    """
    data: dict[str, str] = {}
    for m in re.finditer(r'<!--\s*(\w+)="([^"]*?)"\s*-->', html):
        key, val = m.group(1).lower(), m.group(2)
        data[key] = val
    return data


def parse_email_page(html: str, url: str, month_period: str) -> Optional[RawEmail]:
    """
    Parse a single Pipermail email page and return a RawEmail object.
    Returns None if parsing fails.
    """
    soup = BeautifulSoup(html, "lxml")

    try:
        # Subject — prefer the second <h1> (first is the list name)
        h1_tags = soup.find_all("h1")
        subject = ""
        for h1 in h1_tags:
            txt = h1.get_text(strip=True)
            if txt and txt != "std-proposals":
                subject = txt
                break
        if not subject and h1_tags:
            subject = h1_tags[-1].get_text(strip=True)
        subject = re.sub(r"^(Re:\s*)+", "Re: ", subject, flags=re.IGNORECASE)

        # Primary: extract headers from HTML comments (isocpp archive format)
        cdata = parse_comment_headers(html)

        author_name = cdata.get("name", "").strip()
        author_email_raw = cdata.get("email", "").strip()
        message_id = cdata.get("id", "").strip()
        in_reply_to_raw = cdata.get("inreplyto", "").strip() or None
        references_raw = cdata.get("references", "")
        date_str_comment = cdata.get("sent", "").strip()

        # Fallback: scan <li> text for "Key: value" lines (older Pipermail)
        if not author_name:
            header_data: dict[str, str] = {}
            for li in soup.find_all("li"):
                text = li.get_text()
                for key in ["From", "Date", "Message-ID", "In-Reply-To", "References"]:
                    if text.strip().startswith(key + ":"):
                        header_data[key] = text.strip()[len(key) + 1:].strip()
                        break
            from_str = header_data.get("From", "")
            author_name = parse_author_name(from_str)
            author_email_raw = obfuscate_email(from_str)
            if not message_id:
                message_id = header_data.get("Message-ID", "").strip()
            if not in_reply_to_raw:
                in_reply_to_raw = header_data.get("In-Reply-To", "").strip() or None
            if not references_raw:
                references_raw = header_data.get("References", "")
            if not date_str_comment:
                date_str_comment = header_data.get("Date", "")

        from_str = f"{author_name} <{author_email_raw}>" if author_email_raw else author_name

        date = parse_email_date(date_str_comment)
        if date is None:
            logger.warning("could_not_parse_date", url=url, date_str=date_str_comment)
            from datetime import timezone
            date = datetime.now(tz=timezone.utc)

        if not message_id:
            # Generate a synthetic ID from URL
            message_id = f"<synthetic-{url.split('/')[-1].replace('.php', '')}@{month_period.replace('/', '.')}>"

        in_reply_to = in_reply_to_raw
        references = parse_references(references_raw)

        # Body — the archive uses <div id="start" class="showhtml-body"> for HTML emails
        # and <pre> for plain-text emails. Try both.
        body_div = soup.find(id="start")
        if body_div:
            # HTML email: strip tags, decode entities, normalise whitespace
            # Remove quoted spans (class="quotelev1" etc.) before extracting
            for quoted in body_div.find_all("span", class_=re.compile(r"quotelev")):
                quoted.decompose()
            body_raw = body_div.get_text(separator="\n")
        else:
            pre = soup.find("pre")
            body_raw = pre.get_text() if pre else ""

        body_clean = strip_quoted_lines(body_raw)
        body_new = extract_new_content_only(body_raw)

        return RawEmail(
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
            subject=subject or "No Subject",
            author_name=author_name or "Unknown",
            author_email_obfuscated=author_email_raw,
            date=date,
            body_raw=body_raw,
            body_clean=body_clean,
            body_new_content=body_new,
            source_url=url,
            month_period=month_period,
        )

    except Exception as e:
        logger.error("parse_email_page_failed", url=url, error=str(e), exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Thread reconstruction
# ---------------------------------------------------------------------------

def reconstruct_threads(emails: list[dict]) -> list[dict]:
    """
    Second pass: assign thread_root_id and thread_depth to every email.
    Uses In-Reply-To and References headers to build thread trees.
    """
    logger.info("reconstructing_threads", email_count=len(emails))

    # Build lookup by message_id
    by_id: dict[str, dict] = {e["message_id"]: e for e in emails}

    def find_root(email: dict, depth: int = 0) -> tuple[str, int]:
        """Recursively find the root message ID."""
        if depth > 100:  # guard against cycles
            return email["message_id"], 0
        parent_id = email.get("in_reply_to")
        if not parent_id or parent_id not in by_id:
            return email["message_id"], 0
        root_id, root_depth = find_root(by_id[parent_id], depth + 1)
        return root_id, root_depth + 1

    for email in emails:
        try:
            root_id, depth = find_root(email)
            email["thread_root_id"] = root_id
            email["thread_depth"] = depth
        except Exception as e:
            logger.warning("thread_reconstruction_failed",
                           message_id=email.get("message_id"), error=str(e))
            email["thread_root_id"] = email["message_id"]
            email["thread_depth"] = 0

    return emails


# ---------------------------------------------------------------------------
# Main crawl functions
# ---------------------------------------------------------------------------

async def get_all_month_periods(
    client: httpx.AsyncClient,
    from_period: Optional[str] = None,
    only_period: Optional[str] = None,
) -> list[tuple[str, str]]:
    """
    Returns list of (month_period, index_url) tuples.
    month_period is like "2024/03".
    """
    main_html = await fetch_with_retry(client, f"{BASE_URL}/")
    soup = BeautifulSoup(main_html, "lxml")

    seen = set()
    periods = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        # Match YYYY/MM/index.php or YYYY/MM/ or YYYY/MM
        m = re.match(r"^(\d{4})/(\d{2})(?:/.*)?$", href)
        if m:
            year, month = int(m.group(1)), int(m.group(2))
            if year < START_YEAR or (year == START_YEAR and month < START_MONTH):
                continue
            period = f"{year}/{month:02d}"
            # If only_period is set, only include that exact period
            if only_period and period != only_period:
                continue
            if from_period and period < from_period:
                continue
            if period in seen:
                continue
            seen.add(period)
            # Use the actual index.php endpoint the archive serves
            index_url = f"{BASE_URL}/{period}/index.php"
            periods.append((period, index_url))

    periods.sort(key=lambda x: x[0])
    logger.info("found_month_periods", count=len(periods))
    return periods


async def crawl_month(
    client: httpx.AsyncClient,
    period: str,
    index_url: str,
) -> int:
    """Crawl all emails for a single month in parallel. Returns count of emails written."""
    logger.info("crawling_month", period=period)
    try:
        html = await fetch_with_retry(client, index_url)
    except Exception as e:
        logger.error("failed_to_fetch_month_index", period=period, error=str(e))
        return 0

    email_urls = parse_email_links(html, index_url)
    logger.info("found_emails_in_month", period=period, count=len(email_urls))

    async def fetch_and_parse(url: str) -> int:
        try:
            email_html = await fetch_with_retry(client, url)
            email = parse_email_page(email_html, url, period)
            if email:
                await write_email(email)
                return 1
        except Exception as e:
            logger.error("failed_to_parse_email", url=url, error=str(e))
        return 0

    # Process emails in parallel within the month
    results = await asyncio.gather(*[fetch_and_parse(url) for url in email_urls])
    count = sum(results)

    logger.info("month_crawl_complete", period=period, emails_written=count)
    return count
