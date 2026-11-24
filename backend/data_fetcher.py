"""yfinance data fetching with 15-minute in-memory cache."""
import logging
import math
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import yfinance as yf
from yfinance.exceptions import YFRateLimitError
import cache


log = logging.getLogger("data_fetcher")
_ET = ZoneInfo("America/New_York")


def _today() -> date:
    """Market date, so results do not depend on the server's time zone."""
    return datetime.now(_ET).date()


def _date(text: str) -> date:
    return datetime.strptime(text, "%Y-%m-%d").date()


def _num(val: Any) -> Optional[float]:
    try:
        n = float(val)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def _safe(val: Any, default=None):
    if val is None:
        return default
    try:
        if isinstance(val, float) and math.isnan(val):
            return default
    except Exception:
        pass
    return val


def _ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol)


# ---------------------------------------------------------------------------
# stock info
# ---------------------------------------------------------------------------

def fetch_stock_info(symbol: str) -> dict:
    key = f"info:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    t = _ticker(symbol)
    info = t.info or {}

    price = _safe(info.get("currentPrice") or info.get("regularMarketPrice"), 0.0)
    prev  = _safe(info.get("previousClose"), price)

    result = {
        "symbol": symbol,
        "name": _safe(info.get("longName") or info.get("shortName"), symbol),
        "price": price,
        "prev_close": prev,
        "change_pct": round(((price - prev) / prev * 100) if prev else 0.0, 2),
        "pre_market_price": _safe(info.get("preMarketPrice")),
        "post_market_price": _safe(info.get("postMarketPrice")),
        "market_cap": _safe(info.get("marketCap")),
        "pe_ratio": _safe(info.get("trailingPE") or info.get("forwardPE")),
        "week52_high": _safe(info.get("fiftyTwoWeekHigh")),
        "week52_low": _safe(info.get("fiftyTwoWeekLow")),
        "analyst_low": _safe(info.get("targetLowPrice")),
        "analyst_avg": _safe(info.get("targetMeanPrice")),
        "analyst_high": _safe(info.get("targetHighPrice")),
        "sector": _safe(info.get("sector")),
        "industry": _safe(info.get("industry")),
        "market_state": _safe(info.get("marketState"), "REGULAR"),
    }

    cache.set(key, result)
    return result


# ---------------------------------------------------------------------------
# earnings history
# ---------------------------------------------------------------------------

def _earnings_dates(symbol: str) -> list[dict]:
    """Past and future report dates (US Eastern), newest first."""
    key = f"edates:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    rows: list[dict] = []
    try:
        ed = _ticker(symbol).earnings_dates
        if ed is not None:
            for ts, row in ed.iterrows():
                # Yahoo uses midnight when the time of day is unknown.
                session = None
                if ts.hour or ts.minute:
                    session = "bmo" if ts.hour < 12 else "amc"
                rows.append({
                    "date":     str(ts.date()),
                    "session":  session,
                    "estimate": _num(row.get("EPS Estimate")),
                    "actual":   _num(row.get("Reported EPS")),
                    "surprise": _num(row.get("Surprise(%)")),
                })
    except YFRateLimitError:
        raise  # never cache or score partial data
    except Exception:
        log.warning("earnings dates unavailable for %s", symbol)

    unique = {r["date"]: r for r in rows}
    rows = sorted(unique.values(), key=lambda r: r["date"], reverse=True)
    cache.set(key, rows)
    return rows


def fetch_earnings_history(symbol: str) -> list[dict]:
    """Last 8 reported quarters, newest first. `date` is the report date."""
    key = f"earnings:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    quarters: list[dict] = []
    for r in _earnings_dates(symbol):
        if r["actual"] is None:
            continue
        beat_pct = r["surprise"]
        if beat_pct is None and r["estimate"]:
            beat_pct = round((r["actual"] - r["estimate"]) / abs(r["estimate"]) * 100, 2)
        quarters.append({
            "date":         r["date"],
            "session":      r["session"],
            "eps_estimate": r["estimate"],
            "eps_actual":   r["actual"],
            "beat":         None if beat_pct is None else beat_pct >= 0,
            "beat_pct":     beat_pct,
        })

    quarters = quarters[:8]
    cache.set(key, quarters)
    return quarters


# ---------------------------------------------------------------------------
# revenue history
# ---------------------------------------------------------------------------

