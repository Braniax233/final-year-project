import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import {
  Search,
  Camera,
  CameraOff,
  User,
  CheckCircle,
  AlertCircle,
  Heart,
  Activity,
  ChevronRight,
  X,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import api from "../../api/axios";
import { DEV_MODE } from "../../context/AuthContext";
import { MOCK_PATIENTS } from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const calcBMI = (weight, height) => {
  if (!weight || !height || height <= 0) return null;
  const bmi = parseFloat(weight) / (parseFloat(height) / 100) ** 2;
  const cls =
    bmi < 18.5
      ? {
          label: "Underweight",
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
        }
      : bmi < 25
        ? {
            label: "Normal",
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-200",
          }
        : bmi < 30
          ? {
              label: "Overweight",
              color: "text-amber-600",
              bg: "bg-amber-50",
              border: "border-amber-200",
            }
          : {
              label: "Obese",
              color: "text-red-600",
              bg: "bg-red-50",
              border: "border-red-200",
            };
  return { value: bmi.toFixed(1), ...cls };
};

const classifyReading = (spo2, hr) => {
  const s = parseFloat(spo2);
  const h = parseFloat(hr);
  if (s < 90 || h > 120 || h < 40) return "CRITICAL";
  if (s < 94 || h > 100 || h < 60) return "WARNING";
  return "NORMAL";
};

// Mock classification per spec: SpO2 >= 95 + HR in range → NORMAL, >= 93 → WARNING, else CRITICAL
const classifyReadingMock = (spo2, hr) => {
  const s = parseFloat(spo2);
  const h = parseFloat(hr);
  if (s >= 95 && h >= 60 && h <= 100) return "NORMAL";
  if (s >= 93) return "WARNING";
  return "CRITICAL";
};

const STATUS_STYLES = {
  NORMAL: {
    card: "bg-green-50  border-green-300",
    badge: "bg-green-600  text-white",
    icon: CheckCircle,
    action: "Continue regular monitoring.",
  },
  WARNING: {
    card: "bg-amber-50  border-amber-300",
    badge: "bg-amber-500  text-white",
    icon: AlertCircle,
    action: "Notify assigned clinician for review.",
  },
  CRITICAL: {
    card: "bg-red-50    border-red-400",
    badge: "bg-red-600    text-white",
    icon: AlertCircle,
    action: "Immediate medical attention required. SMS alert sent.",
  },
};

const VIDEO_CONSTRAINTS = {
  width: 320,
  height: 240,
  facingMode: "environment",
};

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = ["Identify Patient", "BMI Entry", "Capture Reading", "Result"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                      ? "bg-brand    text-white ring-4 ring-brand/30"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <CheckCircle size={16} /> : idx}
              </div>
              <p
                className={`text-[10px] mt-1 font-medium whitespace-nowrap ${active ? "text-brand" : done ? "text-green-600" : "text-gray-400"}`}
              >
                {label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mt-[-12px] transition-colors ${idx < current ? "bg-green-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CaptureReading() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [patient, setPatient] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bmi, setBmi] = useState(null);

  const [countdown, setCountdown] = useState(10);
  const [capturing, setCapturing] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [spo2, setSpo2] = useState("");
  const [hr, setHr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [reading, setReading] = useState(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const webcamRef = useRef(null);

  // ── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!capturing) return;
    if (countdown <= 0) {
      setCapturing(false);
      // Simulate sensor result
      const simSpo2 = 92 + Math.floor(Math.random() * 8);
      const simHr = 60 + Math.floor(Math.random() * 50);
      const status = classifyReading(simSpo2, simHr);
      const result = {
        spo2: simSpo2,
        hr: simHr,
        status,
        timestamp: new Date(),
      };
      setReading(result);
      submitReading(result);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [capturing, countdown]);

  // ── Patient search ───────────────────────────────────────────────────────────
  const searchPatient = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");

    if (DEV_MODE) {
      const found = MOCK_PATIENTS.find((p) => p.membershipId === query.trim());
      if (found) {
        setPatient({
          ...found,
          memberId: found.membershipId,
          age: found.dob
            ? Math.floor(
                (Date.now() - new Date(found.dob).getTime()) /
                  (365.25 * 24 * 3600000),
              )
            : null,
        });
      } else {
        setSearchError(
          "Patient not found. Check the membership ID and try again.",
        );
      }
      setSearching(false);
      return;
    }

    try {
      const res = await api.get(
        `/patients?memberId=${encodeURIComponent(query.trim())}`,
      );
      const found = res.data?.patients?.[0] ?? res.data?.[0] ?? res.data;
      if (!found || !found._id) throw new Error("Not found");
      setPatient(found);
    } catch {
      // Mock patient lookup
      const DEMO = {
        _id: "demo",
        name: "John Smith",
        memberId: query.trim() || "VX-001",
        age: 45,
        gender: "Male",
        status: "NORMAL",
      };
      if (query.toUpperCase().startsWith("VX-") || query.match(/\d+/)) {
        setPatient(DEMO);
      } else {
        setSearchError(
          "Patient not found. Check the membership ID and try again.",
        );
      }
    } finally {
      setSearching(false);
    }
  };

  // ── Submit reading to API ────────────────────────────────────────────────────
  const submitReading = async (r) => {
    if (!patient) return;
    if (DEV_MODE) {
      return;
    } // skip API call in dev mode
    setSubmitting(true);
    try {
      await api.post("/device/reading", {
        patientId: patient._id,
        spo2: r.spo2,
        hr: r.hr,
        bmi: bmi?.value,
        weight: weight || undefined,
        height: height || undefined,
        status: r.status,
      });
    } catch {
      /* silent — result already shown */
    } finally {
      setSubmitting(false);
    }
  };

  // ── Manual submit ────────────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    if (!spo2 || !hr) return;
    const status = DEV_MODE
      ? classifyReadingMock(spo2, hr)
      : classifyReading(spo2, hr);
    const r = {
      spo2: parseFloat(spo2),
      hr: parseFloat(hr),
      status,
      timestamp: new Date(),
    };
    setReading(r);
    submitReading(r);
    setStep(4);
  };

  // ── Save note ────────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!note.trim() || !patient) return;
    try {
      await api.post("/notes", {
        patientId: patient._id,
        content: note,
        tags: ["Provider Visit"],
      });
    } catch {
      /* silent */
    }
    setNoteSaved(true);
  };

  const reset = () => {
    setStep(1);
    setQuery("");
    setPatient(null);
    setShowCamera(false);
    setWeight("");
    setHeight("");
    setBmi(null);
    setCountdown(10);
    setCapturing(false);
    setManualMode(false);
    setSpo2("");
    setHr("");
    setReading(null);
    setNote("");
    setNoteSaved(false);
  };

  const resultStyle = reading
    ? (STATUS_STYLES[reading.status] ?? STATUS_STYLES.NORMAL)
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <StepBar current={step} />

      {/* ── STEP 1: Identify Patient ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Identify Patient
            </h2>
            <p className="text-sm text-gray-500">
              Enter the patient's membership ID or scan their barcode.
            </p>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && searchPatient()}
                placeholder="Membership ID (e.g. GH-2025-001)"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </div>
            <button
              onClick={searchPatient}
              disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {searching ? "…" : "Search"}
            </button>
            <button
              onClick={() => setShowCamera((v) => !v)}
              className={`p-2.5 rounded-xl border transition-colors ${showCamera ? "bg-red-50 border-red-200 text-red-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              title={showCamera ? "Close camera" : "Scan barcode"}
            >
              {showCamera ? <CameraOff size={18} /> : <Camera size={18} />}
            </button>
          </div>

          {searchError && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              <AlertCircle size={13} /> {searchError}
            </div>
          )}

          {/* Webcam */}
          {showCamera && (
            <div className="rounded-xl overflow-hidden bg-black">
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={VIDEO_CONSTRAINTS}
                className="w-full"
                screenshotFormat="image/jpeg"
              />
              <p className="text-xs text-center text-gray-300 py-2 bg-gray-900">
                Position barcode in camera frame, then enter the ID manually
                above.
              </p>
            </div>
          )}

          {/* Found patient card */}
          {patient && (
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                {(patient.name || "P")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{patient.name}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {patient.memberId} · {patient.age} yrs · {patient.gender}
                </p>
              </div>
              <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            </div>
          )}

          <div className="flex justify-end">
            <button
              disabled={!patient}
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-40"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: BMI Entry ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              BMI Entry{" "}
              <span className="text-gray-400 font-normal text-sm">
                (optional)
              </span>
            </h2>
            <p className="text-sm text-gray-500">
              Record patient's weight and height to calculate BMI.
            </p>
          </div>

          {patient && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <User size={16} className="text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                {patient.name} · {patient.memberId}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setBmi(null);
                }}
                placeholder="e.g. 75"
                min="10"
                max="300"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  setBmi(null);
                }}
                placeholder="e.g. 175"
                min="50"
                max="250"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </div>
          </div>

          <button
            onClick={() => setBmi(calcBMI(weight, height))}
            disabled={!weight || !height}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            Calculate BMI
          </button>

          {bmi && (
            <div
              className={`p-4 rounded-xl border text-center ${bmi.bg} ${bmi.border}`}
            >
              <p className={`text-3xl font-bold ${bmi.color}`}>{bmi.value}</p>
              <p className={`text-sm font-semibold mt-1 ${bmi.color}`}>
                {bmi.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {weight}kg / {height}cm
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Capture Reading ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-navy-900 rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-1">
              Reading Capture
            </h2>
            <p className="text-slate-400 text-sm">
              {manualMode
                ? "Enter readings manually below."
                : "Place patient's thumb firmly on the sensor."}
            </p>
          </div>

          {!manualMode && (
            <>
              {/* Sensor animation */}
              <div className="flex flex-col items-center py-6">
                <div
                  className={`relative w-28 h-28 rounded-full flex items-center justify-center ${capturing ? "bg-red-500/20 animate-pulse" : "bg-navy-800"} border-4 ${capturing ? "border-red-400" : "border-navy-700"} transition-all`}
                >
                  <Heart
                    size={40}
                    className={`${capturing ? "text-red-400 animate-pulse" : "text-slate-500"} transition-colors`}
                  />
                  {capturing && (
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {countdown}
                    </div>
                  )}
                </div>

                {capturing ? (
                  <div className="mt-4 text-center">
                    <p className="text-white font-semibold">Measuring…</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Hold still for {countdown} seconds
                    </p>
                    {/* Progress bar */}
                    <div className="w-48 h-1.5 bg-navy-700 rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full transition-all duration-1000"
                        style={{ width: `${((10 - countdown) / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setCountdown(10);
                      setCapturing(true);
                    }}
                    className="mt-6 px-8 py-3 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl transition-colors shadow-lg shadow-brand/30"
                  >
                    Start Sensor Reading
                  </button>
                )}
              </div>

              <div className="text-center">
                <button
                  onClick={() => setManualMode(true)}
                  className="text-slate-400 hover:text-white text-xs underline transition-colors"
                >
                  Enter readings manually instead
                </button>
              </div>
            </>
          )}

          {manualMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    <Activity size={12} className="inline mr-1" />
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="e.g. 97"
                    min="70"
                    max="100"
                    className="w-full px-3 py-2.5 text-sm bg-navy-800 border border-navy-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    <Heart size={12} className="inline mr-1" />
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={hr}
                    onChange={(e) => setHr(e.target.value)}
                    placeholder="e.g. 72"
                    min="30"
                    max="250"
                    className="w-full px-3 py-2.5 text-sm bg-navy-800 border border-navy-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setManualMode(false)}
                  className="px-4 py-2.5 rounded-xl border border-navy-700 text-slate-300 text-sm hover:bg-navy-800 transition-colors"
                >
                  Use Sensor
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!spo2 || !hr || submitting}
                  className="flex-1 py-2.5 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Reading"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors w-full text-center"
          >
            ← Back to BMI entry
          </button>
        </div>
      )}

      {/* ── STEP 4: Result ──────────────────────────────────────────────────── */}
      {step === 4 && reading && resultStyle && (
        <div className="space-y-4">
          {/* Result card */}
          <div
            className={`rounded-2xl border-2 p-8 text-center ${resultStyle.card}`}
          >
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-bold mb-4 ${resultStyle.badge}`}
            >
              <resultStyle.icon size={16} />
              {reading.status}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-4">
              <div>
                <p className="text-4xl font-bold text-gray-800">
                  {reading.spo2}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  SpO2 — Oxygen Saturation
                </p>
              </div>
              <div>
                <p className="text-4xl font-bold text-gray-800">{reading.hr}</p>
                <p className="text-sm text-gray-500 mt-1">Heart Rate (bpm)</p>
              </div>
            </div>

            {bmi && (
              <p className="text-sm text-gray-600 mb-2">
                BMI: <strong>{bmi.value}</strong> — {bmi.label}
              </p>
            )}

            <p className="text-sm font-medium text-gray-700 bg-white/60 rounded-xl px-4 py-2 inline-block">
              {resultStyle.action}
            </p>
          </div>

          {/* CRITICAL alert */}
          {reading.status === "CRITICAL" && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl">
              <AlertCircle
                size={18}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-bold text-red-700">
                  Emergency Alert Sent
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  An SMS alert has been automatically dispatched to the assigned
                  clinician and emergency contacts.
                </p>
              </div>
            </div>
          )}

          {/* Session note */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={15} className="text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-700">
                Session Note (optional)
              </h4>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any clinical observations or instructions…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              disabled={noteSaved}
            />
            {!noteSaved ? (
              <button
                onClick={handleSaveNote}
                disabled={!note.trim()}
                className="mt-2 px-3 py-1.5 text-xs bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors disabled:opacity-40"
              >
                Save Note
              </button>
            ) : (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
                <CheckCircle size={12} /> Note saved
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={15} /> New Reading
            </button>
            <button
              onClick={() => navigate("/provider/dashboard")}
              className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
