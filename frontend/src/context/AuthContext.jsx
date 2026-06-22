/**
 * context/AuthContext.jsx
 * Authentication context — login DISABLED for main-feature demo.
 *
 * A default clinician user is injected on mount so every page that
 * calls useAuth() receives a valid user object without requiring login.
 *
 * Re-enable real auth later by restoring the API-based login/register flow.
 */

import { createContext, useState, useContext, useCallback } from "react";

// ── Dev mode — set false to hit the real backend API ──────────────────────────
export const DEV_MODE = false;

// ── Default user injected when auth is disabled ────────────────────────────────
const DEFAULT_USER = {
  _id: "000000000000000000000000",
  name: "Demo Clinician",
  email: "demo@vitalx.com",
  role: "clinician",
  isActive: true,
};

const DEFAULT_TOKEN = "demo_token_no_auth";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEFAULT_USER);
  const [token, setToken] = useState(DEFAULT_TOKEN);

  // login / logout / register are kept so existing call-sites don't break
  const login = useCallback(async (_email, _password) => {
    // Auth disabled — just return the default user
    return DEFAULT_USER;
  }, []);

  const register = useCallback(async (_userData) => {
    return DEFAULT_USER;
  }, []);

  const logout = useCallback(() => {
    // No-op while auth is disabled
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: true,
        loading: false,
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
