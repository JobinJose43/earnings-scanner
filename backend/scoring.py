"""Conviction score 0-100 from yfinance data only. No external APIs."""
from datetime import date
from typing import Optional

from data_fetcher import (
    fetch_earnings_history,
    fetch_revenue_history,
    fetch_analyst_activity,
    fetch_upcoming_earnings,
)


def _beat_streak(quarters: list[dict]) -> int:
    streak = 0
    for q in quarters:
        if q.get("beat") is True:
            streak += 1
        else:
            break
    return streak


def _avg_beat_pct(quarters: list[dict]) -> float:
    vals = [q["beat_pct"] for q in quarters if q.get("beat") is True and q.get("beat_pct") is not None]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def _revenue_growth_yoy(revenues: list[dict]) -> Optional[float]:
    """Latest quarter vs the quarter ended about a year earlier; None if missing."""
    if not revenues:
        return None
    latest = revenues[0]
    end    = date.fromisoformat(latest["date"])
    for r in revenues[1:]:
        if 350 <= (end - date.fromisoformat(r["date"])).days <= 380 and r["revenue"]:
            return round((latest["revenue"] - r["revenue"]) / abs(r["revenue"]) * 100, 1)
    return None


def calculate_conviction(symbol: str) -> dict:
    quarters = fetch_earnings_history(symbol)
    revenues = fetch_revenue_history(symbol)
    analyst  = fetch_analyst_activity(symbol)
    upcoming = fetch_upcoming_earnings(symbol)

    streak   = _beat_streak(quarters)
    avg_beat = _avg_beat_pct(quarters)
    rev_yoy  = _revenue_growth_yoy(revenues)
    net_rev  = analyst.get("net", 0)

    # component points
    streak_pts   = min(streak * 5, 40)
    beat_pts     = round(min((avg_beat / 20) * 25, 25), 1) if avg_beat > 0 else 0.0
    rev_pts      = round(min((rev_yoy / 50) * 20, 20), 1)  if rev_yoy and rev_yoy > 0 else 0.0
    revision_pts = min(max(net_rev, 0) * 2, 15)

    days_until   = upcoming.get("days_until") if upcoming else None
    proximity_pts = 0
    if days_until is not None and 0 <= days_until < 7:
        proximity_pts = 10
    elif days_until is not None and 0 <= days_until < 14:
        proximity_pts = 5

    total = min(round(streak_pts + beat_pts + rev_pts + revision_pts + proximity_pts), 100)

    return {
        "symbol": symbol,
        "conviction_score":    total,
        "beat_streak":         streak,
        "avg_beat_pct":        avg_beat,
        "revenue_growth_yoy":  rev_yoy,
        "analyst_upgrades":    analyst.get("upgrades", 0),
        "analyst_downgrades":  analyst.get("downgrades", 0),
        "analyst_net":         net_rev,
        "days_until_earnings": days_until,
        "earnings_date":       upcoming.get("date") if upcoming else None,
        # component breakdown
        "pts_streak":          streak_pts,
        "pts_beat":            beat_pts,
        "pts_revenue":         rev_pts,
        "pts_revision":        revision_pts,
        "pts_proximity":       proximity_pts,
    }
