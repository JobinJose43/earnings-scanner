import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
  ReferenceLine, Legend,
} from "recharts";

function fmtQ(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `Q${Math.ceil((d.getMonth() + 1) / 3)}'${String(d.getFullYear()).slice(2)}`;
}

// EPS dates are report dates, which fall after the fiscal quarter ends.
function fmtReport(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
}

const TT_STYLE = {
  contentStyle: { background: "#111827", border: "1px solid #374151", borderRadius: 8 },
  labelStyle:   { color: "#e5e7eb", fontWeight: 600 },
  itemStyle:    { color: "#9ca3af" },
};

export function EpsChart({ quarters }) {
  if (!quarters?.length) {
    return <div className="text-gray-500 text-sm text-center py-10">No earnings data</div>;
  }
  const data = [...quarters].reverse().map((q) => ({
    quarter:  fmtReport(q.date),
    Estimate: q.eps_estimate ?? 0,
    Actual:   q.eps_actual   ?? 0,
    beat:     q.beat,
    beat_pct: q.beat_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={3} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="quarter" tick={{ fill: "#6b7280", fontSize: 11 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          {...TT_STYLE}
          formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload;
            return (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
                <div className="font-bold text-gray-200 mb-1">{label}</div>
                <div className="text-gray-400">Est: <span className="text-white">${Number(row.Estimate).toFixed(2)}</span></div>
                <div className="text-gray-400">Act: <span className={row.beat ? "text-emerald-400" : "text-red-400"}>${Number(row.Actual).toFixed(2)}</span></div>
                {row.beat_pct != null && (
                  <div className={`font-semibold mt-1 ${row.beat ? "text-emerald-400" : "text-red-400"}`}>
                    {row.beat ? "+" : ""}{Number(row.beat_pct).toFixed(1)}%
                  </div>
                )}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
        <Bar dataKey="Estimate" fill="#374151" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Actual"   radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.beat ? "#10b981" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ revenues }) {
  if (!revenues?.length) {
    return <div className="text-gray-500 text-sm text-center py-10">No revenue data</div>;
  }
  const data = [...revenues].reverse().map((r) => ({
    quarter: fmtQ(r.date),
    Revenue: parseFloat((r.revenue / 1e9).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="quarter" tick={{ fill: "#6b7280", fontSize: 11 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="B" tickFormatter={(v) => `$${v}`} />
        <Tooltip
          {...TT_STYLE}
          formatter={(v) => [`$${Number(v).toFixed(2)}B`, "Revenue"]}
        />
        <Line
          type="monotone"
          dataKey="Revenue"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ fill: "#3b82f6", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnalystTargetBar({ low, avg, high, current }) {
  if (!low && !avg && !high) return null;
  const min = Math.min(low ?? current, current) * 0.9;
  const max = Math.max(high ?? current, current) * 1.1;
  const range = max - min;
  const pct = (v) => `${(((v - min) / range) * 100).toFixed(1)}%`;

  return (
    <div className="relative h-8 mt-2">
      {/* track */}
      <div className="absolute top-3 left-0 right-0 h-1.5 bg-gray-700 rounded-full" />
      {/* range fill */}
      <div
        className="absolute top-3 h-1.5 bg-blue-500/30 rounded-full"
        style={{ left: pct(low ?? current), right: `${100 - parseFloat(pct(high ?? current))}%` }}
      />
      {/* markers */}
      {[
        { v: low,     label: "L", cls: "bg-red-400"     },
        { v: avg,     label: "A", cls: "bg-blue-400"    },
        { v: high,    label: "H", cls: "bg-emerald-400" },
        { v: current, label: "•", cls: "bg-white"       },
      ].filter((m) => m.v).map(({ v, label, cls }) => (
        <div
          key={label}
          className={`absolute top-1.5 w-4 h-4 rounded-full ${cls} flex items-center justify-center -translate-x-1/2`}
          style={{ left: pct(v) }}
          title={`${label}: $${Number(v).toFixed(2)}`}
        >
          <span className="text-[8px] font-bold text-gray-900">{label}</span>
        </div>
      ))}
    </div>
  );
}