def fetch_revenue_history(symbol: str) -> list[dict]:
    key = f"revenue:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    t = _ticker(symbol)
    revenues: list[dict] = []

    try:
        fin = t.quarterly_financials
        if fin is not None and not fin.empty:
            rev_row = None
            for label in ["Total Revenue", "Revenue"]:
                if label in fin.index:
                    rev_row = fin.loc[label]
                    break
            if rev_row is not None:
                for col in rev_row.index:
                    val = _safe(rev_row[col])
                    if val is not None:
                        revenues.append({
                            "date": str(col.date()) if hasattr(col, "date") else str(col),
                            "revenue": float(val),
                        })
    except YFRateLimitError:
        raise  # never cache or score partial data
    except Exception:
        pass

    revenues = sorted(revenues, key=lambda x: x["date"], reverse=True)[:8]
    cache.set(key, revenues)
    return revenues


# ---------------------------------------------------------------------------
# upcoming earnings
# ---------------------------------------------------------------------------

def fetch_upcoming_earnings(symbol: str) -> Optional[dict]:
    """Next report that has not been published yet, or None."""
    key = f"upcoming:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    today = _today()
    result = None

    future = [
        r for r in _earnings_dates(symbol)
        if r["actual"] is None and _date(r["date"]) >= today
    ]
    if future:
        nxt = min(future, key=lambda r: r["date"])
        result = {"date": nxt["date"], "session": nxt["session"]}
    else:
        # Yahoo's calendar can still list the last report, so skip past dates.
        try:
            dates = (_ticker(symbol).calendar or {}).get("Earnings Date") or []
            dates = dates if isinstance(dates, list) else [dates]
            reported = {r["date"] for r in _earnings_dates(symbol) if r["actual"] is not None}
            upcoming = sorted(
                d for d in (str(x)[:10] for x in dates)
                if _date(d) >= today and d not in reported
            )
            if upcoming:
                result = {"date": upcoming[0], "session": None}
        except YFRateLimitError:
            raise  # never cache or score partial data
        except Exception:
            log.warning("earnings calendar unavailable for %s", symbol)

    if result:
        result["days_until"] = (_date(result["date"]) - today).days
        cache.set(key, result)
    return result



# ---------------------------------------------------------------------------
# options expected move
# ---------------------------------------------------------------------------

MAX_EARNINGS_EXPIRY_DAYS = 45


def choose_expiry(expirations, today, upcoming) -> tuple[Optional[str], bool]:
    """
    Pick the expiration to price. Returns (expiry, covers_earnings).
    Prefers the first one that includes the market's reaction to earnings.
    """
    dates = sorted(expirations)
    if upcoming:
        earn = _date(upcoming["date"])
        for e in dates:
            d = _date(e)
            # Before-open reports react the same day; otherwise the next day.
            if d > earn or (d == earn and upcoming.get("session") == "bmo"):
                # Far-off expirations mostly price ordinary movement.
                if (d - today).days <= MAX_EARNINGS_EXPIRY_DAYS:
                    return e, True
                break
    for e in dates:
        if 5 <= (_date(e) - today).days <= 60:
            return e, False
    return (dates[0] if dates else None), False


def _option_price(row) -> Optional[float]:
    """Bid/ask midpoint, falling back to the last trade."""
    bid, ask = _num(row.get("bid")) or 0.0, _num(row.get("ask")) or 0.0
    if bid > 0 and ask >= bid:
        return (bid + ask) / 2
    last = _num(row.get("lastPrice")) or 0.0
    return last if last > 0 else None


def fetch_expected_move_info(symbol: str) -> dict:
    key = f"options:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    result = {"pct": None, "expiry": None, "covers_earnings": False}
    try:
        t = _ticker(symbol)
        expiry, covers = choose_expiry(t.options or (), _today(), fetch_upcoming_earnings(symbol))
        spot = fetch_stock_info(symbol)["price"]
        if expiry and spot:
            chain  = t.option_chain(expiry)
            calls  = chain.calls.drop_duplicates("strike").set_index("strike")
            puts   = chain.puts.drop_duplicates("strike").set_index("strike")
            common = calls.index.intersection(puts.index)
            if len(common):
                strike = min(common, key=lambda k: abs(k - spot))
                c, p = _option_price(calls.loc[strike]), _option_price(puts.loc[strike])
                # A strike far from spot is not an at-the-money straddle.
                if c is not None and p is not None and abs(strike - spot) / spot <= 0.10:
                    result = {
                        "pct": round((c + p) / spot * 100, 2),
                        "expiry": expiry,
                        "covers_earnings": covers,
                    }
    except YFRateLimitError:
        raise  # never cache or score partial data
    except Exception:
        log.warning("expected move unavailable for %s", symbol)

    cache.set(key, result)
    return result



# ---------------------------------------------------------------------------
# analyst upgrades/downgrades
# ---------------------------------------------------------------------------

