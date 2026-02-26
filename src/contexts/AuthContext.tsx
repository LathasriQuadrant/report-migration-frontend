import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types/migration";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const BACKEND_BASE_URL = "https://accesstokens-aecjbzaqaqcuh6bd.eastus-01.azurewebsites.net";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(
    sessionStorage.getItem("access_token")
  );

  // Fetch access token from /auth/token
  const fetchAccessToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/token`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.access_token || data.token || null;
        if (token) {
          setAccessToken(token);
          sessionStorage.setItem("access_token", token);
        }
        return token;
      }
    } catch (error) {
      console.error("Failed to fetch access token:", error);
    }
    return null;
  };

  // Check Azure AD authentication status by calling the backend
  const checkAuth = async (): Promise<boolean> => {
    try {
      console.log("[Auth] Calling /auth/me...");
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Auth] /auth/me success:", data);
        setUser({
          id: data.oid || "1",
          name: data.name || sessionStorage.getItem("azure_user_name") || "User",
          email: data.email || sessionStorage.getItem("azure_user_email") || "",
        });
        // Persist for local checks
        sessionStorage.setItem("powerbi_authenticated", "true");
        sessionStorage.setItem("azure_user_name", data.name || "User");
        sessionStorage.setItem("azure_user_email", data.email || "");

        // Fetch and store access token
        console.log("[Auth] Now calling /auth/token...");
        const token = await fetchAccessToken();
        console.log("[Auth] Token fetched:", token ? "yes" : "no");
        return true;
      } else {
        console.log("[Auth] /auth/me failed with status:", response.status);
      }
    } catch (error) {
      console.error("Azure AD auth check failed:", error);
    }

    return false;
  };

  // Check for local/session-based authentication
  const checkLocalAuth = (): boolean => {
    const isLocalAuth = sessionStorage.getItem("local_authenticated") === "true";
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    if (isLocalAuth || isPowerBIAuth) {
      const storedName = sessionStorage.getItem("azure_user_name");
      const storedEmail = sessionStorage.getItem("azure_user_email");

      setUser({
        id: "1",
        name: storedName || "User",
        email: storedEmail || "",
      });
      return true;
    }
    return false;
  };

  // Check auth on mount - try local first, then Azure AD
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // First check local auth (faster, no network call)
      if (checkLocalAuth()) {
        setIsLoading(false);
        return;
      }

      // Then check Azure AD auth
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const logout = async () => {
    // Call backend logout to clear server session
    try {
      await fetch(`${BACKEND_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Backend logout failed:", error);
    }
    setUser(null);
    setAccessToken(null);
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("local_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, accessToken, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
