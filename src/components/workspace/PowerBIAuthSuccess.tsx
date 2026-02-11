import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * This page is loaded inside the popup after Azure AD callback.
 * It signals the main tab via localStorage and closes itself.
 */
const PowerBIAuthSuccess = () => {
  useEffect(() => {
    // Signal the main tab that login is complete
    localStorage.setItem("pbi_auth_success", Date.now().toString());

    // Close the popup immediately
    window.close();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-semibold">Authentication Successful</h2>
        <p className="text-muted-foreground">This window will close automatically...</p>
      </div>
    </div>
  );
};

export default PowerBIAuthSuccess;
