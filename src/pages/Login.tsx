import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Clock, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";
const LOGIN_URL = `${BACKEND_BASE_URL}/login`;

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // If already authenticated, go to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleAzureSignIn = () => {
    setIsRedirecting(true);

    // 🔥 IMPORTANT: SAME TAB redirect (fixes 401)
    window.location.href = LOGIN_URL;
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* LEFT BRANDING */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, hsl(210 100% 42%) 0%, hsl(220 60% 28%) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M0 0h1v40H0zM39 0h1v40h-1zM0 0h40v1H0zM0 39h40v1H0z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
          <Link to="/" className="flex items-center gap-3 mb-12 hover:opacity-90">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9M13 17V5M8 17v-3" />
              </svg>
            </div>
            <span className="text-xl font-semibold">ReportFlow</span>
          </Link>

          <h1 className="text-3xl xl:text-4xl font-bold mb-4">
            Sign in to manage
            <br />
            your BI migrations
          </h1>

          <p className="text-white/70 max-w-md mb-10">
            Securely migrate reports from Tableau, Cognos, SAP BO, and more into Microsoft Power BI.
          </p>

          <div className="space-y-4">
            <Feature icon={<Zap />} title="Automated Pipelines" />
            <Feature icon={<Shield />} title="Enterprise Security" />
            <Feature icon={<Clock />} title="Migration in Minutes" />
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="p-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold">Welcome</h2>
                <p className="text-sm text-muted-foreground">Sign in with Microsoft to continue</p>
              </div>

              <Button variant="azure" className="w-full h-11" onClick={handleAzureSignIn} disabled={isRedirecting}>
                {isRedirecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redirecting to Microsoft...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21">
                      <path d="M10 0v10h10V0H10zm0 11v10h10V11H10zM0 0v10h9V0H0zm0 11v10h9V11H0z" fill="currentColor" />
                    </svg>
                    Sign in with Microsoft
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms & Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Feature = ({ icon, title }: { icon: JSX.Element; title: string }) => (
  <div className="flex items-center gap-4">
    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">{icon}</div>
    <p className="text-sm font-medium">{title}</p>
  </div>
);

export default Login;
