"""
Parser for .mbox files. Use this if you have local .mbox archives
from lists.isocpp.org instead of crawling the HTML.
"""
import mailbox
import email.utils as eu
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from models import RawEmail
from logger import setup_logger
from scraper import (
    strip_quoted_lines,
    extract_new_content_only,
    parse_references,
    obfuscate_email,
    parse_author_name,
)

logger = setup_logger()


def extract_body(message: mailbox.Message) -> str:
    """Extract plain text body from a mailbox.Message."""
    body_parts = []

    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                charset = part.get_content_charset() or "utf-8"
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_parts.append(payload.decode(charset, errors="replace"))
                except Exception:
                    body_parts.append(str(part.get_payload()))
    else:
        charset = message.get_content_charset() or "utf-8"
        try:
            payload = message.get_payload(decode=True)
            if payload:
                body_parts.append(payload.decode(charset, errors="replace"))
        except Exception:
            body_parts.append(str(message.get_payload()))

    return "\n".join(body_parts)


def parse_mbox_file(mbox_path: str, month_period: str) -> list[RawEmail]:
    """
    Parse all messages from a .mbox file for the given month period.
    Returns a list of RawEmail objects.
    """
    emails: list[RawEmail] = []
    mbox_path_obj = Path(mbox_path)

    if not mbox_path_obj.exists():
        logger.error("mbox_file_not_found", path=mbox_path)
        return []

    logger.info("parsing_mbox", path=mbox_path, period=month_period)
    mbox = mailbox.mbox(mbox_path)

    for i, message in enumerate(mbox):
        try:
            # Parse date
            date_str = message.get("Date", "")
            try:
                parsed_date = eu.parsedate_to_datetime(date_str)
            except Exception:
                parsed_date = datetime.now(tz=timezone.utc)

            # Parse body
            body = extract_body(message)

            # Parse from header
            from_str = message.get("From", "")
            author_name = parse_author_name(from_str)
            author_email = obfuscate_email(from_str)

            # Parse message ID
            message_id = message.get("Message-ID", "").strip()
            if not message_id:
                message_id = f"<mbox-{month_period}-{i}@local>"

            in_reply_to_raw = message.get("In-Reply-To", "")
            in_reply_to = in_reply_to_raw.strip() if in_reply_to_raw else None

            refs = parse_references(message.get("References", ""))

            subject = message.get("Subject", "No Subject")
            # Decode encoded subject
            try:
                from email.header import decode_header
                decoded_parts = decode_header(subject)
                decoded = []
                for part, charset in decoded_parts:
                    if isinstance(part, bytes):
                        decoded.append(part.decode(charset or "utf-8", errors="replace"))
                    else:
                        decoded.append(part)
                subject = "".join(decoded)
            except Exception:
                pass

            emails.append(RawEmail(
                message_id=message_id,
                in_reply_to=in_reply_to,
                references=refs,
                subject=subject,
                author_name=author_name or "Unknown",
                author_email_obfuscated=author_email,
                date=parsed_date,
                body_raw=body,
                body_clean=strip_quoted_lines(body),
                body_new_content=extract_new_content_only(body),
                source_url=f"https://lists.isocpp.org/std-proposals/{month_period}/",
                month_period=month_period,
            ))

        except Exception as e:
            logger.warning("failed_to_parse_mbox_message",
                           path=mbox_path, index=i, error=str(e))

    logger.info("mbox_parse_complete", path=mbox_path, count=len(emails))
    return emails


def parse_mbox_directory(dir_path: str) -> list[RawEmail]:
    """
    Parse all .mbox files in a directory.
    Expects files named like 2024-03.mbox or 2024_03.mbox.
    """
    all_emails: list[RawEmail] = []
    dir_obj = Path(dir_path)

    if not dir_obj.is_dir():
        logger.error("not_a_directory", path=dir_path)
        return []

    for mbox_file in sorted(dir_obj.glob("*.mbox")):
        # Try to extract YYYY/MM from filename
        m = re.search(r"(\d{4})[-_](\d{2})", mbox_file.stem)
        if m:
            period = f"{m.group(1)}/{m.group(2)}"
        else:
            period = "unknown/00"

        emails = parse_mbox_file(str(mbox_file), period)
        all_emails.extend(emails)

    return all_emails
