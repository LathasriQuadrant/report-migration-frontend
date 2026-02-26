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
  const reportId = sessionStorage.getItem("upload_report_id");
  const datasetId = sessionStorage.getItem("upload_dataset_id");
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

      // 1. Build lookup map
      const visualMap = new Map<string, ApiVisual>();
      visualsToCreate.forEach((v) => visualMap.set(v.title, v));

      /* ----------------------------------------------------------
         🧠 ORPHAN VISUALS & UNIFIED PAGE PROCESSING
      ---------------------------------------------------------- */
      const assignedVisuals = new Set<string>();
      dashboards.forEach((d) => {
        d.worksheets.forEach((w: string) => assignedVisuals.add(w));
      });

      // Find visuals without a dashboard (like Sheet 5)
      const orphanWorksheets = visualsToCreate.filter((v) => !assignedVisuals.has(v.title)).map((v) => v.title);

      // Create a processing list indicating if a page is for orphans
      const pagesToProcess = dashboards.map((d) => ({
        worksheets: d.worksheets,
        isOrphan: false,
      }));

      if (orphanWorksheets.length > 0) {
        pagesToProcess.push({
          worksheets: orphanWorksheets,
          isOrphan: true,
        });
      }

      const cleanReportName = rawReportName.replace(/[^a-zA-Z0-9]/g, "");
      const FALLBACK_TABLES = [rawReportName, cleanReportName, "Sheet1", "Table1", "Extract", "Data", "MainTable"];
      const uniqueFallbacks = [...new Set(FALLBACK_TABLES)];

      let pages = await report.getPages();

      /* ----------------------------------------------------------
         📊 LOOP THROUGH UNIFIED PAGES
      ---------------------------------------------------------- */
      for (let i = 0; i < pagesToProcess.length; i++) {
        const config = pagesToProcess[i];
        const expectedPageName = `Page ${i + 1}`;
        let targetPage = pages[i];

        // Create page if it doesn't exist
        if (!targetPage) {
          targetPage = await report.addPage(expectedPageName);
          pages = await report.getPages();
        }

        setStatus(`Preparing ${expectedPageName}...`);

        // Switch to the page
        await new Promise<void>((resolve) => {
          const handler = () => {
            report.off("pageChanged", handler);
            resolve();
          };
          report.on("pageChanged", handler);
          targetPage.setActive();
        });

        const page = await report.getActivePage();

        // 🔥 STRICT RENAMING AFTER ACTIVATION (Forces "Page 1", "Page 2", etc.)
        if (page.displayName !== expectedPageName) {
          try {
            await page.rename(expectedPageName);
          } catch (e) {
            console.warn(`Rename to ${expectedPageName} failed:`, e);
          }
        }

        // Clear existing visuals
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

        // Track Y position so orphans can stack neatly instead of overlapping
        let currentOrphanY = 40;

        // 4. Create Visuals
        for (const sheetName of config.worksheets) {
          const v = visualMap.get(sheetName);
          if (!v) continue;

          // 🔥 RESET Y POSITION FOR ORPHANS SO THEY DON'T RENDER OFF SCREEN
          let finalX = v.layout.x;
          let finalY = v.layout.y;

          if (config.isOrphan) {
            finalX = 40;
            finalY = currentOrphanY;
            currentOrphanY += v.layout.height + 20; // Add gap for next visual
          }

          setStatus(`Creating ${v.visualType} on ${expectedPageName}...`);
          try {
            const { visual } = await page.createVisual(normalizeType(v.visualType), {
              x: finalX,
              y: finalY,
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

            // Data binding
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
      /* ---- DEBUG: Log session data ---- */
      console.group("🔍 DEBUG: Session Data");
      console.log("workspaceId:", workspaceId);
      console.log("reportId:", reportId);
      console.log("datasetId:", datasetId);
      console.log("metadataBlobUrl:", metadataBlobUrl);
      console.log("rawReportName:", rawReportName);
      console.groupEnd();

      if (!workspaceId || !reportId) {
        setStatus("Missing Session Data");
        setStatusType("error");
        return;
      }

      try {
        /* ---- DEBUG: Embed token request ---- */
        console.group("🔑 DEBUG: Embed Token Request");
        const tokenPayload = { workspaceId, reportId, datasetId };
        console.log("Request payload:", JSON.stringify(tokenPayload, null, 2));

        const res = await fetch("https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/embed-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokenPayload),
        });

        console.log("HTTP Status:", res.status, res.statusText);
        console.log("Response Headers:");
        res.headers.forEach((value, key) => {
          console.log(`  ${key}: ${value}`);
          if (
            key.toLowerCase().includes("request") ||
            key.toLowerCase().includes("activity") ||
            key.toLowerCase().includes("cluster")
          ) {
            console.log(`  ⭐ ${key}: ${value}`);
          }
        });

        const tokenData = await res.json();
        const { embedToken, embedUrl } = tokenData;

        console.log("embedUrl:", embedUrl);
        console.log("embedToken (first 50 chars):", embedToken ? embedToken.substring(0, 50) + "..." : "MISSING!");
        console.log("embedToken type:", typeof embedToken);
        console.log("embedToken length:", embedToken ? embedToken.length : 0);
        console.log("Full token response keys:", Object.keys(tokenData));
        if (tokenData.modelId) console.log("modelId from token response:", tokenData.modelId);
        if (tokenData.datasetId) console.log("datasetId from token response:", tokenData.datasetId);
        console.groupEnd();

        if (!embedToken) {
          console.error("❌ CRITICAL: embedToken is missing or empty!");
          setStatus("Embed token missing from response");
          setStatusType("error");
          return;
        }

        if (containerRef.current) {
          pbiService.reset(containerRef.current);

          const embedConfig = {
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
          };

          console.group("📋 DEBUG: Embed Configuration");
          console.log("tokenType:", models.TokenType.Embed, "(models.TokenType.Embed)");
          console.log("permissions:", models.Permissions.All, "(models.Permissions.All)");
          console.log("viewMode:", models.ViewMode.Edit, "(models.ViewMode.Edit)");
          console.log("report id:", reportId);
          console.log(
            "Full config (token redacted):",
            JSON.stringify({ ...embedConfig, accessToken: "[REDACTED]" }, null, 2),
          );
          console.groupEnd();

          report = pbiService.embed(containerRef.current, embedConfig);

          /* ---- DEBUG: Report lifecycle events ---- */
          report.on("loaded", () => {
            console.log("✅ DEBUG: Report 'loaded' event fired");
          });

          report.on("rendered", () => {
            console.log("📊 DEBUG: Report 'rendered' event fired");
            createStaticVisuals(report);
          });

          report.on("error", (e: any) => {
            console.group("❌ DEBUG: Power BI Error Event");
            console.error("Full error event:", JSON.stringify(e, null, 2));
            if (e.detail) {
              console.error("Error detail:", JSON.stringify(e.detail, null, 2));
              console.error("Message:", e.detail.message);
              console.error("Error code:", e.detail.errorCode);
              console.error("Level:", e.detail.level);
              if (e.detail.technicalDetails) {
                console.error("Technical Details:", JSON.stringify(e.detail.technicalDetails, null, 2));
                console.error("  RequestId:", e.detail.technicalDetails.requestId);
                console.error("  ErrorInfo:", e.detail.technicalDetails.errorInfo);
              }
              if (e.detail.activityId) console.error("ActivityId:", e.detail.activityId);
              if (e.detail.requestId) console.error("RequestId:", e.detail.requestId);
              if (e.detail.clusterUri) console.error("Cluster URI:", e.detail.clusterUri);
            }
            console.groupEnd();
            setStatus("Power BI Error");
            setStatusType("error");
          });

          report.on("dataSelected", (e: any) => {
            console.log("📊 DEBUG: dataSelected event:", JSON.stringify(e, null, 2));
          });

          report.on("commandTriggered", (e: any) => {
            console.log("⚡ DEBUG: commandTriggered event:", JSON.stringify(e, null, 2));
          });

          /* ---- DEBUG: Intercept network for querydata failures ---- */
          const originalFetch = window.fetch;
          window.fetch = async function (...args: Parameters<typeof fetch>) {
            const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
            const isQueryData =
              url.includes("querydata") ||
              url.includes("QueryData") ||
              url.includes("conceptualschema") ||
              url.includes("explore");

            if (isQueryData) {
              console.group("🌐 DEBUG: PBI Network Request");
              console.log("URL:", url);
              console.log("Method:", (args[1] as RequestInit)?.method || "GET");
            }

            try {
              const response = await originalFetch.apply(this, args);

              if (isQueryData) {
                console.log("Status:", response.status, response.statusText);
                response.headers.forEach((value, key) => {
                  if (
                    key.toLowerCase().includes("requestid") ||
                    key.toLowerCase().includes("activityid") ||
                    key.toLowerCase().includes("x-powerbi") ||
                    key.toLowerCase().includes("cluster")
                  ) {
                    console.log(`  Header ${key}: ${value}`);
                  }
                });

                if (!response.ok) {
                  console.error("⚠️ QUERY DATA FAILURE!");
                  console.error("HTTP Status:", response.status);
                  try {
                    const cloned = response.clone();
                    const errorBody = await cloned.text();
                    console.error("Response Body:", errorBody);
                  } catch (readErr) {
                    console.error("Could not read error body:", readErr);
                  }
                }
                console.groupEnd();
              }

              return response;
            } catch (err) {
              if (isQueryData) {
                console.error("❌ NETWORK ERROR on querydata:", err);
                console.groupEnd();
              }
              throw err;
            }
          };
        }
      } catch (e: any) {
        console.error("❌ DEBUG: Init failed:", e);
        console.error("Stack:", e.stack);
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
