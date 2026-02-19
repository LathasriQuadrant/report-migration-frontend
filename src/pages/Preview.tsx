import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as models from "powerbi-models";
import { service, factories } from "powerbi-client";
import { Loader2, CheckCircle2, XCircle, Globe, AlertTriangle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";

import "powerbi-report-authoring";

/* ----------------------------------------------------
    📍 CONFIGURATION & CONSTANTS
   ---------------------------------------------------- */
const pbiService = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);

// Updated Interfaces to match your new JSON structure
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
  const navigate = useNavigate();
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* ----------- DATA MAPPING HELPERS ----------- */
  const cleanColumnName = (colName: string) => {
    if (!colName) return "";
    return colName.replace(/^(cnt|sum|avg|min|max|count|distinct):/i, "");
  };

  const mapRoleName = (visualType: string, semanticRole: string): string => {
    const type = visualType.toLowerCase();
    const role = semanticRole.toLowerCase();

    if (type.includes("table") || type.includes("matrix")) return "Values";
    if (type.includes("bar") || type.includes("column") || type.includes("line")) {
      if (role === "category" || role === "axis") return "Category";
      return "Y";
    }
    if (type.includes("pie") || type.includes("donut")) {
      if (role === "legend" || role === "category") return "Category";
      return "Y";
    }
    if (type.includes("map")) return "Category";

    return "Values";
  };

  async function createStaticVisuals(report: any) {
    if (executed.current) return;
    executed.current = true;
    console.group("🚀 Migrating Dashboards to Pages");

    try {
      setStatus("Fetching visual metadata...");
      let metadata: ExtractionMetadata | null = null;

      if (metadataBlobUrl) {
        const apiRes = await fetch(metadataBlobUrl);
        if (apiRes.ok) {
          const rawData = await apiRes.json();
          // Adjust for "metadata" wrapper in your response body
          metadata = rawData.metadata || rawData;
          setSource("API");
        }
      }

      if (!metadata || !metadata.dashboards) {
        setStatus("No dashboard configuration found");
        setStatusType("warning");
        return;
      }

      setStatus("Entering Edit Mode...");
      await report.switchMode(models.ViewMode.Edit);
      await sleep(1000);

      const initialPages = await report.getPages();

      // ITERATE THROUGH DASHBOARDS
      for (const dash of metadata.dashboards) {
        setStatus(`Creating Page: ${dash.dashboardName}...`);

        // 1. Create a new Power BI Page for each Tableau Dashboard
        const page = await report.addPage(dash.dashboardName);
        await report.setPage(page.name);
        await sleep(800);

        // 2. Filter worksheets that belong to this dashboard
        const dashWorksheets = metadata.worksheets.filter((ws) => dash.worksheets.includes(ws.name));

        let currentY = 0; // Simple vertical stacking for visuals

        for (const ws of dashWorksheets) {
          setStatus(`Adding ${ws.name} to ${dash.dashboardName}...`);

          try {
            // Mapping tableau types to PBI types
            const pbiType = ws.visualType === "Map" ? "filledMap" : "barChart";

            const { visual } = await page.createVisual(pbiType, {
              x: 20,
              y: currentY,
              width: 600,
              height: 350,
            });

            // Set Title
            await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: ws.name });
            await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });

            // 3. Bind Columns
            for (const colInfo of ws.columns) {
              const sanitizedCol = cleanColumnName(colInfo.column);
              // Guessing roles: first col is usually category, others are values
              const role = ws.columns.indexOf(colInfo) === 0 ? "Category" : "Y";

              try {
                await visual.addDataField(role, {
                  $schema: "http://powerbi.com/product/schema#column",
                  table: colInfo.table,
                  column: sanitizedCol,
                });
              } catch (e) {
                console.warn(`Binding failed for ${sanitizedCol}`, e);
              }
            }

            currentY += 370; // Move next visual down
            await sleep(300);
          } catch (e) {
            console.error(`Failed to create visual ${ws.name}`, e);
          }
        }
      }

      // Cleanup: Delete the original blank "Page 1"
      if (initialPages.length > 0) {
        try {
          await report.deletePage(initialPages[0].name);
        } catch (e) {
          /* ignore if only one page exists */
        }
      }

      await report.save();
      setStatus("Dashboard-to-Page migration complete!");
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/migration")}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Report Preview</h1>
        </div>

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

        <div className="relative flex-1 w-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
