import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Loader2, FileStack } from "lucide-react";
import SourceCard from "@/components/dashboard/SourceCard";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import TableauAuthModal from "@/components/workspace/TableauAuthModal";
import { useToast } from "@/hooks/use-toast";

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";
const STATIC_WORKSPACE_ID = "7add5c6b-2552-4441-8799-838d0dbe3d12";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTableauAuth, setShowTableauAuth] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleTableauClick = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: STATIC_WORKSPACE_ID }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === "bypassed") {
          toast({
            title: "Access Sync in Progress",
            description: "AAD lookup delayed, but we've bypassed the check for you.",
          });
        } else {
          toast({
            title: "Access Confirmed",
            description: "Service Principal linked as Admin.",
          });
        }
        setShowTableauAuth(true);
      } else {
        toast({
          variant: "destructive",
          title: "Permission Error",
          description: data.detail || "Unable to grant Service Principal access.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not reach the backend server.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Migration Hub</h1>
          <Button variant="outline" onClick={() => navigate("/history")}>
            <History className="mr-2 h-4 w-4" /> History
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="relative cursor-pointer" onClick={() => !isVerifying && handleTableauClick()}>
            <SourceCard
              sourceId="tableau"
              title="Tableau → Power BI"
              description="Click to start migration"
              icon={<FileStack />}
              color="#E97627"
            />
            {isVerifying && (
              <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center rounded-xl z-30">
                <Loader2 className="animate-spin h-10 w-10 text-orange-600 mb-2" />
                <span className="text-xs font-bold text-orange-700">GRANTING ADMIN ACCESS...</span>
              </div>
            )}
          </div>
        </div>

        <TableauAuthModal
          isOpen={showTableauAuth}
          onSuccess={() => {
            setShowTableauAuth(false);
            navigate("/explore/tableau");
          }}
          onCancel={() => setShowTableauAuth(false)}
        />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
