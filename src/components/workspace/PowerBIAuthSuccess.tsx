import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Callback page after Azure AD auth.
 * The backend redirects here after setting the session cookie.
 * We mark sessionStorage and navigate to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const { markAuthenticated } = useAuth();
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    markAuthenticated();
    setIsDone(true);

    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 500);
  }, [markAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
          {isDone ? (
            <CheckCircle2 className="w-8 h-8 text-primary" />
          ) : (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
        </div>
        <h2 className="text-xl font-semibold">
          {isDone ? "Authentication Successful" : "Verifying..."}
        </h2>
        <p className="text-muted-foreground">
          {isDone ? "Redirecting to dashboard..." : "Please wait..."}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
