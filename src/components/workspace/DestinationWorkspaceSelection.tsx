import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileText,
  Database,
  Loader2,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  ArrowLeft,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/layout/AppLayout";
import MigrationSummaryDialog from "@/components/workspace/MigrationSummaryDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { useAuth } from "@/contexts/AuthContext";
import { TreeNode } from "@/types/migration";

interface PowerBIReport {
  id: string;
  name: string;
}

interface PowerBIDataset {
  id: string;
  name: string;
}

interface PowerBIWorkspace {
  id: string;
  name: string;
  reports?: PowerBIReport[];
  datasets?: PowerBIDataset[];
}

export interface SelectedPowerBIWorkspace {
  id: string;
  name: string;
}

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const sourceNames: Record<string, string> = {
  tableau: "Tableau",
  microstrategy: "MicroStrategy",
  sapbo: "SAP BusinessObjects",
  cognos: "IBM Cognos",
};

const DestinationWorkspaceSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const nodeInfo = location.state?.node as TreeNode | undefined;
  const sourceId = location.state?.source as string | undefined;
  const sourceName = sourceNames[sourceId || ""] || "Unknown";

  const [workspaces, setWorkspaces] = useState<PowerBIWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<SelectedPowerBIWorkspace | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  // --- API: FETCH WORKSPACES ---
  const fetchWorkspaces = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch workspaces");

      const data = await response.json();
      const workspacesList = Array.isArray(data) ? data : data.workspaces || [];
      setWorkspaces(workspacesList);

      if (showRefreshToast) {
        toast({ title: "Refreshed", description: "Workspaces list updated" });
      }
    } catch (err) {
      setError("Failed to load Power BI workspaces.");
      toast({ title: "Error", description: "Could not load workspaces", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) fetchWorkspaces();
    if (!isAuthLoading && !isAuthenticated) navigate("/login", { replace: true });
  }, [isAuthenticated, isAuthLoading]);

  // --- API: CREATE WORKSPACE ---
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    try {
      setIsCreatingWorkspace(true);
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_name: newWorkspaceName.trim() }),
      });

      if (!response.ok) throw new Error("Failed to create workspace");

      toast({ title: "Success", description: "Workspace created successfully" });
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      fetchWorkspaces(true);
    } catch (err) {
      toast({ title: "Error", description: "Unable to create workspace", variant: "destructive" });
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // --- API: ADD SERVICE PRINCIPAL (The critical 403 step) ---
  const addServicePrincipalToWorkspace = async (workspaceId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Access Denied (403):", errorData.detail || errorData);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Network error adding SP:", err);
      return false;
    }
  };

  const handleAutoUpload = async () => {
    if (!selectedWorkspace || !nodeInfo) return;

    setIsUploading(true);
    try {
      // Step 1: Add Service Principal (Required for automated migrations)
      const spAdded = await addServicePrincipalToWorkspace(selectedWorkspace.id);

      if (!spAdded) {
        toast({
          title: "Permission Warning",
          description:
            "Could not add automation agent to workspace. Migration might fail if permissions aren't manualy set.",
          variant: "destructive",
        });
      }

      // Step 2: Trigger Upload
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/${selectedWorkspace.id}/auto-upload`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_name: nodeInfo.name }),
      });

      if (!response.ok) throw new Error("Auto-upload failed");

      toast({ title: "Success", description: "Migration started successfully" });
      navigate(`/migrate/${nodeInfo.id}`, {
        state: { node: nodeInfo, source: sourceId, workspace: selectedWorkspace },
      });
    } catch (err) {
      toast({ title: "Migration Failed", description: "Check console for details", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredWorkspaces = workspaces.filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isAuthLoading)
    return (
      <div className="p-20 text-center">
        <Loader2 className="animate-spin mx-auto" />
      </div>
    );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto h-full flex flex-col p-4">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Select Destination</h1>
              <p className="text-sm text-muted-foreground">Target Workspace for {nodeInfo?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              + New Workspace
            </Button>
            <Button variant="outline" onClick={() => fetchWorkspaces(true)} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
            </Button>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 gap-4 p-4" : "flex flex-col p-2"}>
              {filteredWorkspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => setSelectedWorkspace({ id: ws.id, name: ws.name })}
                  className={`cursor-pointer border rounded-lg p-4 transition-all ${
                    selectedWorkspace?.id === ws.id
                      ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="text-blue-500 w-5 h-5" />
                    <span className="font-semibold text-slate-700 truncate">{ws.name}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {ws.reports?.length || 0} Reports • {ws.datasets?.length || 0} Datasets
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Footer */}
        {selectedWorkspace && (
          <div className="mt-4 p-4 border-t flex justify-between items-center bg-slate-50 rounded-lg">
            <p className="text-sm">
              Selected: <span className="font-bold">{selectedWorkspace.name}</span>
            </p>
            <Button
              size="lg"
              onClick={handleAutoUpload}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : null}
              Migrate to Power BI
            </Button>
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={isCreatingWorkspace}>
              {isCreatingWorkspace ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DestinationWorkspaceSelection;
