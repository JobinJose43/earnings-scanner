export function SentimentBadge({ sentiment }) {
  const map = {
    bullish: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    bearish: "bg-red-500/20 text-red-400 border-red-500/40",
    neutral: "bg-gray-500/20 text-gray-400 border-gray-500/40",
  };
  const cls = map[sentiment] || map.neutral;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${cls}`}>
      {sentiment || "neutral"}
    </span>
  );
}
