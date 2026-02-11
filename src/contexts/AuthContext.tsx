import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

  // Fetch user profile from backend session
  const fetchUserProfile = async (): Promise<User | null> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.name) {
          return {
            id: data.id || "1",
            name: data.name,
            email: data.email || "",
            designation: data.designation || "",
            tenant_id: data.tenant_id || "",
            office_location: data.office_location || "",
          };
        }
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
    return null;
  };

  // Check Azure AD authentication status by calling the backend
  const checkAuth = async (): Promise<boolean> => {
    try {
      // Try fetching user profile first
      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        sessionStorage.setItem("powerbi_authenticated", "true");
        sessionStorage.setItem("azure_user_name", profile.name);
        sessionStorage.setItem("azure_user_email", profile.email);
        return true;
      }

      // Fallback: check /workspaces to verify session is valid
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (response.ok) {
        const storedName = sessionStorage.getItem("azure_user_name");
        const storedEmail = sessionStorage.getItem("azure_user_email");

        setUser({
          id: "1",
          name: storedName || "User",
          email: storedEmail || "",
        });
        sessionStorage.setItem("powerbi_authenticated", "true");
        return true;
      }
    } catch (error) {
      console.error("Azure AD auth check failed:", error);
    }

    return false;
  };

  // Check for local (simulated) authentication
  const checkLocalAuth = (): boolean => {
    const isLocalAuth = sessionStorage.getItem("local_authenticated") === "true";
    if (isLocalAuth) {
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

      if (checkLocalAuth()) {
        setIsLoading(false);
        return;
      }

      await checkAuth();
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
    // Optionally call backend logout endpoint
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
