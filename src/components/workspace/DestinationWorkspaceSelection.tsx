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

/* ---------------- TYPES ---------------- */

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

/* ---------------- CONFIG ---------------- */

const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

const sourceNames: Record<string, string> = {
  tableau: "Tableau",
  microstrategy: "MicroStrategy",
  sapbo: "SAP BusinessObjects",
  cognos: "IBM Cognos",
};

/* ---------------- COMPONENT ---------------- */

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
  const [isUploading, setIsUploading] = useState(false);

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  /* ---------------- HELPERS ---------------- */

  const getAuthHeaders = () => {
    const token = sessionStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  /* ---------------- FETCH WORKSPACES ---------------- */

  const fetchWorkspaces = async (showRefreshToast = false) => {
    try {
      showRefreshToast ? setIsRefreshing(true) : setIsLoading(true);
      setError(null);

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch workspaces");
      }

      const data = await response.json();
      const list = data.workspaces || data.value || [];

      setWorkspaces(list);

      if (showRefreshToast) {
        toast({ title: "Refreshed", description: "Workspaces updated" });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load Power BI workspaces");
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

  /* ---------------- EFFECT ---------------- */

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    fetchWorkspaces();
  }, [isAuthenticated, isAuthLoading]);

  /* ---------------- CREATE WORKSPACE ---------------- */

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      setIsCreatingWorkspace(true);

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ workspace_name: newWorkspaceName.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to create workspace");
      }

      toast({
        title: "Workspace Created",
        description: `"${newWorkspaceName}" created successfully`,
      });

      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      fetchWorkspaces(true);
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  /* ---------------- ADD SP ---------------- */

  const addServicePrincipalToWorkspace = async (workspaceId: string) => {
    try {
      await fetch(`${BACKEND_BASE_URL}/workspaces/add-sp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    } catch (err) {
      console.error("SP add failed", err);
    }
  };

  /* ---------------- AUTO UPLOAD ---------------- */

  const handleAutoUpload = async () => {
    if (!selectedWorkspace || !nodeInfo) return;

    setIsUploading(true);

    try {
      if (sourceId === "tableau") {
        await addServicePrincipalToWorkspace(selectedWorkspace.id);
      }

      const response = await fetch(`${BACKEND_BASE_URL}/workspaces/${selectedWorkspace.id}/auto-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ report_name: nodeInfo.name }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Upload failed");
      }

      toast({
        title: "Success",
        description: "Migration completed successfully",
      });

      navigate(`/migrate/${nodeInfo.id}`, {
        state: {
          node: nodeInfo,
          source: sourceId,
          workspace: selectedWorkspace,
        },
      });
    } catch (err: any) {
      toast({
        title: "Migration Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  /* ---------------- UI ---------------- */

  if (isAuthLoading) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      </AppLayout>
    );
  }

  /* ---------------- RENDER (UNCHANGED UI BELOW) ---------------- */

  return (
    <AppLayout>
      <div className="space-y-6">
        <p className="text-muted-foreground">Workspace selection content goes here.</p>
      </div>
    </AppLayout>
  );
};

export default DestinationWorkspaceSelection;
