import { useState, useEffect } from "react";
import { api } from "../api";
import { Skeleton } from "./Skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function fmtQ(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
}

function MovePill({ pct }) {
  if (pct == null) return <span className="text-gray-600">—</span>;
  const abs = Math.abs(pct);
  const pos = pct >= 0;
  const color = pos ? "text-emerald-400" : "text-red-400";
  const Icon  = pos ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold text-sm ${color}`}>
      <Icon size={13} />
      {pos ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function Bar({ pct, max, color }) {
  const w = Math.min((Math.abs(pct) / max) * 100, 100);
  return (
    <div className="relative h-5 flex items-center">
      {/* center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-700" />
      {/* bar */}
      <div
        className={`absolute h-3 rounded-sm ${color}`}
        style={{
          width:  `${w / 2}%`,
          left:   pct >= 0 ? "50%" : `${50 - w / 2}%`,
          right:  pct < 0  ? "50%" : undefined,
        }}
      />
    </div>
  );
}

export function EarningsMovesDropdown({ ticker, colSpan }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null);
    setLoading(true);
    api.moves(ticker)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  const history = data?.history || [];
  const expected = data?.expected_move_pct;
  const avgAbs   = data?.avg_abs_move;

  // max absolute move for bar scaling
  const maxMove = history.length
    ? Math.max(...history.map((h) => Math.abs(h.actual_move_pct)), expected ?? 0, 5)
    : 10;

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 pb-0">
        <div className="mx-3 mb-3 rounded-xl border border-gray-700/60 bg-gray-900 overflow-hidden">

          {/* header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-800/40">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Expected Move vs Actual Earnings Moves
            </span>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {expected != null && (
                <span>
                  Current implied: <span className="text-purple-400 font-mono font-bold">±{expected}%</span>
                </span>
              )}
              {avgAbs != null && (
                <span>
                  Avg actual: <span className="text-gray-300 font-mono font-bold">±{avgAbs}%</span>
                </span>
              )}
            </div>
          </div>

          {loading && (
            <div className="px-4 py-3 space-y-2">
              {[1,2,3,4].map((i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-600 text-sm">
              No historical earnings move data available
            </div>
          )}

          {!loading && history.length > 0 && (
            <div>
              {/* column headers */}
              <div className="grid grid-cols-[80px_90px_1fr_110px_110px] gap-3 px-4 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-800/60">
                <span>Reported</span>
                <span>Date</span>
                <span>Move chart</span>
                <span>Actual move</span>
                <span>EPS result</span>
              </div>

              {/* implied expected move row (current) */}
              {expected != null && (
                <div className="grid grid-cols-[80px_90px_1fr_110px_110px] gap-3 px-4 py-2.5 items-center border-b border-gray-800/40 bg-purple-500/5">
                  <span className="text-[11px] font-bold text-purple-400">NEXT</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {data?.earnings_date ?? "—"}
                  </span>
                  <div className="relative h-5 flex items-center">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-700" />
                    {/* show ± bars for expected move */}
                    {[1, -1].map((dir) => (
                      <div
                        key={dir}
                        className="absolute h-3 rounded-sm bg-purple-500/40 border border-purple-500/60"
                        style={{
                          width:  `${Math.min((expected / maxMove) * 50, 50)}%`,
                          left:   dir > 0 ? "50%" : undefined,
                          right:  dir < 0 ? "50%" : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-purple-400 font-mono font-bold text-sm">±{expected}%</span>
                  <span className="text-[10px] text-gray-600 italic">{data?.expected_move_covers_earnings ? `exp ${data.expected_move_expiry}` : "not through earnings"}</span>
                </div>
              )}

              {/* historical rows */}
              {history.map((h, i) => {
                const beat  = h.beat;
                const move  = h.actual_move_pct;
                const barColor = move >= 0 ? "bg-emerald-500/70" : "bg-red-500/70";
                const beatColor = beat === true  ? "text-emerald-400"
                                : beat === false ? "text-red-400"
                                : "text-gray-600";
                const beatLabel = beat === true  ? `Beat +${h.beat_pct?.toFixed(1)}%`
                                : beat === false ? `Miss ${h.beat_pct?.toFixed(1)}%`
                                : "—";

                return (
                  <div
                    key={h.date}
                    className={`grid grid-cols-[80px_90px_1fr_110px_110px] gap-3 px-4 py-2.5 items-center ${
                      i < history.length - 1 ? "border-b border-gray-800/40" : ""
                    } hover:bg-gray-800/30 transition-colors`}
                  >
                    <span className="text-xs font-mono font-semibold text-gray-300">
                      {fmtQ(h.date)}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {h.date}
                    </span>
                    <Bar pct={move} max={maxMove} color={barColor} />
                    <MovePill pct={move} />
                    <span className={`text-xs font-semibold ${beatColor}`}>
                      {beatLabel}
                    </span>
                  </div>
                );
              })}

              {/* summary: how often does stock exceed expected move */}
              {expected != null && history.length >= 2 && (() => {
                const exceeded = history.filter((h) => Math.abs(h.actual_move_pct) > expected).length;
                const pct = Math.round((exceeded / history.length) * 100);
                return (
                  <div className="px-4 py-2.5 bg-gray-800/30 border-t border-gray-800 text-xs text-gray-500">
                    Exceeded current implied move (±{expected}%) in{" "}
                    <span className="font-semibold text-gray-300">{exceeded}/{history.length}</span> past earnings ({pct}%)
                    {pct >= 60 && <span className="text-orange-400 ml-2">— past moves were usually larger</span>}
                    {pct <= 30 && <span className="text-blue-400 ml-2">— past moves were usually smaller</span>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
