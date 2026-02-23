// import { useState, useEffect } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { ArrowLeft, Search, RefreshCw, ChevronRight, LayoutGrid, List, BookOpen } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import TreeView from "@/components/explorer/TreeView";
// import AppLayout from "@/components/layout/AppLayout";
// import { sampleTableauTree } from "@/data/sampleTree";
// import { TreeNode } from "@/types/migration";
// import { buildTableauTree } from "@/data/tableauTreeMapper";
// import { useToast } from "@/hooks/use-toast";
// import { Loader2 } from "lucide-react";

// const sourceNames: Record<string, string> = {
//   tableau: "Tableau",
//   microstrategy: "MicroStrategy",
//   sapbo: "SAP BusinessObjects",
//   cognos: "IBM Cognos",
// };

// interface WorkbookItem {
//   id: string;
//   name: string;
//   projectName: string;
//   viewCount: number;
// }

// const Explorer = () => {
//   const { sourceId } = useParams<{ sourceId: string }>();
//   const navigate = useNavigate();
//   const { toast } = useToast();

//   const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
//   const [selectedWorkbook, setSelectedWorkbook] = useState<WorkbookItem | null>(null);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [treeData, setTreeData] = useState<TreeNode[]>(sampleTableauTree);
//   const [workbooks, setWorkbooks] = useState<WorkbookItem[]>([]);
//   const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [isMigrating, setIsMigrating] = useState(false);

//   const sourceName = sourceNames[sourceId || ""] || "Unknown";

//   // ---------------- Extract workbooks for Grid View ----------------
//   const extractWorkbooks = (tree: TreeNode[]): WorkbookItem[] => {
//     const list: WorkbookItem[] = [];

//     const traverse = (nodes: TreeNode[], projectName = "") => {
//       nodes.forEach((node) => {
//         if (node.type === "project" && node.children) {
//           traverse(node.children, node.name);
//         } else if (node.type === "workbook") {
//           list.push({
//             id: node.id,
//             name: node.name,
//             projectName,
//             viewCount: node.children?.length || 0,
//           });
//         } else if (node.children) {
//           traverse(node.children, projectName);
//         }
//       });
//     };

//     traverse(tree);
//     return list;
//   };

//   // ---------------- Load Tableau Tree ----------------
//   useEffect(() => {
//     if (sourceId === "tableau") {
//       const storedTree = sessionStorage.getItem("tableau_tree");
//       if (storedTree) {
//         const parsed = JSON.parse(storedTree);
//         setTreeData(parsed);
//         setWorkbooks(extractWorkbooks(parsed));
//       }
//     }
//   }, [sourceId]);

//   // ---------------- Refresh ----------------
//   const handleRefresh = async () => {
//     if (sourceId !== "tableau") return;

//     const token = sessionStorage.getItem("tableau_api_token");
//     if (!token) {
//       toast({
//         title: "Session expired",
//         description: "Please sign in again",
//         variant: "destructive",
//       });
//       navigate("/");
//       return;
//     }

//     setIsRefreshing(true);
//     try {
//       const response = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/fetch_data",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ api_token: token }),
//         },
//       );

//       const data = await response.json();
//       const newTree = buildTableauTree(data);

//       sessionStorage.setItem("tableau_tree", JSON.stringify(newTree));
//       setTreeData(newTree);
//       setWorkbooks(extractWorkbooks(newTree));

//       toast({ title: "Refreshed", description: "Tableau content updated" });
//     } catch {
//       toast({
//         title: "Refresh failed",
//         description: "Could not refresh Tableau content",
//         variant: "destructive",
//       });
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   // ---------------- Navigation ----------------
//   const handleMigrateWorkbook = async () => {
//     console.log("[MIGRATE] handleMigrateWorkbook called, selectedWorkbook:", selectedWorkbook);
//     if (!selectedWorkbook) {
//       console.log("[MIGRATE] No workbook selected, returning early");
//       return;
//     }

//     const findNode = (nodes: TreeNode[]): TreeNode | null => {
//       for (const node of nodes) {
//         if (node.id === selectedWorkbook.id) return node;
//         if (node.children) {
//           const found = findNode(node.children);
//           if (found) return found;
//         }
//       }
//       return null;
//     };

//     const workbookNode = findNode(treeData);
//     if (!workbookNode) return;

