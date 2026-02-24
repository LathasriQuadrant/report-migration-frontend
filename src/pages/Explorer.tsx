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
  ChevronLeft,
  CheckCircle2,
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

const T_BLUE = "#1F77B4";
const T_ORANGE = "#E8762B";
const ITEMS_PER_PAGE = 8;

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
}

// Soft distinct background colors cycled per card for visual variety
const CARD_ACCENTS = [
  { bg: "#EFF6FF", icon: "#3B82F6", text: "#1D4ED8" },
  { bg: "#FFF7ED", icon: "#F97316", text: "#C2410C" },
  { bg: "#F0FDF4", icon: "#22C55E", text: "#15803D" },
  { bg: "#FDF4FF", icon: "#A855F7", text: "#7E22CE" },
  { bg: "#FFF1F2", icon: "#F43F5E", text: "#BE123C" },
  { bg: "#F0F9FF", icon: "#0EA5E9", text: "#0369A1" },
  { bg: "#FEFCE8", icon: "#EAB308", text: "#A16207" },
  { bg: "#F0FDFA", icon: "#14B8A6", text: "#0F766E" },
];

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
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sourceName = sourceNames[sourceId || ""] || "Unknown";
  const isTableau = sourceId === "tableau";

  const extractWorkbooks = (tree: TreeNode[]): WorkbookItem[] => {
    const list: WorkbookItem[] = [];
    const traverse = (nodes: TreeNode[], projectName = "") => {
      nodes.forEach((node) => {
        if (node.type === "project" && node.children) traverse(node.children, node.name);
        else if (node.type === "workbook") list.push({ id: node.id, name: node.name, projectName });
        else if (node.children) traverse(node.children, projectName);
      });
    };
    traverse(tree);
    return list;
  };

  useEffect(() => {
    if (isTableau) {
      const storedTree = sessionStorage.getItem("tableau_tree");
      if (storedTree) {
        const parsed = JSON.parse(storedTree);
        setTreeData(parsed);
        setWorkbooks(extractWorkbooks(parsed));
      }
    }
  }, [sourceId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleRefresh = async () => {
    if (!isTableau) return;
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
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_token: token }) },
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
    const BASE = "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau";
    const dlRes = await fetch(`${BASE}/download_workbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: token, workbook_id: workbookId, file_name: `${workbookName}.twbx` }),
    });
    if (!dlRes.ok) throw new Error("Failed to download workbook");
    const dlData = await dlRes.json();
    const blobPath = dlData.blob_path || dlData.file_name || `${workbookName}.twbx`;

    const dsRes = await fetch(`${BASE}/download_workbook_datasources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: token, workbook_id: workbookId }),
    });
    if (!dsRes.ok) throw new Error("Failed to download datasources");

    const exRes = await fetch("https://dataset-extraction2-gbdnhcd0dxeaf6df.eastus-01.azurewebsites.net/extract-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blob_path: blobPath }),
    });
    if (!exRes.ok) throw new Error("Failed to extract data");
    const exData = await exRes.json();
    sessionStorage.setItem("extraction_output_files", JSON.stringify(exData.output_files || []));
    return true;
  };

  const handleMigrateWorkbook = async () => {
    if (!selectedWorkbook) return;
    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === selectedWorkbook.id) return node;
        if (node.children) {
          const f = findNode(node.children);
          if (f) return f;
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
  const totalPages = Math.max(1, Math.ceil(filteredWorkbooks.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedWorkbooks = filteredWorkbooks.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const PaginationBar = () => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={safePage === 1}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPageNumbers().map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground"
          >
            …
          </span>
        ) : (
          <button
            key={`page-${page}`}
            onClick={() => setCurrentPage(page as number)}
            className="h-8 min-w-[32px] px-2 flex items-center justify-center rounded-lg text-xs font-semibold transition-all"
            style={
              safePage === page
                ? {
                    background: `linear-gradient(135deg, ${T_BLUE}, ${T_ORANGE})`,
                    color: "#fff",
                    boxShadow: `0 2px 8px ${T_BLUE}40`,
                  }
                : { color: "hsl(var(--muted-foreground))" }
            }
            onMouseEnter={(e) => {
              if (safePage !== page) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.6)";
            }}
            onMouseLeave={(e) => {
              if (safePage !== page) (e.currentTarget as HTMLElement).style.backgroundColor = "";
            }}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={safePage === totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="ml-1 text-xs text-muted-foreground">
        {safePage} / {totalPages}
      </span>
    </div>
  );

  return (
    <AppLayout>
      {/* Page background */}
      <div
        className="min-h-full"
        style={{
          background: "linear-gradient(160deg, #EEF4FB 0%, #F5F0FA 50%, #FEF3E8 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-3 p-4">
          {/* Tableau gradient banner */}
          {isTableau && (
            <div
              className="rounded-2xl px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-md"
              style={{ background: `linear-gradient(135deg, ${T_BLUE} 0%, #2196c4 45%, ${T_ORANGE} 100%)` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-end gap-0.5 h-5">
                  {[10, 16, 12, 20, 8].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-sm bg-white"
                      style={{ height: h, opacity: i % 2 === 0 ? 0.6 : 1 }}
                    />
                  ))}
                </div>
                <span className="text-white font-bold text-sm tracking-wide">Tableau Explorer</span>
              </div>
              <span className="text-white/70 text-xs">
                {workbooks.length} workbook{workbooks.length !== 1 ? "s" : ""} loaded
              </span>
            </div>
          )}

          {/* ── Top bar ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-white/70 hover:bg-white shadow-sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">
                  Dashboard
                </button>
                <ChevronRight className="w-3 h-3" />
                <span className="font-semibold" style={{ color: T_BLUE }}>
                  {sourceName} Explorer
                </span>
              </div>
            </div>

            {/* Search — fills middle */}
            <div className="relative flex-1 mx-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={
                  viewMode === "grid" ? "Search workbooks or projects..." : "Search reports, dashboards, workbooks..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm w-full bg-white/80 backdrop-blur border-white/60 shadow-sm focus:bg-white"
              />
            </div>

            {/* View toggle + refresh */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center bg-white/70 rounded-lg p-0.5 gap-0.5 shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Grid
                </button>
                <button
                  onClick={() => setViewMode("tree")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "tree"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Tree
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-9 text-xs gap-1.5 bg-white/70 border-white/60 hover:bg-white shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* ================= GRID VIEW ================= */}
          {viewMode === "grid" && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable grid */}
              <div className="p-4 flex-1 overflow-y-auto">
                {filteredWorkbooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50">
                      <BookOpen className="w-7 h-7" style={{ color: T_BLUE }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">No workbooks found</p>
                      {searchQuery && <p className="text-xs opacity-50 mt-0.5">Try a different search term</p>}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {paginatedWorkbooks.map((wb, idx) => {
                      const isSelected = selectedWorkbook?.id === wb.id;
                      const isHovered = hoveredId === wb.id;
                      const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];

                      return (
                        <button
                          key={wb.id}
                          onClick={() => setSelectedWorkbook(isSelected ? null : wb)}
                          onMouseEnter={() => setHoveredId(wb.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className="relative flex flex-col rounded-xl text-left transition-all duration-200 overflow-hidden"
                          style={{
                            backgroundColor: isSelected ? accent.bg : isHovered ? accent.bg : "#fff",
                            boxShadow: isSelected
                              ? `0 0 0 2.5px ${accent.icon}, 0 6px 20px ${accent.icon}25`
                              : isHovered
                                ? `0 4px 16px rgba(0,0,0,0.10)`
                                : "0 1px 4px rgba(0,0,0,0.06)",
                            transform: isHovered && !isSelected ? "translateY(-2px)" : "none",
                          }}
                        >
                          {/* Colored left sidebar stripe */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all duration-200"
                            style={{
                              backgroundColor: isSelected || isHovered ? accent.icon : "transparent",
                            }}
                          />

                          <div className="pl-4 pr-3 py-3 flex flex-col gap-2.5 flex-1">
                            {/* Icon + check row */}
                            <div className="flex items-center justify-between">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                style={{
                                  backgroundColor: isSelected || isHovered ? `${accent.icon}20` : "#F3F4F6",
                                  color: isSelected || isHovered ? accent.icon : "#9CA3AF",
                                }}
                              >
                                <BookOpen className="w-4 h-4" />
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: accent.icon }} />
                              )}
                            </div>

                            {/* Workbook name */}
                            <p
                              className="font-semibold text-sm leading-snug line-clamp-2 transition-colors duration-200"
                              style={{ color: isSelected ? accent.text : isHovered ? accent.text : "#111827" }}
                            >
                              {wb.name}
                            </p>

                            {/* Project name */}
                            <div className="flex items-center gap-1.5 mt-auto">
                              <FolderOpen
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: isSelected || isHovered ? accent.icon : "#9CA3AF" }}
                              />
                              <span
                                className="text-xs truncate"
                                style={{ color: isSelected || isHovered ? accent.icon : "#6B7280" }}
                              >
                                {wb.projectName || "—"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer: pagination + migrate */}
              <div
                className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)", backgroundColor: "rgba(255,255,255,0.7)" }}
              >
                <PaginationBar />
                <Button
                  size="sm"
                  onClick={handleMigrateWorkbook}
                  disabled={!selectedWorkbook || isMigrating}
                  className="h-9 px-4 text-xs gap-1.5 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed border-0 rounded-lg flex-shrink-0 shadow-md"
                  style={{
                    background:
                      !selectedWorkbook || isMigrating
                        ? "#D1D5DB"
                        : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
                    boxShadow: selectedWorkbook && !isMigrating ? `0 4px 14px ${T_BLUE}40` : "none",
                  }}
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
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
              {selectedNode && (
                <div
                  className="px-4 py-2 flex items-center gap-1.5 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <span className="text-xs text-muted-foreground">Selected:</span>
                  <span
                    className="flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5"
                    style={{ color: T_ORANGE, borderColor: `${T_ORANGE}40`, backgroundColor: `${T_ORANGE}0a` }}
                  >
                    <Zap className="w-3 h-3" />
                    {selectedNode.name}
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <TreeView nodes={treeData} selectedId={selectedNode?.id || null} onSelect={setSelectedNode} />
              </div>

              <div
                className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)", backgroundColor: "rgba(255,255,255,0.7)" }}
              >
                <span className="text-xs text-muted-foreground">
                  {selectedNode ? `"${selectedNode.name}" ready to migrate` : "Select a node from the tree"}
                </span>
                <Button
                  size="sm"
                  onClick={handleMigrateNode}
                  disabled={!selectedNode || isMigrating}
                  className="h-9 px-4 text-xs gap-1.5 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed border-0 rounded-lg shadow-md"
                  style={{
                    background:
                      !selectedNode || isMigrating
                        ? "#D1D5DB"
                        : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
                    boxShadow: selectedNode && !isMigrating ? `0 4px 14px ${T_BLUE}40` : "none",
                  }}
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
      </div>
    </AppLayout>
  );
};

export default Explorer;
