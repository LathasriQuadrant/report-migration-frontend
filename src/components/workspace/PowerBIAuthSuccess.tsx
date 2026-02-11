import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Callback page after Azure AD auth.
 * The backend already set the session cookie via /auth/callback redirect.
 * We just mark sessionStorage and let the original tab detect it.
 */
const PowerBIAuthSuccess = () => {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("powerbi_authenticated", "true");
    setIsDone(true);

    setTimeout(() => {
      window.close();
    }, 1500);
  }, []);

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
          {isDone
            ? "You can close this tab."
            : "Please wait..."}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
