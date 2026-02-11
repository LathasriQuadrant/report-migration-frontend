import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface UserInfo {
  name: string;
  email: string;
}

const STATIC_USER: UserInfo = { name: "Power BI User", email: "" };

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  markAuthenticated: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const markAuthenticated = () => {
    sessionStorage.setItem("powerbi_authenticated", "true");
    setUser(STATIC_USER);
  };

  useEffect(() => {
    if (sessionStorage.getItem("powerbi_authenticated") === "true") {
      setUser(STATIC_USER);
    }
    setIsLoading(false);
  }, []);

  const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

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
