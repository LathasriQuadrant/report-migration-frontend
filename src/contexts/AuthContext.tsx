import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types/migration";
import { apiFetch } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Calls /auth/me to get user details from the session cookie.
   * Handles 401 (redirect) and 403 (forbidden) via apiFetch.
   */
  const checkAuth = async (): Promise<boolean> => {
    try {
      const response = await apiFetch("/auth/me");

      if (response.ok) {
        const data = await response.json();
        const mappedUser: User = {
          id: data.oid || "1",
          name: data.name || "User",
          email: data.email || data.preferred_username || "",
        };

        setUser(mappedUser);

        // Persist to sessionStorage for quick local checks
        sessionStorage.setItem("powerbi_authenticated", "true");
        sessionStorage.setItem("azure_user_name", mappedUser.name);
        sessionStorage.setItem("azure_user_email", mappedUser.email);

        console.log("Auth /auth/me user:", mappedUser);
        return true;
      }
    } catch (error: any) {
      // apiFetch already handles 401 redirect; log others
      if (!error.message?.includes("Session expired")) {
        console.error("Auth check failed:", error.message);
      }
    }

    return false;
  };

  // Check for local/session-based authentication (fast, no network)
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

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // Set temporary user from sessionStorage so UI doesn't flash
      checkLocalAuth();

      // Always call /auth/me to get real user details
      const authenticated = await checkAuth();

      if (!authenticated) {
        // If /auth/me failed but we had local auth, keep local state
        // Otherwise user stays null and will be redirected
        if (!checkLocalAuth()) {
          setUser(null);
        }
      }

      setIsLoading(false);
    };
    initAuth();
  }, []);

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("local_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, checkAuth, logout }}>
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
