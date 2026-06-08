import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Eye, Clock, X } from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS } from "../../api/mockData";

// Normalize imported MOCK_PATIENTS to the field shape the JSX expects
const normalizePts = (pts) =>
  pts.map((p) => ({
    ...p,
    memberId: p.membershipId ?? p.memberId,
    status: p.latestReading?.status ?? p.status,
    updatedAt: p.latestReading?.timestamp ?? p.updatedAt,
    age: p.dob
      ? Math.floor(
          (Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600000),
        )
      : (p.age ?? null),
    latestReading: p.latestReading
      ? {
          hr: p.latestReading.heartRate ?? p.latestReading.hr,
          spo2: p.latestReading.spo2,
        }
      : null,
  }));

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

const formatTimeAgo = (date) => {
  if (!date) return "—";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

export default function ProviderPatients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (DEV_MODE) {
      setPatients(normalizePts(MOCK_PATIENTS));
      setLoading(false);
      return;
    }

    api
      .get("/patients")
      .then((res) => setPatients(res.data?.patients ?? res.data ?? []))
      .catch(() => setPatients(normalizePts(MOCK_PATIENTS)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q),
    );
  }, [patients, search]);

  if (loading) return <LoadingSpinner message="Loading patients…" />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or ID…"
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 text-xs text-gray-500">
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""} found
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-gray-50/80">
                {[
                  "Patient",
                  "Membership ID",
                  "Age / Gender",
                  "Status",
                  "Last Reading",
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
              {filtered.map((p) => (
                <tr
                  key={p._id}
                  className="hover:bg-blue-50/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                        {getInitials(p.name)}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        {p.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {p.memberId}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {p.age ? `${p.age} yrs` : "—"} · {p.gender || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-4">
                    {p.latestReading ? (
                      <div>
                        <p className="text-xs text-gray-700 font-medium">
                          HR: {p.latestReading.hr} · SpO2:{" "}
                          {p.latestReading.spo2}%
                        </p>
                        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                          <Clock size={11} />
                          <span className="text-[11px]">
                            {formatTimeAgo(p.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No readings</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/provider/capture`)}
                      className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-medium"
                      title="Capture reading"
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Users}
              title="No patients found"
              description={
                search ? `No results for "${search}"` : "No patient records."
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
