import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layouts
import ClinicianLayout from "./layouts/ClinicianLayout";
import ProviderLayout from "./layouts/ProviderLayout";
import PatientLayout from "./layouts/PatientLayout";

// Public
import LoginPage from "./pages/LoginPage";

// Clinician pages
import ClinicianDashboard from "./pages/clinician/Dashboard";
import PatientList from "./pages/clinician/PatientList";
import PatientDetail from "./pages/clinician/PatientDetail";
import Alerts from "./pages/clinician/Alerts";
import Reports from "./pages/clinician/Reports";
import ClinicianSettings from "./pages/clinician/Settings";

// Provider pages
import ProviderDashboard from "./pages/provider/Dashboard";
import CaptureReading from "./pages/provider/CaptureReading";
import ProviderPatients from "./pages/provider/Patients";

// Patient pages
import PatientDashboard from "./pages/patient/Dashboard";
import PatientHistory from "./pages/patient/History";

// Shared
import LoadingSpinner from "./components/LoadingSpinner";

// ── Protected route guard ─────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user?.role && !roles.includes(user.role)) {
    // Redirect to the correct dashboard for their actual role
    const roleHome = {
      clinician: "/clinician/dashboard",
      provider: "/provider/dashboard",
      patient: "/patient/dashboard",
    };
    return <Navigate to={roleHome[user.role] ?? "/login"} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Default: redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Clinician ─────────────────────────────────────────────────────── */}
      <Route
        path="/clinician"
        element={
          <ProtectedRoute roles={["clinician"]}>
            <ClinicianLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/clinician/dashboard" replace />} />
        <Route path="dashboard" element={<ClinicianDashboard />} />
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<ClinicianSettings />} />
      </Route>

      {/* ── Provider ──────────────────────────────────────────────────────── */}
      <Route
        path="/provider"
        element={
          <ProtectedRoute roles={["provider"]}>
            <ProviderLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/provider/dashboard" replace />} />
        <Route path="dashboard" element={<ProviderDashboard />} />
        <Route path="capture" element={<CaptureReading />} />
        <Route path="patients" element={<ProviderPatients />} />
      </Route>

      {/* ── Patient ───────────────────────────────────────────────────────── */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute roles={["patient"]}>
            <PatientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="history" element={<PatientHistory />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
