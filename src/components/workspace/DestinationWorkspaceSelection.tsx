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
  type?: string;
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
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  // Get auth state from context
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Auto-upload state
  const [isUploading, setIsUploading] = useState(false);

  // Lakehouse password retry state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [lakehousePassword, setLakehousePassword] = useState("");
  const [isRetryingLakehouse, setIsRetryingLakehouse] = useState(false);
  const [pendingLakehousePayload, setPendingLakehousePayload] = useState<{ file_name: string; workspace_id: string } | null>(null);

  const fetchWorkspaces = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired or not authenticated - redirect to login
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch workspaces");
      }

      const data = await response.json();
      // Handle both array response and object with workspaces property
      const workspacesList = Array.isArray(data) ? data : data.workspaces || data.value || [];
       
       console.log("Workspaces loaded:", workspacesList.length, "workspaces");
       // Log first workspace to verify structure
       if (workspacesList.length > 0) {
         console.log("Sample workspace data:", {
           name: workspacesList[0].name,
           reportsCount: workspacesList[0].reports?.length || 0,
           datasetsCount: workspacesList[0].datasets?.length || 0,
         });
       }
       
       setWorkspaces(workspacesList);

      if (showRefreshToast) {
        toast({ title: "Refreshed", description: "Workspaces list updated" });
      }
    } catch (err) {
      console.error("Error fetching workspaces:", err);
      setError("Failed to load Power BI workspaces. Please try again.");
      toast({
        title: "Error",
        description: "Could not load Power BI workspaces",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Redirect to login if not authenticated, otherwise fetch workspaces
  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      // Not authenticated - redirect to login
      navigate("/login", { replace: true });
      return;
    }

    // Already authenticated via Azure AD - fetch workspaces
    fetchWorkspaces();
  }, [isAuthenticated, isAuthLoading, navigate]);

  const handleRefresh = () => fetchWorkspaces(true);

  const toggleExpand = (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId);
      } else {
        newSet.add(workspaceId);
      }
      return newSet;
    });
  };

  const handleWorkspaceSelect = (workspace: PowerBIWorkspace) => {
    setSelectedWorkspace({ id: workspace.id, name: workspace.name });
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast({
        title: "Workspace name required",
        description: "Please enter a workspace name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingWorkspace(true);

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_name: newWorkspaceName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to create workspace");
      }

      toast({
        title: "Workspace Created",
        description: `Workspace "${newWorkspaceName}" created successfully`,
      });

      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      fetchWorkspaces(true);
    } catch (err) {
      toast({
        title: "Creation Failed",
        description: err instanceof Error ? err.message : "Unable to create workspace",
        variant: "destructive",
      });
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // Add service principal to workspace
  const addServicePrincipalToWorkspace = async (workspaceId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        console.error("Failed to add service principal:", result);
        // Don't throw - this is a non-blocking operation for now
        return false;
      }

      console.log("Service principal added to workspace successfully");
      return true;
    } catch (err) {
      console.error("Error adding service principal to workspace:", err);
      return false;
    }
  };

  const LAKEHOUSE_URL = "https://live-data-lakehouse-erbghyatb6f4awgf.eastus-01.azurewebsites.net/api/v1/lakehouse/migrate";

  const callLakehouseMigrate = async (fileName: string, workspaceId: string, password?: string) => {
    const body: Record<string, string> = { file_name: fileName, workspace_id: workspaceId };
    if (password) body.password = password;

    const res = await fetch(LAKEHOUSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || data.status !== "success") {
      throw new Error(data.detail || data.message || "Lakehouse migration failed");
    }
    return data;
  };

  const handleAutoUpload = async () => {
    if (!selectedWorkspace || !nodeInfo) return;

    setIsUploading(true);
    try {
      // Add service principal to the selected workspace
      await addServicePrincipalToWorkspace(selectedWorkspace.id);

      // Get blob folder URL from extraction step (stored in sessionStorage)
      const blobFolderUrl = sessionStorage.getItem("extraction_output_folder") || "";
      const extractionFiles = sessionStorage.getItem("extraction_output_files") || "[]";

      console.log("Blob folder URL:", blobFolderUrl);
      console.log("Extraction files:", extractionFiles);

      const response = await fetch("https://report-uploader-awa8avchh6gqa3ad.eastus-01.azurewebsites.net/upload-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          workspace_id: selectedWorkspace.id,
          report_name: nodeInfo.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.message || "Failed to upload template");
      }

      console.log("Auto-upload successful:", result);

      // Store full response and key fields in sessionStorage
      sessionStorage.setItem("upload_response", JSON.stringify(result));
      sessionStorage.setItem("report_name", result.report_name || nodeInfo.name);
      sessionStorage.setItem("report_id", result.report_id || "");
      sessionStorage.setItem("workspace_id", result.workspace_id || selectedWorkspace.id);
      sessionStorage.setItem("workspace_name", selectedWorkspace.name);

      // ---- Lakehouse Migrate ----
      const fileName = `${nodeInfo.name}.twbx`;
      try {
        const lakehouseResult = await callLakehouseMigrate(fileName, selectedWorkspace.id);
        console.log("Lakehouse migration successful:", lakehouseResult);
        sessionStorage.setItem("lakehouse_response", JSON.stringify(lakehouseResult));

        toast({
          title: "Success",
          description: `Migration completed for "${selectedWorkspace.name}"`,
        });

        navigate(`/migrate/${nodeInfo.id}`, {
          state: { node: nodeInfo, source: sourceId, workspace: selectedWorkspace, blobFolderUrl },
        });
      } catch (lakehouseErr) {
        console.warn("Lakehouse migrate failed without password, prompting user:", lakehouseErr);
        setPendingLakehousePayload({ file_name: fileName, workspace_id: selectedWorkspace.id });
        setShowPasswordDialog(true);
      }
    } catch (err) {
      console.error("Migration error:", err);
      toast({
        title: "Migration Failed",
        description: err instanceof Error ? err.message : "Migration process failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordRetry = async () => {
    if (!pendingLakehousePayload || !lakehousePassword.trim()) return;

    setIsRetryingLakehouse(true);
    try {
      const lakehouseResult = await callLakehouseMigrate(
        pendingLakehousePayload.file_name,
        pendingLakehousePayload.workspace_id,
        lakehousePassword.trim(),
      );
      console.log("Lakehouse migration with password successful:", lakehouseResult);
      sessionStorage.setItem("lakehouse_response", JSON.stringify(lakehouseResult));

      setShowPasswordDialog(false);
      setLakehousePassword("");
      setPendingLakehousePayload(null);

      toast({
        title: "Success",
        description: "Lakehouse migration completed successfully",
      });

      const blobFolderUrl = sessionStorage.getItem("extraction_output_folder") || "";
      navigate(`/migrate/${nodeInfo!.id}`, {
        state: { node: nodeInfo, source: sourceId, workspace: selectedWorkspace, blobFolderUrl },
      });
    } catch (err) {
      console.error("Lakehouse retry failed:", err);
      toast({
        title: "Lakehouse Migration Failed",
        description: err instanceof Error ? err.message : "Please check the password and try again",
        variant: "destructive",
      });
    } finally {
      setIsRetryingLakehouse(false);
    }
  };

  const handleStartMigration = () => {
    if (selectedWorkspace && nodeInfo) {
      navigate(`/migrate/${nodeInfo.id}`, {
        state: {
          node: nodeInfo,
          source: sourceId,
          workspace: selectedWorkspace,
        },
      });
    }
  };

  const filteredWorkspaces = workspaces.filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Show loading while checking auth
  if (isAuthLoading || (!isAuthenticated && !isLoading)) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </AppLayout>
    );
  }

  if (!nodeInfo) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-muted-foreground">No report selected. Please go back and select a report.</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ===================== RENDER =====================
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-shrink-0">
          <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">
            Dashboard
          </button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => navigate(-1)} className="hover:text-foreground transition-colors">
            {sourceName} Explorer
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Select Destination</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Power BI Workspaces</h1>
              <p className="text-sm text-muted-foreground">Select destination for "{nodeInfo.name}"</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="powerbi" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              + Create Workspace
            </Button>

            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tree")}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading Power BI workspaces...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex items-center justify-center">
            <div className="text-center py-16">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" onClick={handleRefresh} className="mt-4">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && workspaces.length === 0 && isAuthenticated && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex items-center justify-center">
            <div className="text-center py-16">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No Power BI workspaces found for your account.</p>
            </div>
          </div>
        )}

        {/* GRID VIEW */}
        {!isLoading && !error && workspaces.length > 0 && viewMode === "grid" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredWorkspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSelect(workspace)}
                    className={`p-4 rounded-lg border text-left ${
                      selectedWorkspace?.id === workspace.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <FolderOpen className="w-5 h-5 mb-2 text-primary" />
                    <p className="font-medium text-sm">{workspace.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {workspace.reports?.length || 0} reports • {workspace.datasets?.length || 0} datasets
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selectedWorkspace && (
              <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
                 <Button variant="powerbi" size="lg" onClick={() => setShowMigrationDialog(true)} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading Template...
                    </>
                  ) : (
                    "Migrate to Power BI"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
        {/* TREE VIEW */}
        {!isLoading && !error && workspaces.length > 0 && viewMode === "tree" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="py-2">
                {filteredWorkspaces.map((workspace) => {
                  const isExpanded = expandedWorkspaces.has(workspace.id);
                  const isSelected = selectedWorkspace?.id === workspace.id;
                  const reports = workspace.reports || [];
                  const datasets = workspace.datasets || [];
                  const hasContent = reports.length > 0 || datasets.length > 0;

                  return (
                    <div key={workspace.id}>
                      <button
                        onClick={() => handleWorkspaceSelect(workspace)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-accent/50 ${
                          isSelected ? "bg-accent text-accent-foreground font-medium" : ""
                        }`}
                        style={{ paddingLeft: "12px" }}
                      >
                        <span className="w-4 h-4 flex items-center justify-center shrink-0">
                          {hasContent && (
                            <button
                              onClick={(e) => toggleExpand(workspace.id, e)}
                              className="hover:bg-muted rounded p-0.5"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </span>
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <span className="truncate">{workspace.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">Workspace</span>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && hasContent && (
                        <div className="tree-expand">
                          {/* Reports */}
                          {reports.map((report) => (
                            <div
                              key={report.id}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                              style={{ paddingLeft: "44px" }}
                            >
                              <FileText className="w-4 h-4 text-success" />
                              <span className="truncate">{report.name}</span>
                              <span className="ml-auto text-xs">Report</span>
                            </div>
                          ))}
                          {/* Datasets */}
                          {datasets.map((dataset) => (
                            <div
                              key={dataset.id}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                              style={{ paddingLeft: "44px" }}
                            >
                              <Database className="w-4 h-4 text-info" />
                              <span className="truncate">{dataset.name}</span>
                              <span className="ml-auto text-xs">Dataset</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedWorkspace && (
              <div className="p-4 border-t border-border flex justify-end">
                 <Button variant="powerbi" size="lg" onClick={() => setShowMigrationDialog(true)} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading Template...
                    </>
                  ) : (
                    "Migrate to Power BI"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migration Summary Dialog */}
      <MigrationSummaryDialog
        open={showMigrationDialog}
        onOpenChange={setShowMigrationDialog}
        sourceNode={nodeInfo}
        sourceName={sourceName}
        destinationWorkspace={selectedWorkspace}
         onConfirm={handleAutoUpload}
         isLoading={isUploading}
      />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Power BI Workspace</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Enter workspace name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            autoFocus
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="powerbi" onClick={handleCreateWorkspace} disabled={isCreatingWorkspace}>
              {isCreatingWorkspace ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lakehouse Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { if (!open) { setShowPasswordDialog(false); setLakehousePassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The data source requires authentication. Please enter the password to continue the migration.
          </p>
          <Input
            type="password"
            placeholder="Enter password"
            value={lakehousePassword}
            onChange={(e) => setLakehousePassword(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handlePasswordRetry(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setLakehousePassword(""); }}>
              Cancel
            </Button>
            <Button variant="powerbi" onClick={handlePasswordRetry} disabled={isRetryingLakehouse || !lakehousePassword.trim()}>
              {isRetryingLakehouse ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retrying...</> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DestinationWorkspaceSelection;
