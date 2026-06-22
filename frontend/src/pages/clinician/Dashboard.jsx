import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Heart,
  AlertCircle,
  Monitor,
  Eye,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../../api/axios";
import { getLatestVitals } from "../../api/vitals";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import SparklineChart from "../../components/SparklineChart";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { DEV_MODE } from "../../context/AuthContext";
import {
  MOCK_PATIENTS,
  MOCK_ALERTS,
  MOCK_DASHBOARD_STATS,
  getLiveOverviewData,
} from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

const formatTimeAgo = (date) => {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const generateLiveData = () =>
  Array.from({ length: 20 }, (_, i) => {
    const t = new Date(Date.now() - (19 - i) * 3 * 60 * 1000);
    return {
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      hr: 62 + Math.floor(Math.random() * 28),
      spo2: 94 + Math.floor(Math.random() * 5),
    };
  });

const APPOINTMENTS = [
  { time: "09:00 AM", patient: "John Smith", type: "Routine Check-up" },
  { time: "10:30 AM", patient: "Jane Doe", type: "Follow-up" },
  {
    time: "02:00 PM",
    patient: "Emily Clark",
    type: "Remote Monitoring Review",
  },
];

const HR_SPARK = [72, 75, 71, 78, 74, 72, 76, 73, 71, 74];
const SPO2_SPARK = [98, 97, 98, 99, 97, 98, 98, 97, 99, 98];

// ── Custom tooltip for recharts ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-navy-700">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Data normalizers ───────────────────────────────────────────────────────────
const normalizePts = (pts) =>
  pts.map((p) => ({
    ...p,
    memberId: p.membershipId ?? p.memberId,
    status: p.latestReading?.status ?? p.status,
    updatedAt: p.latestReading?.timestamp ?? p.updatedAt,
    latestReading: p.latestReading
      ? {
          hr: p.latestReading.heartRate ?? p.latestReading.hr,
          spo2: p.latestReading.spo2,
        }
      : null,
  }));

const normalizeAlts = (alts) =>
  alts.map((a) => ({
    ...a,
    type: a.message ?? a.type,
    value: a.value ?? `SpO₂: ${a.spo2}%, HR: ${a.heartRate ?? a.hr} bpm`,
    createdAt: a.timestamp ?? a.createdAt,
    hr: a.heartRate ?? a.hr,
  }));

// ── Component ──────────────────────────────────────────────────────────────────
export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    warning: 0,
    critical: 0,
    live: 0,
  });

  // Live ESP8266 sensor state
  const [liveVitals, setLiveVitals] = useState(null);
  const [sensorOnline, setSensorOnline] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getLatestVitals();
        setLiveVitals(data);
        setSensorOnline(true);
      } catch {
        setSensorOnline(false);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (DEV_MODE) {
      setPatients(normalizePts(MOCK_PATIENTS));
      setStats({
        total: MOCK_DASHBOARD_STATS.totalPatients,
        normal: MOCK_DASHBOARD_STATS.normalCount,
        warning: MOCK_DASHBOARD_STATS.warningCount,
        critical: MOCK_DASHBOARD_STATS.criticalCount,
        live: MOCK_DASHBOARD_STATS.onlineDevices,
      });
      setAlerts(normalizeAlts(MOCK_ALERTS));
      setChartData(getLiveOverviewData());
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get("/patients"),
          api.get("/alerts"),
        ]);
        const pats = pRes.data?.patients ?? pRes.data ?? [];
        setPatients(pats);
        setStats({
          total: pats.length,
          normal: pats.filter(
            (p) => (p.status || "").toUpperCase() === "NORMAL",
          ).length,
          warning: pats.filter(
            (p) => (p.status || "").toUpperCase() === "WARNING",
          ).length,
          critical: pats.filter(
            (p) => (p.status || "").toUpperCase() === "CRITICAL",
          ).length,
          live: pats.filter((p) => p.device?.connected).length,
        });
        setAlerts(aRes.data?.alerts ?? aRes.data ?? []);
        setChartData(generateLiveData());
      } catch {
        setPatients(normalizePts(MOCK_PATIENTS));
        setStats({
          total: MOCK_DASHBOARD_STATS.totalPatients,
          normal: MOCK_DASHBOARD_STATS.normalCount,
          warning: MOCK_DASHBOARD_STATS.warningCount,
          critical: MOCK_DASHBOARD_STATS.criticalCount,
          live: MOCK_DASHBOARD_STATS.onlineDevices,
        });
        setAlerts(normalizeAlts(MOCK_ALERTS));
        setChartData(generateLiveData());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Patients"
          value={stats.total}
          subtitle="Registered"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Normal"
          value={stats.normal}
          subtitle="Stable"
          icon={Heart}
          color="green"
        />
        <StatCard
          title="Warning"
          value={stats.warning}
          subtitle="Needs attention"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="Critical"
          value={stats.critical}
          subtitle="Immediate care"
          icon={AlertCircle}
          color="red"
        />
        <StatCard
          title="Live Devices"
          value={stats.live}
          subtitle="Active monitors"
          icon={Monitor}
          color="purple"
        />
      </div>

      {/* ── Main 2-column grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left column ─────────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          {/* Recent Patients Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Recent Patients
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {patients.length} registered patients
                </p>
              </div>
              <button
                onClick={() => navigate("/clinician/patients")}
                className="text-sm text-brand hover:text-brand-dark font-medium transition-colors"
              >
                View all →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="bg-gray-50/70">
                    {[
                      "Patient",
                      "Status",
                      "HR Trend",
                      "SpO2",
                      "Last Updated",
                      "",
                    ].map((h) => (
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
                  {patients.slice(0, 6).map((patient) => (
                    <tr
                      key={patient._id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(`/clinician/patients/${patient._id}`)
                      }
                    >
                      {/* Patient */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                            {getInitials(patient.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {patient.name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {patient.memberId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td
                        className="px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusBadge status={patient.status} />
                      </td>

                      {/* HR Sparkline */}
                      <td className="px-6 py-4">
                        <div className="w-20 h-8">
                          <SparklineChart data={HR_SPARK} color="#ef4444" />
                        </div>
                      </td>

                      {/* SpO2 */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              (patient.latestReading?.spo2 ?? 98) >= 95
                                ? "bg-green-500"
                                : (patient.latestReading?.spo2 ?? 98) >= 90
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {patient.latestReading?.spo2 ?? "—"}%
                          </span>
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Clock size={12} />
                          <span className="text-xs">
                            {formatTimeAgo(patient.updatedAt)}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clinician/patients/${patient._id}`);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors"
                          title="View patient"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {patients.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No patients yet"
                  description="Patient records will appear here once added."
                />
              )}
            </div>
          </div>

          {/* Live Overview Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Live Overview
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time HR & SpO2 — last 60 min
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-red-500 inline-block rounded" />{" "}
                  Heart Rate (bpm)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-brand inline-block rounded" />{" "}
                  SpO2 (%)
                </span>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={230}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[40, 150]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[85, 102]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hr"
                    stroke="#ef4444"
                    name="Heart Rate"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="spo2"
                    stroke="#3b82f6"
                    name="SpO2"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* ESP8266 Live Sensor Feed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    sensorOnline ? "bg-green-100" : "bg-gray-100"
                  }`}
                >
                  {sensorOnline ? (
                    <Wifi size={14} className="text-green-600" />
                  ) : (
                    <WifiOff size={14} className="text-gray-400" />
                  )}
                </div>
                <h2 className="text-base font-semibold text-gray-800">
                  Live Sensor
                </h2>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  sensorOnline
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {sensorOnline ? "● Online" : "○ Offline"}
              </span>
            </div>

            {liveVitals ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-gray-500 mb-1">
                    <Heart
                      size={11}
                      className="text-red-500 inline-block mr-1"
                    />
                    Heart Rate
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {liveVitals.heartRate}
                  </p>
                  <p className="text-xs text-gray-500">bpm</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1">
                    <Monitor
                      size={11}
                      className="text-brand inline-block mr-1"
                    />
                    SpO2
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {liveVitals.spo2}
                  </p>
                  <p className="text-xs text-gray-500">%</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3">
                No active sensor reading
              </p>
            )}
          </div>

          {/* Recent Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                Recent Alerts
              </h2>
              <button
                onClick={() => navigate("/clinician/alerts")}
                className="text-xs text-brand hover:text-brand-dark font-medium"
              >
                View all →
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {alerts.slice(0, 5).map((alert) => {
                const isCritical =
                  (alert.severity || "").toUpperCase() === "CRITICAL";
                return (
                  <div
                    key={alert._id}
                    className="px-5 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 flex-shrink-0 ${isCritical ? "bg-red-100" : "bg-amber-100"}`}
                      >
                        <AlertCircle
                          size={13}
                          className={
                            isCritical ? "text-red-500" : "text-amber-500"
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {alert.type}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {alert.patientName}
                        </p>
                        <p className="text-xs font-mono text-gray-600 mt-0.5">
                          {alert.value}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={alert.severity} />
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatTimeAgo(alert.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-gray-400">
                  No recent alerts
                </div>
              )}
            </div>
          </div>

          {/* Device Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Device Status
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                <Wifi size={16} className="text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-600">{stats.live}</p>
                <p className="text-[10px] text-green-600 font-medium">Online</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <WifiOff size={16} className="text-red-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-500">
                  {stats.total - stats.live}
                </p>
                <p className="text-[10px] text-red-500 font-medium">Offline</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Monitor size={16} className="text-brand mx-auto mb-1" />
                <p className="text-xl font-bold text-brand">{stats.total}</p>
                <p className="text-[10px] text-brand font-medium">Total</p>
              </div>
            </div>
          </div>

          {/* Today's Appointments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                Today's Appointments
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {APPOINTMENTS.map((appt, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-brand w-20 flex-shrink-0">
                    {appt.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {appt.patient}
                    </p>
                    <p className="text-xs text-gray-500">{appt.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
