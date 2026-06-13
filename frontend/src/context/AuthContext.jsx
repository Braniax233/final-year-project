import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import api from "../api/axios";
import { MOCK_USERS } from "../api/mockData";

// ── Dev mode switch ────────────────────────────────────────────────────────────
// Set to true to bypass the backend entirely and use mock data.
// Set to false when the real backend + database is ready.
export const DEV_MODE = false;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("vitalx_token");
      const storedUser = localStorage.getItem("vitalx_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (_) {
      localStorage.removeItem("vitalx_token");
      localStorage.removeItem("vitalx_user");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (DEV_MODE) {
      // Match email to a mock user role — password is always accepted
      let mockUser = null;
      if (email.includes("clinician")) mockUser = MOCK_USERS.clinician;
      else if (email.includes("provider")) mockUser = MOCK_USERS.provider;
      else if (email.includes("patient")) mockUser = MOCK_USERS.patient;
      else {
        // Default: any unknown email → clinician (so you can type anything)
        mockUser = { ...MOCK_USERS.clinician, email, name: "Demo Clinician" };
      }

      const fakeToken = "dev_mock_token_" + mockUser.role;
      setToken(fakeToken);
      setUser(mockUser);
      localStorage.setItem("vitalx_token", fakeToken);
      localStorage.setItem("vitalx_user", JSON.stringify(mockUser));
      return mockUser;
    }

    // Real API call (used when DEV_MODE = false)
    const response = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser } = response.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("vitalx_token", newToken);
    localStorage.setItem("vitalx_user", JSON.stringify(newUser));
    return newUser;
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (userData) => {
    const response = await api.post("/auth/register", userData);
    const { token: newToken, user: newUser } = response.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("vitalx_token", newToken);
    localStorage.setItem("vitalx_user", JSON.stringify(newUser));
    return newUser;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("vitalx_token");
    localStorage.removeItem("vitalx_user");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export default AuthContext;
