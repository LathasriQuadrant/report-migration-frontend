import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const PowerBIAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserFromCallback } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      const userParam = searchParams.get("user");
      const tokenParam = searchParams.get("access_token");
      
      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          
          const accessToken = tokenParam || userData.access_token || "";
          if (accessToken) {
            localStorage.setItem("access_token", accessToken);
            sessionStorage.setItem("access_token", accessToken);
            console.log("[AUTH] Access token persisted");
          }
          
          const userDetails = {
            id: userData.oid || "1",
            name: userData.name || "User",
            email: userData.email || userData.preferred_username || userData.preferredUsername || "",
            jobTitle: userData.jobTitle || "",
            tenantId: userData.tenant || userData.tid || "",
            preferredUsername: userData.preferred_username || userData.preferredUsername || userData.email || "",
          };
          
          setUserFromCallback(userDetails);
          console.log("[AUTH] User authenticated from URL param:", userDetails.name);
        } catch (error) {
          console.error("[AUTH] Failed to parse user data:", error);
          sessionStorage.setItem("powerbi_authenticated", "true");
        }
      } else {
        // No user param — try fetching from /auth/me using session cookie
        console.log("[AUTH] No user param, trying /auth/me...");
        try {
          const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
            credentials: "include",
          });
          if (res.ok) {
            const userData = await res.json();
            console.log("[AUTH] Got user from /auth/me:", userData);
            
            const userDetails = {
              id: userData.oid || "1",
              name: userData.name || "User",
              email: userData.email || "",
              tenantId: userData.tenant || "",
              preferredUsername: userData.email || "",
            };
            setUserFromCallback(userDetails);
          } else {
            console.warn("[AUTH] /auth/me returned", res.status);
            sessionStorage.setItem("powerbi_authenticated", "true");
          }
        } catch (err) {
          console.warn("[AUTH] /auth/me fetch failed:", err);
          sessionStorage.setItem("powerbi_authenticated", "true");
        }
      }
      
      if (tokenParam) {
        localStorage.setItem("access_token", tokenParam);
        sessionStorage.setItem("access_token", tokenParam);
      }
      
      setIsVerifying(false);
      
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
