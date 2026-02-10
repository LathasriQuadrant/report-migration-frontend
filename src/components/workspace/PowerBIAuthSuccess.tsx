import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Handles the callback from Azure AD authentication.
 * Reads user data from URL query param and redirects to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserFromCallback } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const processAuth = () => {
      const userParam = searchParams.get("user");

      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          console.log("[AUTH] User data from callback URL:", userData);

          // Store access token for API calls
          if (userData.access_token) {
            localStorage.setItem("azure_access_token", userData.access_token);
          }

          setUserFromCallback({
            id: userData.oid || "1",
            name: userData.name || "User",
            email: userData.email || "",
            jobTitle: userData.jobTitle || "",
            tenantId: userData.tid || userData.tenant_id || "",
            preferredUsername: userData.email || "",
          });
        } catch (error) {
          console.error("Failed to parse user data:", error);
          sessionStorage.setItem("powerbi_authenticated", "true");
        }
      } else {
        sessionStorage.setItem("powerbi_authenticated", "true");
      }

      setIsVerifying(false);

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 300);
    };

    processAuth();
  }, [searchParams, setUserFromCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
          {isVerifying ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          )}
        </div>
        <h2 className="text-xl font-semibold">
          {isVerifying ? "Verifying..." : "Authentication Successful"}
        </h2>
        <p className="text-muted-foreground">
          {isVerifying
            ? "Please wait while we verify your credentials..."
            : "Redirecting to dashboard..."}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