//     const token = sessionStorage.getItem("tableau_api_token");
//     console.log("[MIGRATE] Token exists:", !!token);
//     if (!token) {
//       toast({
//         title: "Session expired",
//         description: "Please sign in again",
//         variant: "destructive",
//       });
//       navigate("/");
//       return;
//     }

//     setIsMigrating(true);
//     console.log("[MIGRATE] Starting download_workbook...");

//     try {
//       // Step 1: Download workbook
//       const downloadWorkbookResponse = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             api_token: token,
//             workbook_id: selectedWorkbook.id,
//             file_name: `${selectedWorkbook.name}.twbx`,
//           }),
//         },
//       );

//       if (!downloadWorkbookResponse.ok) {
//         throw new Error("Failed to download workbook");
//       }

//       const downloadWorkbookData = await downloadWorkbookResponse.json();
//       console.log("Workbook downloaded:", downloadWorkbookData);

//       // Use blob_path from download response for extraction
//       const blobPath =
//         downloadWorkbookData.blob_path || downloadWorkbookData.file_name || `${selectedWorkbook.name}.twbx`;
//       console.log("Using blob_path for extraction:", blobPath);

//       // Step 2: Download workbook datasources
//       const downloadDatasourcesResponse = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook_datasources",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             api_token: token,
//             workbook_id: selectedWorkbook.id,
//           }),
//         },
//       );

//       if (!downloadDatasourcesResponse.ok) {
//         throw new Error("Failed to download datasources");
//       }

//       const downloadDatasourcesData = await downloadDatasourcesResponse.json();
//       console.log("Datasources downloaded:", downloadDatasourcesData);

//       // Step 3: Extract data
//       const extractDataResponse = await fetch(
//         "https://dataset-extraction2-gbdnhcd0dxeaf6df.eastus-01.azurewebsites.net/extract-data",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             blob_path: blobPath,
//           }),
//         },
//       );

//       if (!extractDataResponse.ok) {
//         throw new Error("Failed to extract data");
//       }

//       const extractDataResult = await extractDataResponse.json();
//       console.log("Data extracted:", extractDataResult);

//       // Store extraction output files and folder URL in sessionStorage
//       const outputFiles = extractDataResult.output_files || [];
//       sessionStorage.setItem("extraction_output_files", JSON.stringify(outputFiles));

//       // Derive the blob folder URL from the output files
//       // if (outputFiles.length > 0) {
//       //   const firstFileUrl = outputFiles[0];
//       //   const folderUrl = firstFileUrl.substring(0, firstFileUrl.lastIndexOf("/") + 1);
//       //   sessionStorage.setItem("extraction_output_folder", folderUrl);
//       //   console.log("Blob folder URL:", folderUrl);
//       //   console.log("All extracted files:", outputFiles);
//       // }

//       // Store workbook data in session storage
//       const workbookData = {
//         id: selectedWorkbook.id,
//         name: selectedWorkbook.name,
//         projectName: selectedWorkbook.projectName,
//         viewCount: selectedWorkbook.viewCount,
//       };
//       sessionStorage.setItem("selected_workbook", JSON.stringify(workbookData));

//       toast({
//         title: "Preparation complete",
//         description: "Ready to select destination workspace",
//       });

//       // Navigate to workspace selection
//       navigate("/workspace-selection", {
//         state: { node: workbookNode, source: sourceId },
//       });
//     } catch (error) {
//       const message = error instanceof Error ? error.message : "Migration preparation failed";
//       toast({
//         title: "Migration failed",
//         description: message,
//         variant: "destructive",
//       });
//     } finally {
//       setIsMigrating(false);
//     }
//   };

//   const handleMigrateNode = async () => {
//     console.log("[MIGRATE-TREE] handleMigrateNode called, selectedNode:", selectedNode);
//     if (!selectedNode) {
//       console.log("[MIGRATE-TREE] No node selected, returning early");
//       return;
//     }

//     const token = sessionStorage.getItem("tableau_api_token");
//     console.log("[MIGRATE-TREE] Token exists:", !!token);
//     if (!token) {
//       toast({
//         title: "Session expired",
//         description: "Please sign in again",
//         variant: "destructive",
//       });
//       navigate("/");
//       return;
//     }

//     setIsMigrating(true);
//     console.log("[MIGRATE-TREE] Starting download_workbook...");

