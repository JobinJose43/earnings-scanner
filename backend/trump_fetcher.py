"""Fetches Trump-related mentions for a stock via Google News RSS. No API key needed."""
import re

import feedparser
import requests
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import cache
from config import TRUMP_CACHE_TTL, TRUMP_MAX_AGE_DAYS

_COMPANY_NAMES = {
    "NVDA": "Nvidia",
    "AMD": "AMD",
    "AVGO": "Broadcom",
    "MSFT": "Microsoft",
    "META": "Meta",
    "GOOGL": "Google",
    "AAPL": "Apple",
    "TSM": "TSMC",
    "ARM": "Arm Holdings",
    "ORCL": "Oracle",
    "SMCI": "Super Micro",
    "DELL": "Dell",
    "CRM": "Salesforce",
    "SNOW": "Snowflake",
    "PLTR": "Palantir",
    "ANET": "Arista Networks",
    "MRVL": "Marvell",
    "QCOM": "Qualcomm",
    "MU": "Micron",
    "INTC": "Intel",
    "ASML": "ASML",
    "LRCX": "Lam Research",
    "KLAC": "KLA",
    "AMAT": "Applied Materials",
    "CDNS": "Cadence",
    "SNPS": "Synopsys",
}


def _parse_dt(date_str: str) -> Optional[str]:
    if not date_str:
        return None
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _time_ago(iso_str: Optional[str]) -> str:
    if not iso_str:
        return ""
    try:
        dt  = datetime.fromisoformat(iso_str)
        now = datetime.now(timezone.utc)
        sec = int((now - dt).total_seconds())
        if sec < 60:    return f"{sec}s ago"
        if sec < 3600:  return f"{sec // 60}m ago"
        if sec < 86400: return f"{sec // 3600}h ago"
        return f"{sec // 86400}d ago"
    except Exception:
        return ""


_SUFFIXES = re.compile(
    r"[,.]?\s+(Incorporated|Inc|Corporation|Corp|Company|Companies|Co|plc|PLC|Ltd|Limited|Holdings?|"
    r"Group|N\.?V|S\.?A|SE|AG|Technolog(?:y|ies)|Platforms)\.?$|\.com$"
)
_FAMILY = re.compile(r"\b(Eric|Ivanka|Barron|Melania|Lara|Tiffany) Trump\b|\bTrump Jr\b")


# Company names that are also everyday words need a more specific phrase.
_AMBIGUOUS = {
    "Visa":   r"Visa (?:Inc|stock|shares|CEO)",
    "Target": r"Target(?:'s)? (?:Corp|stock|shares|CEO|stores?)",
    "Shell":  r"Shell (?:plc|stock|shares|CEO|oil)",
    "Sea":    r"Sea (?:Ltd|Limited)",
    "Grab":   r"Grab Holdings",
    "JD":     r"JD\.com",
    "ON":     r"ON Semiconductor|onsemi",
}


def company_name(ticker: str, name: Optional[str]) -> str:
    if ticker in _COMPANY_NAMES:
        return _COMPANY_NAMES[ticker]
    name = re.sub(r"^The\s+", "", name or ticker).strip()
    while True:
        short = re.sub(r"[,&\s]+$", "", _SUFFIXES.sub("", name))
        if short == name or not short:
            return name
        name = short


def is_match(text: str, ticker: str, company: str) -> bool:
    """Whole-word match on Trump and the company. Relatives do not count."""
    text = re.sub(r"\s+-\s+[^-]+$", "", text)  # drop the " - Publisher" ending
    if not re.search(r"\bTrump\b", _FAMILY.sub("", text)):
        return False
    if re.search(rf"\b(?:{_AMBIGUOUS.get(company, re.escape(company))})(?!\w)", text):
        return True
    # Short tickers (C, V, MA, NOW) collide with words, so require a cashtag.
    prefix = r"\$" if len(ticker) < 4 else r"\b"
    return bool(re.search(rf"{prefix}{re.escape(ticker)}\b", text))


def fetch_trump_mentions(ticker: str, name: Optional[str] = None) -> list[dict]:
    key = f"trump:{ticker}"
    cached = cache.get(key, ttl=TRUMP_CACHE_TTL)
    if cached is not None:
        return cached

    company = company_name(ticker.upper(), name)
    items = []
    try:
        resp = requests.get(
            "https://news.google.com/rss/search",
            params={"q": f'Trump "{company}" when:{TRUMP_MAX_AGE_DAYS}d',
                    "hl": "en-US", "gl": "US", "ceid": "US:en"},
            timeout=10,
        )
        resp.raise_for_status()
        now = datetime.now(timezone.utc)
        for entry in feedparser.parse(resp.content).entries[:30]:
            title = entry.get("title", "")
            pub   = _parse_dt(entry.get("published", ""))
            link  = entry.get("link", "")
            if not pub or (now - datetime.fromisoformat(pub)).days > TRUMP_MAX_AGE_DAYS:
                continue
            if link.startswith("https://") and is_match(title, ticker.upper(), company):
                items.append({"title": title, "link": link,
                              "published": pub, "time_ago": _time_ago(pub)})
        items = sorted(items, key=lambda x: x["published"], reverse=True)[:5]
    except Exception:
        items = []

    cache.set(key, items, ttl=TRUMP_CACHE_TTL)
    return items


def fetch_trump_latest(ticker: str, name: Optional[str] = None) -> Optional[dict]:
    """Returns only the single most recent Trump mention (for scan rows)."""
    items = fetch_trump_mentions(ticker, name)
    return items[0] if items else None
