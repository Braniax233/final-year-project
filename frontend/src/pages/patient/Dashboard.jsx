import { useState, useEffect, useRef } from "react";
import {
  Heart,
  Activity,
  AlertCircle,
  Phone,
  MapPin,
  Calculator,
  TrendingUp,
  TrendingDown,
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
  ResponsiveContainer,
} from "recharts";
import api from "../../api/axios";
import { getLatestVitals } from "../../api/vitals";
import StatusBadge from "../../components/StatusBadge";
import SparklineChart from "../../components/SparklineChart";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth, DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS, MOCK_READINGS, getChartData } from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const calcBMI = (weight, height) => {
  if (!weight || !height) return null;
  const bmi = weight / (height / 100) ** 2;
  return {
    value: bmi.toFixed(1),
    label:
      bmi < 18.5
        ? "Underweight"
        : bmi < 25
          ? "Normal"
          : bmi < 30
            ? "Overweight"
            : "Obese",
    color:
      bmi < 18.5
        ? "text-blue-600"
        : bmi < 25
          ? "text-green-600"
          : bmi < 30
            ? "text-amber-600"
            : "text-red-600",
    bg:
      bmi < 18.5
        ? "bg-blue-50"
        : bmi < 25
          ? "bg-green-50"
          : bmi < 30
            ? "bg-amber-50"
            : "bg-red-50",
    border:
      bmi < 18.5
        ? "border-blue-200"
        : bmi < 25
          ? "border-green-200"
          : bmi < 30
            ? "border-amber-200"
            : "border-red-200",
  };
};

const STATUS_BANNER = {
  NORMAL: {
    bg: "bg-green-50  border-green-200",
    text: "text-green-700",
    icon: null,
    msg: "Your vital signs are within the normal range. Keep up the healthy lifestyle!",
  },
  WARNING: {
    bg: "bg-amber-50  border-amber-200",
    text: "text-amber-700",
    icon: AlertCircle,
    msg: "Some readings need attention. Please contact your healthcare provider soon.",
  },
  CRITICAL: {
    bg: "bg-red-50    border-red-300",
    text: "text-red-700",
    icon: AlertCircle,
    msg: "Critical reading detected. Seek immediate medical attention.",
  },
};

const MOCK_CONTACTS = [
  {
    name: "Dr. Sarah Adams",
    role: "Primary Clinician",
    phone: "+1 (555) 123-4567",
  },
  { name: "Mary Smith", role: "Emergency Contact", phone: "+1 (555) 765-4321" },
];

