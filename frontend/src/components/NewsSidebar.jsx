import { useState } from "react";
import { X, Rss, ExternalLink } from "lucide-react";
import { usePolling } from "../hooks/usePolling";
import { api } from "../api";
import { Skeleton } from "./Skeleton";

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

const TOP_TICKERS = ["NVDA", "AMD", "META", "MSFT", "AAPL", "GOOGL", "AVGO"];

export function NewsSidebar({ watchlist = [], onClose }) {
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const tickers = watchlistOnly && watchlist.length ? watchlist : TOP_TICKERS;

  const { data, loading, lastUpdated } = usePolling(
    () => api.newsAgg(tickers),
    2 * 60 * 1000,
    [tickers.join(",")]
  );

  const items = data?.items || [];

  return (
    <div className="w-[340px] flex-shrink-0 border-l border-gray-800 bg-gray-950 flex flex-col">
      {/* header */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-3 bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Rss size={13} className="text-blue-400" />
            <span className="text-sm font-semibold text-gray-200">Live News Feed</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-200 rounded transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setWatchlistOnly(false)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !watchlistOnly ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All News
          </button>
          <button
            onClick={() => setWatchlistOnly(true)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              watchlistOnly ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Watchlist Only
          </button>
        </div>
        {lastUpdated && (
          <div className="text-[10px] text-gray-700 mt-1.5">
            Refreshed {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
        {loading && Array(8).fill(0).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-3 w-3/4 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-10">No news available</div>
        )}

        {!loading && items.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 px-4 py-3 hover:bg-gray-900 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              {item.ticker && (
                <span className="inline-block text-[10px] font-mono font-bold bg-gray-800 text-blue-400 rounded px-1.5 py-0.5 mb-1">
                  ${item.ticker}
                </span>
              )}
              <div className="text-sm text-gray-300 leading-snug group-hover:text-white transition-colors line-clamp-3">
                {item.title}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                {item.source} · {item.time_ago || timeAgo(item.published)}
              </div>
            </div>
            <ExternalLink size={11} className="flex-shrink-0 text-gray-700 group-hover:text-gray-500 mt-0.5 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}
