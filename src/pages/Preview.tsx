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

  const normalizeType = (type: string) => {
    const map: Record<string, string> = {
      tableEx: "table",
      clusteredBarChart: "barChart",
      clusteredColumnChart: "columnChart",
      lineChart: "lineChart",
      pieChart: "pieChart",
      donutChart: "donutChart",
    };
    return map[type] || type;
  };

  async function createStaticVisuals(report: any) {
    if (executed.current) return;
    executed.current = true;
    console.group("🚀 Creating Visuals from API");

    try {
      setStatus("Fetching visual configuration...");

      let visualsToCreate: ApiVisual[] = [];
      let dashboards: any[] = [];

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
            if (visualsToCreate.length > 0) {
              setSource("API");
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (visualsToCreate.length === 0) {
        setStatus("No visuals to create (Check API logs)");
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

      // 1. Build a lookup map of visuals by their title (e.g., "Sheet 1")
      const visualMap = new Map<string, ApiVisual>();
      visualsToCreate.forEach((v) => visualMap.set(v.title, v));

      /* ----------------------------------------------------------
         🧠 ORPHAN VISUALS & UNIFIED PAGE PROCESSING
      ---------------------------------------------------------- */
      // Track which visuals are mapped to a dashboard
      const assignedVisuals = new Set<string>();
      dashboards.forEach((d) => {
        d.worksheets.forEach((w: string) => assignedVisuals.add(w));
      });

      // Find visuals that have no dashboard assigned
      const orphanWorksheets = visualsToCreate.filter((v) => !assignedVisuals.has(v.title)).map((v) => v.title);

      // Create a unified list of pages to process
      const pagesToProcess = dashboards.map((d) => ({ worksheets: d.worksheets }));

      // If unmapped visuals exist, dynamically create an extra page config for them
      if (orphanWorksheets.length > 0) {
        pagesToProcess.push({ worksheets: orphanWorksheets });
      }

      // 2. Fallbacks for data binding
      const cleanReportName = rawReportName.replace(/[^a-zA-Z0-9]/g, "");
      const FALLBACK_TABLES = [rawReportName, cleanReportName, "Sheet1", "Table1", "Extract", "Data", "MainTable"];
      const uniqueFallbacks = [...new Set(FALLBACK_TABLES)];

      let pages = await report.getPages();

      // 3. Loop through Unified Pages List
      for (let i = 0; i < pagesToProcess.length; i++) {
        const config = pagesToProcess[i];
        const expectedPageName = `Page ${i + 1}`; // Strict Sequential Naming
        let targetPage = pages[i];

        // Ensure page exists and matches strictly "Page X"
        if (!targetPage) {
          targetPage = await report.addPage(expectedPageName);
          pages = await report.getPages(); // Refresh the array
        } else if (targetPage.displayName !== expectedPageName) {
          try {
            await targetPage.rename(expectedPageName);
          } catch (e) {
            console.warn(`Could not rename to ${expectedPageName}`);
          }
        }

        setStatus(`Preparing ${expectedPageName}...`);

        // 🔥 Safely switch page and wait for the event before proceeding
        await new Promise<void>((resolve) => {
          const handler = () => {
            report.off("pageChanged", handler);
            resolve();
          };
          report.on("pageChanged", handler);
          targetPage.setActive();
        });

        // Always fetch the active page context after switching
        const page = await report.getActivePage();

        // Clear existing visuals on this page
        try {
          const existingVisuals = await page.getVisuals();
          for (const v of existingVisuals) {
            try {
              await page.deleteVisual(v.name);
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          /* ignore */
        }

        await sleep(500);

        // 4. Create Visuals for this page configuration
        for (const sheetName of config.worksheets) {
          const v = visualMap.get(sheetName);
          if (!v) continue;

          setStatus(`Creating ${v.visualType} on ${expectedPageName}...`);
          try {
            const { visual } = await page.createVisual(normalizeType(v.visualType), {
              x: v.layout.x,
              y: v.layout.y,
              width: v.layout.width,
              height: v.layout.height,
              displayState: { mode: models.VisualContainerDisplayMode.Visible },
            });

            if (v.title) {
              try {
                await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: v.title });
                await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });
              } catch (e) {
                /* ignore */
              }
            }
            await sleep(200);

            // Data binding loop
            const bindingEntries = Object.entries(v.bindings);
            for (const [semanticRole, data] of bindingEntries) {
              const technicalRole = mapRoleName(v.visualType, semanticRole);
              const bindArray = Array.isArray(data) ? data : [data];

              for (const b of bindArray) {
                const rawCol = b?.column || "";
                const sanitizedCol = cleanColumnName(rawCol);

                if (b && b.table && sanitizedCol) {
                  let bound = false;
                  try {
                    await visual.addDataField(technicalRole, {
                      $schema: "http://powerbi.com/product/schema#column",
                      table: b.table,
                      column: sanitizedCol,
                    });
                    bound = true;
                  } catch (e) {
                    /* warn */
                  }

                  if (!bound) {
                    for (const fallbackTable of uniqueFallbacks) {
                      if (fallbackTable === b.table) continue;
                      try {
                        await visual.addDataField(technicalRole, {
                          $schema: "http://powerbi.com/product/schema#column",
                          table: fallbackTable,
                          column: sanitizedCol,
                        });
                        bound = true;
                        break;
                      } catch (e) {
                        /* continue */
                      }
                    }
                  }
                }
              }
            }
          } catch (e: any) {
            console.error(`❌ Create failed for ${sheetName}:`, e);
          }
        }
      }

      await report.save();
      setStatus("Dashboards and Visuals generated successfully!");
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
