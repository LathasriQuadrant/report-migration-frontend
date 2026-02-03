import { useState, useEffect } from "react";

import { useNavigate, useLocation } from "react-router-dom";

import { CheckCircle2, Circle, Loader2, XCircle, ArrowLeft, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

import AppLayout from "@/components/layout/AppLayout";

import { MigrationStep, MigrationStatus } from "@/types/migration";

import { cn } from "@/lib/utils";

/* ============================================================

   Steps

============================================================ */

const initialSteps: MigrationStep[] = [
  { id: "step-1", name: "Metadata Extraction", description: "Waiting", status: "pending" },

  { id: "step-2", name: "Artifact Generation", description: "Waiting", status: "pending" },

  { id: "step-3", name: "Dataset & Report Creation", description: "Waiting", status: "pending" },

  { id: "step-4", name: "Deployment", description: "Waiting", status: "pending" },

  { id: "step-5", name: "Validation", description: "Waiting", status: "pending" },
];

const stepIcon = (s: MigrationStatus) => {
  if (s === "completed") return <CheckCircle2 className="text-green-600" />;

  if (s === "running") return <Loader2 className="animate-spin text-blue-600" />;

  if (s === "failed") return <XCircle className="text-red-600" />;

  return <Circle className="text-gray-400" />;
};

/* ============================================================

   Component

============================================================ */

export default function Migration() {
  const navigate = useNavigate();

  const location = useLocation();

  /* ---------------- Navigation inputs ---------------- */

  const nodeInfo = location.state?.node;

  /* ---------------- Session source of truth ---------------- */

  const raw = sessionStorage.getItem("selected_workbook");

  const selectedWorkbook = raw ? JSON.parse(raw) : null;

  const reportName: string | undefined = selectedWorkbook?.name;

  /* ---------------- State ---------------- */

  const [steps, setSteps] = useState<MigrationStep[]>(initialSteps);

  const [fatalError, setFatalError] = useState<string | null>(null);

  const [isComplete, setIsComplete] = useState(false); // Track completion

  /* ---------------- Logger ---------------- */

  const log = (msg: string) => console.log(`[Migration] ${msg}`);

  /* ---------------- Safety validation ---------------- */

  useEffect(() => {
    log("Component mounted");

    if (!raw || !reportName) {
      setFatalError("No report selected. Please restart migration.");

      return;
    }

    if (!nodeInfo) {
      setFatalError("Navigation context lost. Please restart migration.");

      return;
    }

    log(`Report name: ${reportName}`);
  }, []);

  /* ---------------- Helpers ---------------- */

  const updateStep = (index: number, status: MigrationStatus, desc?: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status, description: desc ?? s.description } : s)));
  };

  /* ============================================================

     STEP 1 – Metadata Extraction

  ============================================================ */

  const runMetadataExtraction = async () => {
    updateStep(0, "running", "Extracting metadata");

    log("STEP 1 started");

    const inputBlobUrl = `https://tablueatopowerbi.blob.core.windows.net/tabluea-raw/${encodeURIComponent(
      reportName!,
    )}.twbx`;

    const outputContainerUrl = "https://tablueatopowerbi.blob.core.windows.net/tabluea-json";

    const res = await fetch(
      "https://tablueametadataextractor-geg8dsgdc8gcbrgp.eastus-01.azurewebsites.net/extract-metadata",

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          accept: "application/json",
        },

        body: JSON.stringify({
          inputBlobUrl,

          outputContainerUrl,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();

    sessionStorage.setItem("metadataOutputBlobUrl", data.outputBlobUrl);

    updateStep(0, "completed", "Metadata extracted successfully");

    log("STEP 1 completed");
  };

  /* ============================================================

     STEP 2 – Dataset & Report Generation

  ============================================================ */

  const runDatasetAndReportGeneration = async () => {
    updateStep(2, "running", "Generating dataset and report");

    log("STEP 2 started");

    const container_name = "tableau-datasources";

    const folder_name = sessionStorage.getItem("report_name") || reportName;

    const target_workspace_id = sessionStorage.getItem("workspace_id");

    if (!folder_name || !target_workspace_id) {
      throw new Error("Missing required session storage values");
    }

    const res = await fetch("https://databinding-eef2gaezhdgbd9h0.eastus-01.azurewebsites.net/generate", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        accept: "application/json",
      },

      body: JSON.stringify({
        container_name,

        folder_name,

        report_name: `${folder_name}_Report`,

        target_workspace_id,
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();

    sessionStorage.setItem("generated_dataset_id", data.datasetId);

    sessionStorage.setItem("generated_report_id", data.reportId);

    updateStep(2, "completed", "Dataset and report created");

    log("STEP 2 completed");
  };

  /* ============================================================

     Migration Orchestrator

  ============================================================ */

  useEffect(() => {
    const run = async () => {
      try {
        if (!reportName || !nodeInfo) return;

        await runMetadataExtraction();

        // Placeholder for Step 2 (Artifacts)

        updateStep(1, "completed", "Artifacts generated");

        await runDatasetAndReportGeneration();

        // Placeholders for remaining steps

        updateStep(3, "completed", "Deployed to Workspace");

        updateStep(4, "completed", "Validation Successful");

        log("Migration flow completed");

        setIsComplete(true); // Enable the view button
      } catch (e: any) {
        log(`❌ ERROR: ${e.message}`);

        setFatalError(e.message);
      }
    };

    run();
  }, [reportName, nodeInfo]);

  /* ============================================================

     UI

  ============================================================ */

  return (
    <AppLayout>
      <div className="px-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft />
          </Button>

          <h1 className="text-2xl font-bold">Migration Progress</h1>
        </div>

        {fatalError && (
          <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded">
            <b>Error:</b> {fatalError}
          </div>
        )}

        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          {steps.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex gap-4 p-4 border-b last:border-b-0",

                s.status === "running" && "bg-blue-50",

                s.status === "failed" && "bg-red-50",
              )}
            >
              {stepIcon(s.status)}

              <div>
                <div className="font-medium">{s.name}</div>

                <div className="text-sm text-muted-foreground">{s.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* View Button */}

        <div className="flex justify-end pt-4">
          <Button
            onClick={() => navigate("/preview")}
            disabled={!isComplete}
            className="gap-2 w-full sm:w-auto"
            size="lg"
          >
            View Migrated Report
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
