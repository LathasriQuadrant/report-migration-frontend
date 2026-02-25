import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, XCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { MigrationStep, MigrationStatus } from "@/types/migration";
import { cn } from "@/lib/utils";

/* ============================================================
   Steps (UI remains unchanged)
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

export default function Migration() {
  const navigate = useNavigate();
  const location = useLocation();

  const nodeInfo = location.state?.node;
  const raw = sessionStorage.getItem("selected_workbook");
  const selectedWorkbook = raw ? JSON.parse(raw) : null;
  const reportName: string | undefined = selectedWorkbook?.name;

  const [steps, setSteps] = useState<MigrationStep[]>(initialSteps);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const log = (msg: string) => console.log(`[Migration] ${msg}`);

  const updateStep = (index: number, status: MigrationStatus, desc?: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status, description: desc ?? s.description } : s)));
  };

  /* Auto-complete orchestrator */

  /* ============================================================
      Migration Orchestrator
  ============================================================ */
  useEffect(() => {
    if (!reportName || !nodeInfo) return;

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      // Step 1 – Metadata Extraction (real API call)
      updateStep(0, "running", "Extracting metadata…");
      try {
        const metadataUrl = `https://relationship-e4hraba6bxg3h6bc.eastus-01.azurewebsites.net/extract-metadata?folder_name=${encodeURIComponent(reportName)}`;
        const metaRes = await fetch(metadataUrl, { method: "POST" });
        if (!metaRes.ok) throw new Error(`Metadata extraction failed (${metaRes.status})`);
        const metaData = await metaRes.json();
        console.log("Metadata extraction response:", metaData);
        sessionStorage.setItem("metadata_response", JSON.stringify(metaData));
        if (metaData.outputBlobUrl) {
          sessionStorage.setItem("metadataOutputBlobUrl", metaData.outputBlobUrl);
          console.log("Stored metadataOutputBlobUrl:", metaData.outputBlobUrl);
        }
        updateStep(0, "completed", "Metadata Extraction completed");
      } catch (err: any) {
        log("Metadata extraction error: " + err.message);
        updateStep(0, "failed", err.message);
        setFatalError(err.message);
        return;
      }

      // Steps 2–5 auto-complete
      for (let i = 1; i < steps.length; i++) {
        updateStep(i, "running", "Processing…");
        await delay(1200);
        updateStep(i, "completed", initialSteps[i].name + " completed");
      }
      log("Migration flow completed");
      setIsComplete(true);
    };

    run();
  }, [reportName, nodeInfo]);

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
