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
        credentials: "include",
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

        // Store all user details in localStorage
        localStorage.setItem("user_details", JSON.stringify(details));
        localStorage.setItem("user_id", details.id);
        localStorage.setItem("user_display_name", details.displayName);
        localStorage.setItem("user_email", details.mail);
        if (details.jobTitle) localStorage.setItem("user_job_title", details.jobTitle);
        if (details.preferredLanguage) localStorage.setItem("user_preferred_language", details.preferredLanguage);
        if (details.userPrincipalName) localStorage.setItem("user_principal_name", details.userPrincipalName);
        if (details.givenName) localStorage.setItem("user_given_name", details.givenName);
        if (details.surname) localStorage.setItem("user_surname", details.surname);
        if (details.officeLocation) localStorage.setItem("user_office_location", details.officeLocation);
        if (details.mobilePhone) localStorage.setItem("user_mobile_phone", details.mobilePhone);
        if (details.businessPhones) localStorage.setItem("user_business_phones", JSON.stringify(details.businessPhones));

        // Also keep sessionStorage in sync for backward compatibility
        sessionStorage.setItem("azure_user_name", details.displayName);
        sessionStorage.setItem("azure_user_email", details.mail);
        sessionStorage.setItem("azure_user_id", details.id);
        if (details.jobTitle) sessionStorage.setItem("azure_user_job_title", details.jobTitle);

        setUserDetails(details);
        return details;
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
    return null;
  }, []);

  // Check Azure AD authentication status by calling the backend
  const checkAuth = async (): Promise<boolean> => {
    try {
      // First try /user/me endpoint
      const userResponse = await fetch(`${BACKEND_BASE_URL}/user/me`, {
        credentials: "include",
      });

      if (userResponse.ok) {
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
      }

      // Fallback to /workspaces endpoint
      const workspacesResponse = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (workspacesResponse.ok) {
        // Try to fetch user details even if workspaces succeeds
        const details = await fetchUserDetails();
        if (details) {
          setUser({
            id: details.id,
            name: details.displayName,
            email: details.mail,
          });
        } else {
          // Use stored values as fallback
          const storedName = sessionStorage.getItem("azure_user_name") || localStorage.getItem("user_display_name");
          const storedEmail = sessionStorage.getItem("azure_user_email") || localStorage.getItem("user_email");
          const storedId = sessionStorage.getItem("azure_user_id") || localStorage.getItem("user_id");

          setUser({
            id: storedId || "1",
            name: storedName || "User",
            email: storedEmail || "",
          });
        }
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

      // Load user details from localStorage if available
      const storedDetails = localStorage.getItem("user_details");
      if (storedDetails) {
        try {
          setUserDetails(JSON.parse(storedDetails));
        } catch (e) {
          console.error("Failed to parse stored user details:", e);
        }
      }

      return true;
    }

    // Also check if we have Azure AD auth stored
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    if (isPowerBIAuth) {
      const storedName = sessionStorage.getItem("azure_user_name") || localStorage.getItem("user_display_name");
      const storedEmail = sessionStorage.getItem("azure_user_email") || localStorage.getItem("user_email");
      const storedId = sessionStorage.getItem("azure_user_id") || localStorage.getItem("user_id");

      setUser({
        id: storedId || "1",
        name: storedName || "User",
        email: storedEmail || "",
      });

      // Load user details from localStorage if available
      const storedDetails = localStorage.getItem("user_details");
      if (storedDetails) {
        try {
          setUserDetails(JSON.parse(storedDetails));
        } catch (e) {
          console.error("Failed to parse stored user details:", e);
        }
      }

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
    setUserDetails(null);
    
    // Clear sessionStorage
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("local_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
    sessionStorage.removeItem("azure_user_id");
    sessionStorage.removeItem("azure_user_job_title");
    
    // Clear localStorage user details
    localStorage.removeItem("user_details");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_display_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_job_title");
    localStorage.removeItem("user_preferred_language");
    localStorage.removeItem("user_principal_name");
    localStorage.removeItem("user_given_name");
    localStorage.removeItem("user_surname");
    localStorage.removeItem("user_office_location");
    localStorage.removeItem("user_mobile_phone");
    localStorage.removeItem("user_business_phones");
  };

  return (
    <AuthContext.Provider value={{ user, userDetails, isAuthenticated: !!user, isLoading, checkAuth, logout, fetchUserDetails }}>
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
