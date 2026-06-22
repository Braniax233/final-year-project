import { Routes, Route, Navigate } from "react-router-dom";

// Layouts
import ClinicianLayout from "./layouts/ClinicianLayout";
import ProviderLayout from "./layouts/ProviderLayout";
import PatientLayout from "./layouts/PatientLayout";

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

export default function App() {
  return (
    <Routes>
      {/* Default → clinician dashboard */}
      <Route
        path="/"
        element={<Navigate to="/clinician/dashboard" replace />}
      />

      {/* ── Clinician ───────────────────────────────────────────────────────── */}
      <Route path="/clinician" element={<ClinicianLayout />}>
        <Route index element={<Navigate to="/clinician/dashboard" replace />} />
        <Route path="dashboard" element={<ClinicianDashboard />} />
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<ClinicianSettings />} />
      </Route>

      {/* ── Provider ────────────────────────────────────────────────────────── */}
      <Route path="/provider" element={<ProviderLayout />}>
        <Route index element={<Navigate to="/provider/dashboard" replace />} />
        <Route path="dashboard" element={<ProviderDashboard />} />
        <Route path="capture" element={<CaptureReading />} />
        <Route path="patients" element={<ProviderPatients />} />
      </Route>

      {/* ── Patient ─────────────────────────────────────────────────────────── */}
      <Route path="/patient" element={<PatientLayout />}>
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="history" element={<PatientHistory />} />
      </Route>

      {/* Catch-all → clinician dashboard */}
      <Route
        path="*"
        element={<Navigate to="/clinician/dashboard" replace />}
      />
    </Routes>
  );
}