const generateHistory = () =>
  Array.from({ length: 12 }, (_, i) => ({
    time: new Date(Date.now() - (11 - i) * 15 * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    spo2: 94 + Math.floor(Math.random() * 5),
    hr: 68 + Math.floor(Math.random() * 20),
  }));

export default function PatientDashboard() {
  const { user } = useAuth();

  const [patient, setPatient] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(() =>
    DEV_MODE ? [] : generateHistory(),
  );

  // Live sensor state — polls /api/vitals/latest every 5 seconds
  const [liveVitals, setLiveVitals] = useState(null);
  const [sensorOnline, setSensorOnline] = useState(false);
  const pollRef = useRef(null);

  // BMI calculator state
  const [bmiWeight, setBmiWeight] = useState("");
  const [bmiHeight, setBmiHeight] = useState("");
  const [bmiResult, setBmiResult] = useState(null);

  // Location sharing
  const [locConsent, setLocConsent] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);

  // Start polling the live sensor endpoint
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

    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (DEV_MODE) {
      const raw =
        MOCK_PATIENTS.find((p) => p._id === user?.patientId) ??
        MOCK_PATIENTS[0];
      setPatient({
        ...raw,
        memberId: raw.membershipId,
        status: raw.latestReading?.status,
        latestReading: raw.latestReading
          ? { hr: raw.latestReading.heartRate, spo2: raw.latestReading.spo2 }
          : null,
        emergencyContacts:
          raw.emergencyContacts?.map((c) => ({
            ...c,
            role: c.relationship ?? c.role,
          })) ?? [],
      });
      setLocConsent(!!raw?.locationSharingConsent);
      setReadings(MOCK_READINGS["p001"] ?? []);
      setHistory(getChartData("p001"));
      setLoading(false);
      return;
    }

    const patientId = user?._id || user?.patientId;
    const endpoint = patientId ? `/patients/${patientId}` : "/patients/me";

    api
      .get(endpoint)
      .then((res) => {
        const p = res.data?.patient ?? res.data;
        setPatient(p);
        setLocConsent(!!p?.locationSharingConsent);
      })
      .catch(() => {
        setPatient({
          _id: user?._id || "demo",
          name: user?.name || "John Smith",
          memberId: user?.memberId || "VX-001",
          status: "NORMAL",
          latestReading: { hr: 72, spo2: 98 },
          emergencyContacts: MOCK_CONTACTS,
        });
      });

    const readId = user?._id || user?.patientId;
    if (readId) {
      api
        .get(`/patients/${readId}/readings?limit=10`)
        .then((res) => setReadings(res.data?.readings ?? res.data ?? []))
        .catch(() => {});
    }

    setLoading(false);
  }, [user]);

  const handleLocationToggle = async () => {
    const next = !locConsent;
    setLocConsent(next);
    setSavingLoc(true);
    try {
      await api.put(`/patients/${patient._id}`, {
        locationSharingConsent: next,
      });
    } catch {
      /* optimistic */
    } finally {
      setSavingLoc(false);
    }
  };

  const latestHr = patient?.latestReading?.hr ?? 72;
  const latestSpo2 = patient?.latestReading?.spo2 ?? 98;
  const status = (patient?.status ?? "NORMAL").toUpperCase();
  const banner = STATUS_BANNER[status] ?? STATUS_BANNER.NORMAL;
  const BannerIcon = banner.icon;

  const hrData = history.map((h) => h.hr);
  const spo2Data = history.map((h) => h.spo2);

  if (loading) return <LoadingSpinner message="Loading your dashboard…" />;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white">
        <p className="text-slate-400 text-sm mb-0.5">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h2 className="text-xl font-bold">
          Hello, {patient?.name || user?.name || "Patient"} 👋
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Membership ID:{" "}
          <span className="font-mono text-slate-300">
            {patient?.memberId || user?.memberId || "—"}
          </span>
        </p>
      </div>

      {/* Status banner */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${banner.bg}`}
      >
        {BannerIcon && (
          <BannerIcon
            size={18}
            className={`${banner.text} flex-shrink-0 mt-0.5`}
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={status} size="md" />
            <span className={`text-sm font-bold ${banner.text}`}>{status}</span>
          </div>
          <p className={`text-sm ${banner.text}`}>{banner.msg}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Live Sensor Card ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
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
                <h3 className="text-sm font-semibold text-gray-800">
                  Live Sensor
                </h3>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                    <Heart size={11} className="text-red-500" /> Heart Rate
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {liveVitals.heartRate}
                  </p>
                  <p className="text-xs text-gray-500">bpm</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                    <Activity size={11} className="text-brand" /> SpO2
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {liveVitals.spo2}
                  </p>
                  <p className="text-xs text-gray-500">%</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">
                {sensorOnline
                  ? "Waiting for sensor data…"
                  : "Place your finger on the sensor to begin."}
              </p>
            )}
          </div>

          {/* Vital cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* SpO2 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Activity size={14} className="text-brand" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    SpO2
                  </span>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-end gap-1 mb-3">
                <p className="text-4xl font-bold text-gray-800">{latestSpo2}</p>
                <p className="text-lg text-gray-500 mb-1">%</p>
              </div>
              <div className="h-12">
                <SparklineChart data={spo2Data} color="#3b82f6" tooltip />
              </div>
            </div>

            {/* HR */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <Heart size={14} className="text-red-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    Heart Rate
                  </span>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-end gap-1 mb-3">
                <p className="text-4xl font-bold text-gray-800">{latestHr}</p>
                <p className="text-sm text-gray-500 mb-1">bpm</p>
              </div>
              <div className="h-12">
                <SparklineChart data={hrData} color="#ef4444" tooltip />
              </div>
            </div>
          </div>

          {/* Sparkline history chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Recent Activity
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-red-400 inline-block rounded" />{" "}
                  HR
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-brand inline-block rounded" />{" "}
                  SpO2
                </span>
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={history}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
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
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hr"
                    stroke="#ef4444"
                    name="HR"
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

          {/* BMI Calculator */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-violet-100 rounded-lg">
                <Calculator size={14} className="text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">
                BMI Calculator
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={bmiWeight}
                  onChange={(e) => {
                    setBmiWeight(e.target.value);
                    setBmiResult(null);
                  }}
                  placeholder="e.g. 70"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={bmiHeight}
                  onChange={(e) => {
                    setBmiHeight(e.target.value);
                    setBmiResult(null);
                  }}
                  placeholder="e.g. 175"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
            </div>

            <button
              onClick={() => setBmiResult(calcBMI(bmiWeight, bmiHeight))}
              disabled={!bmiWeight || !bmiHeight}
              className="w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40 mb-3"
            >
              Calculate BMI
            </button>

            {bmiResult && (
              <div
                className={`p-4 rounded-xl border text-center ${bmiResult.bg} ${bmiResult.border}`}
              >
                <p className={`text-3xl font-bold ${bmiResult.color}`}>
                  {bmiResult.value}
                </p>
                <p className={`text-sm font-semibold mt-1 ${bmiResult.color}`}>
                  {bmiResult.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {bmiResult.label === "Normal"
                    ? "✓ Healthy weight range"
                    : bmiResult.label === "Underweight"
                      ? "Consider consulting your doctor."
                      : bmiResult.label === "Overweight"
                        ? "Diet and exercise recommended."
                        : "Medical advice recommended."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Emergency contacts */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <Phone size={14} className="text-red-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">
                Emergency Contacts
              </h3>
            </div>
            <div className="space-y-3">
              {(patient?.emergencyContacts || MOCK_CONTACTS).map((c, i) => (
                <div
                  key={i}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-500">{c.role}</p>
                  <a
                    href={`tel:${c.phone}`}
                    className="text-xs text-brand hover:underline font-medium mt-0.5 flex items-center gap-1"
                  >
                    <Phone size={11} /> {c.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Location sharing */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <MapPin size={14} className="text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Location Sharing
                </h3>
              </div>
              <button
                onClick={handleLocationToggle}
                disabled={savingLoc}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${locConsent ? "bg-brand" : "bg-gray-200"} disabled:opacity-60`}
                role="switch"
                aria-checked={locConsent}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${locConsent ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {locConsent
                ? "Your location is being shared with your care team for emergency use."
                : "Enable to share your location with your care team in emergencies."}
            </p>
          </div>

          {/* Quick vitals summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Vitals Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">SpO2</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${latestSpo2}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">
                    {latestSpo2}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Heart Rate</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{
                        width: `${Math.min((latestHr / 120) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">
                    {latestHr} bpm
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
