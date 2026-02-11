import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

interface UserInfo {
  name: string;
  email: string;
}

const STATIC_USER: UserInfo = { name: "Power BI User", email: "" };

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    // Quick check: if sessionStorage flag is set, trust it
    if (sessionStorage.getItem("powerbi_authenticated") === "true") {
      setUser(STATIC_USER);
      setIsLoading(false);
      return;
    }

    // Otherwise verify with backend session cookie
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("powerbi_authenticated", "true");
        setUser({ name: data.name || "Power BI User", email: data.email || "" });
      } else {
        sessionStorage.removeItem("powerbi_authenticated");
        setUser(null);
      }
    } catch {
      // If backend unreachable, check sessionStorage only
      if (sessionStorage.getItem("powerbi_authenticated") === "true") {
        setUser(STATIC_USER);
      } else {
        setUser(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    sessionStorage.removeItem("powerbi_authenticated");
    setUser(null);
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
