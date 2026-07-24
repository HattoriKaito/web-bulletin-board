import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { clearToken, getToken, setToken as persistToken } from "../api/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    persistToken(res.access_token);
    setTokenState(res.access_token);
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    // signupのレスポンスもlogin同様アクセストークンを含むため、
    // 登録後に改めてログインAPIを呼ばずそのままログイン状態にできる。
    const res = await authApi.signup(email, password, displayName);
    persistToken(res.access_token);
    setTokenState(res.access_token);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: token !== null, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