def fetch_analyst_activity(symbol: str) -> dict:
    key = f"analyst:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    t = _ticker(symbol)
    result = {"upgrades": 0, "downgrades": 0, "net": 0}

    try:
        ud = t.upgrades_downgrades
        if ud is not None and not ud.empty:
            cutoff = datetime.now() - timedelta(days=30)
            idx = ud.index.tz_localize(None) if ud.index.tzinfo else ud.index
            recent = ud[idx >= cutoff]
            up, dn = 0, 0
            for _, row in recent.iterrows():
                action = str(row.get("Action", "")).lower()
                if action == "up":  # new coverage and repeated ratings are not upgrades
                    up += 1
                elif action == "down":
                    dn += 1
            result = {"upgrades": up, "downgrades": dn, "net": up - dn}
    except YFRateLimitError:
        raise  # never cache or score partial data
    except Exception:
        pass

    cache.set(key, result)
    return result


# ---------------------------------------------------------------------------
# earnings moves: options expected vs actual historical move
# ---------------------------------------------------------------------------

def reaction_move(dates, closes, report_date, session) -> Optional[float]:
    """
    Close-to-close % move around a report.
    Before open: prior close -> same-day close. After close: same-day -> next close.
    """
    if session not in ("bmo", "amc") or report_date not in dates:
        return None
    i = dates.index(report_date)
    a, b = (i - 1, i) if session == "bmo" else (i, i + 1)
    if a < 0 or b >= len(closes) or not closes[a]:
        return None
    return round((closes[b] - closes[a]) / closes[a] * 100, 1)


def fetch_earnings_moves(symbol: str) -> dict:
    """Current implied move plus the actual stock move after each past report."""
    key = f"emoves:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    quarters = fetch_earnings_history(symbol)
    move     = fetch_expected_move_info(symbol)
    upcoming = fetch_upcoming_earnings(symbol)
    history  = []

    if quarters:
        try:
            start = _date(quarters[-1]["date"]) - timedelta(days=10)
            hist  = _ticker(symbol).history(start=str(start), end=str(_today() + timedelta(days=1)))
            series = hist["Close"].dropna()
            # Today's bar is not a close until the market shuts.
            now = datetime.now(_ET)
            if len(series) and series.index[-1].date() == now.date() and now.hour < 16:
                series = series.iloc[:-1]
            dates  = [d.date() for d in series.index]
            closes = [float(c) for c in series]
            for q in quarters:
                actual = reaction_move(dates, closes, _date(q["date"]), q["session"])
                if actual is not None:
                    history.append({**q, "actual_move_pct": actual})
        except YFRateLimitError:
            raise  # never cache or score partial data
        except Exception:
            log.warning("earnings moves unavailable for %s", symbol)

    result = {
        "expected_move_pct":    move["pct"],
        "expected_move_expiry": move["expiry"],
        "expected_move_covers_earnings": move["covers_earnings"],
        "earnings_date":        upcoming["date"] if upcoming else None,
        "history":              history,
        "avg_abs_move":         round(
            sum(abs(h["actual_move_pct"]) for h in history) / len(history), 1
        ) if history else None,
    }
    cache.set(key, result)
    return result


# ---------------------------------------------------------------------------
# live price (short TTL)
# ---------------------------------------------------------------------------

def fetch_live_price(symbol: str) -> dict:
    key = f"live:{symbol}"
    cached = cache.get(key, ttl=30)
    if cached is not None:
        return cached

    t = _ticker(symbol)
    info  = t.info or {}
    price = _safe(info.get("currentPrice") or info.get("regularMarketPrice"), 0.0)
    prev  = _safe(info.get("previousClose"), price)

    result = {
        "symbol": symbol,
        "price": price,
        "prev_close": prev,
        "change_pct": round(((price - prev) / prev * 100) if prev else 0.0, 2),
        "pre_market_price": _safe(info.get("preMarketPrice")),
        "post_market_price": _safe(info.get("postMarketPrice")),
        "market_state": _safe(info.get("marketState"), "REGULAR"),
    }

    cache.set(key, result, ttl=30)
    return result


# ---------------------------------------------------------------------------
# earnings calendar
# ---------------------------------------------------------------------------

def fetch_earnings_calendar(days: int = 60) -> list[dict]:
    from config import STOCK_UNIVERSE
    key = f"calendar:{days}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    today  = _today()
    cutoff = today + timedelta(days=days)
    events = []

    for symbol in STOCK_UNIVERSE:
        ev = fetch_upcoming_earnings(symbol)
        if ev:
            try:
                d = datetime.strptime(ev["date"], "%Y-%m-%d").date()
                if today <= d <= cutoff:
                    events.append({
                        "symbol": symbol,
                        "date": ev["date"],
                        "days_until": ev["days_until"],
                    })
            except YFRateLimitError:
                raise  # never cache or score partial data
            except Exception:
                pass

    events.sort(key=lambda x: x["date"])
    cache.set(key, events)
    return events
