import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STATIC_USER = {
  name: "Power BI User",
  email: "user@organization.com",
};

interface AuthContextType {
  user: typeof STATIC_USER | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  markAuthenticated: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const markAuthenticated = () => {
    localStorage.setItem("powerbi_authenticated", "true");
    setIsAuthenticated(true);
  };

  // Check auth on mount
  useEffect(() => {
    const isAuthed = localStorage.getItem("powerbi_authenticated") === "true";
    setIsAuthenticated(isAuthed);
    setIsLoading(false);
  }, []);

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("powerbi_authenticated");
  };

  return (
    <AuthContext.Provider
      value={{
        user: isAuthenticated ? STATIC_USER : null,
        isAuthenticated,
        isLoading,
        markAuthenticated,
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
