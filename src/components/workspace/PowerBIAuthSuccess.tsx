import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This page handles the callback from Azure AD authentication.
 * The backend has already stored the access_token in the server-side session.
 * We just mark the frontend as authenticated and redirect to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { setUserFromCallback } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Backend session now holds the access_token.
    // Mark frontend as authenticated and redirect.
    sessionStorage.setItem("powerbi_authenticated", "true");

    setUserFromCallback({
      id: "1",
      name: "Power BI User",
      email: "",
    });

    setIsVerifying(false);

    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 500);
  }, [setUserFromCallback, navigate]);

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
