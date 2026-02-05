import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, CheckCircle2, Clock, History, BarChart3, Loader2 } from "lucide-react";
import SourceCard from "@/components/dashboard/SourceCard";
import StatsCard from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import TableauAuthModal from "@/components/workspace/TableauAuthModal";
import { TableauIcon, MicroStrategyIcon, SAPBOIcon, CognosIcon } from "@/components/icons/SourceIcons";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";
const STATIC_WORKSPACE_ID = "1c780154-a538-447a-81a6-dd97636b60dd";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [showTableauAuth, setShowTableauAuth] = useState(false);
  const [isAddingSP, setIsAddingSP] = useState(false);

  // Add service principal to workspace
  const addServicePrincipalToWorkspace = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: STATIC_WORKSPACE_ID }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Add SP failed:", errorData.detail || errorData);
        return false;
      }
      console.log("Service Principal added successfully");
      return true;
    } catch (err) {
      console.error("Network error adding SP:", err);
      return false;
    }
  };

  useEffect(() => {
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("selected_workbook");
  }, []);

  const handleSourceClick = async (sourceId: string) => {
    if (sourceId === "tableau") {
      // Call add-sp endpoint before opening Tableau auth modal
      setIsAddingSP(true);
      await addServicePrincipalToWorkspace();
      setIsAddingSP(false);
      setShowTableauAuth(true);
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
              <SourceCard
                key={source.id}
                sourceId={source.id}
                title={source.title}
                description={source.description}
                icon={source.icon}
                color={source.color}
                onClick={() => handleSourceClick(source.id)}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
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
