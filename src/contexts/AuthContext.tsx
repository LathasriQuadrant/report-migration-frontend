import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { User } from "@/types/migration";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
}

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isCheckingRef = useRef(false);

  // Single source of truth: call /auth/me to verify session cookie
  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent calls (race condition prevention)
    if (isCheckingRef.current) return !!user;
    isCheckingRef.current = true;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.oid || "1",
          name: userData.name || "User",
          email: userData.email || "",
        });
        return true;
      }
    } catch (error) {
      console.error("Session verification failed:", error);
    }

    setUser(null);
    return false;
  }, []);

  // On mount: verify session with backend
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();
  }, [checkAuth]);

  // Listen for pbi_login_sync from popup tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pbi_login_sync" && e.newValue) {
        // Wait 500ms for cookie propagation, then verify
        setTimeout(async () => {
          setIsLoading(true);
          await checkAuth();
          setIsLoading(false);
          // Clean up the sync flag
          localStorage.removeItem("pbi_login_sync");
        }, 500);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAuth]);

  // Global 401 handler: listen for custom event from API calls
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const logout = async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }
    setUser(null);
    localStorage.removeItem("pbi_login_sync");
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
