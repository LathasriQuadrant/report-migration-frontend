import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This page handles the redirect from Azure AD /auth/callback.
 * Calls /auth/me to fetch user details and verify session.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Verify session and fetch user details from /auth/me
      const success = await checkAuth();

      if (success) {
        // Signal other tabs via localStorage
        const name = sessionStorage.getItem("azure_user_name");
        const email = sessionStorage.getItem("azure_user_email");
        localStorage.setItem("user_details", JSON.stringify({ name, email }));
      }

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