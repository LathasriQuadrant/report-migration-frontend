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
const STATIC_WORKSPACE_ID = "1c780154-a538-447a-81a6-dd97636b60dd";
// This is the Service Principal ID you want Rajashekar to add automatically
const TARGET_SP_CLIENT_ID = "e2eaa87b-ee2a-4680-9982-870896175cfc";

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
   * BYPASS STRATEGY:
   * Uses Rajashekar's user token to add the Service Principal.
   * This avoids the 403 error caused by the Tenant Setting restriction on Apps.
   */
  const addServicePrincipalAsUser = async () => {
    setIsProcessingSP(true);
    try {
      // Note the endpoint change to /workspaces/add-any-sp
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-any-sp`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: STATIC_WORKSPACE_ID,
          new_sp_id: TARGET_SP_CLIENT_ID,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.detail || "Power BI rejected the user-delegated request.";
        console.error("User-Delegate SP Error:", errorMsg);

        toast({
          variant: "destructive",
          title: "Permission Error",
          description: "Ensure you are a Workspace Admin and logged in.",
        });
        return false;
      }

      console.log("SP Provisioning Success (via User Token):", result.message);
      return true;
    } catch (err) {
      console.error("Network error during User-Delegate add:", err);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not reach the backend server.",
      });
      return false;
    } finally {
      setIsProcessingSP(false);
    }
  };

  const handleSourceClick = async (sourceId: string) => {
    if (sourceId === "tableau") {
      // Attempt the User-Delegated bypass
      const success = await addServicePrincipalAsUser();

      if (success) {
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatsCard
            title="Total Migrations"
            value="48"
            change="+12% from last month"
            changeType="positive"
            icon={<FileStack className="w-5 h-5" />}
          />
          <StatsCard
            title="Completed"
            value="42"
            change="87.5% success rate"
            changeType="positive"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatsCard title="In Progress" value="3" icon={<Clock className="w-5 h-5" />} />
          <StatsCard
            title="Avg. Duration"
            value="4.2m"
            change="-18% faster"
            changeType="positive"
            icon={<BarChart3 className="w-5 h-5" />}
          />
        </div>

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
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Recent Migrations</h2>
          <div className="bg-card rounded-lg border border-border enterprise-shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Report
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: "Sales Overview Dashboard", source: "Tableau", status: "completed", date: "2 hours ago" },
                  { name: "Financial KPIs", source: "MicroStrategy", status: "completed", date: "5 hours ago" },
                  { name: "Customer Analytics", source: "SAP BO", status: "running", date: "Just now" },
                ].map((item, i) => (
                  <tr key={i} className="table-row-hover transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{item.name}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{item.source}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.status === "completed" ? "status-completed" : "status-running"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${item.status === "completed" ? "bg-success" : "bg-info animate-pulse"}`}
                        />
                        {item.status === "completed" ? "Completed" : "Running"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{item.date}</td>
                  </tr>
                ))}
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
