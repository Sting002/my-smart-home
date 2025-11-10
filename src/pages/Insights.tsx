import React, { useCallback, useMemo, useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  Brush,
} from "recharts";

type Period = "day" | "week" | "month";
type TrendMetric = "power" | "energy";

type TrendPoint = {
  time: string;
  watts: number;
  kwh: number;
  avg?: number;
};

type TrendStats = {
  todayTrend: TrendPoint[];
  todayKwhTotal: number;
};

type DeviceBreakdownSlice = {
  id: string;
  name: string;
  value: number;
  cost: number;
};

type PieTooltipPayload = {
  payload?: {
    name?: string;
  };
};

function formatMinute(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const Insights: React.FC = () => {
  const { devices, tariff, currency, powerHistory } = useEnergy();
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<TrendMetric>("power");
  const [resolution, setResolution] = useState<1 | 5 | 15>(1);

  // Guard: needs at least one device to show breakdowns
  const hasDevices = devices.length > 0;

  // Colors for charts
  const COLORS = ["#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#06B6D4"];

  /**
   * Build "Today" trend from recent power history
   * - Buckets all device power readings into 1-minute bins
   * - Sums power across devices per minute
   * - Also includes approximate energy per minute (kWh): watts * (1/60) / 1000
   */
  const { todayTrend, todayKwhTotal }: TrendStats = useMemo(() => {
    // Build minute-level map of total watts across devices
    const perMinute = new Map<number, number>(); // minuteTs -> totalWatts
    Object.values(powerHistory).forEach((list) => {
      list.forEach((pt) => {
        const minuteTs = Math.floor(pt.ts / 60000) * 60000;
        perMinute.set(minuteTs, (perMinute.get(minuteTs) ?? 0) + pt.watts);
      });
    });

    // Re-bucket to selected resolution (1, 5, 15 minutes)
    const bucketMs = resolution * 60000;
    const buckets = new Map<number, { sumWatts: number; count: number; sumKwh: number }>();
    const minutes = Array.from(perMinute.entries()).sort((a, b) => a[0] - b[0]);
    minutes.forEach(([minuteTs, totalWatts]) => {
      const bucketStart = Math.floor(minuteTs / bucketMs) * bucketMs;
      const entry = buckets.get(bucketStart) || { sumWatts: 0, count: 0, sumKwh: 0 };
      entry.sumWatts += totalWatts;
      entry.count += 1;
      entry.sumKwh += totalWatts / 60 / 1000; // kWh for this 1-minute point
      buckets.set(bucketStart, entry);
    });

    const chart: TrendPoint[] = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, agg]) => {
        const avgWatts = agg.count > 0 ? agg.sumWatts / agg.count : 0;
        return {
          time: formatMinute(ts),
          watts: Number(avgWatts.toFixed(0)),
          kwh: Number(agg.sumKwh.toFixed(4)),
        };
      });

    // Today total kWh from devices (authoritative from /energy messages)
    const kwhFromDevices = devices.reduce((sum, d) => sum + d.kwhToday, 0);

    return {
      todayTrend: chart,
      todayKwhTotal: Number(kwhFromDevices.toFixed(4)),
    };
  }, [powerHistory, devices, resolution]);

  // Compute a simple moving average for readability (5-point window)
  const { trendWithAvg, maxY, peakValue, peakLabel } = useMemo(() => {
    const data: TrendPoint[] = todayTrend || [];
    const key: keyof Pick<TrendPoint, "watts" | "kwh"> = metric === "power" ? "watts" : "kwh";
    const win = 5;
    const avgArr = data.map((_, idx) => {
      const start = Math.max(0, idx - (win - 1));
      const slice = data.slice(start, idx + 1);
      const sum = slice.reduce((s, d) => s + d[key], 0);
      const avg = sum / slice.length;
      return Number(avg.toFixed(metric === "power" ? 0 : 4));
    });
    const merged = data.map((d, i) => ({ ...d, avg: avgArr[i] }));
    const maxRaw = Math.max(0, ...data.map((d) => d[key]));
    const maxAvg = Math.max(0, ...avgArr);
    const maxYVal = Math.max(maxRaw, maxAvg);
    // Peak label from raw data
    let peakValue = 0;
    let peakTime = "";
    data.forEach((d) => {
      const v = d[key];
      if (v > peakValue) {
        peakValue = v;
        peakTime = d.time;
      }
    });
    const peakLabel = metric === "power" ? `${peakValue.toLocaleString()} W` : `${peakValue.toFixed(3)} kWh`;
    return { trendWithAvg: merged, maxY: maxYVal, peakValue, peakLabel: `${peakLabel} at ${peakTime}` };
  }, [todayTrend, metric]);

  // Device breakdown for Pie (kWh + cost)
  const deviceBreakdown = useMemo<DeviceBreakdownSlice[]>(() => {
    return devices
      .map((d) => ({ id: d.id, name: d.name, value: d.kwhToday, cost: d.kwhToday * tariff }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [devices, tariff]);

  // KPIs
  const avgDailyKwh = useMemo(() => todayKwhTotal, [todayKwhTotal]);
  const projectedMonthlyCost = useMemo(() => (todayKwhTotal * 30 * tariff).toFixed(2), [todayKwhTotal, tariff]);

  // Weekly placeholder: today's value in the proper weekday slot
  const weeklyBars = useMemo(() => {
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayIdx = new Date().getDay(); // Sun=0..Sat=6
    const mapIdx = (d: number) => (d === 0 ? 6 : d - 1); // Mon=0..Sun=6
    const arr = weekdays.map((day) => ({ day, kwh: 0 }));
    arr[mapIdx(todayIdx)].kwh = Number(todayKwhTotal.toFixed(3));
    return arr;
  }, [todayKwhTotal]);

  // Monthly placeholder: 30-day simple array with today's value
  const monthBars = useMemo(() => {
    const day = new Date().getDate();
    const arr = Array.from({ length: 30 }, (_, i) => ({ day: String(i + 1).padStart(2, "0"), kwh: 0 }));
    if (day >= 1 && day <= 30) arr[day - 1].kwh = Number(todayKwhTotal.toFixed(3));
    return arr;
  }, [todayKwhTotal]);

  // Lightweight recommendations
  const recommendations = useMemo(() => {
    const recs: { icon: string; text: string }[] = [];
    if (todayKwhTotal > 0.05) {
      recs.push({ icon: "⚡", text: "Noticeable usage detected. Consider shifting heavy loads to off-peak." });
    }
    const top = devices.slice().sort((a, b) => b.kwhToday - a.kwhToday)[0];
    if (top && top.kwhToday > 0) {
      recs.push({ icon: "🏷️", text: `${top.name} is your top consumer today. Check schedule or thresholds.` });
    }
    if (recs.length === 0) recs.push({ icon: "ℹ️", text: "No high consumption patterns detected yet. Keep monitoring." });
    return recs;
  }, [devices, todayKwhTotal]);

  const formatLineTooltip = useCallback(
    (value: number | string, name: string) => {
      const numericValue = typeof value === "number" ? value : Number(value);
      const isPowerMetric = metric === "power";
      const metricName = isPowerMetric ? "watts" : "kwh";
      if (name === metricName) {
        const formatted = isPowerMetric
          ? `${numericValue.toLocaleString()} W`
          : `${numericValue.toFixed(3)} kWh`;
        return [formatted, isPowerMetric ? "Power" : "Energy"];
      }
      if (name === "avg") {
        const formatted = isPowerMetric
          ? `${numericValue.toLocaleString()} W`
          : `${numericValue.toFixed(3)} kWh`;
        return [formatted, "Avg (5-pt)"];
      }
      return [value, name];
    },
    [metric]
  );

  const formatEnergyTooltip = useCallback(
    (value: number | string) => [`${Number(value).toFixed(3)} kWh`, "Energy (kWh)"],
    []
  );

  const formatPieTooltip = useCallback(
    (
      value: number | string,
      _label: string,
      payload?: PieTooltipPayload
    ) => {
      const sliceName =
        typeof payload?.payload?.name === "string"
          ? payload.payload.name
          : "Device";
      const numericValue = Number(value);
      const slice = deviceBreakdown.find((d) => d.name === sliceName);
      const cost = slice ? slice.cost : 0;
      return [`${numericValue.toFixed(3)} kWh · ${currency} ${cost.toFixed(2)}`, sliceName];
    },
    [currency, deviceBreakdown]
  );
  if (!hasDevices) {
    return <div className="text-center text-gray-400 mt-10">No devices connected. Connect a device to view insights.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Energy Trend */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Energy Trends</h2>
          <div className="flex gap-2 items-center">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as TrendMetric)}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              aria-label="Trend metric"
            >
              <option value="power">Power (W)</option>
              <option value="energy">Energy (kWh/min)</option>
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              aria-label="Trend period"
            >
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            {period === "day" && (
              <select
                value={String(resolution)}
                onChange={(e) => setResolution(Number(e.target.value) as 1 | 5 | 15)}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                aria-label="Resolution"
                title="Resolution"
              >
                <option value="1">1 min</option>
                <option value="5">5 min</option>
                <option value="15">15 min</option>
              </select>
            )}
          </div>
        </div>
        {period === "day" && todayTrend.length > 0 && (
          <div className="text-xs text-gray-400 mb-2">Peak: <span className="text-gray-200">{peakLabel}</span></div>
        )}

        {period === "day" && (
          todayTrend.length === 0 ? (
            <div className="text-gray-400 text-sm">Collecting data. Check back shortly.</div>
          ) : (
            <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendWithAvg} margin={{ top: 8, right: 12, left: 8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" minTickGap={24} />
                <YAxis
                  stroke="#9CA3AF"
                  domain={[0, Math.ceil((maxY || 0) * 1.1)]}
                  tickFormatter={(v: number) => (metric === "power" ? `${v}` : `${v.toFixed(3)}`)}
                  label={{ value: metric === "power" ? "Power (W)" : "Energy (kWh/min)", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                  formatter={formatLineTooltip}
                />
                <Line
                  type="monotone"
                  dataKey={metric === "power" ? "watts" : "kwh"}
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, stroke: "#22C55E", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 4"
                />
                {peakValue > 0 && (
                  <ReferenceLine y={peakValue} stroke="#F59E0B" strokeDasharray="4 3" />
                )}
                <Brush dataKey="time" height={20} stroke="#9CA3AF" travellerWidth={8} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-[11px] text-gray-400 mt-2">Legend: <span className="text-gray-200">Power</span> (green), <span className="text-gray-200">Avg</span> (blue dashed)</div>
            </>
          )
        )}

        {period === "week" && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} formatter={formatEnergyTooltip} />
              <Bar dataKey="kwh" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {period === "month" && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} formatter={formatEnergyTooltip} />
              <Bar dataKey="kwh" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {period !== "day" && <div className="text-xs text-gray-500 mt-2">Note: Weekly/Monthly values currently reflect today only.</div>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{avgDailyKwh.toFixed(3)}</div>
          <div className="text-sm text-gray-400">kWh Today</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-500">
            {currency} {projectedMonthlyCost}
          </div>
          <div className="text-sm text-gray-400">Projected Monthly Cost</div>
        </div>
      </div>

      {/* Device Breakdown */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Device Breakdown (kWh Today)</h2>
        {deviceBreakdown.length === 0 ? (
          <div className="text-gray-400 text-sm">Collecting data. Check back in a minute.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={deviceBreakdown} cx="50%" cy="50%" labelLine={false} outerRadius={80} dataKey="value">
                {deviceBreakdown.map((d, i) => (
                  <Cell key={d.id} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                formatter={formatPieTooltip}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {deviceBreakdown.length > 0 && (
          <div className="mt-4 space-y-1 text-sm">
            {deviceBreakdown.slice(0, 6).map((d, i) => (
              <div key={d.id} className="flex justify-between text-gray-300">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name}
                </span>
                <span>
                  {d.value.toFixed(3)} kWh · {currency} {d.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Recommendations</h2>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex gap-3 items-start bg-gray-900 rounded-lg p-3">
              <span className="text-2xl">{rec.icon}</span>
              <p className="text-gray-300 text-sm">{rec.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Insights;



