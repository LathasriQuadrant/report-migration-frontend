import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  fetchUserDetails: () => Promise<UserProfile | null>;
  logout: () => void;
}

interface UserProfile {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string | null;
  preferredLanguage: string | null;
}

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user details from /user/me endpoint
  const fetchUserDetails = async (): Promise<UserProfile | null> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/user/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const userProfile: UserProfile = {
          id: userData.id || "1",
          displayName: userData.displayName || "User",
          mail: userData.mail || "",
          jobTitle: userData.jobTitle || null,
          preferredLanguage: userData.preferredLanguage || null,
        };
        
        setUser(userProfile);
        
        // Store in session storage for persistence
        sessionStorage.setItem("user_details", JSON.stringify(userProfile));
        sessionStorage.setItem("azure_user_name", userProfile.displayName);
        sessionStorage.setItem("azure_user_email", userProfile.mail);
        sessionStorage.setItem("powerbi_authenticated", "true");
        
        return userProfile;
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
    return null;
  };

  // Check Azure AD authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      const userProfile = await fetchUserDetails();
      if (userProfile) {
        return true;
      }
    } catch (error) {
      console.error("Azure AD auth check failed:", error);
    }
    return false;
  };

  // Check for local (simulated) authentication or stored session
  const checkLocalAuth = (): boolean => {
    const isLocalAuth = sessionStorage.getItem("local_authenticated") === "true";
    if (isLocalAuth) {
      const storedName = sessionStorage.getItem("azure_user_name");
      const storedEmail = sessionStorage.getItem("azure_user_email");
      setUser({
        id: "1",
        displayName: storedName || "User",
        mail: storedEmail || "",
        jobTitle: null,
        preferredLanguage: null,
      });
      return true;
    }
    
    // Check for stored user details from previous session
    const storedDetails = sessionStorage.getItem("user_details");
    if (storedDetails) {
      try {
        const userProfile = JSON.parse(storedDetails) as UserProfile;
        setUser(userProfile);
        return true;
      } catch {
        // Invalid stored data, clear it
        sessionStorage.removeItem("user_details");
      }
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
    sessionStorage.removeItem("user_details");
    // Optionally call backend logout endpoint
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, checkAuth, fetchUserDetails, logout }}>
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
