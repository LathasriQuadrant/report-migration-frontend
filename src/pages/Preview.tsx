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
      console.log(visualsArray);
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

    try {
      setStatus("Fetching visual configuration...");

      const apiRes = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadataBlobPath: metadataBlobUrl }),
      });

      const data = await apiRes.json();
      const visuals = data.visuals || [];
      const dashboards = data.dashboards || [];

      if (!visuals.length) {
        setStatus("No visuals returned");
        setStatusType("warning");
        return;
      }

      await report.switchMode(models.ViewMode.Edit);
      await sleep(800);

      /* ------------------------------------------------
       🧠 VISUAL TYPE NORMALIZER (CRITICAL FIX)
    ------------------------------------------------ */
      const normalizeType = (type: string) => {
        const map: any = {
          tableEx: "table",
          clusteredBarChart: "barChart",
          clusteredColumnChart: "columnChart",
          lineChart: "lineChart",
          pieChart: "pieChart",
          donutChart: "donutChart",
        };
        return map[type] || type;
      };

      /* ------------------------------------------------
       GET ALL PAGES
    ------------------------------------------------ */
      let pages = await report.getPages();

      /* ------------------------------------------------
       DELETE EXTRA PAGES (KEEP ONLY REQUIRED)
    ------------------------------------------------ */
      while (pages.length > dashboards.length) {
        await report.deletePage(pages[pages.length - 1].name);
        pages = await report.getPages();
      }

      /* ------------------------------------------------
       BUILD LOOKUP
    ------------------------------------------------ */
      const visualMap = new Map();
      visuals.forEach((v: any) => visualMap.set(v.title, v));

      /* ------------------------------------------------
       DASHBOARD → PAGE MAPPING
    ------------------------------------------------ */
      for (let i = 0; i < dashboards.length; i++) {
        const dashboard = dashboards[i];
        const page = pages[i];

        if (!page) continue;

        await page.setActive();
        await sleep(400);

        /* CLEAR PAGE */
        const existing = await page.getVisuals();
        for (const v of existing) {
          await page.deleteVisual(v.name);
        }

        /* CREATE VISUALS */
        for (const sheet of dashboard.worksheets) {
          const v = visualMap.get(sheet);
          if (!v) continue;

          try {
            const { visual } = await page.createVisual(normalizeType(v.visualType), {
              x: v.layout.x,
              y: v.layout.y,
              width: v.layout.width,
              height: v.layout.height,
            });

            /* SET TITLE */
            await visual.updateSettings({
              title: { visible: true, text: v.title },
            });

            /* BIND DATA */
            for (const role of Object.keys(v.bindings)) {
              const roleName = mapRoleName(v.visualType, role);

              const bindings = Array.isArray(v.bindings[role]) ? v.bindings[role] : [v.bindings[role]];

              for (const b of bindings) {
                await visual.addDataField(roleName, {
                  $schema: "http://powerbi.com/product/schema#column",
                  table: b.table,
                  column: cleanColumnName(b.column),
                });
              }
            }
          } catch (err) {
            console.error("❌ Visual creation failed:", err);
          }
        }
      }

      await report.save();
      setStatus("Dashboards mapped successfully!");
      setStatusType("success");
    } catch (err: any) {
      setStatus("Error: " + err.message);
      setStatusType("error");
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

  // ✅ FIX: Wrapped in AppLayout and added Header for consistent flow
  return (
    <AppLayout>
      <div className="flex flex-col gap-4 p-6 h-full">
        {/* Header Section (Matches Migration.tsx style) */}
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
