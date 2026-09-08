import { createContext, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("smbc_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem("smbc_user");
      localStorage.removeItem("smbc_access_token");
      localStorage.removeItem("smbc_refresh_token");
      return null;
    }
  });

  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("smbc_access_token", data.accessToken);
    localStorage.setItem("smbc_refresh_token", data.refreshToken);
    localStorage.setItem("smbc_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }

  function logout() {
    localStorage.removeItem("smbc_access_token");
    localStorage.removeItem("smbc_refresh_token");
    localStorage.removeItem("smbc_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
