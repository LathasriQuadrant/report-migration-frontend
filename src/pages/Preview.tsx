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
    📍 CONFIGURATION & INTERFACES
   ---------------------------------------------------- */
const API_URL = "https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/runtime-visuals";

const pbiService = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);

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

interface ApiBinding {
  table: string;
  column: string;
}

interface ApiVisual {
  visualType: string;
  title: string;
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bindings: Record<string, ApiBinding>;
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
  const mapApiDataToVisuals = (apiResponse: any): ApiVisual[] | null => {
    try {
      if (!apiResponse) return null;
      const visualsArray = apiResponse.runtime_visuals?.visuals || apiResponse.visuals;
      if (!Array.isArray(visualsArray)) return null;

      return visualsArray.map((v: any) => ({
        visualType: v.visualType,
        title: v.title,
        layout: v.layout,
        bindings: v.bindings,
      }));
    } catch (e) {
      console.error("Mapping error:", e);
      return null;
    }
  };

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
    console.group("🚀 Creating Visuals from API");

    try {
      setStatus("Fetching visual configuration...");
      let metadata: ExtractionMetadata | null = null;
      let visualsToCreate: ApiVisual[] = [];
      let dashboards: ApiDashboard[] = [];

      if (metadataBlobUrl) {
        try {
          // Fetch directly from blob for the new dashboard structure
          const blobRes = await fetch(metadataBlobUrl);
          if (blobRes.ok) {
            const data = await blobRes.json();
            metadata = data.metadata || data;

            if (metadata) {
              dashboards = metadata.dashboards || [];
              setSource("API");
            }
          }
        } catch (e) {
          console.error("Blob fetch failed, falling back to API", e);
        }
      }

      // Fallback to API_URL if blob fails or is insufficient
      if (!metadata || dashboards.length === 0) {
        try {
          const apiRes = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadataBlobPath: metadataBlobUrl }),
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            dashboards = data.runtime_visuals?.dashboards || data.dashboards || [];
            const mapped = mapApiDataToVisuals(data);
            if (mapped && mapped.length > 0) {
              visualsToCreate = mapped;
              setSource("API");
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      setStatus("Switching to Edit mode...");
      try {
        await report.switchMode(models.ViewMode.Edit);
      } catch (e) {
        /* ignore */
      }
      await sleep(1000);

      const initialPages = await report.getPages();
      const firstPage = initialPages[0];

      // Normalize Dashboards if none exist
      if (!dashboards || dashboards.length === 0) {
        dashboards = [
          {
            dashboardName: "Report",
            worksheets: visualsToCreate.map((v) => v.title),
          },
        ];
      }

      setStatus("Clearing canvas...");
      try {
        const existingVisuals = await firstPage.getVisuals();
        for (const v of existingVisuals) {
          try {
            await firstPage.deleteVisual(v.name);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      await sleep(500);

      const cleanReportName = rawReportName.replace(/[^a-zA-Z0-9]/g, "");
      const FALLBACK_TABLES = [rawReportName, cleanReportName, "Sheet1", "Table1", "Extract", "Data", "MainTable"];
      const uniqueFallbacks = [...new Set(FALLBACK_TABLES)];

      /* =====================================================
        ⭐ SINGLE UNIFIED PAGE CREATION LOOP
      ===================================================== */
      for (const dash of dashboards) {
        setStatus(`Creating page: ${dash.dashboardName}`);

        // FIX: Use firstPage for the first dash, addPage for others
        const page = dash === dashboards[0] ? firstPage : await report.addPage(dash.dashboardName);

        // Match visuals to this dashboard
        const dashVisuals = metadata
          ? metadata.worksheets.filter((ws) => dash.worksheets.includes(ws.name))
          : visualsToCreate.filter((v) => dash.worksheets.includes(v.title));

        let currentY = 0;

        for (const v of dashVisuals) {
          const vTitle = "title" in v ? v.title : v.name;
          const vType = "visualType" in v ? v.visualType : v.visualType;

          setStatus(`Adding ${vTitle} to ${dash.dashboardName}`);

          try {
            // FIX 1: Map Tableau types to PBI internal types to avoid unsupportedProperty
            let pbiType = "barChart";
            const typeStr = vType.toLowerCase();
            if (typeStr.includes("map")) pbiType = "filledMap";
            else if (typeStr.includes("table")) pbiType = "table";
            else if (typeStr.includes("pie")) pbiType = "pieChart";

            // FIX 2: Create with minimal config
            const { visual } = await page.createVisual(pbiType);

            // FIX 3: Set layout properties AFTER creation
            await visual.setCustomSize(600, 300);
            await visual.setCustomPosition(20, currentY);

            if (vTitle) {
              await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: vTitle });
              await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });
            }

            await sleep(200);

            // Handle Data Binding based on metadata source
            if ("columns" in v) {
              // Metadata Path
              for (let i = 0; i < v.columns.length; i++) {
                const col = v.columns[i];
                const role = i === 0 ? "Category" : "Y";
                try {
                  await visual.addDataField(role, {
                    $schema: "http://powerbi.com/product/schema#column",
                    table: col.table,
                    column: cleanColumnName(col.column),
                  });
                } catch {
                  /* ignore */
                }
              }
            } else if ("bindings" in v) {
              // API Path
              for (const [semanticRole, data] of Object.entries(v.bindings)) {
                if (!data || !data.column) continue;
                const sanitizedCol = cleanColumnName(data.column);
                const technicalRole = mapRoleName(vType, semanticRole);

                let bound = false;
                try {
                  await visual.addDataField(technicalRole, {
                    $schema: "http://powerbi.com/product/schema#column",
                    table: data.table,
                    column: sanitizedCol,
                  });
                  bound = true;
                } catch {
                  /* ignore */
                }

                if (!bound) {
                  for (const fb of uniqueFallbacks) {
                    try {
                      await visual.addDataField(technicalRole, {
                        $schema: "http://powerbi.com/product/schema#column",
                        table: fb,
                        column: sanitizedCol,
                      });
                      break;
                    } catch {
                      /* ignore */
                    }
                  }
                }
              }
            }

            currentY += 350;
            await sleep(300);
          } catch (e: any) {
            console.error(`❌ Create failed for visual:`, e);
          }
        }
      }

      await report.save();
      setStatus("Visuals generated successfully!");
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
