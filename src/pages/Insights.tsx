import React, { useMemo, useState } from "react";
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
} from "recharts";

type Period = "day" | "week" | "month";

function formatMinute(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const Insights: React.FC = () => {
  const { devices, tariff, currency, powerHistory } = useEnergy();
  const [period, setPeriod] = useState<Period>("day");

  // Guard: needs at least one device to show breakdowns
  const hasDevices = devices.length > 0;

  // --- COLORS for Pie slices
  const COLORS = ["#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#06B6D4"];

  /**
   * Build "Today" trend from recent power history
   * - Buckets all device power readings into 1-minute bins
   * - Sums power across devices per minute
   * - Converts to kWh for a soft energy trend (approximation)
   */
  const { todayTrend, todayKwhTotal } = useMemo(() => {
    // Bucket by minute start (ms)
    const bucketMap = new Map<number, number>(); // minuteTs -> totalWatts

    Object.values(powerHistory).forEach((list) => {
      list.forEach((pt) => {
        const minuteTs = Math.floor(pt.ts / 60000) * 60000;
        bucketMap.set(minuteTs, (bucketMap.get(minuteTs) ?? 0) + pt.watts);
      });
    });

    // Sort by minute asc and build chart points
    const minutes = Array.from(bucketMap.entries()).sort((a, b) => a[0] - b[0]);

    const chart = minutes.map(([minuteTs, totalWatts]) => {
      // 1-minute bin energy ≈ watts * (1/60) Wh => kWh
      const kwh = (totalWatts / 60) / 1000;
      return {
        time: formatMinute(minuteTs),
        watts: Number(totalWatts.toFixed(0)),
        kwh: Number(kwh.toFixed(4)),
      };
    });

    // Today total kWh from devices (authoritative, comes from /energy messages)
    const kwhFromDevices = devices.reduce((sum, d) => sum + d.kwhToday, 0);

    return {
      todayTrend: chart,
      todayKwhTotal: Number(kwhFromDevices.toFixed(4)),
    };
  }, [powerHistory, devices]);

  // Device breakdown for Pie (uses actual kwhToday)
  const deviceBreakdown = useMemo(() => {
    return devices
      .map((d) => ({ name: d.name, value: d.kwhToday }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [devices]);

  // Derived KPIs
  const avgDailyKwh = useMemo(() => {
    // We only have "today" in this simple setup; average = today so far
    return todayKwhTotal;
  }, [todayKwhTotal]);

  const projectedMonthlyCost = useMemo(() => {
    const monthly = todayKwhTotal * 30 * tariff;
    return monthly.toFixed(2);
  }, [todayKwhTotal, tariff]);

  // Build weekly bars (simple: today value + zeros for others)
  const weeklyBars = useMemo(() => {
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    // place today's value in today's slot
    const todayIdx = new Date().getDay(); // Sun=0..Sat=6
    const mapIdx = (d: number) => (d === 0 ? 6 : d - 1); // shift so Mon=0..Sun=6
    const arr = weekdays.map((day) => ({ day, kwh: 0 }));
    arr[mapIdx(todayIdx)].kwh = Number(todayKwhTotal.toFixed(3));
    return arr;
  }, [todayKwhTotal]);

  // Month bars: placeholder (today only) – can be extended to persist days in localStorage
  const monthBars = useMemo(() => {
    const day = new Date().getDate();
    const arr = Array.from({ length: 30 }, (_, i) => ({
      day: String(i + 1).padStart(2, "0"),
      kwh: 0,
    }));
    if (day >= 1 && day <= 30) {
      arr[day - 1].kwh = Number(todayKwhTotal.toFixed(3));
    }
    return arr;
  }, [todayKwhTotal]);

  const recommendations = useMemo(() => {
    const recs: { icon: string; text: string }[] = [];
    if (todayKwhTotal > 0.05) {
      recs.push({ icon: "⚡", text: "Noticeable usage detected. Consider shifting heavy loads to off-peak." });
    }
    const top = devices
      .slice()
      .sort((a, b) => b.kwhToday - a.kwhToday)[0];
    if (top && top.kwhToday > 0) {
      recs.push({
        icon: "🔌",
        text: `${top.name} is your top consumer today. Check schedule or thresholds.`,
      });
    }
    if (recs.length === 0) {
      recs.push({ icon: "✅", text: "No high consumption patterns detected yet. Keep monitoring." });
    }
    return recs;
  }, [devices, todayKwhTotal]);

  if (!hasDevices) {
    return (
      <div className="text-center text-gray-400 mt-10">
        No devices connected. Connect a device to view insights.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Energy Trend */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Energy Trends</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {period === "day" && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={todayTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
              <Line type="monotone" dataKey="watts" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {period === "week" && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
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
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
              <Bar dataKey="kwh" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        )}
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
          <div className="text-gray-400 text-sm">Collecting data… check back in a minute.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={deviceBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
              >
                {deviceBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
            </PieChart>
          </ResponsiveContainer>
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
