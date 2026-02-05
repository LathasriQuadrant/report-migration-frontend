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

  // Check Azure AD authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
       // Check workspaces endpoint to verify session is valid
       const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
         method: "GET",
         credentials: "include",
         headers: {
           Accept: "application/json",
         },
       });

       if (response.ok) {
         // Session is valid, restore user from storage or set default
         const storedDetails = localStorage.getItem("user_details");
         if (storedDetails) {
           try {
             const details = JSON.parse(storedDetails);
             setUser({
               id: details.id || "1",
               name: details.displayName || "User",
               email: details.mail || "",
             });
           } catch (e) {
             setUser({ id: "1", name: "User", email: "" });
           }
         } else {
           setUser({ id: "1", name: "User", email: "" });
         }
        sessionStorage.setItem("powerbi_authenticated", "true");
        return true;
      }

       // If 401, we are not authenticated
      logout();
      return false;
    } catch (error) {
      console.error("Azure AD auth check failed:", error);
      logout();
      return false;
    }
  };

  // Helper to sync state from local storage on refresh
  const syncFromStorage = useCallback(() => {
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    const storedDetails = localStorage.getItem("user_details");

    if (isPowerBIAuth && storedDetails) {
      try {
        const details = JSON.parse(storedDetails);
        setUser({
          id: details.id || "1",
          name: details.displayName || "User",
          email: details.mail || "",
        });
        return true;
      } catch (e) {
        console.error("Error parsing stored details", e);
      }
    }
    return false;
  }, []);

  // Initial Auth initialization
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // Check storage first for UI snappiness
      const hasStoredSession = syncFromStorage();

      // Always verify with the backend to ensure the cookie hasn't expired
      await checkAuth();

      setIsLoading(false);
    };
    initAuth();
  }, []);

  const logout = () => {
    setUser(null);

    // Clear all storage
    sessionStorage.clear();
    localStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        checkAuth,
        logout,
      }}
    >
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
