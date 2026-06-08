import { useState, useEffect, useMemo } from "react";
import { History, Activity, Heart, Filter, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useAuth, DEV_MODE } from "../../context/AuthContext";
import { MOCK_READINGS } from "../../api/mockData";

// Normalize imported MOCK_READINGS to the field shape the JSX expects
const normalizeReadings = (readings) =>
  readings.map((r) => ({
    ...r,
    hr: r.heartRate ?? r.hr,
    time:
      r.time ??
      new Date(r.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    date:
      r.date ??
      new Date(r.timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    status: r.status ?? "NORMAL",
  }));

const generateMockReadings = (n = 40) =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.now() - (n - 1 - i) * 45 * 60 * 1000);
    const spo2 = 93 + Math.floor(Math.random() * 6);
    const hr = 60 + Math.floor(Math.random() * 45);
    return {
      _id: String(i),
      timestamp: t,
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: t.toLocaleDateString([], { month: "short", day: "numeric" }),
      spo2,
      hr,
      status:
        spo2 < 90 || hr > 120 || hr < 45
          ? "CRITICAL"
          : spo2 < 94 || hr > 100 || hr < 60
            ? "WARNING"
            : "NORMAL",
    };
  });

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function PatientHistory() {
  const { user } = useAuth();

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    if (DEV_MODE) {
      setReadings(normalizeReadings(MOCK_READINGS["p001"] || []));
      setLoading(false);
      return;
    }

    const patientId = user?._id || user?.patientId;
    const endpoint = patientId
      ? `/patients/${patientId}/readings`
      : "/readings/my";

    api
      .get(endpoint)
      .then((res) => setReadings(res.data?.readings ?? res.data ?? []))
      .catch(() => setReadings(generateMockReadings()))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    let list = readings;
    if (dateFrom) {
      list = list.filter((r) => new Date(r.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      list = list.filter((r) => new Date(r.timestamp) <= end);
    }
    if (statusFilter !== "ALL") {
      list = list.filter(
        (r) => (r.status || "").toUpperCase() === statusFilter,
      );
    }
    return list;
  }, [readings, dateFrom, dateTo, statusFilter]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatusFilter("ALL");
  };
  const hasFilters = dateFrom || dateTo || statusFilter !== "ALL";

  // Chart data — show all readings (up to 30 for chart readability)
  const chartData = useMemo(
    () =>
      filtered.slice(-30).map((r) => ({
        time: r.time,
        hr: r.hr,
        spo2: r.spo2,
      })),
    [filtered],
  );

  const stats = {
    avg_spo2: filtered.length
      ? (
          filtered.reduce((a, r) => a + (r.spo2 || 0), 0) / filtered.length
        ).toFixed(1)
      : "—",
    avg_hr: filtered.length
      ? Math.round(
          filtered.reduce((a, r) => a + (r.hr || 0), 0) / filtered.length,
        )
      : "—",
    critical: filtered.filter((r) => r.status === "CRITICAL").length,
    warning: filtered.filter((r) => r.status === "WARNING").length,
  };

  if (loading) return <LoadingSpinner message="Loading your readings…" />;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Avg SpO2",
            value: `${stats.avg_spo2}%`,
            color: "text-brand",
          },
          {
            label: "Avg HR",
            value: `${stats.avg_hr} bpm`,
            color: "text-red-500",
          },
          { label: "Warnings", value: stats.warning, color: "text-amber-600" },
          { label: "Critical", value: stats.critical, color: "text-red-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Full chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              HR & SpO2 History
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Showing last {chartData.length} readings
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-red-400 inline-block rounded" />{" "}
              Heart Rate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-brand inline-block rounded" /> SpO2
            </span>
          </div>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                domain={[40, 150]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[85, 102]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="hr"
                stroke="#ef4444"
                name="Heart Rate (bpm)"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spo2"
                stroke="#3b82f6"
                name="SpO2 (%)"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">
              Filter readings:
            </span>
          </div>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          <div className="flex gap-1">
            {["ALL", "NORMAL", "WARNING", "CRITICAL"].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  statusFilter === f
                    ? "bg-brand text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
            >
              <X size={12} /> Clear
            </button>
          )}

          <p className="text-xs text-gray-400 ml-auto">
            {filtered.length} results
          </p>
        </div>
      </div>

      {/* Readings table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="bg-gray-50/80">
                {["Date & Time", "SpO2", "Heart Rate", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered
                .slice()
                .reverse()
                .map((r) => (
                  <tr
                    key={r._id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {r.date}
                      </span>
                      <span className="ml-2 font-mono">{r.time}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Activity size={13} className="text-brand" />
                        <span className="text-sm font-bold text-gray-700">
                          {r.spo2}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Heart size={13} className="text-red-400" />
                        <span className="text-sm font-bold text-gray-700">
                          {r.hr} bpm
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={History}
              title="No readings found"
              description="Try adjusting the date range or status filter."
            />
          )}
        </div>
      </div>
    </div>
  );
}
