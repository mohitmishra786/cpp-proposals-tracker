from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


class RawEmail(BaseModel):
    message_id: str
    in_reply_to: Optional[str] = None
    references: list[str] = []
    subject: str
    author_name: str
    author_email_obfuscated: str
    date: datetime
    body_raw: str
    body_clean: str           # quoted lines stripped
    body_new_content: str     # only lines the author wrote (no > prefix lines)
    source_url: str
    month_period: str         # "2024/03"
    thread_root_id: Optional[str] = None  # filled in post-processing
    thread_depth: int = 0

    @field_validator("message_id", "subject", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v
