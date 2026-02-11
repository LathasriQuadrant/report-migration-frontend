import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuthFromCallback: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Set authenticated from callback
  const setAuthFromCallback = () => {
    sessionStorage.setItem("powerbi_authenticated", "true");
    setIsAuthenticated(true);
  };

  // Check for existing session on mount
  useEffect(() => {
    setIsLoading(true);
    const isPowerBIAuth = sessionStorage.getItem("powerbi_authenticated") === "true";
    setIsAuthenticated(isPowerBIAuth);
    setIsLoading(false);
  }, []);

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("powerbi_authenticated");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, setAuthFromCallback, logout }}>
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
