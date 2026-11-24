import { useState, useEffect } from "react";
import {
  X, Star, TrendingUp, TrendingDown, Copy, Check,
  ExternalLink, RefreshCw,
} from "lucide-react";
import { api } from "../api";
import { IS_PUBLIC } from "../config";
import { usePolling } from "../hooks/usePolling";
import { ConvictionBadge, convictionLabel } from "./ConvictionBadge";
import { EpsChart, RevenueChart, AnalystTargetBar } from "./EarningsChart";
import { Skeleton } from "./Skeleton";

// ── formatting ───────────────────────────────────────────────────────────────
function f(n, d = 2) { return n == null ? "—" : Number(n).toFixed(d); }
function fCap(n) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${n}`;
}
function timeAgo(isoStr) {
  if (!isoStr) return "";
  try {
    const sec = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (sec < 60)    return `${sec}s ago`;
    if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  } catch { return ""; }
}

// ── copy-for-claude formatter ─────────────────────────────────────────────────
function buildClipboardText(ticker, detail, news) {
  const cv  = detail.conviction || {};
  const info = detail;

  const lines = [
    `STOCK: ${ticker} — ${info.name}`,
    `CONVICTION SCORE: ${cv.conviction_score}/100  (${convictionLabel(cv.conviction_score)})`,
    "",
    `EARNINGS: ${cv.earnings_date ?? "Unknown"} (${cv.days_until_earnings ?? "?"} days away)`,
    `EXPECTED MOVE: ±${info.expected_move_pct ?? "?"}%`,
    "",
    "FUNDAMENTALS:",
    `- Revenue growth YoY: ${f(cv.revenue_growth_yoy, 1)}%`,
    `- P/E ratio: ${f(info.pe_ratio, 1)}`,
    `- Market cap: ${fCap(info.market_cap)}`,
    `- Analyst targets: Low $${f(info.analyst_low)} / Avg $${f(info.analyst_avg)} / High $${f(info.analyst_high)}`,
    `- Current price: $${f(info.price)}`,
    `- 52-week range: $${f(info.week52_low)} – $${f(info.week52_high)}`,
    "",
    `BEAT HISTORY (last ${(detail.earnings_history || []).length} quarters):`,
  ];

  const quarters = detail.earnings_history || [];
  quarters.forEach((q, i) => {
    const label   = `Q${i + 1}`;
    const beatStr = q.beat != null ? (q.beat ? `Beat by +${f(q.beat_pct, 1)}%` : `Missed by ${f(q.beat_pct, 1)}%`) : "N/A";
    lines.push(`${label}: Est $${f(q.eps_estimate)} / Actual $${f(q.eps_actual)} / ${beatStr}`);
  });
  if (quarters.length === 0) lines.push("No data available");

  lines.push("", "CONVICTION BREAKDOWN:");
  lines.push(`- Beat streak: ${cv.beat_streak} consecutive quarters (+${cv.pts_streak}pts)`);
  lines.push(`- Avg EPS beat: ${f(cv.avg_beat_pct, 1)}% (+${cv.pts_beat}pts)`);
  lines.push(`- Revenue growth: ${f(cv.revenue_growth_yoy, 1)}% (+${cv.pts_revenue}pts)`);
  lines.push(`- Analyst revisions: ${cv.analyst_upgrades} upgrades, ${cv.analyst_downgrades} downgrades (+${cv.pts_revision}pts)`);
  lines.push(`- Earnings proximity: ${cv.days_until_earnings ?? "?"} days away (+${cv.pts_proximity}pts)`);

  if (news?.length) {
    lines.push("", "RECENT NEWS:");
    news.slice(0, 6).forEach((item) => {
      const ago = timeAgo(item.published) || item.time_ago || "";
      lines.push(`- ${item.title} (${item.source}${ago ? ", " + ago : ""})`);
    });
  }

  return lines.join("\n");
}

// ── component ─────────────────────────────────────────────────────────────────
export function StockDetailPanel({ ticker, onClose, watchlist, onWatchlistToggle }) {
  const [detail,   setDetail]   = useState(null);
  const [news,     setNews]     = useState([]);
  const [correlated, setCorrelated] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState(false);
  const [activeTab, setActiveTab] = useState("eps");

  // live price poll every 30s
  const { data: live } = usePolling(
    () => ticker ? api.price(ticker) : Promise.resolve(null),
    30_000,
    [ticker]
  );

  useEffect(() => {
    if (!ticker) return;
    setDetail(null);
    setNews([]);
    setCorrelated(null);
    setLoading(true);
    Promise.all([api.stock(ticker), api.news(ticker), api.correlated(ticker)])
      .then(([d, n, c]) => { setDetail(d); setNews(n.items || []); setCorrelated(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  async function handleCopy() {
    if (!detail) return;
    const text = buildClipboardText(ticker, detail, news);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!ticker) return null;

  const price      = live?.price      ?? detail?.price      ?? 0;
  const changePct  = live?.change_pct ?? detail?.change_pct ?? 0;
  const preMarket  = live?.pre_market_price  ?? detail?.pre_market_price;
  const postMarket = live?.post_market_price ?? detail?.post_market_price;
  const mktState   = live?.market_state ?? detail?.market_state ?? "REGULAR";
  const inWl       = watchlist?.includes(ticker);
  const chgPos     = changePct >= 0;
  const cv         = detail?.conviction;

  return (
    <div className="fixed inset-0 z-30 lg:static lg:w-[500px] flex-shrink-0 border-l border-gray-800 bg-gray-950 flex flex-col overflow-hidden">
      {/* ── header ── */}
      <div className="flex-shrink-0 border-b border-gray-800 px-5 py-4 bg-gray-900">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold font-mono text-white">{ticker}</h2>
              {cv && <ConvictionBadge score={cv.conviction_score} size="lg" />}
            </div>
            {loading ? <Skeleton className="h-4 w-48" /> : (
              <div className="text-sm text-gray-400">{detail?.name}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onWatchlistToggle(ticker, inWl)}
              className={`p-2 rounded-lg transition-colors ${inWl ? "text-yellow-400 bg-yellow-400/10" : "text-gray-600 hover:text-gray-300"}`}
              title={inWl ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star size={16} fill={inWl ? "currentColor" : "none"} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* price row */}
        <div className="flex items-end gap-4 flex-wrap">
          {loading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <>
              <div className="text-3xl font-mono font-bold text-white">${f(price)}</div>
              <div className={`flex items-center gap-1 text-lg font-semibold ${chgPos ? "text-emerald-400" : "text-red-400"}`}>
                {chgPos ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                {chgPos ? "+" : ""}{f(changePct, 2)}%
              </div>

              {/* pre/post market */}
              {mktState !== "REGULAR" && (preMarket || postMarket) && (
                <div className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500">
                    {mktState === "PRE" ? "Pre-mkt" : "After-hrs"}:
                  </span>
                  <span className="font-mono font-semibold text-gray-200 ml-1">
                    ${f(mktState === "PRE" ? preMarket : postMarket)}
                  </span>
                </div>
              )}

              {detail?.expected_move_pct && (
                <div className="ml-auto text-xs font-semibold text-purple-400 bg-purple-400/10 border border-purple-400/30 rounded-full px-3 py-1.5 whitespace-nowrap">
                  ±{detail.expected_move_pct}% expected move
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        {/* key stats */}
        <div className="px-5 py-4 border-b border-gray-800">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Market Cap",   fCap(detail?.market_cap)],
                ["P/E Ratio",    f(detail?.pe_ratio, 1)],
                ["52W High",     `$${f(detail?.week52_high)}`],
                ["52W Low",      `$${f(detail?.week52_low)}`],
                ["Beat Streak",  `${cv?.beat_streak ?? "—"} qtrs`],
                ["Rev Growth",   cv?.revenue_growth_yoy == null ? "—" : `${f(cv.revenue_growth_yoy, 1)}% YoY`],
              ].map(([label, val]) => (
                <div key={label} className="bg-gray-900 rounded-lg px-3 py-2.5">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-sm font-mono font-bold text-gray-100">{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* analyst targets */}
        {!loading && (detail?.analyst_avg || detail?.analyst_low || detail?.analyst_high) && (
          <div className="px-5 py-4 border-b border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Analyst Price Targets</div>
            <div className="flex justify-between text-center mb-1">
              {[["Low", detail.analyst_low, "text-red-400"], ["Avg", detail.analyst_avg, "text-blue-400"], ["High", detail.analyst_high, "text-emerald-400"]].map(([l, v, cls]) => (
                <div key={l}>
                  <div className="text-[10px] text-gray-600">{l}</div>
                  <div className={`font-mono font-bold text-base ${cls}`}>${f(v)}</div>
                </div>
              ))}
            </div>
            <AnalystTargetBar
              low={detail.analyst_low}
              avg={detail.analyst_avg}
              high={detail.analyst_high}
              current={price}
            />
            {detail.analyst_avg && price > 0 && (
              <div className="text-xs text-gray-600 mt-2">
                Upside to avg target: <span className={`font-semibold ${((detail.analyst_avg - price) / price) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {f(((detail.analyst_avg - price) / price) * 100, 1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* charts tabs */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex gap-1 mb-4">
            {[["eps", "EPS History"], ["revenue", "Revenue Trend"], ["correlated", "Correlated Assets"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === key ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <Skeleton className="h-52 w-full rounded-lg" />
          ) : activeTab === "eps" ? (
            <>
              <div className="bg-gray-900 rounded-lg p-3">
                <EpsChart quarters={detail?.earnings_history} />
              </div>
              <div className="flex gap-4 mt-2 text-[11px] text-gray-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gray-600 inline-block" />Estimate</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" />Beat</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" />Miss</span>
              </div>
            </>
          ) : activeTab === "revenue" ? (
            <div className="bg-gray-900 rounded-lg p-3">
              <RevenueChart revenues={detail?.revenue_history} />
            </div>
          ) : (
            <div>
              {!correlated?.has_mapping ? (
                <div className="text-gray-600 text-sm text-center py-6">
                  No catalyst mapping tracked for {ticker} yet.
                </div>
              ) : (
                <>
                  <div className="mb-3 text-xs text-gray-500">
                    Catalyst: <span className="text-gray-300 font-medium">{correlated.type}</span>
                    {" "}&middot;{" "}
                    <span className="text-gray-400">{correlated.sector}</span>
                  </div>
                  <div className="space-y-2">
                    {correlated.correlated.map((c) => (
                      <div key={c.tk} className="bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono font-bold text-white">{c.tk}</span>
                            <span className="text-xs text-gray-500">{c.name}</span>
                          </div>
                          <span
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              c.exp === "inverse"
                                ? "text-red-400 bg-red-400/10"
                                : "text-emerald-400 bg-emerald-400/10"
                            }`}
                          >
                            {c.exp === "inverse" ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                            {c.exp === "inverse" ? "Inverse" : "Follows"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 mb-1.5">
                          {c.rel} &middot; corr {c.corr.toFixed(2)} &middot; {c.lag}
                        </div>
                        <div className="text-xs text-gray-400 leading-snug">{c.why}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* conviction breakdown */}
        {!loading && cv && (
          <div className="px-5 py-4 border-b border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Conviction Breakdown</div>
            <div className="space-y-2.5">
              {[
                ["Beat Streak",        cv.pts_streak,   40, `${cv.beat_streak} consecutive quarters`],
                ["Avg EPS Beat",       cv.pts_beat,     25, `${f(cv.avg_beat_pct, 1)}% avg beat`],
                ["Revenue Growth",     cv.pts_revenue,  20, cv.revenue_growth_yoy == null ? "No year-ago data" : `${f(cv.revenue_growth_yoy, 1)}% YoY`],
                ["Analyst Momentum",   cv.pts_revision, 15, `${cv.analyst_upgrades}↑ ${cv.analyst_downgrades}↓ (net ${cv.analyst_net})`],
                ["Earnings Proximity", cv.pts_proximity,10, cv.days_until_earnings != null ? `${cv.days_until_earnings}d away` : "N/A"],
              ].map(([label, pts, max, detail2]) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">{detail2}</span>
                      <span className="text-xs font-mono font-semibold text-gray-300">{pts}/{max}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min((pts / max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* news */}
        {!IS_PUBLIC && <div className="px-5 py-4 border-b border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent News</div>
          {loading ? (
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : news.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-6">No news found</div>
          ) : (
            <div className="space-y-2">
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 bg-gray-900 hover:bg-gray-800 rounded-lg p-3 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      {item.source} · {item.time_ago || timeAgo(item.published)}
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-gray-700 group-hover:text-gray-400 flex-shrink-0 mt-0.5 transition-colors" />
                </a>
              ))}
            </div>
          )}
        </div>}

        {/* copy for claude */}
        <div className="px-5 py-4">
          <button
            onClick={handleCopy}
            disabled={loading || !detail}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              copied
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied! Paste into Claude →" : "Copy for Claude"}
          </button>
          <div className="text-[10px] text-gray-700 text-center mt-2">
            Copies fundamentals, beat history &amp; news formatted for Claude chat
          </div>
        </div>
      </div>
    </div>
  );
}
