STOCK_REGIONS = {
    "US": {
        "Semiconductors": [
            "NVDA", "AMD", "AVGO", "QCOM", "MU", "INTC", "MRVL", "ON", "MCHP",
            "TXN", "KLAC", "LRCX", "AMAT", "CDNS", "SNPS",
        ],
        "Software": [
            "MSFT", "ORCL", "CRM", "SNOW", "PLTR", "ADBE", "NOW", "WDAY",
            "TEAM", "DDOG", "CRWD", "PANW", "NET", "MDB", "HUBS", "ZS", "FTNT", "GTLB",
        ],
        "Big Tech": [
            "AAPL", "GOOGL", "META", "AMZN", "NFLX", "TSLA", "UBER",
        ],
        "Hardware": [
            "ANET", "DELL", "SMCI", "HPQ", "CSCO", "IBM",
        ],
        "Finance": [
            "JPM", "BAC", "GS", "MS", "V", "MA", "BLK", "SCHW",
            "SPGI", "AXP", "C", "COF", "USB", "PNC", "MCO", "ICE", "CME",
        ],
        "Healthcare": [
            "LLY", "UNH", "ABBV", "JNJ", "MRK", "AMGN", "VRTX", "REGN",
            "GILD", "PFE", "BMY", "ISRG", "TMO", "ABT", "DHR", "BSX",
        ],
        "Consumer": [
            "HD", "WMT", "COST", "MCD", "SBUX", "NKE", "DIS", "CMG", "BKNG",
            "LOW", "TGT", "ABNB",
        ],
        "Energy": [
            "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "HAL",
        ],
        "Industrials": [
            "HON", "CAT", "DE", "GE", "BA", "LMT", "RTX", "UPS", "FDX",
            "CSX", "NSC",
        ],
    },
    "Europe": {
        "Technology": [
            "ASML", "SAP", "ERIC", "NOK", "BNTX",
        ],
        "Healthcare": [
            "NVS", "AZN", "GSK", "NVO", "SNY",
        ],
        "Finance": [
            "HSBC", "BCS", "ING", "DB", "UBS", "SAN", "BBVA",
        ],
        "Energy": [
            "SHEL", "BP", "TTE", "EQNR",
        ],
        "Consumer": [
            "LVMUY", "UL", "DEO", "BTI",
        ],
        "Industrials": [
            "SIEGY", "STLA", "EADSY",
        ],
    },
    "Asia": {
        "Semiconductors": [
            "TSM", "UMC", "ASX",
        ],
        "Technology": [
            "ARM", "SONY", "NTDOY", "FUJIY",
        ],
        "Chinese Tech": [
            "BABA", "TCEHY", "BIDU", "JD", "PDD", "NTES", "BILI", "SE",
        ],
        "India": [
            "HDB", "IBN", "INFY", "WIT",
        ],
        "Japan": [
            "TM", "HMC", "MUFG", "SMFG", "SFTBY",
        ],
        "EV": [
            "NIO", "XPEV", "LI",
        ],
        "Other": [
            "GRAB", "YUMC",
        ],
    },
}

# Flat lookup: ticker -> {region, sector}
STOCK_META: dict[str, dict] = {}
for _region, _sectors in STOCK_REGIONS.items():
    for _sector, _tickers in _sectors.items():
        for _ticker in _tickers:
            STOCK_META[_ticker] = {"region": _region, "sector": _sector}

STOCK_UNIVERSE: list[str] = list(STOCK_META.keys())

CACHE_TTL = 900          # 15 minutes (stock data)
TRUMP_MAX_AGE_DAYS = 14
TRUMP_CACHE_TTL = 1800   # 30 minutes (Trump mentions)

RSS_FEEDS_TICKER = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US",
]
RSS_FEEDS_GENERAL = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
]
