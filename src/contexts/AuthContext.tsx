import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { User } from "@/types/migration";

interface UserDetails {
  id: string;
  displayName: string;
  mail: string;
  jobTitle?: string;
  preferredLanguage?: string;
  userPrincipalName?: string;
  givenName?: string;
  surname?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

interface AuthContextType {
  user: User | null;
  userDetails: UserDetails | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
  fetchUserDetails: () => Promise<UserDetails | null>;
}

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch detailed user info from /user/me endpoint
  const fetchUserDetails = useCallback(async (): Promise<UserDetails | null> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/user/me`, {
        method: "GET",
        credentials: "include", // CRITICAL: Sends session cookies to cross-origin backend
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const details: UserDetails = {
          id: data.id || "",
          displayName: data.displayName || "",
          mail: data.mail || "",
          jobTitle: data.jobTitle,
          preferredLanguage: data.preferredLanguage,
          userPrincipalName: data.userPrincipalName,
          givenName: data.givenName,
          surname: data.surname,
          officeLocation: data.officeLocation,
          mobilePhone: data.mobilePhone,
          businessPhones: data.businessPhones,
        };

        // Persistent storage for profile data
        localStorage.setItem("user_details", JSON.stringify(details));
        setUserDetails(details);
        return details;
      } else if (response.status === 401) {
        console.warn("Unauthorized: Session cookie missing or expired on backend.");
        return null;
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
    return null;
  }, []);

  // Check Azure AD authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      // Prioritize /user/me as it proves the session is valid for Graph/Profile data
      const details = await fetchUserDetails();

      if (details) {
        setUser({
          id: details.id,
          name: details.displayName,
          email: details.mail,
        });
        sessionStorage.setItem("powerbi_authenticated", "true");
        return true;
      }

      // If details are null (401), we are not authenticated
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
        setUserDetails(details);
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
    setUserDetails(null);

    // Clear all storage
    sessionStorage.clear();
    localStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userDetails,
        isAuthenticated: !!user,
        isLoading,
        checkAuth,
        logout,
        fetchUserDetails,
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
