"""
Write the read-only dataset used by the public site.

    python snapshot.py ../frontend/public/data

Exits non-zero, leaving existing data alone, if too many tickers fail. That way
a bad run never replaces a good published snapshot.
"""
import json
import math
import shutil
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import data_fetcher as df
import scan_rows
import spillover_engine as sp
from config import STOCK_UNIVERSE

WORKERS = 2          # stay gentle with Yahoo
RETRY_WAITS = (60, 180, 300, 600)
MIN_SUCCESS = 0.85


def clean(value):
    """Replace NaN/inf (invalid JSON) with None."""
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def build(symbol: str):
    try:
        row = scan_rows.build_scan_row(symbol)
        if not row["price"]:
            raise ValueError("no price")
        return symbol, row, {
            "detail":     scan_rows.build_detail(symbol),
            "moves":      {"ticker": symbol, **df.fetch_earnings_moves(symbol)},
            "correlated": sp.get_correlated(symbol),
        }
    except Exception as exc:
        print(f"  {symbol}: {exc!r}", flush=True)
        return symbol, None, None


def publish(src: Path, out: Path) -> None:
    """Copy over in place: Windows cannot rename a folder a dev server watches."""
    shutil.copytree(src, out, dirs_exist_ok=True)
    for old in (out / "stocks").glob("*.json"):
        if not (src / "stocks" / old.name).exists():
            old.unlink()


def main(out: Path) -> int:
    results = {}
    todo = list(STOCK_UNIVERSE)
    for wait in (0, *RETRY_WAITS):
        if wait:
            print(f"retrying {len(todo)} tickers in {wait}s", flush=True)
            time.sleep(wait)
        with ThreadPoolExecutor(WORKERS) as pool:
            for symbol, row, detail in pool.map(build, todo):
                results[symbol] = (symbol, row, detail)
        todo = [s for s in todo if not results[s][1]]
        if not todo:
            break
    built = list(results.values())
    good = [b for b in built if b[1]]
    print(f"{len(good)}/{len(built)} tickers OK")
    for field in ("earnings_date", "expected_move_pct", "revenue_growth_yoy"):
        print(f"  with {field}: {sum(b[1][field] is not None for b in good)}")
    with_history = sum(bool(b[2]["detail"]["earnings_history"]) for b in good)
    print(f"  with earnings history: {with_history}")
    if min(len(good), with_history) < MIN_SUCCESS * len(built):
        print("Too many failures; snapshot not written.")
        return 1

    tmp = Path(tempfile.mkdtemp(prefix="scanner-"))
    (tmp / "stocks").mkdir()

    def write(path, data):
        path.write_text(json.dumps(clean(data), allow_nan=False), encoding="utf-8")

    stocks = sorted((b[1] for b in good), key=lambda r: r["conviction_score"], reverse=True)
    write(tmp / "snapshot.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stocks": stocks,
    })
    for symbol, _, detail in good:
        write(tmp / "stocks" / f"{symbol}.json", detail)
    publish(tmp, out)
    shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
