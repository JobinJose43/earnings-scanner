// Same interface as the live API, backed by static JSON and browser storage.
const DATA = `${process.env.PUBLIC_URL || ""}/data`;
const WATCHLIST_KEY = "earnings-scanner-watchlist";
const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    const request = fetch(`${DATA}/${path}`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    request.catch(() => cache.delete(path)); // allow a retry after a failure
    cache.set(path, request);
  }
  return cache.get(path);
}

// Recomputed in the browser so it stays right between snapshots.
export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
}

async function stocks() {
  const { stocks: rows, generated_at } = await load("snapshot.json");
  return {
    generated_at,
    rows: rows.map((s) => ({ ...s, days_until_earnings: daysUntil(s.earnings_date) })),
  };
}

function readWatchlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const stock = (t) => load(`stocks/${encodeURIComponent(t)}.json`);

export const publicApi = {
  scan: async (region) => {
    const { rows, generated_at } = await stocks();
    const list = region ? rows.filter((s) => s.region === region) : rows;
    return { stocks: list, count: list.length, generated_at };
  },
  stock:      async (t) => (await stock(t)).detail,
  moves:      async (t) => (await stock(t)).moves,
  correlated: async (t) => (await stock(t)).correlated,
  news:       async () => ({ items: [] }),
  newsAgg:    async () => ({ items: [] }),
  price:      async () => null,
  calendar:   async (days = 30) => {
    const { rows } = await stocks();
    const events = rows
      .filter((s) => s.days_until_earnings != null && s.days_until_earnings >= 0 && s.days_until_earnings <= days)
      .map((s) => ({ symbol: s.symbol, date: s.earnings_date, conviction_score: s.conviction_score }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { events };
  },
  watchlist: async () => ({ watchlist: readWatchlist() }),
  watchlistSet: async (ticker, action) => {
    const rest = readWatchlist().filter((t) => t !== ticker);
    const watchlist = action === "add" ? [...rest, ticker] : rest;
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch { /* storage blocked: lasts for this visit only */ }
    return { watchlist };
  },
};
