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
    const processAuth = () => {
      const userParam = searchParams.get("user");
      const tokenParam = searchParams.get("access_token");

      let userDetails = {
        id: "1",
        name: "Power BI User",
        email: "user@organization.com",
        jobTitle: "",
        tenantId: "",
        preferredUsername: "",
      };

      // Try to parse user details from URL if available
      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          userDetails = {
            id: userData.oid || "1",
            name: userData.name || "Power BI User",
            email: userData.email || userData.preferred_username || "user@organization.com",
            jobTitle: userData.jobTitle || "",
            tenantId: userData.tenant || userData.tid || "",
            preferredUsername: userData.preferred_username || userData.email || "",
          };
          const accessToken = tokenParam || userData.access_token || "";
          if (accessToken) {
            localStorage.setItem("access_token", accessToken);
            sessionStorage.setItem("access_token", accessToken);
          }
        } catch (e) {
          console.warn("[AUTH] Could not parse user param, using defaults");
        }
      }

      if (tokenParam) {
        localStorage.setItem("access_token", tokenParam);
        sessionStorage.setItem("access_token", tokenParam);
      }

      // Always set user and navigate — no blocking on /auth/me
      setUserFromCallback(userDetails);
      console.log("[AUTH] User set:", userDetails.name);

      setIsVerifying(false);
      setTimeout(() => navigate('/dashboard', { replace: true }), 400);
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
