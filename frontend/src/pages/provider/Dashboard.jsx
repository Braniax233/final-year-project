import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Users,
  Activity,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import api from "../../api/axios";
import StatCard from "../../components/StatCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth, DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS } from "../../api/mockData";

const MOCK_ACTIVITY = [
  {
    id: "1",
    type: "reading",
    patient: "John Smith",
    memberId: "VX-001",
    result: "NORMAL",
    spo2: 98,
    hr: 72,
    time: new Date(Date.now() - 15 * 60000),
  },
  {
    id: "2",
    type: "reading",
    patient: "Jane Doe",
    memberId: "VX-002",
    result: "WARNING",
    spo2: 93,
    hr: 105,
    time: new Date(Date.now() - 45 * 60000),
  },
  {
    id: "3",
    type: "reading",
    patient: "Emily Clark",
    memberId: "VX-004",
    result: "NORMAL",
    spo2: 99,
    hr: 68,
    time: new Date(Date.now() - 90 * 60000),
  },
  {
    id: "4",
    type: "reading",
    patient: "Michael Brown",
    memberId: "VX-005",
    result: "WARNING",
    spo2: 92,
    hr: 45,
    time: new Date(Date.now() - 120 * 60000),
  },
  {
    id: "5",
    type: "reading",
    patient: "Robert Johnson",
    memberId: "VX-003",
    result: "CRITICAL",
    spo2: 87,
    hr: 138,
    time: new Date(Date.now() - 180 * 60000),
  },
];

