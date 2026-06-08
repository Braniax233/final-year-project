import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Heart,
  Activity,
  AlertCircle,
  Plus,
  Tag,
  Save,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Edit2,
  Monitor,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import SparklineChart from "../../components/SparklineChart";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS, MOCK_READINGS, MOCK_NOTES } from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calcBMI = (weight, height) => {
  if (!weight || !height) return null;
  const bmi = weight / (height / 100) ** 2;
  const cls =
    bmi < 18.5
      ? {
          label: "Underweight",
          color: "text-blue-600   bg-blue-50   border-blue-200",
        }
      : bmi < 25
        ? {
            label: "Normal",
            color: "text-green-600  bg-green-50  border-green-200",
          }
        : bmi < 30
          ? {
              label: "Overweight",
              color: "text-amber-600  bg-amber-50  border-amber-200",
            }
          : {
              label: "Obese",
              color: "text-red-600    bg-red-50    border-red-200",
            };
  return { value: bmi.toFixed(1), ...cls };
};

const generateReadings = (n = 30) =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.now() - (n - 1 - i) * 30 * 60 * 1000);
    const spo2 = 93 + Math.floor(Math.random() * 6);
    const hr = 65 + Math.floor(Math.random() * 40);
    return {
      _id: String(i),
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: t,
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

const NOTE_TAGS = [
  "Routine",
  "Follow-up",
  "Urgent",
  "Medication",
  "Lab Results",
  "Exercise",
  "Diet",
];
const PERIODS = ["1H", "6H", "24H", "7D"];

// ── Custom chart tooltip ──────────────────────────────────────────────────────
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

// ── Data normalizers ───────────────────────────────────────────────────────────
const normalizePt = (raw, id) => {
  if (!raw) return null;
  return {
    ...raw,
    _id: id ?? raw._id,
    memberId: raw.membershipId ?? raw.memberId,
    status: raw.latestReading?.status ?? raw.status,
    location: raw.address ?? raw.location,
    condition: raw.primaryCondition ?? raw.condition,
    height: raw.bmi?.height ?? raw.height,
    weight: raw.bmi?.weight ?? raw.weight,
    emergencyContact: raw.emergencyContacts?.[0]
      ? {
          name: raw.emergencyContacts[0].name,
          phone: raw.emergencyContacts[0].phone,
          relation:
            raw.emergencyContacts[0].relationship ??
            raw.emergencyContacts[0].relation,
        }
      : (raw.emergencyContact ?? null),
    thresholds: raw.threshold
      ? {
          spo2Min: raw.threshold.spo2Min,
          spo2Max: raw.threshold.spo2Max,
          hrMin: raw.threshold.hrMin,
          hrMax: raw.threshold.hrMax,
        }
      : (raw.thresholds ?? {
          spo2Min: 90,
          spo2Max: 100,
          hrMin: 60,
          hrMax: 100,
        }),
    latestReading: raw.latestReading
      ? {
          hr: raw.latestReading.heartRate ?? raw.latestReading.hr,
          spo2: raw.latestReading.spo2,
          timestamp: raw.latestReading.timestamp,
        }
      : null,
  };
};

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
  }));

