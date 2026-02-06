import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types/migration";

interface UserDetails extends User {
  jobTitle?: string;
  preferredLanguage?: string;
}

interface AuthContextType {
  user: UserDetails | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  fetchUserDetails: () => Promise<UserDetails | null>;
  logout: () => void;
}

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user details from /auth/me endpoint
  const fetchUserDetails = async (): Promise<UserDetails | null> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const userData = await response.json();
        // Map fields from backend: { name, email, oid, tenant }
        const userDetails: UserDetails = {
          id: userData.oid || "1",
          name: userData.name || "User",
          email: userData.email || "",
        };

        // Store in localStorage for persistence
        localStorage.setItem("user_details", JSON.stringify(userDetails));
        localStorage.setItem("user_id", userDetails.id);
        localStorage.setItem("user_email", userDetails.email);
        
        // Also store in sessionStorage for backward compatibility
        sessionStorage.setItem("azure_user_name", userDetails.name);
        sessionStorage.setItem("azure_user_email", userDetails.email);
        sessionStorage.setItem("powerbi_authenticated", "true");

        setUser(userDetails);
        return userDetails;
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    }
    return null;
  };

  // Check Azure AD authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      // First try to fetch user details directly
      const userDetails = await fetchUserDetails();
      if (userDetails) {
        return true;
      }

      // Fallback: check workspaces endpoint
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (response.ok) {
        // Try to load cached user details
        const cachedDetails = localStorage.getItem("user_details");
        if (cachedDetails) {
          setUser(JSON.parse(cachedDetails));
        } else {
          setUser({
            id: "1",
            name: sessionStorage.getItem("azure_user_name") || "User",
            email: sessionStorage.getItem("azure_user_email") || "",
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

  // Check for session-based authentication (after redirect)
  const checkSessionAuth = (): boolean => {
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    const isLocalAuth = sessionStorage.getItem("local_authenticated") === "true";
    
    if (isPowerBIAuth || isLocalAuth) {
      const cachedDetails = localStorage.getItem("user_details");
      if (cachedDetails) {
        try {
          setUser(JSON.parse(cachedDetails));
          return true;
        } catch (e) {
          // Invalid JSON, continue to fallback
        }
      }
      // Set minimal user if no cached details - still authenticated!
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

  // Check auth on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // First check session storage (fastest, no network call)
      if (checkSessionAuth()) {
        setIsLoading(false);
        // Still try to refresh user details in background
        fetchUserDetails().catch(() => {});
        return;
      }

      // Then check Azure AD auth via backend
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
    localStorage.removeItem("user_details");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
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
