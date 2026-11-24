import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Search, Star, ChevronRight } from "lucide-react";
import { ConvictionBadge, convictionLabel } from "./ConvictionBadge";
import { SkeletonRow } from "./Skeleton";
import { EarningsMovesDropdown } from "./EarningsMovesDropdown";

// ── formatting ──────────────────────────────────────────────────────────────
function f(n, d = 1) { return n == null ? "—" : Number(n).toFixed(d); }
function timeAgo(iso) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 36e5));
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
function fCap(n) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${n}`;
}

// ── config ───────────────────────────────────────────────────────────────────
const COLS = [
  { key: "symbol",              label: "Ticker"     },
  { key: "conviction_score",    label: "Score"      },
  { key: "price",               label: "Price"      },
  { key: "change_pct",          label: "Chg %"      },
  { key: "earnings_date",       label: "Earnings"   },
  { key: "days_until_earnings", label: "Days"       },
  { key: "expected_move_pct",   label: "Exp Move"   },
  { key: "revenue_growth_yoy",  label: "Rev YoY"    },
  { key: "beat_streak",         label: "Streak"     },
  { key: "avg_beat_pct",        label: "Beat Avg"   },
  { key: "market_cap",          label: "Mkt Cap"    },
  { key: "trump_mention",       label: "Trump"      },
];

const FILTERS = [
  { label: "All",           fn: () => true },
  { label: "Strong Setup 80+",fn: (s) => s.conviction_score >= 80 },
  { label: "Watch 60–79",   fn: (s) => s.conviction_score >= 60 && s.conviction_score < 80 },
  { label: "This Week",     fn: (s) => s.days_until_earnings != null && s.days_until_earnings >= 0 && s.days_until_earnings <= 7 },
  { label: "Next Week",     fn: (s) => s.days_until_earnings != null && s.days_until_earnings > 7 && s.days_until_earnings <= 14 },
  { label: "Trump Mentions",fn: (s) => !!s.trump_mention },
];

// ── component ────────────────────────────────────────────────────────────────
export function ScannerTable({ stocks, loading, error, watchlist = [], onRowClick, onWatchlistToggle, lastUpdated }) {
  const [sort,     setSort]     = useState({ key: "conviction_score", dir: -1 });
  const [filter,   setFilter]   = useState(0);
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null); // ticker or null

  function toggleExpand(e, symbol) {
    e.stopPropagation();
    setExpanded((prev) => (prev === symbol ? null : symbol));
  }

  const sorted = useMemo(() => {
    if (!stocks) return [];
    const wlSet = new Set(watchlist);
    let rows = stocks.filter(FILTERS[filter].fn);
    if (search) {
      const q = search.toUpperCase();
      rows = rows.filter((s) => s.symbol.includes(q) || (s.name || "").toUpperCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      // watchlisted stocks pin to top
      const aw = wlSet.has(a.symbol) ? 1 : 0;
      const bw = wlSet.has(b.symbol) ? 1 : 0;
      if (aw !== bw) return bw - aw;
      const av = a[sort.key] ?? -Infinity;
      const bv = b[sort.key] ?? -Infinity;
      return sort.dir * (av > bv ? 1 : av < bv ? -1 : 0);
    });
  }, [stocks, sort, filter, search, watchlist]);

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 });
  }

  function SortIcon({ col }) {
    if (sort.key !== col) return <ChevronUp size={11} className="text-gray-700" />;
    return sort.dir === -1
      ? <ChevronDown size={11} className="text-blue-400" />
      : <ChevronUp   size={11} className="text-blue-400" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-wrap bg-gray-950">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker…"
            className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-40"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilter(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filter === i ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {lastUpdated && (
          <span className="ml-auto text-xs text-gray-600 whitespace-nowrap">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800">
              <th className="w-8 px-3 py-3" />
              <th className="w-8 px-2 py-3" title="Expand earnings moves" />
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label} <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="text-center py-16 text-gray-600">
                  {error && !stocks?.length ? "Could not load scanner data. Please try again." : "No stocks match filter"}
                </td>
              </tr>
            )}

            {!loading && sorted.map((s) => {
              const inWl     = watchlist.includes(s.symbol);
              const chgPos   = (s.change_pct ?? 0) >= 0;
              const daysUrgent = s.days_until_earnings != null && s.days_until_earnings >= 0 && s.days_until_earnings <= 7;
              const daysWarn   = s.days_until_earnings != null && s.days_until_earnings > 7  && s.days_until_earnings <= 14;

              const isExpanded = expanded === s.symbol;
              const totalCols  = COLS.length + 2; // star + chevron cols + data cols

              return (
                <>
                <tr
                  key={s.symbol}
                  onClick={() => onRowClick(s.symbol)}
                  className={`cursor-pointer transition-colors
                    ${isExpanded ? "bg-gray-800/70" : inWl ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-gray-800/50"}
                    ${!isExpanded ? "border-b border-gray-800/40" : ""}`}
                >
                  {/* watchlist star */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onWatchlistToggle(s.symbol, inWl)}
                      className={`transition-colors ${inWl ? "text-yellow-400" : "text-gray-700 hover:text-gray-500"}`}
                    >
                      <Star size={13} fill={inWl ? "currentColor" : "none"} />
                    </button>
                  </td>

                  {/* expand toggle */}
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => toggleExpand(e, s.symbol)}
                      title="Show expected vs actual earnings moves"
                      className={`p-1 rounded transition-all ${
                        isExpanded
                          ? "text-blue-400 bg-blue-500/10 rotate-90"
                          : "text-gray-600 hover:text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </td>

                  {/* ticker + name */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {inWl && <Star size={9} className="text-yellow-400 flex-shrink-0" fill="currentColor" />}
                      <span className="font-mono font-bold text-white">{s.symbol}</span>
                      {s.region && s.region !== "US" && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          s.region === "Europe"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        }`}>
                          {s.region === "Europe" ? "EU" : "ASIA"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[130px] mt-0.5">{s.name}</div>
                    {s.sector && (
                      <div className="text-[10px] text-gray-700 mt-0.5">{s.sector}</div>
                    )}
                  </td>

                  {/* conviction */}
                  <td className="px-3 py-3">
                    <ConvictionBadge score={s.conviction_score} />
                    <div className="text-[10px] text-gray-600 mt-0.5">{convictionLabel(s.conviction_score)}</div>
                  </td>

                  {/* price */}
                  <td className="px-3 py-3 font-mono text-gray-200">${f(s.price, 2)}</td>

                  {/* change % */}
                  <td className={`px-3 py-3 font-mono font-semibold text-sm ${chgPos ? "text-emerald-400" : "text-red-400"}`}>
                    {chgPos ? "+" : ""}{f(s.change_pct)}%
                  </td>

                  {/* earnings date */}
                  <td className="px-3 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">
                    {s.earnings_date ?? "—"}
                  </td>

                  {/* days until */}
                  <td className="px-3 py-3">
                    {s.days_until_earnings != null ? (
                      <span className={`font-mono font-bold text-sm ${daysUrgent ? "text-orange-400" : daysWarn ? "text-yellow-400" : "text-gray-500"}`}>
                        {s.days_until_earnings}d
                      </span>
                    ) : "—"}
                  </td>

                  {/* expected move */}
                  <td
                    className={`px-3 py-3 font-mono text-sm ${s.expected_move_covers_earnings ? "text-purple-400" : "text-gray-500"}`}
                    title={s.expected_move_expiry
                      ? `At-the-money straddle, options expiring ${s.expected_move_expiry}. ${s.expected_move_covers_earnings ? "Covers the next earnings report; later expirations also include ordinary movement." : "Does NOT include the next earnings reaction, or its date is unknown."}`
                      : undefined}
                  >
                    {s.expected_move_pct != null ? `±${s.expected_move_pct}%` : "—"}
                    {s.expected_move_expiry && (
                      <div className="text-[10px] text-gray-600 font-sans whitespace-nowrap">
                        {s.expected_move_covers_earnings ? `thru ${s.expected_move_expiry.slice(5)}` : "excl. earnings"}
                      </div>
                    )}
                  </td>

                  {/* rev growth */}
                  <td className={`px-3 py-3 font-mono text-sm ${(s.revenue_growth_yoy ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.revenue_growth_yoy != null ? `${f(s.revenue_growth_yoy)}%` : "—"}
                  </td>

                  {/* beat streak */}
                  <td className="px-3 py-3">
                    {s.beat_streak != null ? (
                      <span className="flex items-center gap-1">
                        <span className="font-mono font-bold text-white">{s.beat_streak}</span>
                        <span className="text-[10px] text-gray-600">qtrs</span>
                      </span>
                    ) : "—"}
                  </td>

                  {/* avg beat */}
                  <td className="px-3 py-3 font-mono text-blue-400 text-sm">
                    {s.avg_beat_pct != null ? `+${f(s.avg_beat_pct)}%` : "—"}
                  </td>

                  {/* mkt cap */}
                  <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fCap(s.market_cap)}</td>

                  {/* trump mention */}
                  <td className="px-3 py-3">
                    {s.trump_mention ? (
                      <a
                        href={s.trump_mention.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={s.trump_mention.title}
                        className="group inline-flex flex-col gap-0.5"
                      >
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors whitespace-nowrap">
                          TRUMP {timeAgo(s.trump_mention.published)}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[160px] group-hover:text-gray-300 transition-colors">
                          {s.trump_mention.title}
                        </span>
                      </a>
                    ) : (
                      <span className="text-gray-700 text-xs">—</span>
                    )}
                  </td>
                </tr>

                {/* expandable moves dropdown */}
                {isExpanded && (
                  <EarningsMovesDropdown
                    ticker={s.symbol}
                    colSpan={totalCols}
                  />
                )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
