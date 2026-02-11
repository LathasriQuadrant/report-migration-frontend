import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Callback page after Azure AD auth (opens in the new tab).
 * Broadcasts auth success to the original tab via BroadcastChannel, then closes.
 */
const PowerBIAuthSuccess = () => {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Notify the original login tab
    const channel = new BroadcastChannel("auth_channel");
    channel.postMessage("auth_success");
    channel.close();

    setIsDone(true);

    // Close this tab after a short delay
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
          {isDone ? "You can close this tab." : "Please wait..."}
        </p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
