import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from "lucide-react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS } from "../../api/mockData";

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
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
];
const avatarColor = (id = "") =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

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

const PAGE_SIZE = 7;

// ── Add Patient Modal ──────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    memberId: "",
    age: "",
    gender: "Male",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/patients", form);
      onAdded(res.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">
            Add New Patient
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Full Name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field w-full"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field w-full"
                placeholder="patient@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-field w-full"
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Membership ID
              </label>
              <input
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                className="input-field w-full"
                placeholder="VX-009"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Age
              </label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="input-field w-full"
                placeholder="35"
                min="1"
                max="120"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="input-field w-full"
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatientList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filter, setFilter] = useState("ALL"); // ALL | NORMAL | WARNING | CRITICAL
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

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
    let list = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.memberId?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
    }
    if (filter !== "ALL") {
      list = list.filter((p) => (p.status || "").toUpperCase() === filter);
    }
    return list;
  }, [patients, search, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdded = (newPatient) => {
    setPatients((prev) => [newPatient, ...prev]);
  };

  if (loading) return <LoadingSpinner message="Loading patients…" />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, ID, or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {["ALL", "NORMAL", "WARNING", "CRITICAL"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/20 whitespace-nowrap"
        >
          <Plus size={15} /> Add Patient
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/80">
                {[
                  "Patient",
                  "Membership ID",
                  "Age / Gender",
                  "Assigned To",
                  "Status",
                  "Last Reading",
                  "Actions",
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
              {paged.map((patient) => (
                <tr
                  key={patient._id}
                  className="hover:bg-blue-50/20 transition-colors group"
                >
                  {/* Patient */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(patient._id)}`}
                      >
                        {getInitials(patient.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {patient.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-[140px]">
                          {patient.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Membership ID */}
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {patient.memberId || "—"}
                    </span>
                  </td>

                  {/* Age / Gender */}
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.age ? `${patient.age} yrs` : "—"} ·{" "}
                    {patient.gender || "—"}
                  </td>

                  {/* Assigned */}
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.assignedClinician ||
                      patient.clinician?.name ||
                      "—"}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <StatusBadge status={patient.status} />
                  </td>

                  {/* Last Reading */}
                  <td className="px-6 py-4">
                    {patient.latestReading ? (
                      <div>
                        <p className="text-xs text-gray-700 font-medium">
                          HR: {patient.latestReading.hr} · SpO2:{" "}
                          {patient.latestReading.spo2}%
                        </p>
                        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                          <Clock size={11} />
                          <span className="text-[11px]">
                            {formatTimeAgo(patient.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        No readings yet
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          navigate(`/clinician/patients/${patient._id}`)
                        }
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors"
                        title="View"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paged.length === 0 && (
            <EmptyState
              icon={Users}
              title="No patients found"
              description={
                search
                  ? `No results for "${search}"`
                  : "No patients match the selected filter."
              }
            />
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    n === page
                      ? "bg-brand text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