//     try {
//       // Step 1: Download workbook
//       const downloadWorkbookResponse = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             api_token: token,
//             workbook_id: selectedNode.id,
//             file_name: `${selectedNode.name}.twbx`,
//           }),
//         },
//       );

//       if (!downloadWorkbookResponse.ok) {
//         throw new Error("Failed to download workbook");
//       }

//       const downloadWorkbookData = await downloadWorkbookResponse.json();
//       console.log("Workbook downloaded:", downloadWorkbookData);

//       // Use blob_path from download response for extraction
//       const blobPath = downloadWorkbookData.blob_path || downloadWorkbookData.file_name || `${selectedNode.name}.twbx`;
//       console.log("Using blob_path for extraction:", blobPath);

//       // Step 2: Download workbook datasources
//       const downloadDatasourcesResponse = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook_datasources",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             api_token: token,
//             workbook_id: selectedNode.id,
//           }),
//         },
//       );

//       if (!downloadDatasourcesResponse.ok) {
//         throw new Error("Failed to download datasources");
//       }

//       const downloadDatasourcesData = await downloadDatasourcesResponse.json();
//       console.log("Datasources downloaded:", downloadDatasourcesData);

//       // Step 3: Extract data
//       const extractDataResponse = await fetch(
//         "https://dataset-extraction2-gbdnhcd0dxeaf6df.eastus-01.azurewebsites.net/extract-data",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             blob_path: blobPath,
//           }),
//         },
//       );

//       if (!extractDataResponse.ok) {
//         throw new Error("Failed to extract data");
//       }

//       const extractDataResult = await extractDataResponse.json();
//       console.log("Data extracted:", extractDataResult);

//       // Store extraction output files and folder URL in sessionStorage
//       const outputFiles = extractDataResult.output_files || [];
//       sessionStorage.setItem("extraction_output_files", JSON.stringify(outputFiles));

//       // Derive the blob folder URL from the output files
//       // if (outputFiles.length > 0) {
//       //   const firstFileUrl = outputFiles[0];
//       //   const folderUrl = firstFileUrl.substring(0, firstFileUrl.lastIndexOf("/") + 1);
//       //   sessionStorage.setItem("extraction_output_folder", folderUrl);
//       //   console.log("Blob folder URL:", folderUrl);
//       //   console.log("All extracted files:", outputFiles);
//       // }

//       // Store selected node data in session storage
//       const nodeData = {
//         id: selectedNode.id,
//         name: selectedNode.name,
//         type: selectedNode.type,
//       };
//       sessionStorage.setItem("selected_workbook", JSON.stringify(nodeData));

//       toast({
//         title: "Preparation complete",
//         description: "Ready to select destination workspace",
//       });

//       // Navigate to workspace selection
//       navigate("/workspace-selection", {
//         state: { node: selectedNode, source: sourceId },
//       });
//     } catch (error) {
//       const message = error instanceof Error ? error.message : "Migration preparation failed";
//       toast({
//         title: "Migration failed",
//         description: message,
//         variant: "destructive",
//       });
//     } finally {
//       setIsMigrating(false);
//     }
//   };

//   const filteredWorkbooks = workbooks.filter(
//     (w) =>
//       w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       w.projectName.toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   // ============================== UI ==============================
//   return (
//     <AppLayout>
//       <div className="max-w-7xl mx-auto h-full flex flex-col">
//         {/* Breadcrumb */}
//         <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-shrink-0">
//           <button onClick={() => navigate("/")}>Dashboard</button>
//           <ChevronRight className="w-4 h-4" />
//           <span className="text-foreground font-medium">{sourceName} Explorer</span>
//         </div>

//         {/* Header */}
//         <div className="flex items-center justify-between mb-4 flex-shrink-0">
//           <div className="flex items-center gap-3">
//             <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
//               <ArrowLeft className="w-5 h-5" />
//             </Button>
//             <div>
//               <h1 className="text-xl font-bold">{sourceName} Workbooks</h1>
//               <p className="text-sm text-muted-foreground">Select content to migrate to Power BI</p>
//             </div>
//           </div>

//           <div className="flex items-center gap-2">
//             <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
//               <LayoutGrid className="w-4 h-4" />
//             </Button>
//             <Button variant={viewMode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tree")}>
//               <List className="w-4 h-4" />
//             </Button>
//             <Button variant="outline" size="sm" onClick={handleRefresh}>
//               <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
//               Refresh
//             </Button>
//           </div>
//         </div>

