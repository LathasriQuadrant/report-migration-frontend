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

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) return !!user;
    isCheckingRef.current = true;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.email || "1",
          name: userData.name || "User",
          email: userData.email || "",
        });
        isCheckingRef.current = false;
        return true;
      }
    } catch (error) {
      console.error("Session verification failed:", error);
    }

    setUser(null);
    isCheckingRef.current = false;
    return false;
  }, []);

  // On mount: verify session
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();
  }, [checkAuth]);

  // Listen for "pbi_auth_success" from the popup tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pbi_auth_success") {
        const recheck = async () => {
          setIsLoading(true);
          await checkAuth();
          setIsLoading(false);
          localStorage.removeItem("pbi_auth_success");
        };
        recheck();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAuth]);

  // Global 401 handler
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
    localStorage.removeItem("pbi_auth_success");
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
