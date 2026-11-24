"""
spillover_engine.py — Correlated-assets / catalyst-spillover data.

Ported from the standalone Spillover prototype. Maps a ticker to the
catalyst theme it's a primary driver of, and to the assets that historically
move because of that theme.

To add coverage: add a THEME_INFO entry, a SPILLOVER_MAP entry, and point one
or more tickers at it via PRIMARY_TICKER_THEME.
"""

from dataclasses import dataclass, asdict


@dataclass
class Spill:
    tk: str
    name: str
    rel: str
    why: str
    corr: float
    lag: str
    exp: str = "follow"              # follow | inverse


THEME_INFO: dict[str, dict] = {
    "memory_cycle": {"sector": "Semis · Memory",    "type": "Earnings / pricing"},
    "semicap":      {"sector": "Semis · Equipment",  "type": "Capex cycle"},
    "foundry_win":  {"sector": "Semis · Foundry",    "type": "Contract win"},
    "ai_semi":      {"sector": "Semis · AI",         "type": "AI demand / guidance"},
    "oil_shock":    {"sector": "Macro · Energy",     "type": "Supply shock"},
}


SPILLOVER_MAP: dict[str, list[Spill]] = {
    "memory_cycle": [
        Spill("WDC", "Western Digital", "Direct memory/storage peer",
              "Pure-play NAND+HDD; gaps on memory pricing read-through. Smaller cap, bigger % move.", 0.86, "Same day → +1"),
        Spill("STX", "Seagate", "Direct storage peer",
              "Moves in lockstep with WDC on storage pricing signals.", 0.82, "Same day → +1"),
        Spill("SNDK", "Sandisk", "NAND pure-play",
              "Most leveraged to NAND pricing; high beta to the memory narrative.", 0.79, "Same day → +1"),
        Spill("NVDA", "Nvidia", "Downstream HBM demand",
              "Strong HBM commentary reads as AI-capex confirmation.", 0.55, "+1 day"),
        Spill("AMAT", "Applied Materials", "Upstream equipment",
              "Memory capex guidance re-rates fab-equipment order visibility.", 0.49, "+1-2 days"),
    ],
    "semicap": [
        Spill("LRCX", "Lam Research", "Equipment peer",
              "Most memory-capex-levered; order-cycle duration drives the multiple.", 0.88, "Same day"),
        Spill("KLAC", "KLA Corp", "Equipment peer",
              "Process-control monopoly; moves with the cohort on capex headlines.", 0.85, "Same day"),
        Spill("ASML", "ASML", "Litho monopoly (laggard check)",
              "Often the relative laggard in a synchronized breakout — catch-up potential.", 0.72, "Same day → +1"),
        Spill("INTC", "Intel", "Foundry-spend driver",
              "Foundry wins feed the capex story; moves on the same demand thesis.", 0.51, "+1 day"),
    ],
    "foundry_win": [
        Spill("AMAT", "Applied Materials", "Fab-tooling supplier",
              "Foundry expansion = wafer-fab equipment orders; broadest beneficiary.", 0.62, "+1-2 days"),
        Spill("LRCX", "Lam Research", "Fab-tooling supplier",
              "Etch/deposition demand rises with new capacity buildout.", 0.60, "+1-2 days"),
        Spill("NVDA", "Nvidia", "Potential foundry customer",
              "Diversifying away from a single foundry is a mild positive sentiment read.", 0.41, "+1 day"),
    ],
    "ai_semi": [
        Spill("AMD", "AMD", "AI-semi peer (contagion)",
              "Moves on peer guidance with no own-name news — algo correlation amplifies.", 0.83, "Same day"),
        Spill("INTC", "Intel", "Semi peer (contagion)",
              "Dragged by sector-ETF deleveraging, not fundamentals.", 0.79, "Same day"),
        Spill("NVDA", "Nvidia", "AI-semi bellwether",
              "Sets/absorbs sector sentiment; recovers faster as the bellwether.", 0.61, "Same day"),
    ],
    "oil_shock": [
        Spill("HAL", "Halliburton", "Oilfield-services beneficiary",
              "Producers ramp capacity outside conflict zones → services demand. Geopolitical proxy.", 0.78, "+1-3 days"),
        Spill("OXY", "Occidental", "Leveraged E&P",
              "High-beta producer; earnings swing hard with crude.", 0.74, "Same day"),
        Spill("SLB", "SLB", "Oilfield services",
              "Same tailwind as HAL with more international chokepoint exposure.", 0.71, "+1-3 days"),
        Spill("DAL", "Delta Air Lines", "Fuel-cost victim",
              "Jet fuel ~1/3 of opex; sustained high crude crushes airline margins.", 0.68, "+1-2 days", exp="inverse"),
        Spill("LUV", "Southwest", "Fuel-cost victim",
              "Domestic carrier, thin hedging; most exposed to a fast fuel spike.", 0.64, "+1-2 days", exp="inverse"),
    ],
}


# ticker -> theme it's a primary driver of. NVDA/AVGO both anchor the ai_semi
# narrative; energy names all sit on the same oil_shock catalyst.
PRIMARY_TICKER_THEME: dict[str, str] = {
    "MU": "memory_cycle",
    "NVDA": "ai_semi", "AVGO": "ai_semi",
    "AMAT": "semicap", "LRCX": "semicap", "KLAC": "semicap", "ASML": "semicap",
    "TSM": "foundry_win",
    "XOM": "oil_shock", "CVX": "oil_shock", "COP": "oil_shock",
    "SLB": "oil_shock", "EOG": "oil_shock", "OXY": "oil_shock", "HAL": "oil_shock",
}


def get_correlated(ticker: str) -> dict:
    ticker = ticker.upper()
    theme = PRIMARY_TICKER_THEME.get(ticker)
    if not theme:
        return {"ticker": ticker, "has_mapping": False, "correlated": []}
    info = THEME_INFO[theme]
    rows = [asdict(s) for s in SPILLOVER_MAP.get(theme, []) if s.tk != ticker]
    return {
        "ticker": ticker,
        "has_mapping": True,
        "theme": theme,
        "sector": info["sector"],
        "type": info["type"],
        "correlated": rows,
    }
