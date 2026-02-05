import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This page handles the callback from Azure AD authentication.
 * Fetches user details and redirects to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { fetchUserDetails } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      try {
        // Fetch user details from /user/me endpoint
        const userProfile = await fetchUserDetails();
        
        if (userProfile) {
          setIsVerifying(false);
          
          // Redirect to dashboard after short delay
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          setError("Failed to fetch user details. Please try again.");
          setIsVerifying(false);
        }
      } catch (err) {
        console.error("Auth verification failed:", err);
        setError("Authentication verification failed. Please try again.");
        setIsVerifying(false);
      }
    };
    
    verifyAndRedirect();
  }, [fetchUserDetails, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
          {isVerifying && !error ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : error ? (
            <div className="w-8 h-8 text-destructive">✕</div>
          ) : (
            <CheckCircle2 className="w-8 h-8 text-success" />
          )}
        </div>
        <h2 className="text-xl font-semibold">
          {isVerifying ? "Fetching User Details..." : error ? "Authentication Failed" : "Authentication Successful"}
        </h2>
        <p className="text-muted-foreground">
          {isVerifying
            ? "Please wait while we fetch your profile..."
            : error
            ? error
            : "Redirecting to dashboard..."}
        </p>
        {error && (
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;