import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Building2,
  Home,
  Stethoscope,
  UserCheck,
  LogIn,
  UserPlus,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Heart,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ── Constants ──────────────────────────────────────────────────────────────────
const ROLE_LABELS = { doctor: "Doctor", nurse: "Nurse", home: "Patient" };
const ROLE_BACKEND = {
  doctor: "clinician",
  nurse: "provider",
  home: "patient",
};
const ROLE_HOME_PATH = {
  clinician: "/clinician/dashboard",
  provider: "/provider/dashboard",
  patient: "/patient/dashboard",
};

// ── Shared style fragments ─────────────────────────────────────────────────────
const inputClass =
  "bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors";
const labelClass = "text-slate-400 text-sm mb-1 block";

// ── Animated circle card ───────────────────────────────────────────────────────
function CircleCard({
  icon: Icon,
  label,
  subtitle,
  gradient,
  onClick,
  delay = 0,
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-4 cursor-pointer focus:outline-none"
    >
      {/* Pulsing ring */}
      <div
        className={`absolute w-52 h-52 rounded-full ${gradient} opacity-20 animate-ping-ring`}
        style={{ animationDelay: `${delay + 0.3}s` }}
      />
      {/* Main circle */}
      <div
        className={`relative w-44 h-44 rounded-full ${gradient} flex flex-col items-center justify-center shadow-2xl
          transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(59,130,246,0.4)]
          animate-float`}
        style={{ animationDelay: `${delay}s` }}
      >
        <Icon size={52} className="text-white" strokeWidth={1.5} />
        <span className="text-white font-bold text-base mt-2">{label}</span>
      </div>
      {subtitle && <span className="text-slate-400 text-sm">{subtitle}</span>}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Step machine
  const [step, setStep] = useState("context"); // context | role | auth | form
  const [visible, setVisible] = useState(true);
  const [uiRole, setUiRole] = useState(null); // 'doctor' | 'nurse' | 'home'
  const [authMode, setAuthMode] = useState(null); // 'signin' | 'signup'

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    department: "",
    dob: "",
    gender: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(ROLE_HOME_PATH[user.role] ?? "/login", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // ── Step transitions ─────────────────────────────────────────────────────────
  const goToStep = (nextStep) => {
    setVisible(false);
    setTimeout(() => {
      setStep(nextStep);
      setError("");
      setVisible(true);
    }, 200);
  };

  const handleBack = () => {
    if (step === "role") goToStep("context");
    else if (step === "auth") goToStep(uiRole === "home" ? "context" : "role");
    else if (step === "form") goToStep("auth");
  };

  const handleContextSelect = (type) => {
    if (type === "hospital") {
      goToStep("role");
    } else {
      setUiRole("home");
      goToStep("auth");
    }
  };

  const handleRoleSelect = (role) => {
    setUiRole(role);
    goToStep("auth");
  };

  const handleAuthMode = (mode) => {
    setAuthMode(mode);
    goToStep("form");
  };

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (authMode === "signin") {
      if (!form.email.trim() || !form.password.trim()) {
        setError("Please enter your email and password.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const loggedUser = await login(form.email.trim(), form.password);
        navigate(ROLE_HOME_PATH[loggedUser?.role] ?? "/login", {
          replace: true,
        });
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Invalid credentials. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    } else {
      if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
        setError("Please fill in all required fields.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (form.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const userData = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: ROLE_BACKEND[uiRole],
          ...(form.phone && { phone: form.phone.trim() }),
          ...(uiRole !== "home" &&
            form.department && { department: form.department.trim() }),
          ...(uiRole === "home" && form.dob && { dob: form.dob }),
          ...(uiRole === "home" && form.gender && { gender: form.gender }),
        };
        const newUser = await register(userData);
        navigate(ROLE_HOME_PATH[newUser?.role] ?? "/login", { replace: true });
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Registration failed. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  // ── Role icon ────────────────────────────────────────────────────────────────
  const RoleIcon =
    uiRole === "doctor" ? Stethoscope : uiRole === "nurse" ? UserCheck : Heart;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0f172a] to-[#1a1f35] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 w-[520px] h-[520px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] bg-indigo-600/5 rounded-full blur-[140px]" />
      </div>

      {/* Logo */}
      <div className="absolute top-6 left-8 flex items-center gap-2.5 z-10">
        <div className="relative">
          <div className="p-2 bg-brand rounded-xl">
            <Activity size={18} className="text-white" />
          </div>
          <div className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full">
            <Heart size={6} className="text-white fill-white" />
          </div>
        </div>
        <div>
          <span className="text-white font-bold text-lg leading-none">
            Vital X
          </span>
          <p className="text-blue-400 text-[10px] font-medium tracking-widest uppercase leading-none mt-0.5">
            MediMonitor
          </p>
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4">
        <div
          className={`transition-all duration-200 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {/* Back button */}
          {step !== "context" && (
            <button
              onClick={handleBack}
              className="mb-10 flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
            >
              <ArrowLeft
                size={16}
                className="group-hover:-translate-x-1 transition-transform"
              />
              <span className="text-sm">Back</span>
            </button>
          )}

          {/* ── STEP 1: context ─────────────────────────────────────────────── */}
          {step === "context" && (
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-3">
                How will you use Vital X?
              </h1>
              <p className="text-slate-400 text-lg mb-16">
                Choose your access type to get started
              </p>
              <div className="flex items-start justify-center gap-16 flex-wrap">
                <CircleCard
                  icon={Building2}
                  label="Hospital"
                  subtitle="For medical staff"
                  gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                  onClick={() => handleContextSelect("hospital")}
                  delay={0}
                />
                <CircleCard
                  icon={Home}
                  label="Home"
                  subtitle="For patients"
                  gradient="bg-gradient-to-br from-teal-400 to-emerald-600"
                  onClick={() => handleContextSelect("home")}
                  delay={0.2}
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: role ─────────────────────────────────────────────────── */}
          {step === "role" && (
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-3">
                What is your role?
              </h1>
              <p className="text-slate-400 text-lg mb-16">
                Select your position at the hospital
              </p>
              <div className="flex items-start justify-center gap-16 flex-wrap">
                <CircleCard
                  icon={Stethoscope}
                  label="Doctor"
                  subtitle="Clinician & monitoring"
                  gradient="bg-gradient-to-br from-blue-500 to-blue-700"
                  onClick={() => handleRoleSelect("doctor")}
                  delay={0}
                />
                <CircleCard
                  icon={UserCheck}
                  label="Nurse"
                  subtitle="Reading capture"
                  gradient="bg-gradient-to-br from-purple-500 to-purple-700"
                  onClick={() => handleRoleSelect("nurse")}
                  delay={0.2}
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: auth ──────────────────────────────────────────────────── */}
          {step === "auth" && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <RoleIcon size={36} className="text-blue-400" />
                <h1 className="text-4xl font-bold text-white">
                  Welcome, {ROLE_LABELS[uiRole]}
                </h1>
              </div>
              <p className="text-slate-400 text-lg mb-12">
                Sign in to your account or create a new one
              </p>

              <div className="flex items-stretch justify-center gap-6 flex-wrap">
                {/* Sign In card */}
                <button
                  onClick={() => handleAuthMode("signin")}
                  className="group relative w-64 bg-white/5 border border-white/10 rounded-2xl p-8 text-left
                    hover:bg-white/10 hover:border-white/20
                    transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none"
                >
                  <div className="p-3 bg-slate-700/60 rounded-xl w-fit mb-4 group-hover:bg-slate-700 transition-colors">
                    <Lock size={26} className="text-blue-400" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">Sign In</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Access your existing account
                  </p>
                  <div className="absolute inset-0 rounded-2xl border border-blue-500/0 group-hover:border-blue-500/30 transition-colors pointer-events-none" />
                </button>

                {/* Sign Up card */}
                <button
                  onClick={() => handleAuthMode("signup")}
                  className="group relative w-64 bg-gradient-to-br from-blue-600/25 to-indigo-600/25 border border-blue-500/30 rounded-2xl p-8 text-left
                    hover:from-blue-600/35 hover:to-indigo-600/35 hover:border-blue-400/50
                    transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 focus:outline-none"
                >
                  <div className="p-3 bg-blue-600/40 rounded-xl w-fit mb-4 group-hover:bg-blue-600/60 transition-colors">
                    <UserPlus size={26} className="text-blue-300" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">Sign Up</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Create a new account
                  </p>
                  <div className="absolute inset-0 rounded-2xl border border-blue-400/0 group-hover:border-blue-400/40 transition-colors pointer-events-none" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: form ──────────────────────────────────────────────────── */}
          {step === "form" && (
            <div className="max-w-md mx-auto">
              <h1 className="text-3xl font-bold text-white mb-1">
                {authMode === "signin" ? "Sign In" : "Create Account"}
              </h1>
              <p className="text-slate-400 mb-8">{ROLE_LABELS[uiRole]}</p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* ── Sign In fields ─────────────────────────────────────────── */}
                {authMode === "signin" && (
                  <>
                    <div>
                      <label className={labelClass}>Email address</label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={updateField("email")}
                          placeholder="you@example.com"
                          disabled={loading}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Password</label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type={showPwd ? "text" : "password"}
                          autoComplete="current-password"
                          value={form.password}
                          onChange={updateField("password")}
                          placeholder="••••••••"
                          disabled={loading}
                          className={`${inputClass} pl-11 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Sign Up fields ─────────────────────────────────────────── */}
                {authMode === "signup" && (
                  <>
                    {/* Full Name */}
                    <div>
                      <label className={labelClass}>Full Name *</label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type="text"
                          autoComplete="name"
                          value={form.name}
                          onChange={updateField("name")}
                          placeholder="John Doe"
                          disabled={loading}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className={labelClass}>Email address *</label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={updateField("email")}
                          placeholder="you@example.com"
                          disabled={loading}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className={labelClass}>Password *</label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type={showPwd ? "text" : "password"}
                          autoComplete="new-password"
                          value={form.password}
                          onChange={updateField("password")}
                          placeholder="••••••••"
                          disabled={loading}
                          className={`${inputClass} pl-11 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className={labelClass}>Confirm Password *</label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type={showConfirmPwd ? "text" : "password"}
                          autoComplete="new-password"
                          value={form.confirmPassword}
                          onChange={updateField("confirmPassword")}
                          placeholder="••••••••"
                          disabled={loading}
                          className={`${inputClass} pl-11 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPwd((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirmPwd ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className={labelClass}>
                        Phone {uiRole === "home" ? "*" : "(optional)"}
                      </label>
                      <div className="relative">
                        <Phone
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={updateField("phone")}
                          placeholder="+1 (555) 000-0000"
                          disabled={loading}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>

                    {/* Hospital staff: Department */}
                    {(uiRole === "doctor" || uiRole === "nurse") && (
                      <div>
                        <label className={labelClass}>
                          Department / Ward (optional)
                        </label>
                        <input
                          type="text"
                          value={form.department}
                          onChange={updateField("department")}
                          placeholder="e.g. Cardiology, ICU"
                          disabled={loading}
                          className={inputClass}
                        />
                      </div>
                    )}

                    {/* Patient: DOB + Gender */}
                    {uiRole === "home" && (
                      <>
                        <div>
                          <label className={labelClass}>Date of Birth</label>
                          <div className="relative">
                            <Calendar
                              size={16}
                              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                            />
                            <input
                              type="date"
                              value={form.dob}
                              onChange={updateField("dob")}
                              disabled={loading}
                              className={`${inputClass} pl-11`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>Gender</label>
                          <select
                            value={form.gender}
                            onChange={updateField("gender")}
                            disabled={loading}
                            className={`${inputClass} appearance-none`}
                          >
                            <option value="" className="bg-slate-900">
                              Select gender
                            </option>
                            <option value="male" className="bg-slate-900">
                              Male
                            </option>
                            <option value="female" className="bg-slate-900">
                              Female
                            </option>
                            <option value="other" className="bg-slate-900">
                              Other
                            </option>
                          </select>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Error message */}
                {error && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl
                    transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2 shadow-lg shadow-brand/30 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {authMode === "signin"
                        ? "Signing in…"
                        : "Creating account…"}
                    </>
                  ) : (
                    <>
                      {authMode === "signin" ? (
                        <LogIn size={16} />
                      ) : (
                        <UserPlus size={16} />
                      )}
                      {authMode === "signin" ? "Sign In" : "Create Account"}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-600 text-xs whitespace-nowrap">
        © {new Date().getFullYear()} Vital X — Secure Medical IoT Platform
      </p>
    </div>
  );
}
