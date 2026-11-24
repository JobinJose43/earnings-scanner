import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import "./index.css";
import { api } from "./api";
import { usePolling } from "./hooks/usePolling";
import { ScannerTable } from "./components/ScannerTable";
import { StockDetailPanel } from "./components/StockDetailPanel";
import { NewsSidebar } from "./components/NewsSidebar";
import { EarningsCalendarStrip } from "./components/EarningsCalendarStrip";
import { IS_PUBLIC } from "./config";
import { Activity, Newspaper, RefreshCw, TrendingUp } from "lucide-react";

// Written out so the bundler drops the condor code from public builds.
const CondorScanner = process.env.REACT_APP_PUBLIC_MODE === "1"
  ? null
  : lazy(() => import("./components/CondorScanner"));

const REGIONS = ["All", "US", "Europe", "Asia"];

export default function App() {
  const [activeApp,      setActiveApp]       = useState("earnings");
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [showNews,       setShowNews]        = useState(false);
  const [watchlist,      setWatchlist]       = useState([]);
  const [activeRegion,   setActiveRegion]    = useState("All");

  // load watchlist once on mount
  useEffect(() => {
    api.watchlist()
      .then((d) => setWatchlist(d.watchlist || []))
      .catch(() => {});
  }, []);

  const regionParam = activeRegion === "All" ? "" : activeRegion;
  const [regionLoading, setRegionLoading] = useState(false);

  function handleRegionChange(r) {
    setActiveRegion(r);
    setRegionLoading(true);
  }

  const { data: scanData, loading: scanLoading, error: scanError, lastUpdated: fetchedAt, refresh } = usePolling(
    () => api.scan(regionParam).finally(() => setRegionLoading(false)),
    60_000,
    [regionParam]
  );

  const handleWatchlistToggle = useCallback(async (ticker, isInWl) => {
    const res = await api.watchlistSet(ticker, isInWl ? "remove" : "add");
    setWatchlist(res.watchlist || []);
  }, []);

  const stocks = scanData?.stocks || [];
  const lastUpdated = scanData?.generated_at ? new Date(scanData.generated_at) : fetchedAt;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-950 text-gray-100">
      {/* ── header ── */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900 px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 z-20">
        <div className="flex items-center gap-2.5">
          <Activity size={18} className="text-blue-400" />
          <h1 className="text-base font-bold text-white tracking-tight">
            {activeApp === "earnings" ? "Earnings Conviction Scanner" : "0DTE Iron Condor Scanner"}
          </h1>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-bold tracking-wide">
            {IS_PUBLIC ? "SNAPSHOT" : "LIVE"}
          </span>
        </div>

        {/* ── app tabs ── */}
        {!IS_PUBLIC && <div className="flex items-center gap-1 ml-6">
          <button
            onClick={() => setActiveApp("earnings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === "earnings"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <Activity size={12} />
            Earnings
          </button>
          <button
            onClick={() => setActiveApp("condor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === "condor"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <TrendingUp size={12} />
            0DTE Condor
          </button>
        </div>}
        {IS_PUBLIC && <a href="https://jobinjose.site/portfolio.html" className="text-xs text-gray-400 hover:text-gray-200">← Portfolio</a>}

        {activeApp === "earnings" && (
          <div className="ml-auto flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-600 hidden sm:block">
                Updated {IS_PUBLIC ? lastUpdated.toLocaleString() : lastUpdated.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={refresh}
              className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              title="Refresh now"
            >
              <RefreshCw size={14} className={scanLoading ? "animate-spin" : ""} />
            </button>

            <div className="text-xs text-gray-600 hidden sm:block">
              {watchlist.length} watchlisted
            </div>

            {!IS_PUBLIC && <button
              onClick={() => setShowNews((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showNews
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <Newspaper size={13} />
              News
            </button>}
          </div>
        )}
      </header>

      {!IS_PUBLIC && activeApp === "condor" ? (
        <div className="flex-1 overflow-auto">
          <Suspense fallback={null}><CondorScanner /></Suspense>
        </div>
      ) : (
        <>
          {/* ── region tabs ── */}
          <div className="flex-shrink-0 border-b border-gray-800 bg-gray-900 px-5 flex items-center gap-1">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => handleRegionChange(r)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeRegion === r
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {r === "All" ? "All Stocks" : r}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-600 pr-1">
              {scanData?.count ?? 0} stocks
            </span>
          </div>

          {/* ── calendar strip ── */}
          <EarningsCalendarStrip onTickerClick={setSelectedTicker} />

          {/* ── main layout ── */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden min-w-0">
              <ScannerTable
                stocks={stocks}
                loading={scanLoading || regionLoading}
                error={scanError}
                watchlist={watchlist}
                onRowClick={setSelectedTicker}
                onWatchlistToggle={handleWatchlistToggle}
                lastUpdated={IS_PUBLIC ? null : lastUpdated}
              />
            </div>

            {selectedTicker && (
              <StockDetailPanel
                ticker={selectedTicker}
                onClose={() => setSelectedTicker(null)}
                watchlist={watchlist}
                onWatchlistToggle={handleWatchlistToggle}
              />
            )}

            {showNews && (
              <NewsSidebar
                watchlist={watchlist}
                onClose={() => setShowNews(false)}
              />
            )}
          </div>
        </>
      )}
      <footer className="flex-shrink-0 border-t border-gray-800 bg-gray-900 px-5 py-1.5 text-[11px] text-gray-500">
        Educational project, not investment advice. The score is a rules-based summary of past data, not a forecast.
        {IS_PUBLIC && " Data is a delayed snapshot, mainly from Yahoo Finance, and may be wrong or incomplete."}
      </footer>
    </div>
  );
}
