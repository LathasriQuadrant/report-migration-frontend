import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { setUserFromCallback } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserFromSession = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch user: ${res.status}`);
        }

        const userData = await res.json();
        console.log("[AUTH] User data from backend session:", userData);

        setUserFromCallback({
          id: userData.oid || "1",
          name: userData.name || "User",
          email: userData.email || "",
          jobTitle: userData.jobTitle || "",
          tenantId: userData.tenant_id || "",
          preferredUsername: userData.email || "",
        });

        setIsVerifying(false);

        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 300);
      } catch (err: any) {
        console.error("[AUTH] Failed to fetch user from session:", err);
        setError(err.message);
        setIsVerifying(false);
      }
    };

    fetchUserFromSession();
  }, [setUserFromCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
          style={{ backgroundColor: error ? "hsl(var(--destructive) / 0.1)" : isVerifying ? "hsl(var(--primary) / 0.1)" : "hsl(var(--success, 142 76% 36%) / 0.1)" }}>
          {isVerifying ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : error ? (
            <AlertCircle className="w-8 h-8 text-destructive" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          )}
        </div>
        <h2 className="text-xl font-semibold">
          {isVerifying ? "Verifying..." : error ? "Authentication Failed" : "Authentication Successful"}
        </h2>
        <p className="text-muted-foreground">
          {isVerifying
            ? "Please wait while we verify your credentials..."
            : error
            ? error
            : "Redirecting to dashboard..."}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