const normalizeNotes = (notes) =>
  notes.map((n) => ({
    ...n,
    content: n.note ?? n.content,
    createdAt: n.timestamp ?? n.createdAt,
  }));

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [readings, setReadings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState("6H");

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteTags, setNoteTags] = useState([]);
  const [savingNote, setSavingNote] = useState(false);

  // Thresholds
  const [thresholds, setThresholds] = useState({
    spo2Min: 90,
    spo2Max: 100,
    hrMin: 60,
    hrMax: 100,
  });
  const [savedThresh, setSavedThresh] = useState(false);
  const [savingThresh, setSavingThresh] = useState(false);

  useEffect(() => {
    if (DEV_MODE) {
      const raw = MOCK_PATIENTS.find((p) => p._id === id);
      const p = normalizePt(raw, id);
      setPatient(p);
      setReadings(normalizeReadings(MOCK_READINGS[id] || []));
      setNotes(normalizeNotes(MOCK_NOTES[id] || []));
      if (p?.thresholds) setThresholds(p.thresholds);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [pRes, rRes, nRes] = await Promise.all([
          api.get(`/patients/${id}`),
          api.get(`/patients/${id}/readings`),
          api.get(`/notes/patient/${id}`),
        ]);
        const p = pRes.data?.patient ?? pRes.data;
        setPatient(p);
        setReadings(rRes.data?.readings ?? rRes.data ?? []);
        setNotes(nRes.data?.notes ?? nRes.data ?? []);
        if (p?.thresholds) setThresholds(p.thresholds);
      } catch {
        const raw = MOCK_PATIENTS.find((p) => p._id === id) ?? MOCK_PATIENTS[0];
        const p = normalizePt(raw, id);
        setPatient(p);
        setReadings(
          normalizeReadings(
            MOCK_READINGS[id] || MOCK_READINGS["p001"] || generateReadings(),
          ),
        );
        setNotes(normalizeNotes(MOCK_NOTES[id] || MOCK_NOTES["p001"] || []));
        if (p?.thresholds) setThresholds(p.thresholds);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const bmi = patient ? calcBMI(patient.weight, patient.height) : null;

  // Filter chart data by period
  const chartData = (() => {
    const now = Date.now();
    const ms =
      { "1H": 3600000, "6H": 21600000, "24H": 86400000, "7D": 604800000 }[
        period
      ] ?? 21600000;
    return readings.filter((r) => now - new Date(r.timestamp).getTime() <= ms);
  })();

  const hrData = readings
    .map((r) => r.hr)
    .filter(Boolean)
    .slice(-10);
  const spo2Data = readings
    .map((r) => r.spo2)
    .filter(Boolean)
    .slice(-10);

  const latest = readings[readings.length - 1];

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.post("/notes", {
        patientId: id,
        content: noteText,
        tags: noteTags,
      });
      setNotes((prev) => [res.data, ...prev]);
    } catch {
      setNotes((prev) => [
        {
          _id: Date.now().toString(),
          clinicianName: "You",
          content: noteText,
          tags: noteTags,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } finally {
      setNoteText("");
      setNoteTags([]);
      setShowNoteForm(false);
      setSavingNote(false);
    }
  };

  const saveThresholds = async () => {
    setSavingThresh(true);
    try {
      await api.put(`/patients/${id}/thresholds`, thresholds);
    } catch {
      /* optimistic */
    } finally {
      setSavedThresh(true);
      setTimeout(() => setSavedThresh(false), 2000);
      setSavingThresh(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading patient…" />;
  if (!patient)
    return (
      <EmptyState
        icon={AlertCircle}
        title="Patient not found"
        description="This patient record doesn't exist."
      />
    );

  const TABS = ["overview", "health-history", "vitals", "reports", "notes"];
  const TAB_LABELS = {
    overview: "Overview",
    "health-history": "Health History",
    vitals: "Vitals History",
    reports: "Reports",
    notes: "Notes",
  };

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/clinician/patients")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{patient.name}</h2>
          <p className="text-xs text-gray-500">Patient Detail View</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* ── Left: main content ────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-5">
          {/* Patient Profile Header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center text-brand text-xl font-bold flex-shrink-0">
                {getInitials(patient.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-lg font-bold text-gray-800">
                    {patient.name}
                  </h3>
                  <StatusBadge status={patient.status} size="md" />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />{" "}
                    Active
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono mb-3">
                  {patient.memberId}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Phone size={12} /> {patient.phone || "—"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} /> {patient.email || "—"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} /> {patient.location || "—"}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500 hidden sm:block flex-shrink-0">
                <p className="font-medium text-gray-700">{patient.gender}</p>
                <p>{patient.age} years old</p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
              {[
                {
                  label: "Blood Group",
                  value: patient.bloodGroup || "—",
                  color: "text-red-600",
                },
                {
                  label: "Height",
                  value: patient.height ? `${patient.height} cm` : "—",
                  color: "text-blue-600",
                },
                {
                  label: "Weight",
                  value: patient.weight ? `${patient.weight} kg` : "—",
                  color: "text-emerald-600",
                },
                {
                  label: "BMI",
                  value: bmi?.value ?? "—",
                  color: "text-violet-600",
                  extra: bmi?.label,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="text-center p-3 bg-gray-50 rounded-xl"
                >
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  {s.extra && (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${bmi?.color}`}
                    >
                      {s.extra}
                    </span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Tab nav */}
            <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? "border-brand text-brand"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6">
              {/* ── OVERVIEW ── */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Current vitals */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Heart Rate */}
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-red-100 rounded-lg">
                            <Heart size={14} className="text-red-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            Heart Rate
                          </span>
                        </div>
                        <StatusBadge
                          status={latest?.status ?? patient.status}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-gray-800">
                          {latest?.hr ?? patient.latestReading?.hr ?? "—"}
                        </p>
                        <p className="text-sm text-gray-500 mb-1">bpm</p>
                      </div>
                      <div className="h-10 mt-2">
                        <SparklineChart data={hrData} color="#ef4444" />
                      </div>
                    </div>
                    {/* SpO2 */}
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-100 rounded-lg">
                            <Activity size={14} className="text-brand" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            SpO2
                          </span>
                        </div>
                        <StatusBadge
                          status={latest?.status ?? patient.status}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-gray-800">
                          {latest?.spo2 ?? patient.latestReading?.spo2 ?? "—"}
                        </p>
                        <p className="text-sm text-gray-500 mb-1">%</p>
                      </div>
                      <div className="h-10 mt-2">
                        <SparklineChart data={spo2Data} color="#3b82f6" />
                      </div>
                    </div>
                  </div>

                  {/* Trend chart */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">
                        HR & SpO2 Trend
                      </h4>
                      <div className="flex items-center gap-1">
                        {PERIODS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                              period === p
                                ? "bg-brand text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
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
                        <ReferenceLine
                          yAxisId="left"
                          y={thresholds.hrMin}
                          stroke="#ef444460"
                          strokeDasharray="4 2"
                        />
                        <ReferenceLine
                          yAxisId="left"
                          y={thresholds.hrMax}
                          stroke="#ef444460"
                          strokeDasharray="4 2"
                        />
                        <ReferenceLine
                          yAxisId="right"
                          y={thresholds.spo2Min}
                          stroke="#3b82f660"
                          strokeDasharray="4 2"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="hr"
                          stroke="#ef4444"
                          name="HR (bpm)"
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

                  {/* Recent alerts in overview */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Recent Alerts
                    </h4>
                    <div className="space-y-2">
                      {readings
                        .filter((r) => r.status !== "NORMAL")
                        .slice(-3)
                        .map((r) => (
                          <div
                            key={r._id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                          >
                            <AlertCircle
                              size={14}
                              className={
                                r.status === "CRITICAL"
                                  ? "text-red-500"
                                  : "text-amber-500"
                              }
                            />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-700">
                                HR: {r.hr} bpm &nbsp;·&nbsp; SpO2: {r.spo2}%
                              </p>
                            </div>
                            <StatusBadge status={r.status} />
                            <span className="text-[10px] text-gray-400">
                              {formatDate(r.timestamp)}
                            </span>
                          </div>
                        ))}
                      {readings.filter((r) => r.status !== "NORMAL").length ===
                        0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                          No alerts for this patient
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── VITALS HISTORY ── */}
              {activeTab === "vitals" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Readings History
                    </h4>
                    <div className="flex gap-1">
                      {PERIODS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${period === p ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
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
                        name="HR (bpm)"
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

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <th className="text-left px-4 py-2">Time</th>
                          <th className="text-left px-4 py-2">HR (bpm)</th>
                          <th className="text-left px-4 py-2">SpO2 (%)</th>
                          <th className="text-left px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {readings
                          .slice()
                          .reverse()
                          .slice(0, 15)
                          .map((r) => (
                            <tr key={r._id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2 text-xs text-gray-500">
                                {formatDate(r.timestamp)}
                              </td>
                              <td className="px-4 py-2 font-medium text-gray-700">
                                {r.hr}
                              </td>
                              <td className="px-4 py-2 font-medium text-gray-700">
                                {r.spo2}%
                              </td>
                              <td className="px-4 py-2">
                                <StatusBadge status={r.status} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── NOTES ── */}
              {activeTab === "notes" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Session Notes
                    </h4>
                    <button
                      onClick={() => setShowNoteForm((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition-colors"
                    >
                      <Plus size={13} /> Add Note
                    </button>
                  </div>

                  {/* Note form */}
                  {showNoteForm && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write session note…"
                        rows={3}
                        className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white resize-none"
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                          <Tag size={11} /> Tags
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {NOTE_TAGS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() =>
                                setNoteTags((prev) =>
                                  prev.includes(tag)
                                    ? prev.filter((t) => t !== tag)
                                    : [...prev, tag],
                                )
                              }
                              className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                                noteTags.includes(tag)
                                  ? "bg-brand text-white border-brand"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-brand"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowNoteForm(false)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveNote}
                          disabled={savingNote || !noteText.trim()}
                          className="px-3 py-1.5 text-xs rounded-lg bg-brand text-white font-medium disabled:opacity-50 hover:bg-brand-dark"
                        >
                          {savingNote ? "Saving…" : "Save Note"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes list */}
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note._id}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-brand/10 rounded-full flex items-center justify-center text-brand text-[10px] font-bold">
                              {getInitials(note.clinicianName)}
                            </div>
                            <span className="text-xs font-semibold text-gray-700">
                              {note.clinicianName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Clock size={11} />
                            <span className="text-[10px]">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {note.content}
                        </p>
                        {note.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {note.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-medium px-2 py-0.5 bg-brand/10 text-brand rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <EmptyState
                        icon={Edit2}
                        title="No notes yet"
                        description="Add the first session note above."
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── OTHER TABS (placeholder) ── */}
              {(activeTab === "health-history" || activeTab === "reports") && (
                <EmptyState
                  icon={Activity}
                  title={`${TAB_LABELS[activeTab]} coming soon`}
                  description="This section will display detailed medical history records."
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Patient info card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-800 mb-4">
              Patient Information
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Condition</p>
                <p className="text-gray-700 font-medium">
                  {patient.condition || "—"}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Allergies</p>
                <p className="text-red-600 font-medium">
                  {patient.allergies || "None known"}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Medications</p>
                <p className="text-gray-700 leading-relaxed">
                  {patient.medications || "—"}
                </p>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-gray-400 mb-1">Emergency Contact</p>
                {patient.emergencyContact ? (
                  <div>
                    <p className="font-semibold text-gray-700">
                      {patient.emergencyContact.name}
                    </p>
                    <p className="text-gray-500">
                      {patient.emergencyContact.relation}
                    </p>
                    <p className="text-brand">
                      {patient.emergencyContact.phone}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Threshold config */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-800 mb-4">
              Alert Thresholds
            </h4>
            <div className="space-y-3">
              {[
                { label: "SpO2 Min (%)", key: "spo2Min", min: 80, max: 99 },
                { label: "SpO2 Max (%)", key: "spo2Max", min: 90, max: 100 },
                { label: "HR Min (bpm)", key: "hrMin", min: 30, max: 80 },
                { label: "HR Max (bpm)", key: "hrMax", min: 80, max: 200 },
              ].map(({ label, key, min, max }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-28 flex-shrink-0">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={thresholds[key]}
                    onChange={(e) =>
                      setThresholds((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value),
                      }))
                    }
                    min={min}
                    max={max}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveThresholds}
              disabled={savingThresh}
              className={`w-full mt-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                savedThresh
                  ? "bg-green-100 text-green-700"
                  : "bg-brand text-white hover:bg-brand-dark"
              }`}
            >
              {savedThresh ? (
                <>
                  <CheckCircle size={13} /> Saved!
                </>
              ) : (
                <>
                  <Save size={13} /> Save Thresholds
                </>
              )}
            </button>
          </div>

          {/* BMI card */}
          {bmi && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                BMI Assessment
              </h4>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-800">{bmi.value}</p>
                <span
                  className={`inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${bmi.color}`}
                >
                  {bmi.label}
                </span>
                <p className="text-xs text-gray-500 mt-3">
                  {patient.height}cm · {patient.weight}kg
                </p>
              </div>
            </div>
          )}

          {/* Start Live Monitoring */}
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-navy-900 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 transition-colors shadow-sm">
            <Monitor size={16} />
            Start Live Monitoring
          </button>
        </div>
      </div>
    </div>
  );
}
