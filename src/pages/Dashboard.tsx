import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, CheckCircle2, Clock, History, BarChart3, Loader2 } from "lucide-react";
import SourceCard from "@/components/dashboard/SourceCard";
import StatsCard from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import TableauAuthModal from "@/components/workspace/TableauAuthModal";
import { TableauIcon, MicroStrategyIcon, SAPBOIcon, CognosIcon } from "@/components/icons/SourceIcons";
import { useToast } from "@/hooks/use-toast";

const migrationSources = [
  {
    id: "tableau",
    title: "Tableau → Power BI",
    description: "Migrate workbooks, dashboards, and data sources from Tableau Server or Online",
    icon: <TableauIcon className="w-5 h-5" />,
    color: "#E97627",
  },
  {
    id: "microstrategy",
    title: "MicroStrategy → Power BI",
    description: "Convert MicroStrategy reports and dossiers to Power BI format",
    icon: <MicroStrategyIcon className="w-5 h-5" />,
    color: "#CC2131",
  },
  {
    id: "sapbo",
    title: "SAP BO → Power BI",
    description: "Migrate SAP BusinessObjects universes and Web Intelligence reports",
    icon: <SAPBOIcon className="w-5 h-5" />,
    color: "#0FAAFF",
  },
  {
    id: "cognos",
    title: "Cognos → Power BI",
    description: "Transform IBM Cognos Analytics reports and dashboards",
    icon: <CognosIcon className="w-5 h-5" />,
    color: "#054ADA",
  },
];

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";
const STATIC_WORKSPACE_ID = "7add5c6b-2552-4441-8799-838d0dbe3d12";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTableauAuth, setShowTableauAuth] = useState(false);
  const [isProcessingSP, setIsProcessingSP] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("selected_workbook");
  }, []);

  /**
   * Hits the /workspaces/add-sp endpoint
   * Payload: { "workspace_id": STATIC_WORKSPACE_ID }
   */
  const ensureServicePrincipalAccess = async () => {
    setIsProcessingSP(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        credentials: "include", // Essential for cookie-based session/auth
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: STATIC_WORKSPACE_ID,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // If Power BI says "Failed to get service principal details from AAD"
        const errorDetail = result.detail || "Power BI rejected the access request.";
        console.error("Backend Error:", errorDetail);

        toast({
          variant: "destructive",
          title: "Access Verification Failed",
          description: typeof errorDetail === "string" ? errorDetail : "Check AAD permissions.",
        });
        return false;
      }

      // If already exists or just added, show success
      console.log("SP Access Verified:", result.message);
      toast({
        title: "Access Verified",
        description:
          result.message === "already exist"
            ? "Service Principal already has access."
            : "Successfully linked Service Principal to workspace.",
      });

      return true;
    } catch (err) {
      console.error("Connection Error:", err);
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not connect to the backend server.",
      });
      return false;
    } finally {
      setIsProcessingSP(false);
    }
  };

  const handleSourceClick = async (sourceId: string) => {
    if (sourceId === "tableau") {
      // 1. Run the backend check for Service Principal Admin access
      const hasAccess = await ensureServicePrincipalAccess();

      // 2. Only show the next modal if the backend successfully linked the SP
      if (hasAccess) {
        setShowTableauAuth(true);
      }
    } else {
      navigate(`/explore/${sourceId}`);
    }
  };

  const handleTableauAuthSuccess = () => {
    setShowTableauAuth(false);
    navigate("/explore/tableau");
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Migration Control Center</h1>
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              <History className="w-4 h-4 mr-2" />
              View History
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Monitor and manage your BI report migrations to Power BI</p>
          <div className="mt-4 h-px bg-border" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatsCard
            title="Total Migrations"
            value="48"
            change="+12%"
            changeType="positive"
            icon={<FileStack className="w-5 h-5" />}
          />
          <StatsCard
            title="Completed"
            value="42"
            change="87.5%"
            changeType="positive"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatsCard title="In Progress" value="3" icon={<Clock className="w-5 h-5" />} />
          <StatsCard
            title="Avg. Duration"
            value="4.2m"
            change="-18%"
            changeType="positive"
            icon={<BarChart3 className="w-5 h-5" />}
          />
        </div>

        {/* Source Cards */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Choose Migration Source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {migrationSources.map((source) => (
              <div key={source.id} className="relative">
                <SourceCard
                  sourceId={source.id}
                  title={source.title}
                  description={source.description}
                  icon={source.icon}
                  color={source.color}
                  onClick={() => handleSourceClick(source.id)}
                />
                {source.id === "tableau" && isProcessingSP && (
                  <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center rounded-xl backdrop-blur-[2px] z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Verifying SP Access
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Recent Migrations</h2>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Report</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium">Sales Overview</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">Tableau</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Completed
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">2h ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TableauAuthModal
        isOpen={showTableauAuth}
        onSuccess={handleTableauAuthSuccess}
        onCancel={() => setShowTableauAuth(false)}
      />
    </AppLayout>
  );
};

export default Dashboard;
