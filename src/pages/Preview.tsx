import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as models from "powerbi-models";
import { service, factories } from "powerbi-client";
import { Loader2, CheckCircle2, XCircle, Globe, AlertTriangle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";

import "powerbi-report-authoring";

/* ----------------------------------------------------
    📍 CONFIGURATION & INTERFACES
   ---------------------------------------------------- */
const API_URL = "https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/runtime-visuals";
const pbiService = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);

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
  bindings: Record<string, ApiBinding | ApiBinding[]>;
}

interface ApiDashboard {
  dashboardName: string;
  worksheets: string[];
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
  const rawReportName = sessionStorage.getItem("report_name") || "sampletbl";

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
    return semanticRole;
  };

  async function createStaticVisuals(report: any) {
    if (executed.current) return;
    executed.current = true;
    console.group("🚀 Creating Visuals from API");

    try {
      setStatus("Fetching visual configuration...");
      let visualsToCreate: ApiVisual[] = [];
      let dashboards: ApiDashboard[] = [];

      if (metadataBlobUrl) {
        try {
          const apiRes = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadataBlobPath: metadataBlobUrl }),
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            visualsToCreate = data.visuals || [];
            dashboards = data.dashboards || [];
            setSource("API");
          }
        } catch (e) {
          console.error("API Error:", e);
        }
      }

      if (visualsToCreate.length === 0) {
        setStatus("No visuals found");
        setStatusType("warning");
        return;
      }

      // Ensure Dashboard 1 exists if API only returns a flat list
      if (dashboards.length === 0) {
        dashboards = [
          {
            dashboardName: "Dashboard 1",
            worksheets: visualsToCreate.map((v) => v.title),
          },
        ];
      }

      setStatus("Switching to Edit mode...");
      await report.switchMode(models.ViewMode.Edit);
      await sleep(1500);

      const initialPages = await report.getPages();
      const firstPage = initialPages[0];

      // Clean default Page 1
      try {
        const visuals = await firstPage.getVisuals();
        for (const v of visuals) await firstPage.deleteVisual(v.name);
      } catch (e) {}

      const uniqueFallbacks = [...new Set([rawReportName, "Sheet1", "Table1", "Extract", "Data", "MainTable"])];

      /* =====================================================
        ⭐ DASHBOARD TO PAGE LOOP
      ===================================================== */
      for (const dash of dashboards) {
        setStatus(`Creating page: ${dash.dashboardName}`);

        // Use existing page for first dashboard, create new ones for others
        const page = dash === dashboards[0] ? firstPage : await report.addPage(dash.dashboardName);

        // Filter visuals for THIS dashboard
        const dashVisuals = visualsToCreate.filter((v) => dash.worksheets.includes(v.title));

        for (const v of dashVisuals) {
          setStatus(`Adding ${v.title} to ${dash.dashboardName}`);
          try {
            // 1. Create Visual with Layout included to avoid TypeError
            const createResult = await page.createVisual(v.visualType, {
              x: v.layout.x,
              y: v.layout.y,
              width: v.layout.width,
              height: v.layout.height,
              displayState: { mode: models.VisualContainerDisplayMode.Visible },
            });

            const visual = createResult.visual;

            // 2. Set Properties
            if (v.title) {
              await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: v.title });
              await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });
            }

            await sleep(500);

            // 3. Bind Data
            for (const [role, data] of Object.entries(v.bindings)) {
              const techRole = mapRoleName(v.visualType, role);
              const items = Array.isArray(data) ? data : [data];

              for (const item of items) {
                if (!item.column) continue;
                const sanitizedCol = cleanColumnName(item.column);
                let bound = false;

                try {
                  await visual.addDataField(techRole, {
                    $schema: "http://powerbi.com/product/schema#column",
                    table: item.table,
                    column: sanitizedCol,
                  });
                  bound = true;
                } catch (err) {}

                if (!bound) {
                  for (const fbTable of uniqueFallbacks) {
                    try {
                      await visual.addDataField(techRole, {
                        $schema: "http://powerbi.com/product/schema#column",
                        table: fbTable,
                        column: sanitizedCol,
                      });
                      break;
                    } catch (e) {}
                  }
                }
              }
            }
          } catch (err) {
            console.error(`❌ Creation failed for ${v.title}:`, err);
          }
        }
      }

      await report.save();
      setStatus("Migration successful!");
      setStatusType("success");
    } catch (err: any) {
      console.error("❌ Critical Error:", err);
      setStatus("Error: " + err.message);
      setStatusType("error");
    } finally {
      console.groupEnd();
    }
  }

  useEffect(() => {
    let report: any;
    if (isEmbedding.current) return;
    isEmbedding.current = true;

    async function init() {
      if (!workspaceId || !reportId) return;
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
                : "bg-white border-blue-100 text-slate-700"
          }`}
        >
          {statusType === "loading" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
          {statusType === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
          {statusType === "error" && <XCircle className="h-5 w-5 text-red-600" />}
          <div className="flex flex-col flex-1">
            <span className="text-sm font-semibold opacity-70">System Status</span>
            <span className="font-medium">{status}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full border text-xs font-medium">
            <Globe className="h-3 w-3" />
            Config: {source}
          </div>
        </div>

        <div className="relative flex-1 w-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
