import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

/**
 * This page handles the redirect from Azure AD /auth/callback.
 * Fetches user details from /auth/me, then verifies session via /workspaces.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Step 1: Fetch user details from /auth/me
      try {
        const meResponse = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
          credentials: "include",
        });

        if (meResponse.ok) {
          const data = await meResponse.json();
          if (data.name) sessionStorage.setItem("azure_user_name", data.name);
          if (data.email) sessionStorage.setItem("azure_user_email", data.email);
          if (data.oid) sessionStorage.setItem("azure_user_oid", data.oid);
          if (data.tenant) sessionStorage.setItem("azure_user_tid", data.tenant);

          // Signal other tabs
          localStorage.setItem("user_details", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      }

      // Step 2: Verify session via /workspaces and update auth context
      await checkAuth();

      setIsVerifying(false);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    };

    verifyAndRedirect();
  }, [checkAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
          {isVerifying ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-success" />
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