import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Zap, Clock, ArrowLeft, ExternalLink, Loader2, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";
const LOGIN_URL = `${BACKEND_BASE_URL}/login`;

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuth();
  const [isWaiting, setIsWaiting] = useState(false);
  const [loginWindow, setLoginWindow] = useState<Window | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isLoginView, setIsLoginView] = useState(true);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check if auth completed
  const checkAuthCompletion = useCallback(async () => {
    const isAuthed = await checkAuth();
    if (isAuthed) {
      navigate("/dashboard", { replace: true });
      return true;
    }
    return false;
  }, [checkAuth, navigate]);

  // Poll for authentication completion when waiting
  useEffect(() => {
    if (!isWaiting) return;

    const interval = setInterval(async () => {
      if (loginWindow && loginWindow.closed) {
        const isAuthed = await checkAuthCompletion();
        if (!isAuthed) {
          setIsWaiting(false);
          setLoginWindow(null);
        }
        clearInterval(interval);
        return;
      }

      const isAuthed = await checkAuthCompletion();
      if (isAuthed) {
        loginWindow?.close();
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isWaiting, loginWindow, checkAuthCompletion]);

  const handleAzureSignIn = () => {
    setIsWaiting(true);
    const newWindow = window.open(LOGIN_URL, "_blank", "noopener");
    setLoginWindow(newWindow);
  };

  // Clear form when switching views
  const switchView = (toLogin: boolean) => {
    setIsLoginView(toLogin);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  // Email/password login handler (simulated - does not use Azure AD checkAuth)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Simulated login delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Store user info for simulated session
      sessionStorage.setItem("azure_user_name", email.split("@")[0]);
      sessionStorage.setItem("azure_user_email", email);
      sessionStorage.setItem("local_authenticated", "true");

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registration handler (simulated - does not use Azure AD checkAuth)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulated registration delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Store user info for simulated session
      sessionStorage.setItem("azure_user_name", name || email.split("@")[0]);
      sessionStorage.setItem("azure_user_email", email);
      sessionStorage.setItem("local_authenticated", "true");

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(210 100% 42%) 0%, hsl(220 60% 28%) 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h1v40H0V0zm39 0h1v40h-1V0zM0 0h40v1H0V0zm0 39h40v1H0v-1z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
          <Link to="/" className="flex items-center gap-3 mb-12 hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 17V9M13 17V5M8 17v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight">ReportFlow</span>
          </Link>

          <div className="mb-12">
            <h1 className="text-3xl xl:text-4xl font-bold mb-4 leading-tight tracking-tight">
              Sign in to manage
              <br />
              your BI migrations
            </h1>
            <p className="text-base text-white/70 leading-relaxed max-w-md">
              Access your migration dashboard to monitor, manage, and deploy reports to Microsoft Power BI.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white/90" />
              </div>
              <div>
                <p className="font-medium text-sm text-white/95">Automated Migration Pipelines</p>
                <p className="text-xs text-white/60">Zero-downtime transfer with validation</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white/90" />
              </div>
              <div>
                <p className="font-medium text-sm text-white/95">Enterprise Security</p>
                <p className="text-xs text-white/60">SOC 2 compliant with audit logging</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-white/90" />
              </div>
              <div>
                <p className="font-medium text-sm text-white/95">Migration in Minutes</p>
                <p className="text-xs text-white/60">Not weeks or months</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login/Register */}
      <div className="flex-1 lg:w-1/2 flex flex-col bg-background overflow-hidden">
        {/* Back to home link */}
        <div className="p-4 flex-shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18 17V9M13 17V5M8 17v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-foreground">ReportFlow</span>
            </div>

            {/* Card Container - Compact height */}
            <div className="bg-card rounded-xl border border-border enterprise-shadow-lg p-6">
              <div className="text-center mb-5">
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  {isLoginView ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLoginView ? "Sign in to continue to ReportFlow" : "Register to get started with ReportFlow"}
                </p>
              </div>

              {/* Azure AD waiting state */}
              {isWaiting ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Waiting for authentication...</p>
                    <p className="text-xs text-muted-foreground mt-1">Complete sign-in in the opened browser tab</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsWaiting(false);
                      setLoginWindow(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  {/* Login Form */}
                  {isLoginView ? (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Login
                          </>
                        )}
                      </Button>
                    </form>
                  ) : (
                    /* Register Form */
                    <form onSubmit={handleRegister} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="register-name">Full Name</Label>
                        <Input
                          id="register-name"
                          type="text"
                          placeholder="John Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="register-email">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="register-password">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Register
                          </>
                        )}
                      </Button>
                    </form>
                  )}

                  {/* Divider */}
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  {/* Azure AD SSO Button */}
                  <Button variant="azure" className="w-full h-10" onClick={handleAzureSignIn}>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none">
                      <path d="M10 0v10h10V0H10zm0 11v10h10V11H10zM0 0v10h9V0H0zm0 11v10h9V11H0z" fill="currentColor" />
                    </svg>
                    Sign in with Microsoft
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </div>

            {/* Toggle text outside the container */}
            {!isWaiting && (
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {isLoginView ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchView(false)}
                      className="text-primary hover:underline font-medium"
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchView(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
