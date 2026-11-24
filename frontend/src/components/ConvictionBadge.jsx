export function scoreColor(score) {
  if (score >= 80) return "emerald";
  if (score >= 60) return "blue";
  if (score >= 40) return "yellow";
  return "gray";
}

export function ConvictionBadge({ score, size = "md" }) {
  const c = scoreColor(score);
  const colorMap = {
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    blue:    "bg-blue-500/20    text-blue-400    border-blue-500/40",
    yellow:  "bg-yellow-500/20  text-yellow-400  border-yellow-500/40",
    gray:    "bg-gray-600/20    text-gray-400    border-gray-600/40",
  };
  const sizeMap = {
    lg: "text-2xl font-bold px-4 py-2",
    md: "text-sm px-3 py-1",
    sm: "text-[11px] px-2 py-0.5",
  };
  return (
    <span className={`inline-flex items-center rounded-full border font-mono font-semibold ${colorMap[c]} ${sizeMap[size]}`}>
      {score}
    </span>
  );
}

export function convictionLabel(score) {
  if (score >= 80) return "Strong Setup";
  if (score >= 60) return "Watch";
  if (score >= 40) return "Neutral";
  return "Weak";
}
