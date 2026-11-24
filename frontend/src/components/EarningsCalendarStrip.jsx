import { useRef, useEffect } from "react";
import { Calendar } from "lucide-react";
import { usePolling } from "../hooks/usePolling";
import { api } from "../api";
import { ConvictionBadge } from "./ConvictionBadge";
import { Skeleton } from "./Skeleton";

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function EarningsCalendarStrip({ onTickerClick }) {
  const { data, loading } = usePolling(() => api.calendar(30), 15 * 60 * 1000);
  const scrollRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  // group events by date
  const grouped = {};
  (data?.events || []).forEach((ev) => {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  });

  // scroll so today is visible on first load
  useEffect(() => {
    if (!scrollRef.current || loading) return;
    const el = scrollRef.current.querySelector("[data-today='true']");
    if (el) el.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [loading]);

  return (
    <div className="border-b border-gray-800 bg-gray-900/60 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/60">
        <Calendar size={12} className="text-gray-500" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          Earnings Calendar — Next 30 Days
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto px-4 py-2.5"
        style={{ scrollbarWidth: "none" }}
      >
        {loading && Array(6).fill(0).map((_, i) => (
          <Skeleton key={i} className="flex-shrink-0 w-28 h-20 rounded-lg" />
        ))}

        {!loading && Object.keys(grouped).length === 0 && (
          <div className="text-gray-600 text-xs py-3">No earnings in next 30 days</div>
        )}

        {!loading && Object.entries(grouped).map(([date, events]) => {
          const isToday = date === today;
          const isPast  = date < today;
          return (
            <div
              key={date}
              data-today={isToday}
              className={`flex-shrink-0 min-w-[110px] rounded-lg border px-2.5 py-2 transition-colors ${
                isToday
                  ? "border-blue-500/60 bg-blue-500/10"
                  : isPast
                  ? "border-gray-800 bg-gray-900/20 opacity-40"
                  : "border-gray-700/60 bg-gray-900"
              }`}
            >
              <div className={`text-[10px] font-bold mb-1.5 ${isToday ? "text-blue-400" : "text-gray-500"}`}>
                {isToday ? "TODAY" : dayLabel(date)}
              </div>
              <div className="flex flex-col gap-1">
                {events.map((ev) => (
                  <button
                    key={ev.symbol}
                    onClick={() => onTickerClick(ev.symbol)}
                    className="flex items-center justify-between gap-1.5 hover:bg-gray-800 rounded px-1 py-0.5 w-full text-left transition-colors"
                  >
                    <span className="font-mono font-bold text-xs text-white">{ev.symbol}</span>
                    <ConvictionBadge score={ev.conviction_score} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
