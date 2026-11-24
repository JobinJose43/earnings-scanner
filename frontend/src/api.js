import { API_BASE, IS_PUBLIC } from "./config";
import { publicApi } from "./publicApi";

async function get(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const liveApi = {
  scan:         (region)     => get(region ? `/scan?region=${region}` : "/scan"),
  regions:      ()           => get("/regions"),
  stock:        (t)          => get(`/stock/${t}`),
  moves:        (t)          => get(`/stock/${t}/moves`),
  news:         (t)          => get(`/news/${t}`),
  newsAgg:      (tickers)    => get(`/news?tickers=${(tickers || []).join(",")}`),
  calendar:     (days = 30)  => get(`/calendar?days=${days}`),
  price:        (t)          => get(`/price/${t}`),
  watchlist:    ()           => get("/watchlist"),
  watchlistSet: (ticker, action) =>
    fetch(`${API_BASE}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, action }),
    }).then((r) => r.json()),
  trump: (t) => get(`/trump/${t}`),
  correlated: (t) => get(`/correlated/${t}`),
};

export const api = IS_PUBLIC ? publicApi : liveApi;
