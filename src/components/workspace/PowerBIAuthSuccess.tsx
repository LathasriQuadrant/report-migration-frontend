import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Handles redirect from /auth/callback which includes user details as query params.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Extract user details from /auth/callback redirect URL
      const name = searchParams.get("name");
      const email = searchParams.get("email");
      const tid = searchParams.get("tid") || searchParams.get("tenant");
      const oid = searchParams.get("oid");

      // Store in sessionStorage
      if (name) sessionStorage.setItem("azure_user_name", name);
      if (email) sessionStorage.setItem("azure_user_email", email);
      if (tid) sessionStorage.setItem("azure_user_tid", tid);
      if (oid) sessionStorage.setItem("azure_user_oid", oid);
      sessionStorage.setItem("powerbi_authenticated", "true");

      // Signal other tabs
      localStorage.setItem("user_details", JSON.stringify({ name, email, tid, oid }));

      // Verify session via /workspaces
      await checkAuth();

      setIsVerifying(false);
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    };

    verifyAndRedirect();
  }, [checkAuth, navigate, searchParams]);

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