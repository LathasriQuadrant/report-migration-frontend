import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types/migration";

interface UserDetails extends User {
  jobTitle?: string;
}

interface AuthContextType {
  user: UserDetails | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUserFromCallback: (user: UserDetails) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set user from callback URL parameter
  const setUserFromCallback = (userData: UserDetails) => {
    // Store in localStorage for persistence
    localStorage.setItem("user_details", JSON.stringify(userData));
    localStorage.setItem("user_id", userData.id);
    localStorage.setItem("user_email", userData.email);
    
    // Store in sessionStorage for session management
    sessionStorage.setItem("azure_user_name", userData.name);
    sessionStorage.setItem("azure_user_email", userData.email);
    sessionStorage.setItem("powerbi_authenticated", "true");
    
    setUser(userData);
  };

  // Check for existing session on mount
  const checkSessionAuth = (): boolean => {
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    
    if (isPowerBIAuth) {
      const cachedDetails = localStorage.getItem("user_details");
      if (cachedDetails) {
        try {
          setUser(JSON.parse(cachedDetails));
          return true;
        } catch (e) {
          // Invalid JSON, continue to fallback
        }
      }
      // Set minimal user if no cached details
      const storedName = sessionStorage.getItem("azure_user_name");
      const storedEmail = sessionStorage.getItem("azure_user_email");
      if (storedName || storedEmail) {
        setUser({
          id: localStorage.getItem("user_id") || "1",
          name: storedName || "User",
          email: storedEmail || "",
        });
        return true;
      }
    }
    return false;
  };

  // Check auth on mount
  useEffect(() => {
    setIsLoading(true);
    checkSessionAuth();
    setIsLoading(false);
  }, []);

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
    localStorage.removeItem("user_details");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, setUserFromCallback, logout }}>
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
