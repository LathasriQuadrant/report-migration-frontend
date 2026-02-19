import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom"; // ➕ Added for navigation
import * as models from "powerbi-models";
import { service, factories } from "powerbi-client";
import { Loader2, CheckCircle2, XCircle, Globe, AlertTriangle, ArrowLeft } from "lucide-react";

// ➕ Import UI Components to match Migration page style
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";

import "powerbi-report-authoring";

/* ----------------------------------------------------
    📍 CONFIGURATION & CONSTANTS
   ---------------------------------------------------- */
const API_URL = "https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/runtime-visuals";

const pbiService = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);

// --- Updated Interfaces for New Metadata Structure ---
interface ApiWorksheet {
  name: string;
  visualType: string;
  columns: { table: string; column: string }[];
}

interface ApiDashboard {
  dashboardName: string;
  worksheets: string[];
}

interface ExtractionMetadata {
  tables: Record<string, string[]>;
  relationships: any[];
  worksheets: ApiWorksheet[];
  dashboards: ApiDashboard[];
}

export default function PowerBIReport() {
  const navigate = useNavigate(); // ➕ Init hook
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Initializing...");
  const [statusType, setStatusType] = useState<"loading" | "success" | "error" | "warning">("loading");
  const [source, setSource] = useState<"API" | "None">("None");

  const isEmbedding = useRef(false);
  const executed = useRef(false);

  /* ---------------- SESSION DATA ---------------- */
  const workspaceId = sessionStorage.getItem("workspace_id");
  const reportId = sessionStorage.getItem("generated_report_id");
  const datasetId = sessionStorage.getItem("generated_dataset_id");
  const metadataBlobUrl = sessionStorage.getItem("metadataOutputBlobUrl");
  const rawReportName = sessionStorage.getItem("report_name") || "sampletbl";

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* ----------- DATA MAPPING HELPERS ----------- */

  // Helper to strip prefixes
  const cleanColumnName = (colName: string) => {
    if (!colName) return "";
    return colName.replace(/^(cnt|sum|avg|min|max|count|distinct):/i, "");
  };

  // Helper to map roles
  const mapRoleName = (visualType: string, semanticRole: string): string => {
    const type = visualType.toLowerCase();
    const role = semanticRole.toLowerCase();

    if (type.includes("table") || type.includes("matrix")) return "Values";

    if (
      type.includes("bar") ||
      type.includes("column") ||
      type.includes("line") ||
      type.includes("area") ||
      type.includes("scatter")
    ) {
      if (role === "category" || role === "axis") return "Category";
      if (role === "values" || role === "y") return "Y";
      if (role === "legend" || role === "series") return "Series";
      if (type.includes("scatter") && role === "x") return "X";
    }

    if (type.includes("pie") || type.includes("donut")) {
      if (role === "legend" || role === "category") return "Category";
      if (role === "values") return "Y";
    }

    return semanticRole;
  };

  async function createStaticVisuals(report: any) {
    if (executed.current) return;
    executed.current = true;
    console.group("🚀 Migrating Tableau Dashboards to Power BI Pages");

    try {
      setStatus("Fetching visual configuration...");
      let metadata: ExtractionMetadata | null = null;

      if (metadataBlobUrl) {
        try {
          // Fetch the JSON directly from the blob URL
          const apiRes = await fetch(metadataBlobUrl);
          if (apiRes.ok) {
            const data = await apiRes.json();
            // Handle the "metadata" wrapper if it exists in the response
            metadata = data.metadata || data;
            setSource("API");
          }
        } catch (e) {
          console.error("Failed to fetch metadata blob", e);
        }
      }

      if (!metadata || !metadata.dashboards) {
        setStatus("No dashboards found in metadata");
        setStatusType("warning");
        console.groupEnd();
        return;
      }

      setStatus("Switching to Edit mode...");
      try {
        await report.switchMode(models.ViewMode.Edit);
      } catch (e) {
        /* ignore */
      }
      await sleep(1000);

      const initialPages = await report.getPages();

      // --- NEW LOGIC: Iterate Dashboards as Pages ---
      for (const dash of metadata.dashboards) {
        setStatus(`Creating Page: ${dash.dashboardName}...`);

        // Add a new page for each Tableau Dashboard
        const page = await report.addPage(dash.dashboardName);
        await report.setPage(page.name);
        await sleep(500);

        // Find worksheet data for this dashboard
        const dashWorksheets = metadata.worksheets.filter((ws) => dash.worksheets.includes(ws.name));

        let currentY = 0; // Vertical stacking offset

        for (const ws of dashWorksheets) {
          setStatus(`Creating visual: ${ws.name} on ${dash.dashboardName}...`);
          try {
            // Map visual types
            const pbiType = ws.visualType === "Map" ? "filledMap" : "barChart";

            const { visual } = await page.createVisual(pbiType, {
              x: 20,
              y: currentY,
              width: 600,
              height: 350,
              displayState: { mode: models.VisualContainerDisplayMode.Visible },
            });

            // Set Title
            try {
              await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: ws.name });
              await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });
            } catch (e) {
              /* ignore */
            }

            // Bind Columns
            for (let i = 0; i < ws.columns.length; i++) {
              const colInfo = ws.columns[i];
              const sanitizedCol = cleanColumnName(colInfo.column);

              // Simple heuristic: first column is Category, rest are Y (Values)
              const technicalRole = i === 0 ? "Category" : "Y";

              try {
                await visual.addDataField(technicalRole, {
                  $schema: "http://powerbi.com/product/schema#column",
                  table: colInfo.table,
                  column: sanitizedCol,
                });
              } catch (e) {
                console.warn(`Binding failed for ${sanitizedCol}`, e);
              }
            }

            currentY += 370; // Move next visual down
            await sleep(200);
          } catch (e) {
            console.error(`❌ Visual ${ws.name} failed:`, e);
          }
        }
      }

      // Cleanup: Delete the original blank pages (e.g., "Page 1")
      if (initialPages.length > 0) {
        for (const p of initialPages) {
          try {
            await report.deletePage(p.name);
          } catch (e) {
            /* ignore */
          }
        }
      }

      await report.save();
      setStatus("Report generation successful!");
      setStatusType("success");
    } catch (err: any) {
      console.error("❌ Critical Error:", err);
      setStatus("Error: " + err.message);
      setStatusType("error");
    } finally {
      console.groupEnd();
    }
  }

  /* ----------- EMBED REPORT ----------- */
  useEffect(() => {
    let report: any;
    if (isEmbedding.current) return;
    isEmbedding.current = true;

    async function init() {
      if (!workspaceId || !reportId) {
        setStatus("Missing Session Data");
        setStatusType("error");
        return;
      }

      try {
        const res = await fetch("https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/embed-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, reportId, datasetId }),
        });
        const { embedToken, embedUrl } = await res.json();

        if (containerRef.current) {
          pbiService.reset(containerRef.current);
          report = pbiService.embed(containerRef.current, {
            type: "report",
            id: reportId,
            embedUrl,
            accessToken: embedToken,
            tokenType: models.TokenType.Embed,
            permissions: models.Permissions.All,
            viewMode: models.ViewMode.Edit,
            settings: {
              panes: {
                fields: { visible: true, expanded: true },
                visualizations: { visible: true },
              },
            },
          });

          report.on("rendered", () => {
            console.log("📊 Report rendered");
            createStaticVisuals(report);
          });

          report.on("error", (e: any) => {
            console.error("PBI Error:", e.detail);
            setStatus("Power BI Error");
            setStatusType("error");
          });
        }
      } catch (e: any) {
        setStatus("Init failed: " + e.message);
        setStatusType("error");
      }
    }
    init();
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 p-6 h-full">
        {/* Header Section */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/migration")}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Report Preview</h1>
        </div>

        {/* Status Bar */}
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border shadow-sm transition-all duration-300 ${
            statusType === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : statusType === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : statusType === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-blue-100 text-slate-700"
          }`}
        >
          {statusType === "loading" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
          {statusType === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
          {statusType === "error" && <XCircle className="h-5 w-5 text-red-600" />}
          {statusType === "warning" && <AlertTriangle className="h-5 w-5 text-amber-600" />}

          <div className="flex flex-col flex-1">
            <span className="text-sm font-semibold uppercase tracking-wider opacity-70">System Status</span>
            <span className="font-medium">{status}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full border border-black/5 text-xs font-medium">
            <Globe className="h-3 w-3" />
            Config Source: {source}
          </div>
        </div>

        {/* Power BI Container */}
        <div className="relative flex-1 w-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
