import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as models from "powerbi-models";
import { service, factories } from "powerbi-client";
import { Loader2, CheckCircle2, XCircle, Globe, AlertTriangle, ArrowLeft, Clock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Initializing...");
  const [statusType, setStatusType] = useState<"loading" | "success" | "error" | "warning">("loading");
  const [source, setSource] = useState<"API" | "None">("None");

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState("60"); // minutes for lakehouse

  // Power BI schedule fields
  const [scheduleDays, setScheduleDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(["08:00"]);
  const [newTime, setNewTime] = useState("08:00");
  const [scheduleTimeZone, setScheduleTimeZone] = useState("UTC");
  // notifyOption removed — backend forces "NoNotification" via Service Principal

  const isEmbedding = useRef(false);
  const executed = useRef(false);

  /* ---------------- SESSION DATA ---------------- */
  const workspaceId = sessionStorage.getItem("workspace_id");
  const reportId = sessionStorage.getItem("upload_report_id");
  const datasetId = sessionStorage.getItem("upload_dataset_id");
  const metadataBlobUrl = sessionStorage.getItem("metadataOutputBlobUrl");
  const rawReportName = sessionStorage.getItem("report_name") || "sampletbl";

  const userToken = sessionStorage.getItem("access_token");

  const BACKEND_BASE_URL = "https://accesstokens-aecjbzaqaqcuh6bd.eastus-01.azurewebsites.net";
  const handleScheduleRefresh = async () => {
    console.group("DEBUG: Schedule Refresh");

    // Step 1: Validate required session values
    console.log("Step 1 — Session values:", { datasetId, workspaceId });

    if (!datasetId || !workspaceId) {
      console.error("Step 1 FAIL: datasetId or workspaceId missing");
      console.groupEnd();
      toast({ title: "Missing data", description: "Dataset ID or Workspace ID not found.", variant: "destructive" });
      return;
    }

    setScheduling(true);
    try {
      // Step 2: Build payload — flat object, backend wraps in {value:...} and forces notifyOption
      const pbiPayload: Record<string, any> = {
        enabled: scheduleEnabled,
        times: scheduleTimes,
        timeZone: scheduleTimeZone,
      };
      if (scheduleDays.length > 0) {
        pbiPayload.days = scheduleDays;
      }

      const pbiUrl = `${BACKEND_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/refresh-schedule?workspace_id=${encodeURIComponent(workspaceId)}`;

      console.log("Step 2 — Power BI URL:", pbiUrl);
      console.log("Step 2 — Power BI Payload:", JSON.stringify(pbiPayload));

      // Step 3: Fire request (backend uses Service Principal token)
      console.log("Step 3 — Sending PATCH request…");

      const pbiRes = await fetch(pbiUrl, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pbiPayload),
      });

      // Step 4: Trace response
      const body = await pbiRes.text();
      console.log(`Step 4 — Power BI response: ${pbiRes.status} ${pbiRes.statusText}`, body);

      if (!pbiRes.ok) {
        console.error("Step 4 — Power BI returned non-OK:", pbiRes.status, body);
        throw new Error(`Power BI schedule failed: ${body || `HTTP ${pbiRes.status}`}`);
      }

      // Step 5: Summary
      console.log("Step 5 — Success");
      console.groupEnd();

      toast({
        title: scheduleEnabled ? "Schedule enabled" : "Schedule disabled",
        description: scheduleEnabled
          ? `Power BI: ${scheduleTimes.join(", ")} on ${scheduleDays.length > 0 ? scheduleDays.length + " day(s)" : "all days"}`
          : "Scheduled refresh has been turned off.",
      });
      setScheduleOpen(false);
    } catch (err: any) {
      console.error("Schedule Refresh ERROR:", err);
      console.groupEnd();
      toast({ title: "Schedule failed", description: err.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const handleRefreshNow = async () => {
    if (!datasetId || !workspaceId) {
      toast({ title: "Missing data", description: "Dataset ID or Workspace ID not found.", variant: "destructive" });
      return;
    }

    setRefreshing(true);
    try {
      // Hit the original dataset refresh endpoint
      const res = await fetch(
        `${BACKEND_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/refresh?workspace_id=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      // Also hit the lakehouse refresh endpoint
      if (rawReportName) {
        const lakehouseRes = await fetch(
          `${LAKEHOUSE_BASE_URL}/api/v1/lakehouse/refresh/${encodeURIComponent(rawReportName)}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!lakehouseRes.ok) {
          const errText = await lakehouseRes.text();
          console.warn("Lakehouse refresh warning:", errText);
        }
      }

      toast({ title: "Refresh triggered", description: `Refresh started for dataset.` });
    } catch (err: any) {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

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

    // 1. Grab the Job ID we saved on the previous screen
    const currentJobId = sessionStorage.getItem("current_migration_job_id");

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

        // ❌ DB UPDATE: Mark as failed because no visuals were found
        if (currentJobId) {
          try {
            await fetch(
              `https://databasemanagement-e0e0d7bqhdg3gec7.eastus-01.azurewebsites.net/jobs/${currentJobId}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  MigrationStatus: "Failed",
                  ErrorMessage: "No visuals to create (Check API logs)",
                  CompletedAt: new Date().toISOString(),
                }),
              },
            );
          } catch (e) {
            console.error("Failed to update job status", e);
          }
        }

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

      // Build lookup map
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

      // ✅ DB UPDATE SUCCESS: Update the database to Completed
      if (currentJobId) {
        try {
          await fetch(`https://databasemanagement-e0e0d7bqhdg3gec7.eastus-01.azurewebsites.net/jobs/${currentJobId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              MigrationStatus: "Completed",
              CompletedAt: new Date().toISOString(), // Gives us the end time for duration math
            }),
          });
        } catch (e) {
          console.error("Failed to update job status to Completed", e);
        }
      }
    } catch (err: any) {
      console.error("❌ Critical Error:", err);
      setStatus("Error: " + err.message);
      setStatusType("error");

      // ❌ DB UPDATE FAILED: Update the database to Failed
      if (currentJobId) {
        try {
          await fetch(`https://databasemanagement-e0e0d7bqhdg3gec7.eastus-01.azurewebsites.net/jobs/${currentJobId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              MigrationStatus: "Failed",
              ErrorMessage: err.message || "Unknown error occurred during visual generation",
              CompletedAt: new Date().toISOString(),
            }),
          });
        } catch (e) {
          console.error("Failed to update job status to Failed", e);
        }
      }
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

      if (!workspaceId || !reportId || !userToken) {
        setStatus("Missing Session Data or Auth Token");
        setStatusType("error");
        return;
      }

      try {
        if (containerRef.current) {
          pbiService.reset(containerRef.current);

          // 🚀 We build the URL manually now
          const builtEmbedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${workspaceId}`;

          const embedConfig = {
            type: "report",
            id: reportId,
            embedUrl: builtEmbedUrl, // Added this line
            accessToken: userToken, // Changed this line to use session storage token
            tokenType: models.TokenType.Aad, // Changed this line to Aad
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
          console.log("tokenType:", models.TokenType.Aad, "(models.TokenType.Aad)");
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
  }, [workspaceId, reportId, datasetId, metadataBlobUrl, rawReportName, userToken]);

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

        {/* Refresh Buttons - shown after success */}
        {statusType === "success" && (
          <div className="flex justify-end gap-2">
            <Button onClick={handleRefreshNow} disabled={refreshing} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button onClick={() => setScheduleOpen(true)} className="gap-2">
              <Clock className="h-4 w-4" />
              Schedule Refresh
            </Button>
          </div>
        )}

        {/* Power BI Container */}
        <div className="relative flex-1 w-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>

      {/* Schedule Refresh Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Refresh</DialogTitle>
            <DialogDescription>
              Configure the refresh schedule for <strong>{rawReportName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <span className="text-sm font-medium">Enable Scheduled Refresh</span>
                <p className="text-xs text-muted-foreground">
                  {scheduleEnabled ? "Refresh is active" : "Refresh is turned off"}
                </p>
              </div>
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>

            {/* All schedule options - only shown when enabled */}
            {scheduleEnabled && (
              <>
                {/* Lakehouse Interval */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lakehouse Refresh Interval</label>
                  <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every 1 hour</SelectItem>
                      <SelectItem value="120">Every 2 hours</SelectItem>
                      <SelectItem value="180">Every 3 hours</SelectItem>
                      <SelectItem value="360">Every 6 hours</SelectItem>
                      <SelectItem value="720">Every 12 hours</SelectItem>
                      <SelectItem value="1440">Every 24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Days of the week */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Power BI Refresh Days</label>
                  <div className="grid grid-cols-4 gap-2">
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                      <label key={day} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={scheduleDays.includes(day)}
                          onCheckedChange={(checked) => {
                            setScheduleDays((prev) =>
                              checked ? [...prev, day] : prev.filter((d) => d !== day)
                            );
                          }}
                        />
                        <span>{day.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Refresh Times */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Power BI Refresh Times (UTC)</label>
                  <div className="flex flex-wrap gap-2">
                    {scheduleTimes.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm">
                        {t}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setScheduleTimes((prev) => prev.filter((x) => x !== t))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newTime && !scheduleTimes.includes(newTime)) {
                          setScheduleTimes((prev) => [...prev, newTime].sort());
                        }
                      }}
                    >
                      Add Time
                    </Button>
                  </div>
                </div>

                {/* Time Zone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Zone</label>
                  <Select value={scheduleTimeZone} onValueChange={setScheduleTimeZone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Eastern Standard Time">Eastern (US)</SelectItem>
                      <SelectItem value="Central Standard Time">Central (US)</SelectItem>
                      <SelectItem value="Mountain Standard Time">Mountain (US)</SelectItem>
                      <SelectItem value="Pacific Standard Time">Pacific (US)</SelectItem>
                      <SelectItem value="India Standard Time">India (IST)</SelectItem>
                      <SelectItem value="GMT Standard Time">GMT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notify Option */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notification</label>
                  <Select value={notifyOption} onValueChange={setNotifyOption}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MailOnFailure">Email on failure</SelectItem>
                      <SelectItem value="NoNotification">No notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleRefresh} disabled={scheduling}>
              {scheduling && <Loader2 className="h-4 w-4 animate-spin" />}
              {scheduling ? "Scheduling..." : "Set Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
