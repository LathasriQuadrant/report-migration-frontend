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
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Initializing...");
  const [statusType, setStatusType] = useState<"loading" | "success" | "error" | "warning">("loading");
  const [source, setSource] = useState<"API" | "None">("None");

  const isEmbedding = useRef(false);
  const executed = useRef(false);

  const workspaceId = sessionStorage.getItem("workspace_id");
  const reportId = sessionStorage.getItem("generated_report_id");
  const datasetId = sessionStorage.getItem("generated_dataset_id");
  const metadataBlobUrl = sessionStorage.getItem("metadataOutputBlobUrl");
  const rawReportName = sessionStorage.getItem("report_name") || "sampletbl";

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const cleanColumnName = (colName: string) => {
    if (!colName) return "";
    return colName.replace(/^(cnt|sum|avg|min|max|count|distinct):/i, "");
  };

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

  const mapRoleName = (visualType: string, semanticRole: string): string => {
    const type = visualType.toLowerCase();
    const role = semanticRole.toLowerCase();
    if (type.includes("table") || type.includes("matrix")) return "Values";
    if (type.includes("bar") || type.includes("column") || type.includes("line")) {
      if (role === "category" || role === "axis") return "Category";
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
      let metadata: ExtractionMetadata | null = null;
      let visualsToCreate: ApiVisual[] = [];
      let dashboards: ApiDashboard[] = [];

      if (metadataBlobUrl) {
        try {
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
          console.error("Blob fetch failed", e);
        }
      }

      // If no metadata or dashboards, fallback to API
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
            if (mapped) visualsToCreate = mapped;
            setSource("API");
          }
        } catch (e) {
          console.error("API fetch failed", e);
        }
      }

      setStatus("Switching to Edit mode...");
      await report.switchMode(models.ViewMode.Edit);
      await sleep(1000);

      const initialPages = await report.getPages();
      const firstPage = initialPages[0];

      if (dashboards.length === 0) {
        dashboards = [
          {
            dashboardName: "Report",
            worksheets: visualsToCreate.map((v) => v.title),
          },
        ];
      }

      // Clear first page
      try {
        const existingVisuals = await firstPage.getVisuals();
        for (const v of existingVisuals) {
          await firstPage.deleteVisual(v.name);
        }
      } catch (e) {
        /* ignore */
      }

      const uniqueFallbacks = [...new Set([rawReportName, "Sheet1", "Table1", "Data", "MainTable"])];

      for (const dash of dashboards) {
        setStatus(`Creating page: ${dash.dashboardName}`);
        const page = dash === dashboards[0] ? firstPage : await report.addPage(dash.dashboardName);

        // Unified visual collection
        const dashVisuals: (ApiWorksheet | ApiVisual)[] = metadata
          ? metadata.worksheets.filter((ws) => dash.worksheets.includes(ws.name))
          : visualsToCreate.filter((v) => dash.worksheets.includes(v.title));

        let currentY = 0;

        for (const v of dashVisuals) {
          // Resolve visual details safely to avoid TS2339
          const vTitle = "name" in v ? v.name : v.title;
          const vType = v.visualType;

          setStatus(`Adding ${vTitle} to ${dash.dashboardName}`);

          try {
            let pbiType = "barChart";
            const typeStr = vType.toLowerCase();
            if (typeStr.includes("map")) pbiType = "filledMap";
            else if (typeStr.includes("table")) pbiType = "table";
            else if (typeStr.includes("pie")) pbiType = "pieChart";

            const { visual } = await page.createVisual(pbiType);
            await visual.setCustomSize(600, 300);
            await visual.setCustomPosition(20, currentY);

            await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: vTitle });
            await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });

            await sleep(200);

            // Handle Data Binding
            if ("columns" in v) {
              for (let i = 0; i < v.columns.length; i++) {
                const col = v.columns[i];
                const role = i === 0 ? "Category" : "Y";
                await visual
                  .addDataField(role, {
                    $schema: "http://powerbi.com/product/schema#column",
                    table: col.table,
                    column: cleanColumnName(col.column),
                  })
                  .catch(() => {});
              }
            } else if ("bindings" in v) {
              for (const [semanticRole, data] of Object.entries(v.bindings)) {
                if (!data?.column) continue;
                const techRole = mapRoleName(vType, semanticRole);
                let bound = false;
                await visual
                  .addDataField(techRole, {
                    $schema: "http://powerbi.com/product/schema#column",
                    table: data.table,
                    column: cleanColumnName(data.column),
                  })
                  .then(() => (bound = true))
                  .catch(() => {});

                if (!bound) {
                  for (const fb of uniqueFallbacks) {
                    try {
                      await visual.addDataField(techRole, {
                        $schema: "http://powerbi.com/product/schema#column",
                        table: fb,
                        column: cleanColumnName(data.column),
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
          } catch (e) {
            console.error(`❌ Create failed for ${vTitle}:`, e);
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
          });
          report.on("rendered", () => createStaticVisuals(report));
        }
      } catch (e: any) {
        setStatus("Init failed");
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
          className={`flex items-center gap-3 p-4 rounded-lg border shadow-sm ${statusType === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-blue-100 text-slate-700"}`}
        >
          {statusType === "loading" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
          <div className="flex flex-col flex-1">
            <span className="text-sm font-semibold opacity-70">System Status</span>
            <span className="font-medium">{status}</span>
          </div>
        </div>
        <div className="relative flex-1 w-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
