import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This page handles the callback from Azure AD authentication.
 * Reads user data from URL query param and redirects to dashboard.
 */
const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserFromCallback } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const processAuth = () => {
      // Read user from URL query param
      const userParam = searchParams.get("user");
      
      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          
          // Persist access_token so the original Login tab can detect auth
          if (userData.access_token) {
            localStorage.setItem("access_token", userData.access_token);
            sessionStorage.setItem("access_token", userData.access_token);
            console.log("[AUTH] Access token persisted");
          }
          
          // Store user details via AuthContext
          const userDetails = {
            id: userData.oid || "1",
            name: userData.name || "User",
            email: userData.email || userData.preferredUsername || "",
            jobTitle: userData.jobTitle || "",
            tenantId: userData.tenant || userData.tid || userData.tenant_id || "",
            preferredUsername: userData.preferredUsername || userData.email || "",
          };
          
          setUserFromCallback(userDetails);
          
          console.log("[AUTH] User authenticated from callback:", userDetails.name, userDetails.email);
        } catch (error) {
          console.error("[AUTH] Failed to parse user data:", error);
          sessionStorage.setItem("powerbi_authenticated", "true");
        }
      } else {
        // No user param, but still mark as authenticated
        sessionStorage.setItem("powerbi_authenticated", "true");
        console.log("[AUTH] No user param, marked as authenticated");
      }
      
      setIsVerifying(false);
      
      // Navigate to dashboard after brief delay
      setTimeout(() => {
        console.log("[AUTH] Navigating to dashboard...");
        navigate('/dashboard', { replace: true });
      }, 500);
    };
    
    processAuth();
  }, [searchParams, setUserFromCallback, navigate]);

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