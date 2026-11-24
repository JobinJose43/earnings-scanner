"""Builds scanner rows and detail records. Shared by the API and the snapshot."""
import data_fetcher as df
import scoring as sc
import trump_fetcher as tf
from config import STOCK_META


def build_scan_row(symbol: str) -> dict:
    info  = df.fetch_stock_info(symbol)
    score = sc.calculate_conviction(symbol)
    move  = df.fetch_expected_move_info(symbol)
    meta  = STOCK_META.get(symbol, {})
    return {
        "symbol":              symbol,
        "name":                info.get("name", symbol),
        "price":               info.get("price", 0),
        "change_pct":          info.get("change_pct", 0),
        "conviction_score":    score["conviction_score"],
        "earnings_date":       score.get("earnings_date"),
        "days_until_earnings": score.get("days_until_earnings"),
        "expected_move_pct":   move["pct"],
        "expected_move_expiry": move["expiry"],
        "expected_move_covers_earnings": move["covers_earnings"],
        "revenue_growth_yoy":  score.get("revenue_growth_yoy"),
        "beat_streak":         score.get("beat_streak"),
        "avg_beat_pct":        score.get("avg_beat_pct"),
        "market_cap":          info.get("market_cap"),
        "pe_ratio":            info.get("pe_ratio"),
        "trump_mention":       tf.fetch_trump_latest(symbol, info.get("name")),
        "region":              meta.get("region", "US"),
        "sector":              meta.get("sector", ""),
    }


def build_detail(symbol: str) -> dict:
    move = df.fetch_expected_move_info(symbol)
    return {
        **df.fetch_stock_info(symbol),
        "conviction":        sc.calculate_conviction(symbol),
        "earnings_history":  df.fetch_earnings_history(symbol),
        "revenue_history":   df.fetch_revenue_history(symbol),
        "expected_move_pct": move["pct"],
        "expected_move_expiry": move["expiry"],
        "expected_move_covers_earnings": move["covers_earnings"],
        "analyst_activity":  df.fetch_analyst_activity(symbol),
    }
