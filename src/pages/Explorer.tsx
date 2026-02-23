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

// import { useState, useEffect } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import {
//   ArrowLeft,
//   RefreshCw,
//   ChevronRight,
//   LayoutGrid,
//   List,
//   BookOpen,
//   Search,
//   Zap,
//   FolderOpen,
//   Eye,
//   ChevronLeft,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import TreeView from "@/components/explorer/TreeView";
// import AppLayout from "@/components/layout/AppLayout";
// import { sampleTableauTree } from "@/data/sampleTree";
// import { TreeNode } from "@/types/migration";
// import { buildTableauTree } from "@/data/tableauTreeMapper";
// import { useToast } from "@/hooks/use-toast";
// import { Loader2 } from "lucide-react";

// // Tableau official brand colors
// const T_BLUE = "#1F77B4";
// const T_ORANGE = "#E8762B";

// const ITEMS_PER_PAGE = 12;

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
//   const [hoveredId, setHoveredId] = useState<string | null>(null);
//   const [currentPage, setCurrentPage] = useState(1);

//   const sourceName = sourceNames[sourceId || ""] || "Unknown";
//   const isTableau = sourceId === "tableau";

//   const extractWorkbooks = (tree: TreeNode[]): WorkbookItem[] => {
//     const list: WorkbookItem[] = [];
//     const traverse = (nodes: TreeNode[], projectName = "") => {
//       nodes.forEach((node) => {
//         if (node.type === "project" && node.children) traverse(node.children, node.name);
//         else if (node.type === "workbook")
//           list.push({ id: node.id, name: node.name, projectName, viewCount: node.children?.length || 0 });
//         else if (node.children) traverse(node.children, projectName);
//       });
//     };
//     traverse(tree);
//     return list;
//   };

//   useEffect(() => {
//     if (isTableau) {
//       const storedTree = sessionStorage.getItem("tableau_tree");
//       if (storedTree) {
//         const parsed = JSON.parse(storedTree);
//         setTreeData(parsed);
//         setWorkbooks(extractWorkbooks(parsed));
//       }
//     }
//   }, [sourceId]);

//   // Reset to page 1 when search changes
//   useEffect(() => {
//     setCurrentPage(1);
//   }, [searchQuery]);