const STATUS_BAR = {
  NORMAL: "bg-green-500",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

const STATUS_TEXT = {
  NORMAL: "text-green-700 bg-green-50 border-green-200",
  WARNING: "text-amber-700 bg-amber-50 border-amber-200",
  CRITICAL: "text-red-700   bg-red-50   border-red-200",
};

const formatTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ seen: 0, captured: 0, alerts: 0 });

  useEffect(() => {
    if (DEV_MODE) {
      const devActivity = [
        {
          id: "1",
          type: "reading",
          patient: MOCK_PATIENTS[0].name,
          memberId: MOCK_PATIENTS[0].membershipId,
          result: MOCK_PATIENTS[0].latestReading.status,
          spo2: MOCK_PATIENTS[0].latestReading.spo2,
          hr: MOCK_PATIENTS[0].latestReading.heartRate,
          time: new Date(Date.now() - 15 * 60000),
        },
        {
          id: "2",
          type: "reading",
          patient: MOCK_PATIENTS[1].name,
          memberId: MOCK_PATIENTS[1].membershipId,
          result: MOCK_PATIENTS[1].latestReading.status,
          spo2: MOCK_PATIENTS[1].latestReading.spo2,
          hr: MOCK_PATIENTS[1].latestReading.heartRate,
          time: new Date(Date.now() - 45 * 60000),
        },
        {
          id: "3",
          type: "reading",
          patient: MOCK_PATIENTS[2].name,
          memberId: MOCK_PATIENTS[2].membershipId,
          result: MOCK_PATIENTS[2].latestReading.status,
          spo2: MOCK_PATIENTS[2].latestReading.spo2,
          hr: MOCK_PATIENTS[2].latestReading.heartRate,
          time: new Date(Date.now() - 90 * 60000),
        },
      ];
      setActivity(devActivity);
      setStats({ seen: 3, captured: 8, alerts: 2 });
      setLoading(false);
      return;
    }

    api
      .get("/readings/today")
      .then((res) => {
        const data = res.data?.readings ?? res.data ?? [];
        setActivity(data);
        setStats({
          seen: data.length,
          captured: data.length,
          alerts: data.filter(
            (a) => (a.result || "").toUpperCase() !== "NORMAL",
          ).length,
        });
      })
      .catch(() => {
        setActivity(MOCK_ACTIVITY);
        setStats({
          seen: MOCK_ACTIVITY.length,
          captured: MOCK_ACTIVITY.length,
          alerts: MOCK_ACTIVITY.filter(
            (a) => (a.result || "").toUpperCase() !== "NORMAL",
          ).length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">
              Good{" "}
              {new Date().getHours() < 12
                ? "morning"
                : new Date().getHours() < 17
                  ? "afternoon"
                  : "evening"}
              ,
            </p>
            <h2 className="text-xl font-bold">
              {user?.name || "Healthcare Provider"} 👋
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={() => navigate("/provider/capture")}
            className="flex items-center gap-2.5 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-brand/30"
          >
            <Camera size={18} />
            Capture New Reading
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Patients Seen Today"
          value={stats.seen}
          subtitle="Unique patients"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Readings Captured"
          value={stats.captured}
          subtitle="Successful captures"
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Alerts Triggered"
          value={stats.alerts}
          subtitle="Warning + Critical"
          icon={AlertCircle}
          color="amber"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/provider/capture")}
          className="bg-white border-2 border-brand rounded-2xl p-6 text-left hover:bg-blue-50/50 transition-colors group"
        >
          <div className="p-3 bg-brand/10 rounded-xl w-fit mb-3 group-hover:bg-brand/20 transition-colors">
            <Camera size={24} className="text-brand" />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1">
            Capture New Reading
          </h3>
          <p className="text-xs text-gray-500">
            Identify patient and record SpO2 & HR
          </p>
          <div className="flex items-center gap-1 mt-3 text-brand text-xs font-semibold">
            Start now <ArrowRight size={12} />
          </div>
        </button>

        <button
          onClick={() => navigate("/provider/patients")}
          className="bg-white border border-gray-100 rounded-2xl p-6 text-left hover:bg-gray-50 transition-colors group shadow-sm"
        >
          <div className="p-3 bg-gray-100 rounded-xl w-fit mb-3 group-hover:bg-gray-200 transition-colors">
            <Users size={24} className="text-gray-600" />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1">
            Find Patient
          </h3>
          <p className="text-xs text-gray-500">
            Search by name or membership ID
          </p>
          <div className="flex items-center gap-1 mt-3 text-gray-500 text-xs font-semibold">
            Browse records <ArrowRight size={12} />
          </div>
        </button>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              Today's Activity
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {activity.length} readings captured
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} />
            {new Date().toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {activity.map((item) => {
            const status = (item.result || "NORMAL").toUpperCase();
            return (
              <div key={item.id} className="px-6 py-4 flex items-center gap-4">
                {/* Status dot */}
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_BAR[status] ?? "bg-gray-400"}`}
                />

                {/* Patient */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {item.patient}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {item.memberId}
                  </p>
                </div>

                {/* Vitals */}
                <div className="text-xs text-gray-600 hidden sm:flex items-center gap-4">
                  <span>
                    HR: <strong>{item.hr}</strong>
                  </span>
                  <span>
                    SpO2: <strong>{item.spo2}%</strong>
                  </span>
                </div>

                {/* Status badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_TEXT[status] ?? STATUS_TEXT.NORMAL}`}
                >
                  {status}
                </span>

                {/* Time */}
                <div className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0">
                  <Clock size={11} />
                  {formatTime(item.time)}
                </div>

                {status === "NORMAL" && (
                  <CheckCircle
                    size={14}
                    className="text-green-500 flex-shrink-0"
                  />
                )}
                {status !== "NORMAL" && (
                  <AlertCircle
                    size={14}
                    className={
                      status === "CRITICAL"
                        ? "text-red-500 flex-shrink-0"
                        : "text-amber-500 flex-shrink-0"
                    }
                  />
                )}
              </div>
            );
          })}

          {activity.length === 0 && (
            <div className="px-6 py-10 text-center">
              <Camera size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">
                No readings captured today
              </p>
              <button
                onClick={() => navigate("/provider/capture")}
                className="mt-3 text-xs text-brand hover:underline font-medium"
              >
                Capture first reading →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
