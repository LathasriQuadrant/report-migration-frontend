import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as models from "powerbi-models";
import { service, factories } from "powerbi-client";
import { Loader2, CheckCircle2, XCircle, Globe, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import "powerbi-report-authoring";

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
  bindings: Record<string, any>;
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const cleanColumnName = (colName: string) => colName.replace(/^(cnt|sum|avg|min|max|count|distinct):/i, "");

  const mapRoleName = (visualType: string, role: string) => {
    const t = visualType.toLowerCase();
    const r = role.toLowerCase();

    if (t.includes("table")) return "Values";

    if (t.includes("bar") || t.includes("column") || t.includes("line")) {
      if (r === "category") return "Category";
      if (r === "values") return "Y";
    }
    return role;
  };

  async function createStaticVisuals(report: any) {
    if (executed.current) return;
    executed.current = true;

    try {
      setStatus("Fetching visuals...");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadataBlobPath: metadataBlobUrl }),
      });

      const data = await res.json();
      const visuals: ApiVisual[] = data.visuals || [];
      const dashboards = data.dashboards || [];

      if (!visuals.length) return;

      await report.switchMode(models.ViewMode.Edit);
      await sleep(800);

      const pages = await report.getPages();

      const visualMap = new Map();
      visuals.forEach((v) => visualMap.set(v.title, v));

      for (let i = 0; i < dashboards.length; i++) {
        const dashboard = dashboards[i];
        const targetPage = pages[i];
        if (!targetPage) continue;

        setStatus(`Switching to ${targetPage.displayName}...`);

        // WAIT for actual page change
        await new Promise<void>((resolve) => {
          const handler = () => {
            report.off("pageChanged", handler);
            resolve();
          };
          report.on("pageChanged", handler);
          targetPage.setActive();
        });

        const page = await report.getActivePage();

        // Clear page
        const existing = await page.getVisuals();
        for (const v of existing) await page.deleteVisual(v.name);

        await sleep(500);

        // Create visuals
        for (const sheetName of dashboard.worksheets) {
          const v = visualMap.get(sheetName);
          if (!v) continue;

          const { visual } = await page.createVisual(v.visualType, {
            x: v.layout.x,
            y: v.layout.y,
            width: v.layout.width,
            height: v.layout.height,
            displayState: {
              mode: models.VisualContainerDisplayMode.Visible,
            },
          });

          // Title
          await visual.setProperty({ objectName: "title", propertyName: "text" }, { value: v.title });
          await visual.setProperty({ objectName: "title", propertyName: "visible" }, { value: true });

          // Bindings
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

  useEffect(() => {
    let report: any;
    if (isEmbedding.current) return;
    isEmbedding.current = true;

    async function init() {
      try {
        const res = await fetch("https://visuals-json-gdfth9dsbmhrgcb0.eastus-01.azurewebsites.net/embed-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, reportId, datasetId }),
        });

        const { embedToken, embedUrl } = await res.json();

        report = pbiService.embed(containerRef.current!, {
          type: "report",
          id: reportId,
          embedUrl,
          accessToken: embedToken,
          tokenType: models.TokenType.Embed,
          permissions: models.Permissions.All,
          viewMode: models.ViewMode.Edit,
        });

        report.on("rendered", () => {
          createStaticVisuals(report);
        });
      } catch (e: any) {
        setStatus(e.message);
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

        <div className="relative flex-1 min-h-[600px] border rounded-xl bg-white">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