//   const handleRefresh = async () => {
//     if (!isTableau) return;
//     const token = sessionStorage.getItem("tableau_api_token");
//     if (!token) {
//       toast({ title: "Session expired", description: "Please sign in again", variant: "destructive" });
//       navigate("/");
//       return;
//     }
//     setIsRefreshing(true);
//     try {
//       const response = await fetch(
//         "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau/fetch_data",
//         { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_token: token }) },
//       );
//       const data = await response.json();
//       const newTree = buildTableauTree(data);
//       sessionStorage.setItem("tableau_tree", JSON.stringify(newTree));
//       setTreeData(newTree);
//       setWorkbooks(extractWorkbooks(newTree));
//       toast({ title: "Refreshed", description: "Tableau content updated" });
//     } catch {
//       toast({ title: "Refresh failed", description: "Could not refresh Tableau content", variant: "destructive" });
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   const runMigrationSteps = async (workbookId: string, workbookName: string) => {
//     const token = sessionStorage.getItem("tableau_api_token");
//     if (!token) {
//       toast({ title: "Session expired", description: "Please sign in again", variant: "destructive" });
//       navigate("/");
//       return null;
//     }
//     const BASE = "https://tableau-backend-app-hrdxfhfpghf3f0bg.eastus-01.azurewebsites.net/tableau";

//     const dlRes = await fetch(`${BASE}/download_workbook`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ api_token: token, workbook_id: workbookId, file_name: `${workbookName}.twbx` }),
//     });
//     if (!dlRes.ok) throw new Error("Failed to download workbook");
//     const dlData = await dlRes.json();
//     const blobPath = dlData.blob_path || dlData.file_name || `${workbookName}.twbx`;

//     const dsRes = await fetch(`${BASE}/download_workbook_datasources`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ api_token: token, workbook_id: workbookId }),
//     });
//     if (!dsRes.ok) throw new Error("Failed to download datasources");

//     const exRes = await fetch("https://dataset-extraction2-gbdnhcd0dxeaf6df.eastus-01.azurewebsites.net/extract-data", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ blob_path: blobPath }),
//     });
//     if (!exRes.ok) throw new Error("Failed to extract data");
//     const exData = await exRes.json();
//     sessionStorage.setItem("extraction_output_files", JSON.stringify(exData.output_files || []));
//     return true;
//   };

//   const handleMigrateWorkbook = async () => {
//     if (!selectedWorkbook) return;
//     const findNode = (nodes: TreeNode[]): TreeNode | null => {
//       for (const node of nodes) {
//         if (node.id === selectedWorkbook.id) return node;
//         if (node.children) {
//           const f = findNode(node.children);
//           if (f) return f;
//         }
//       }
//       return null;
//     };
//     const workbookNode = findNode(treeData);
//     if (!workbookNode) return;
//     setIsMigrating(true);
//     try {
//       await runMigrationSteps(selectedWorkbook.id, selectedWorkbook.name);
//       sessionStorage.setItem("selected_workbook", JSON.stringify(selectedWorkbook));
//       toast({ title: "Preparation complete", description: "Ready to select destination workspace" });
//       navigate("/workspace-selection", { state: { node: workbookNode, source: sourceId } });
//     } catch (error) {
//       toast({
//         title: "Migration failed",
//         description: error instanceof Error ? error.message : "Migration preparation failed",
//         variant: "destructive",
//       });
//     } finally {
//       setIsMigrating(false);
//     }
//   };

//   const handleMigrateNode = async () => {
//     if (!selectedNode) return;
//     setIsMigrating(true);
//     try {
//       await runMigrationSteps(selectedNode.id, selectedNode.name);
//       sessionStorage.setItem(
//         "selected_workbook",
//         JSON.stringify({ id: selectedNode.id, name: selectedNode.name, type: selectedNode.type }),
//       );
//       toast({ title: "Preparation complete", description: "Ready to select destination workspace" });
//       navigate("/workspace-selection", { state: { node: selectedNode, source: sourceId } });
//     } catch (error) {
//       toast({
//         title: "Migration failed",
//         description: error instanceof Error ? error.message : "Migration preparation failed",
//         variant: "destructive",
//       });
//     } finally {
//       setIsMigrating(false);
//     }
//   };

//   // Pagination logic
//   const filteredWorkbooks = workbooks.filter(
//     (w) =>
//       w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       w.projectName.toLowerCase().includes(searchQuery.toLowerCase()),
//   );
//   const totalPages = Math.max(1, Math.ceil(filteredWorkbooks.length / ITEMS_PER_PAGE));
//   const paginatedWorkbooks = filteredWorkbooks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

//   const getPageNumbers = () => {
//     const pages: (number | "...")[] = [];
//     if (totalPages <= 7) {
//       for (let i = 1; i <= totalPages; i++) pages.push(i);
//     } else {
//       pages.push(1);
//       if (currentPage > 3) pages.push("...");
//       for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
//       if (currentPage < totalPages - 2) pages.push("...");
//       pages.push(totalPages);
//     }
//     return pages;
//   };

//   return (
//     <AppLayout>
//       <div className="max-w-7xl mx-auto h-full flex flex-col gap-2">
//         {/* Tableau gradient banner */}
//         {isTableau && (
//           <div
//             className="rounded-xl px-4 py-2.5 flex items-center justify-between flex-shrink-0"
//             style={{ background: `linear-gradient(135deg, ${T_BLUE} 0%, #2196c4 45%, ${T_ORANGE} 100%)` }}
//           >
//             <div className="flex items-center gap-2.5">
//               <div className="flex items-end gap-0.5 h-5">
//                 {[10, 16, 12, 20, 8].map((h, i) => (
//                   <div
//                     key={i}
//                     className="w-1.5 rounded-sm bg-white"
//                     style={{ height: h, opacity: i % 2 === 0 ? 0.6 : 1 }}
//                   />
//                 ))}
//               </div>
//               <span className="text-white font-semibold text-sm tracking-wide">Tableau Explorer</span>
//             </div>
//             <span className="text-white/70 text-xs">
//               {workbooks.length} workbook{workbooks.length !== 1 ? "s" : ""} loaded
//             </span>
//           </div>
//         )}

//         {/* ── Top bar: back + breadcrumb | search | view toggle + refresh ── */}
//         <div className="flex items-center gap-2 flex-shrink-0">
//           {/* Left: back + breadcrumb */}
//           <div className="flex items-center gap-2 flex-shrink-0">
//             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
//               <ArrowLeft className="w-4 h-4" />
//             </Button>
//             <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
//               <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">
//                 Dashboard
//               </button>
//               <ChevronRight className="w-3 h-3" />
//               <span className="font-semibold" style={{ color: T_BLUE }}>
//                 {sourceName} Explorer
//               </span>
//             </div>
//           </div>

//           {/* Center: search — grows to fill space */}
//           <div className="relative flex-1 mx-2">
//             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
//             <Input
//               placeholder={
//                 viewMode === "grid" ? "Search workbooks or projects..." : "Search reports, dashboards, workbooks..."
//               }
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="pl-8 h-8 text-sm w-full"
//             />
//           </div>

//           {/* Right: view toggle + refresh */}
//           <div className="flex items-center gap-1.5 flex-shrink-0">
//             <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
//               <button
//                 onClick={() => setViewMode("grid")}
//                 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
//                   viewMode === "grid"
//                     ? "bg-background text-foreground shadow-sm"
//                     : "text-muted-foreground hover:text-foreground"
//                 }`}
//               >
//                 <LayoutGrid className="w-3.5 h-3.5" />
//                 Grid
//               </button>
//               <button
//                 onClick={() => setViewMode("tree")}
//                 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
//                   viewMode === "tree"
//                     ? "bg-background text-foreground shadow-sm"
//                     : "text-muted-foreground hover:text-foreground"
//                 }`}
//               >
//                 <List className="w-3.5 h-3.5" />
//                 Tree
//               </button>
//             </div>
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={handleRefresh}
//               disabled={isRefreshing}
//               className="h-8 text-xs gap-1.5"
//             >
//               <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
//               Refresh
//             </Button>
//           </div>
//         </div>

//         {/* ================= GRID VIEW ================= */}
//         {viewMode === "grid" && (
//           <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
//             {/* Sub-bar: result count + selected badge */}
//             <div className="px-3 py-2 border-b border-border flex-shrink-0 flex items-center justify-between">
//               <span className="text-xs text-muted-foreground">
//                 <span className="font-semibold" style={{ color: T_BLUE }}>
//                   {filteredWorkbooks.length}
//                 </span>{" "}
//                 {filteredWorkbooks.length === 1 ? "workbook" : "workbooks"}
//                 {searchQuery && <span className="opacity-60"> found</span>}
//                 {totalPages > 1 && (
//                   <span className="ml-1 opacity-60">
//                     · page {currentPage} of {totalPages}
//                   </span>
//                 )}
//               </span>
//               {selectedWorkbook && (
//                 <span
//                   className="flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5"
//                   style={{ color: T_ORANGE, borderColor: `${T_ORANGE}40`, backgroundColor: `${T_ORANGE}0a` }}
//                 >
//                   <Zap className="w-3 h-3" />
//                   {selectedWorkbook.name}
//                 </span>
//               )}
//             </div>

//             {/* Grid */}
//             <div className="p-3 flex-1 overflow-y-auto">
//               {filteredWorkbooks.length === 0 ? (
//                 <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
//                   <BookOpen className="w-10 h-10 opacity-20" />
//                   <p className="text-sm font-medium">No workbooks found</p>
//                   {searchQuery && <p className="text-xs opacity-60">Try a different search term</p>}
//                 </div>
//               ) : (
//                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
//                   {paginatedWorkbooks.map((wb) => {
//                     const isSelected = selectedWorkbook?.id === wb.id;
//                     const isHovered = hoveredId === wb.id;
//                     return (
//                       <button
//                         key={wb.id}
//                         onClick={() => setSelectedWorkbook(isSelected ? null : wb)}
//                         onMouseEnter={() => setHoveredId(wb.id)}
//                         onMouseLeave={() => setHoveredId(null)}
//                         className="relative flex flex-col p-3 rounded-lg border text-left transition-all duration-150 min-h-[100px]"
//                         style={
//                           isSelected
//                             ? {
//                                 borderColor: T_BLUE,
//                                 backgroundColor: `${T_BLUE}08`,
//                                 boxShadow: `0 0 0 1.5px ${T_BLUE}40`,
//                               }
//                             : isHovered
//                               ? {
//                                   borderColor: `${T_BLUE}60`,
//                                   backgroundColor: `${T_BLUE}04`,
//                                   boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
//                                 }
//                               : {}
//                         }
//                       >
//                         {/* Selected dot */}
//                         {isSelected && (
//                           <span
//                             className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full ring-2 ring-white"
//                             style={{ backgroundColor: T_ORANGE }}
//                           />
//                         )}

//                         {/* Icon + name row */}
//                         <div className="flex items-start gap-2 mb-2">
//                           <div
//                             className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
//                             style={
//                               isSelected
//                                 ? { backgroundColor: `${T_BLUE}20`, color: T_BLUE }
//                                 : isHovered
//                                   ? { backgroundColor: `${T_BLUE}14`, color: T_BLUE }
//                                   : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
//                             }
//                           >
//                             <BookOpen className="w-3.5 h-3.5" />
//                           </div>
//                           <p
//                             className="font-semibold text-sm leading-snug line-clamp-2 flex-1 pr-4 transition-colors"
//                             style={isSelected ? { color: T_BLUE } : isHovered ? { color: T_ORANGE } : {}}
//                           >
//                             {wb.name}
//                           </p>
//                         </div>

//                         {/* Footer meta */}
//                         <div className="mt-auto flex items-center justify-between gap-1">
//                           <div className="flex items-center gap-1 min-w-0">
//                             <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
//                             <span className="text-xs text-muted-foreground truncate">{wb.projectName || "—"}</span>
//                           </div>
//                           {wb.viewCount > 0 && (
//                             <div className="flex items-center gap-0.5 flex-shrink-0">
//                               <Eye className="w-3 h-3 text-muted-foreground" />
//                               <span className="text-xs text-muted-foreground">{wb.viewCount}</span>
//                             </div>
//                           )}
//                         </div>
//                       </button>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>

//             {/* ── Footer: pagination LEFT + migrate RIGHT ── */}
//             <div className="px-3 py-2 border-t border-border flex items-center justify-between flex-shrink-0 gap-3">
//               {/* Pagination */}
//               {totalPages > 1 ? (
//                 <div className="flex items-center gap-1">
//                   <button
//                     onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
//                     disabled={currentPage === 1}
//                     className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                   >
//                     <ChevronLeft className="w-3.5 h-3.5" />
//                   </button>

//                   {getPageNumbers().map((page, i) =>
//                     page === "..." ? (
//                       <span
//                         key={`ellipsis-${i}`}
//                         className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground"
//                       >
//                         …
//                       </span>
//                     ) : (
//                       <button
//                         key={page}
//                         onClick={() => setCurrentPage(page as number)}
//                         className="h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-md text-xs font-medium transition-all"
//                         style={
//                           currentPage === page
//                             ? { backgroundColor: T_BLUE, color: "#fff", border: `1px solid ${T_BLUE}` }
//                             : { border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }
//                         }
//                         onMouseEnter={(e) => {
//                           if (currentPage !== page)
//                             (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${T_BLUE}10`;
//                         }}
//                         onMouseLeave={(e) => {
//                           if (currentPage !== page) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
//                         }}
//                       >
//                         {page}
//                       </button>
//                     ),
//                   )}

//                   <button
//                     onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
//                     disabled={currentPage === totalPages}
//                     className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                   >
//                     <ChevronRight className="w-3.5 h-3.5" />
//                   </button>
//                 </div>
//               ) : (
//                 <span className="text-xs text-muted-foreground">
//                   {selectedWorkbook ? `"${selectedWorkbook.name}" selected` : "Click a workbook to select it"}
//                 </span>
//               )}

//               {/* Migrate button */}
//               <Button
//                 size="sm"
//                 onClick={handleMigrateWorkbook}
//                 disabled={!selectedWorkbook || isMigrating}
//                 className="h-8 text-xs gap-1.5 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed border-0 flex-shrink-0"
//                 style={{
//                   background:
//                     !selectedWorkbook || isMigrating
//                       ? undefined
//                       : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
//                 }}
//               >
//                 {isMigrating ? (
//                   <>
//                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
//                     Preparing...
//                   </>
//                 ) : (
//                   <>
//                     <Zap className="w-3.5 h-3.5" />
//                     Migrate to Power BI
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//         )}

//         {/* ================= TREE VIEW ================= */}
//         {viewMode === "tree" && (
//           <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
//             {/* Selected badge */}
//             {selectedNode && (
//               <div className="px-3 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-1.5">
//                 <span className="text-xs text-muted-foreground">Selected:</span>
//                 <span
//                   className="flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5"
//                   style={{ color: T_ORANGE, borderColor: `${T_ORANGE}40`, backgroundColor: `${T_ORANGE}0a` }}
//                 >
//                   <Zap className="w-3 h-3" />
//                   {selectedNode.name}
//                 </span>
//               </div>
//             )}

//             <div className="flex-1 overflow-y-auto">
//               <TreeView nodes={treeData} selectedId={selectedNode?.id || null} onSelect={setSelectedNode} />
//             </div>

//             {/* Footer */}
//             <div className="px-3 py-2 border-t border-border flex items-center justify-between flex-shrink-0">
//               <span className="text-xs text-muted-foreground">
//                 {selectedNode ? `"${selectedNode.name}" ready to migrate` : "Select a node from the tree"}
//               </span>
//               <Button
//                 size="sm"
//                 onClick={handleMigrateNode}
//                 disabled={!selectedNode || isMigrating}
//                 className="h-8 text-xs gap-1.5 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed border-0"
//                 style={{
//                   background:
//                     !selectedNode || isMigrating
//                       ? undefined
//                       : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
//                 }}
//               >
//                 {isMigrating ? (
//                   <>
//                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
//                     Preparing...
//                   </>
//                 ) : (
//                   <>
//                     <Zap className="w-3.5 h-3.5" />
//                     Migrate to Power BI
//                   </>
//                 )}
//               </Button>
//             </div>
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
const ITEMS_PER_PAGE = 12;

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
  const paginatedWorkbooks = filteredWorkbooks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-2">
        {/* Tableau gradient banner */}
        {isTableau && (
          <div
            className="rounded-xl px-4 py-2.5 flex items-center justify-between flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${T_BLUE} 0%, #2196c4 45%, ${T_ORANGE} 100%)` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-end gap-0.5 h-5">
                {[10, 16, 12, 20, 8].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-sm bg-white"
                    style={{ height: h, opacity: i % 2 === 0 ? 0.6 : 1 }}
                  />
                ))}
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">Tableau Explorer</span>
            </div>
            <span className="text-white/70 text-xs">
              {workbooks.length} workbook{workbooks.length !== 1 ? "s" : ""} loaded
            </span>
          </div>
        )}

        {/* ── Top bar: back + breadcrumb | search | view toggle + refresh ── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
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

          <div className="relative flex-1 mx-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={
                viewMode === "grid" ? "Search workbooks or projects..." : "Search reports, dashboards, workbooks..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "tree"
                    ? "bg-background text-foreground shadow-sm"
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
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ================= GRID VIEW ================= */}
        {viewMode === "grid" && (
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            {/* Scrollable grid area */}
            <div className="p-4 flex-1 overflow-y-auto">
              {filteredWorkbooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${T_BLUE}10` }}
                  >
                    <BookOpen className="w-7 h-7" style={{ color: T_BLUE }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">No workbooks found</p>
                    {searchQuery && <p className="text-xs opacity-50 mt-0.5">Try a different search term</p>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {paginatedWorkbooks.map((wb) => {
                    const isSelected = selectedWorkbook?.id === wb.id;
                    return (
                      <button
                        key={wb.id}
                        onClick={() => setSelectedWorkbook(isSelected ? null : wb)}
                        className="group relative flex flex-col rounded-xl text-left transition-all duration-200 overflow-hidden"
                        style={{
                          background: isSelected
                            ? `linear-gradient(145deg, ${T_BLUE}18 0%, ${T_BLUE}08 100%)`
                            : "hsl(var(--muted)/0.4)",
                          boxShadow: isSelected
                            ? `0 0 0 2px ${T_BLUE}, 0 4px 16px ${T_BLUE}20`
                            : "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement).style.background =
                              `linear-gradient(145deg, ${T_BLUE}10 0%, ${T_ORANGE}06 100%)`;
                            (e.currentTarget as HTMLElement).style.boxShadow =
                              `0 0 0 1px ${T_BLUE}40, 0 4px 12px rgba(0,0,0,0.08)`;
                            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted)/0.4)";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                            (e.currentTarget as HTMLElement).style.transform = "";
                          }
                        }}
                      >
                        {/* Colored top accent strip */}
                        <div
                          className="h-1 w-full flex-shrink-0 transition-all duration-200"
                          style={{
                            background: isSelected ? `linear-gradient(90deg, ${T_BLUE}, ${T_ORANGE})` : "transparent",
                          }}
                        />

                        <div className="p-3 flex flex-col gap-2 flex-1">
                          {/* Icon row */}
                          <div className="flex items-start justify-between">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
                              style={
                                isSelected
                                  ? { background: `linear-gradient(135deg, ${T_BLUE}30, ${T_BLUE}15)`, color: T_BLUE }
                                  : { backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))" }
                              }
                            >
                              <BookOpen className="w-4 h-4" />
                            </div>

                            {isSelected && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: T_BLUE }} />}
                          </div>

                          {/* Name */}
                          <p
                            className="font-semibold text-sm leading-snug line-clamp-2 transition-colors duration-200"
                            style={isSelected ? { color: T_BLUE } : {}}
                          >
                            {wb.name}
                          </p>

                          {/* Project */}
                          <div className="flex items-center gap-1 mt-auto">
                            <FolderOpen className="w-3 h-3 flex-shrink-0 opacity-40" />
                            <span className="text-xs text-muted-foreground truncate opacity-70">
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

            {/* ── Footer: pagination LEFT · migrate RIGHT ── */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between flex-shrink-0 gap-4">
              {/* Pagination */}
              {totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {getPageNumbers().map((page, i) =>
                    page === "..." ? (
                      <span
                        key={`e-${i}`}
                        className="h-7 w-6 flex items-center justify-center text-xs text-muted-foreground"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className="h-7 min-w-[28px] px-1.5 rounded-md text-xs font-medium transition-all"
                        style={
                          currentPage === page
                            ? { background: `linear-gradient(135deg, ${T_BLUE}, ${T_ORANGE})`, color: "#fff" }
                            : { color: "hsl(var(--foreground))" }
                        }
                        onMouseEnter={(e) => {
                          if (currentPage !== page)
                            (e.currentTarget as HTMLElement).style.backgroundColor = `${T_BLUE}12`;
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== page) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                        }}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div /> /* spacer so migrate stays right */
              )}

              {/* Migrate button */}
              <Button
                size="sm"
                onClick={handleMigrateWorkbook}
                disabled={!selectedWorkbook || isMigrating}
                className="h-8 text-xs gap-1.5 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed border-0 flex-shrink-0"
                style={{
                  background:
                    !selectedWorkbook || isMigrating
                      ? undefined
                      : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
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
          <div className="bg-card rounded-xl border border-border enterprise-shadow flex-1 flex flex-col min-h-0">
            {selectedNode && (
              <div className="px-3 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-1.5">
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

            <div className="px-3 py-2 border-t border-border flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                {selectedNode ? `"${selectedNode.name}" ready to migrate` : "Select a node from the tree"}
              </span>
              <Button
                size="sm"
                onClick={handleMigrateNode}
                disabled={!selectedNode || isMigrating}
                className="h-8 text-xs gap-1.5 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed border-0"
                style={{
                  background:
                    !selectedNode || isMigrating
                      ? undefined
                      : `linear-gradient(135deg, ${T_BLUE} 0%, ${T_ORANGE} 100%)`,
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
    </AppLayout>
  );
};

export default Explorer;
