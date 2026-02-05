import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This page handles the callback from Azure AD authentication.
  * Immediately calls /user/me to fetch user details, then redirects to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Verifying authentication...");

  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Mark as authenticated in session storage
      sessionStorage.setItem("powerbi_authenticated", "true");
      
      setStatusMessage("Fetching your profile...");
      
      // Verify auth with backend - this now calls /user/me first
      await checkAuth();
      
      setIsVerifying(false);
      setStatusMessage("Welcome! Redirecting to dashboard...");
      
      // Redirect to dashboard after short delay
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
          {statusMessage}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;