//         {/* ================= GRID VIEW ================= */}
//         {viewMode === "grid" && (
//           <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
//             <div className="p-3 border-b border-border flex-shrink-0">
//               <Input
//                 placeholder="Search workbooks..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//               />
//             </div>

//             <div className="p-4 flex-1 overflow-y-auto">
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
//                 {filteredWorkbooks.map((wb) => (
//                   <button
//                     key={wb.id}
//                     onClick={() => setSelectedWorkbook(wb)}
//                     className={`p-4 rounded-lg border text-left ${
//                       selectedWorkbook?.id === wb.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
//                     }`}
//                   >
//                     <BookOpen className="w-5 h-5 mb-2" />
//                     <p className="font-medium text-sm">{wb.name}</p>
//                     <p className="text-xs text-muted-foreground">{wb.projectName}</p>
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {selectedWorkbook && (
//               <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
//                 <Button variant="powerbi" size="lg" onClick={handleMigrateWorkbook} disabled={isMigrating}>
//                   {isMigrating ? (
//                     <>
//                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                       Preparing Migration...
//                     </>
//                   ) : (
//                     "Migrate to Power BI"
//                   )}
//                 </Button>
//               </div>
//             )}
//           </div>
//         )}

//         {/* ================= TREE VIEW ================= */}
//         {viewMode === "tree" && (
//           <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
//             <div className="p-3 border-b border-border flex-shrink-0">
//               <Input
//                 placeholder="Search reports, dashboards, workbooks..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//               />
//             </div>

//             <div className="flex-1 overflow-y-auto">
//               <TreeView nodes={treeData} selectedId={selectedNode?.id || null} onSelect={setSelectedNode} />
//             </div>

//             {selectedNode && (
//               <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
//                 <Button variant="powerbi" size="lg" onClick={handleMigrateNode} disabled={isMigrating}>
//                   {isMigrating ? (
//                     <>
//                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                       Preparing Migration...
//                     </>
//                   ) : (
//                     "Migrate to Power BI"
//                   )}
//                 </Button>
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     </AppLayout>
//   );
// };

// export default Explorer;

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  LayoutGrid,
  List,
  BookOpen,
  Search,
  Zap,
  FolderOpen,
  Eye,
} from "lucide-react";
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sourceName = sourceNames[sourceId || ""] || "Unknown";

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

  const handleRefresh = async () => {
    if (sourceId !== "tableau") return;
    const token = sessionStorage.getItem("tableau_api_token");
    if (!token) {
      toast({ title: "Session expired", description: "Please sign in again", variant: "destructive" });
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
      toast({ title: "Refresh failed", description: "Could not refresh Tableau content", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const runMigrationSteps = async (workbookId: string, workbookName: string) => {
    const token = sessionStorage.getItem("tableau_api_token");
    if (!token) {
      toast({ title: "Session expired", description: "Please sign in again", variant: "destructive" });
      navigate("/");
      return null;
    }

    const downloadWorkbookResponse = await fetch(
      "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: token, workbook_id: workbookId, file_name: `${workbookName}.twbx` }),
      },
    );
    if (!downloadWorkbookResponse.ok) throw new Error("Failed to download workbook");
    const downloadWorkbookData = await downloadWorkbookResponse.json();
    const blobPath = downloadWorkbookData.blob_path || downloadWorkbookData.file_name || `${workbookName}.twbx`;

    const downloadDatasourcesResponse = await fetch(
      "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/download_workbook_datasources",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: token, workbook_id: workbookId }),
      },
    );
    if (!downloadDatasourcesResponse.ok) throw new Error("Failed to download datasources");

    const extractDataResponse = await fetch(
      "https://dataset-extraction2-gbdnhcd0dxeaf6df.eastus-01.azurewebsites.net/extract-data",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blob_path: blobPath }),
      },
    );
    if (!extractDataResponse.ok) throw new Error("Failed to extract data");
    const extractDataResult = await extractDataResponse.json();

    const outputFiles = extractDataResult.output_files || [];
    sessionStorage.setItem("extraction_output_files", JSON.stringify(outputFiles));

    return true;
  };

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

    setIsMigrating(true);
    try {
      await runMigrationSteps(selectedWorkbook.id, selectedWorkbook.name);
      sessionStorage.setItem("selected_workbook", JSON.stringify(selectedWorkbook));
      toast({ title: "Preparation complete", description: "Ready to select destination workspace" });
      navigate("/workspace-selection", { state: { node: workbookNode, source: sourceId } });
    } catch (error) {
      toast({
        title: "Migration failed",
        description: error instanceof Error ? error.message : "Migration preparation failed",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrateNode = async () => {
    if (!selectedNode) return;
    setIsMigrating(true);
    try {
      await runMigrationSteps(selectedNode.id, selectedNode.name);
      sessionStorage.setItem(
        "selected_workbook",
        JSON.stringify({ id: selectedNode.id, name: selectedNode.name, type: selectedNode.type }),
      );
      toast({ title: "Preparation complete", description: "Ready to select destination workspace" });
      navigate("/workspace-selection", { state: { node: selectedNode, source: sourceId } });
    } catch (error) {
      toast({
        title: "Migration failed",
        description: error instanceof Error ? error.message : "Migration preparation failed",
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-2">
        {/* Breadcrumb + Header — combined into one tight row */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">
                Dashboard
              </button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-semibold">{sourceName} Explorer</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View toggle — pill style */}
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "tree"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Tree
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats bar — quick glance info */}
        {viewMode === "grid" && workbooks.length > 0 && (
          <div className="flex items-center gap-4 px-1 flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredWorkbooks.length}</span>{" "}
              {filteredWorkbooks.length === 1 ? "workbook" : "workbooks"}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {selectedWorkbook && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Zap className="w-3 h-3" />
                {selectedWorkbook.name} selected
              </span>
            )}
          </div>
        )}

        {/* ================= GRID VIEW ================= */}
        {viewMode === "grid" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            {/* Search */}
            <div className="px-3 py-2 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search workbooks or projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="p-3 flex-1 overflow-y-auto">
              {filteredWorkbooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No workbooks found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredWorkbooks.map((wb) => {
                    const isSelected = selectedWorkbook?.id === wb.id;
                    const isHovered = hoveredId === wb.id;
                    return (
                      <button
                        key={wb.id}
                        onClick={() => setSelectedWorkbook(isSelected ? null : wb)}
                        onMouseEnter={() => setHoveredId(wb.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={`group relative p-3 rounded-lg border text-left transition-all duration-150 ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm"
                        }`}
                      >
                        {/* Selection indicator */}
                        {isSelected && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />}

                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center mb-2 transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}
                        >
                          <BookOpen className="w-4 h-4" />
                        </div>

                        <p className="font-medium text-sm leading-tight truncate pr-3">{wb.name}</p>

                        <div className="flex items-center justify-between mt-1.5 gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{wb.projectName || "—"}</p>
                          </div>
                          {wb.viewCount > 0 && (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Eye className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{wb.viewCount}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer action bar */}
            <div
              className={`px-3 py-2 border-t border-border flex items-center justify-between flex-shrink-0 transition-all ${selectedWorkbook ? "bg-primary/3" : ""}`}
            >
              <span className="text-xs text-muted-foreground">
                {selectedWorkbook ? `"${selectedWorkbook.name}" ready to migrate` : "Click a workbook to select it"}
              </span>
              <Button
                variant="powerbi"
                size="sm"
                onClick={handleMigrateWorkbook}
                disabled={!selectedWorkbook || isMigrating}
                className="h-8 text-xs gap-1.5 disabled:opacity-40"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Migrate to Power BI
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ================= TREE VIEW ================= */}
        {viewMode === "tree" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            {/* Search */}
            <div className="px-3 py-2 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search reports, dashboards, workbooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TreeView nodes={treeData} selectedId={selectedNode?.id || null} onSelect={setSelectedNode} />
            </div>

            {/* Footer action bar */}
            <div
              className={`px-3 py-2 border-t border-border flex items-center justify-between flex-shrink-0 transition-all ${selectedNode ? "bg-primary/3" : ""}`}
            >
              <span className="text-xs text-muted-foreground">
                {selectedNode ? `"${selectedNode.name}" ready to migrate` : "Select a node from the tree"}
              </span>
              <Button
                variant="powerbi"
                size="sm"
                onClick={handleMigrateNode}
                disabled={!selectedNode || isMigrating}
                className="h-8 text-xs gap-1.5 disabled:opacity-40"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Migrate to Power BI
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Explorer;
