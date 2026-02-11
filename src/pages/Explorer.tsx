import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
 import { ArrowLeft, Search, RefreshCw, ChevronRight, LayoutGrid, List, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TreeView from "@/components/explorer/TreeView";
import AppLayout from "@/components/layout/AppLayout";
import { sampleTableauTree } from "@/data/sampleTree";
import { TreeNode } from "@/types/migration";
import { buildTableauTree } from "@/data/tableauTreeMapper";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const sourceNames: Record<string, string> = {
  tableau: "Tableau",
  microstrategy: "MicroStrategy",
  sapbo: "SAP BusinessObjects",
  cognos: "IBM Cognos",
};

interface WorkbookItem {
  id: string;
  name: string;
  projectName: string;
  viewCount: number;
}

const Explorer = () => {
  const { sourceId } = useParams<{ sourceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedWorkbook, setSelectedWorkbook] = useState<WorkbookItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [treeData, setTreeData] = useState<TreeNode[]>(sampleTableauTree);
  const [workbooks, setWorkbooks] = useState<WorkbookItem[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const sourceName = sourceNames[sourceId || ""] || "Unknown";

  // ---------------- Extract workbooks for Grid View ----------------
  const extractWorkbooks = (tree: TreeNode[]): WorkbookItem[] => {
    const list: WorkbookItem[] = [];

    const traverse = (nodes: TreeNode[], projectName = "") => {
      nodes.forEach((node) => {
        if (node.type === "project" && node.children) {
          traverse(node.children, node.name);
        } else if (node.type === "workbook") {
          list.push({
            id: node.id,
            name: node.name,
            projectName,
            viewCount: node.children?.length || 0,
          });
        } else if (node.children) {
          traverse(node.children, projectName);
        }
      });
    };

    traverse(tree);
    return list;
  };

  // ---------------- Load Tableau Tree ----------------
  useEffect(() => {
    if (sourceId === "tableau") {
      const storedTree = sessionStorage.getItem("tableau_tree");
      if (storedTree) {
        const parsed = JSON.parse(storedTree);
        setTreeData(parsed);
        setWorkbooks(extractWorkbooks(parsed));
      }
    }
  }, [sourceId]);

  // ---------------- Refresh ----------------
  const handleRefresh = async () => {
    if (sourceId !== "tableau") return;

    const token = sessionStorage.getItem("tableau_api_token");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please sign in again",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch(
        "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/fetch_data",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_token: token }),
        },
      );

      const data = await response.json();
      const newTree = buildTableauTree(data);

      sessionStorage.setItem("tableau_tree", JSON.stringify(newTree));
      setTreeData(newTree);
      setWorkbooks(extractWorkbooks(newTree));

      toast({ title: "Refreshed", description: "Tableau content updated" });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Could not refresh Tableau content",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // ---------------- Navigation ----------------
  const handleMigrateWorkbook = async () => {
    if (!selectedWorkbook) return;

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === selectedWorkbook.id) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const workbookNode = findNode(treeData);
    if (!workbookNode) return;

    const token = sessionStorage.getItem("tableau_api_token");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please sign in again",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsMigrating(true);

    try {
      // Step 1: Download workbook
      const downloadWorkbookResponse = await fetch(
        "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_token: token,
            workbook_id: selectedWorkbook.id,
            file_name: `${selectedWorkbook.name}.twbx`,
          }),
        }
      );

      if (!downloadWorkbookResponse.ok) {
        throw new Error("Failed to download workbook");
      }

      const downloadWorkbookData = await downloadWorkbookResponse.json();
      console.log("Workbook downloaded:", downloadWorkbookData);

      // Step 2: Download workbook datasources
      const downloadDatasourcesResponse = await fetch(
        "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook_datasources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_token: token,
            workbook_id: selectedWorkbook.id,
          }),
        }
      );

      if (!downloadDatasourcesResponse.ok) {
        throw new Error("Failed to download datasources");
      }

      const downloadDatasourcesData = await downloadDatasourcesResponse.json();
      console.log("Datasources downloaded:", downloadDatasourcesData);

      // Step 3: Extract data
      const extractDataResponse = await fetch(
        "https://dataset-extraction-b0erfxbtereygmgz.eastus-01.azurewebsites.net/extract-data",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blob_path: `${selectedWorkbook.name}.twbx`,
          }),
        }
      );

      if (!extractDataResponse.ok) {
        throw new Error("Failed to extract data");
      }

      const extractDataResult = await extractDataResponse.json();
      console.log("=== Extract Data Response ===");
      console.log("Full response:", JSON.stringify(extractDataResult, null, 2));
      console.log("Output folder:", extractDataResult.folder || extractDataResult.output_folder);
      console.log("Uploaded files:", extractDataResult.files || extractDataResult.uploaded_files);
      console.log("=============================");

      // Store workbook data in session storage
      const workbookData = {
        id: selectedWorkbook.id,
        name: selectedWorkbook.name,
        projectName: selectedWorkbook.projectName,
        viewCount: selectedWorkbook.viewCount,
      };
      sessionStorage.setItem("selected_workbook", JSON.stringify(workbookData));

      toast({
        title: "Preparation complete",
        description: "Ready to select destination workspace",
      });

      // Navigate to workspace selection
      navigate("/workspace-selection", {
        state: { node: workbookNode, source: sourceId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration preparation failed";
      toast({
        title: "Migration failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrateNode = async () => {
    if (!selectedNode) return;

    const token = sessionStorage.getItem("tableau_api_token");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please sign in again",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsMigrating(true);

    try {
      // Step 1: Download workbook
      const downloadWorkbookResponse = await fetch(
        "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_token: token,
            workbook_id: selectedNode.id,
            file_name: `${selectedNode.name}.twbx`,
          }),
        }
      );

      if (!downloadWorkbookResponse.ok) {
        throw new Error("Failed to download workbook");
      }

      const downloadWorkbookData = await downloadWorkbookResponse.json();
      console.log("Workbook downloaded:", downloadWorkbookData);

      // Step 2: Download workbook datasources
      const downloadDatasourcesResponse = await fetch(
        "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook_datasources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_token: token,
            workbook_id: selectedNode.id,
          }),
        }
      );

      if (!downloadDatasourcesResponse.ok) {
        throw new Error("Failed to download datasources");
      }

      const downloadDatasourcesData = await downloadDatasourcesResponse.json();
      console.log("Datasources downloaded:", downloadDatasourcesData);

      // Step 3: Extract data
      const extractDataResponse = await fetch(
        "https://dataset-extraction-b0erfxbtereygmgz.eastus-01.azurewebsites.net/extract-data",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blob_path: `${selectedNode.name}.twbx`,
          }),
        }
      );

      if (!extractDataResponse.ok) {
        throw new Error("Failed to extract data");
      }

      const extractDataResult = await extractDataResponse.json();
      console.log("=== Extract Data Response ===");
      console.log("Full response:", JSON.stringify(extractDataResult, null, 2));
      console.log("Output folder:", extractDataResult.folder || extractDataResult.output_folder);
      console.log("Uploaded files:", extractDataResult.files || extractDataResult.uploaded_files);
      console.log("=============================");

    // Store selected node data in session storage
    const nodeData = {
      id: selectedNode.id,
      name: selectedNode.name,
      type: selectedNode.type,
    };
    sessionStorage.setItem("selected_workbook", JSON.stringify(nodeData));

      toast({
        title: "Preparation complete",
        description: "Ready to select destination workspace",
      });

    // Navigate to workspace selection
    navigate("/workspace-selection", {
      state: { node: selectedNode, source: sourceId },
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration preparation failed";
      toast({
        title: "Migration failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredWorkbooks = workbooks.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.projectName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ============================== UI ==============================
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-shrink-0">
          <button onClick={() => navigate("/")}>Dashboard</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{sourceName} Explorer</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{sourceName} Workbooks</h1>
              <p className="text-sm text-muted-foreground">Select content to migrate to Power BI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tree")}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ================= GRID VIEW ================= */}
        {viewMode === "grid" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-border flex-shrink-0">
              <Input
                placeholder="Search workbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredWorkbooks.map((wb) => (
                  <button
                    key={wb.id}
                    onClick={() => setSelectedWorkbook(wb)}
                    className={`p-4 rounded-lg border text-left ${
                      selectedWorkbook?.id === wb.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <BookOpen className="w-5 h-5 mb-2" />
                    <p className="font-medium text-sm">{wb.name}</p>
                    <p className="text-xs text-muted-foreground">{wb.projectName}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedWorkbook && (
              <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
                <Button variant="powerbi" size="lg" onClick={handleMigrateWorkbook} disabled={isMigrating}>
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparing Migration...
                    </>
                  ) : (
                    "Migrate to Power BI"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ================= TREE VIEW ================= */}
        {viewMode === "tree" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-border flex-shrink-0">
              <Input
                placeholder="Search reports, dashboards, workbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <TreeView nodes={treeData} selectedId={selectedNode?.id || null} onSelect={setSelectedNode} />
            </div>

            {selectedNode && (
              <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
                <Button variant="powerbi" size="lg" onClick={handleMigrateNode} disabled={isMigrating}>
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparing Migration...
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
    </AppLayout>
  );
};

export default Explorer;
