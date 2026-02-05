import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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

  // Fetch user details from /user/me endpoint
  const fetchUserDetails = useCallback(async (): Promise<User | null> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/user/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          id: data.id || "1",
          name: data.displayName || "User",
          email: data.mail || "",
          jobTitle: data.jobTitle || undefined,
          preferredLanguage: data.preferredLanguage || undefined,
        };
        
        // Store in sessionStorage for persistence
        sessionStorage.setItem("azure_user_name", userData.name);
        sessionStorage.setItem("azure_user_email", userData.email);
        sessionStorage.setItem("azure_user_id", userData.id);
        if (userData.jobTitle) sessionStorage.setItem("azure_user_job_title", userData.jobTitle);
        if (userData.preferredLanguage) sessionStorage.setItem("azure_user_language", userData.preferredLanguage);
        
        return userData;
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
    return null;
  }, []);

  // Check Azure AD authentication status by calling /user/me
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const userData = await fetchUserDetails();
      
      if (userData) {
        setUser(userData);
        sessionStorage.setItem("powerbi_authenticated", "true");
        return true;
      }
      
      // Fallback to /workspaces if /user/me fails
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (response.ok) {
        const storedName = sessionStorage.getItem("azure_user_name");
        const storedEmail = sessionStorage.getItem("azure_user_email");
        const storedId = sessionStorage.getItem("azure_user_id");
        const storedJobTitle = sessionStorage.getItem("azure_user_job_title");
        const storedLanguage = sessionStorage.getItem("azure_user_language");
        
        setUser({
          id: storedId || "1",
          name: storedName || "User",
          email: storedEmail || "",
          jobTitle: storedJobTitle || undefined,
          preferredLanguage: storedLanguage || undefined,
        });
        sessionStorage.setItem("powerbi_authenticated", "true");
        return true;
      }
    } catch (error) {
      console.error("Azure AD auth check failed:", error);
    }

    return false;
  }, [fetchUserDetails]);

  // Check for local (simulated) authentication
  const checkLocalAuth = (): boolean => {
    const isLocalAuth = sessionStorage.getItem("local_authenticated") === "true";
    if (isLocalAuth) {
      const storedName = sessionStorage.getItem("azure_user_name");
      const storedEmail = sessionStorage.getItem("azure_user_email");
      const storedId = sessionStorage.getItem("azure_user_id");
      const storedJobTitle = sessionStorage.getItem("azure_user_job_title");
      const storedLanguage = sessionStorage.getItem("azure_user_language");

      setUser({
        id: storedId || "1",
        name: storedName || "User",
        email: storedEmail || "",
        jobTitle: storedJobTitle || undefined,
        preferredLanguage: storedLanguage || undefined,
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

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("local_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
    sessionStorage.removeItem("azure_user_id");
    sessionStorage.removeItem("azure_user_job_title");
    sessionStorage.removeItem("azure_user_language");
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
