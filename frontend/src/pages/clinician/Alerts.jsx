import { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  Clock,
  User,
  Bell,
} from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { DEV_MODE } from "../../context/AuthContext";
import { MOCK_ALERTS } from "../../api/mockData";

const formatTimeAgo = (d) => {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

// Normalize imported MOCK_ALERTS to the field shape the JSX expects
const normalizeAlerts = (alts) =>
  alts.map((a) => ({
    ...a,
    type: a.message ?? a.type,
    memberId: a.membershipId ?? a.memberId,
    hr: a.heartRate ?? a.hr,
    location: a.gpsCoordinates ?? a.location ?? null,
    status: a.status ?? (a.resolvedAt ? "resolved" : "unresolved"),
    createdAt: a.timestamp ?? a.createdAt,
  }));

const FILTER_TABS = [
  { key: "all", label: "All Alerts" },
  { key: "CRITICAL", label: "Critical" },
  { key: "WARNING", label: "Warning" },
  { key: "resolved", label: "Resolved" },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [resolving, setResolving] = useState(null);

  useEffect(() => {
    if (DEV_MODE) {
      setAlerts(normalizeAlerts(MOCK_ALERTS));
      setLoading(false);
      return;
    }

    api
      .get("/alerts")
      .then((res) => setAlerts(res.data?.alerts ?? res.data ?? []))
      .catch(() => setAlerts(normalizeAlerts(MOCK_ALERTS)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    if (filter === "resolved")
      return alerts.filter((a) => a.status === "resolved");
    return alerts.filter(
      (a) =>
        (a.severity || "").toUpperCase() === filter && a.status !== "resolved",
    );
  }, [alerts, filter]);

  const handleResolve = async (alertId) => {
    setResolving(alertId);
    if (!DEV_MODE) {
      try {
        await api.put(`/alerts/${alertId}/resolve`);
      } catch {
        /* optimistic update */
      }
    }
    setAlerts((prev) =>
      prev.map((a) => (a._id === alertId ? { ...a, status: "resolved" } : a)),
    );
    setResolving(null);
  };

  const counts = {
    all: alerts.length,
    CRITICAL: alerts.filter(
      (a) =>
        (a.severity || "").toUpperCase() === "CRITICAL" &&
        a.status !== "resolved",
    ).length,
    WARNING: alerts.filter(
      (a) =>
        (a.severity || "").toUpperCase() === "WARNING" &&
        a.status !== "resolved",
    ).length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  if (loading) return <LoadingSpinner message="Loading alerts…" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Alerts & Notifications
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {counts.CRITICAL + counts.WARNING} unresolved alerts
          </p>
        </div>
        {counts.CRITICAL + counts.WARNING > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl">
            <Bell size={14} className="animate-pulse" />
            <span className="font-semibold">
              {counts.CRITICAL + counts.WARNING} require attention
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? counts.all
              : tab.key === "resolved"
                ? counts.resolved
                : counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filter === tab.key
                      ? tab.key === "CRITICAL"
                        ? "bg-red-100 text-red-600"
                        : tab.key === "WARNING"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-gray-200 text-gray-600"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const isCritical =
            (alert.severity || "").toUpperCase() === "CRITICAL";
          const isResolved = alert.status === "resolved";

          return (
            <div
              key={alert._id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                isResolved
                  ? "border-gray-100 opacity-70"
                  : isCritical
                    ? "border-red-200"
                    : "border-amber-200"
              }`}
            >
              {/* Severity left bar */}
              <div className="flex">
                <div
                  className={`w-1 flex-shrink-0 ${
                    isResolved
                      ? "bg-gray-300"
                      : isCritical
                        ? "bg-red-500"
                        : "bg-amber-500"
                  }`}
                />

                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left info */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl flex-shrink-0 ${
                          isResolved
                            ? "bg-gray-100"
                            : isCritical
                              ? "bg-red-100"
                              : "bg-amber-100"
                        }`}
                      >
                        <AlertCircle
                          size={16}
                          className={
                            isResolved
                              ? "text-gray-400"
                              : isCritical
                                ? "text-red-500"
                                : "text-amber-500"
                          }
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {alert.type}
                          </p>
                          <StatusBadge
                            status={isResolved ? "RESOLVED" : alert.severity}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <User size={12} className="text-gray-400" />
                          <p className="text-xs text-gray-600 font-medium">
                            {alert.patientName}
                          </p>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs font-mono text-gray-400">
                            {alert.memberId}
                          </span>
                        </div>
                        {/* Vitals */}
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-400 rounded-full" />
                            <span className="font-mono font-semibold text-gray-700">
                              HR: {alert.hr} bpm
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-blue-400 rounded-full" />
                            <span className="font-mono font-semibold text-gray-700">
                              SpO2: {alert.spo2}%
                            </span>
                          </span>
                          {alert.location && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <MapPin size={11} />
                              <span>
                                {alert.location.lat.toFixed(4)}°,{" "}
                                {alert.location.lng.toFixed(4)}°
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: time + action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        <Clock size={11} />
                        <span>{formatTimeAgo(alert.createdAt)}</span>
                      </div>
                      {!isResolved && (
                        <button
                          onClick={() => handleResolve(alert._id)}
                          disabled={resolving === alert._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle size={12} />
                          {resolving === alert._id ? "Resolving…" : "Resolve"}
                        </button>
                      )}
                      {isResolved && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle size={12} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No alerts found"
          description={
            filter === "all"
              ? "All clear! No alerts in the system."
              : `No ${filter.toLowerCase()} alerts at this time.`
          }
        />
      )}
    </div>
  );
}
