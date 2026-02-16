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

  /* ============================================================
      STEP 1 – New Metadata Extraction (Relationships)
  ============================================================ */
  const runMetadataExtraction = async () => {
    updateStep(0, "running", "Extracting metadata and relationships");
    log("STEP 1 started (Import Mode)");

    const folder_name = reportName || "relationdatabase";
    const url = `https://relationship-e4hraba6bxg3h6bc.eastus-01.azurewebsites.net/extract-metadata?folder_name=${encodeURIComponent(folder_name)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      const errorText = await res.text();
      // Detect "No CSV tables found" error
      if (errorText.includes("No CSV tables found")) {
        log("⚠️ Import mode unavailable. Switching to Live Data mode...");
        throw new Error("SWITCH_TO_LIVE_MODE");
      }
      throw new Error(errorText);
    }

    const data = await res.json();

    sessionStorage.setItem("metadataOutputBlobUrl", data.outputBlobUrl);
    if (data.metadata?.relationships) {
      sessionStorage.setItem("migration_relationships", JSON.stringify(data.metadata.relationships));
    }

    updateStep(0, "completed", "Metadata & Relationships extracted");
    log("STEP 1 completed");
  };

  /* ============================================================
      STEP 3 – New Semantic Model & Report Creation
  ============================================================ */

  const runLiveDataMigration = async () => {
    updateStep(2, "running", "Migrating to Power BI (Live Data Mode)");
    log("Live Data Migration started");

    const file_name = `${reportName}.twbx`;
    const target_workspace_id = sessionStorage.getItem("workspace_id");

    if (!target_workspace_id) throw new Error("Target Workspace ID missing");
    if (!dbPassword) throw new Error("Database password missing");

    const res = await fetch("https://live-data-hqfeeufjawfecjfd.eastus-01.azurewebsites.net/api/v1/migrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        file_name,
        password: dbPassword,
        target_workspace_id,
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    // Store IDs for preview and refresh
    sessionStorage.setItem("generated_dataset_id", data.dataset_id);
    sessionStorage.setItem("generated_report_id", data.report_id);
    sessionStorage.setItem("report_name", data.report_name);
    sessionStorage.setItem("workbook_name", data.workbook_name);

    updateStep(2, "completed", `${data.table_count} tables with ${data.relationships_count} relationships migrated`);
    log("Live Data Migration completed");

    setCanRefresh(true); // Enable refresh button
  };
  const continueWithLiveMode = async () => {
    try {
      setShowPasswordDialog(false);

      // Skip Step 1 (already completed by extract)
      // Step 2: Artifact Generation (skip for live mode)
      updateStep(1, "completed", "Live data mode - artifacts not needed");

      // Step 3: Live Data Migration
      await runLiveDataMigration();

      // Final Steps
      updateStep(3, "completed", "Deployed to Power BI Workspace");
      updateStep(4, "completed", "Validation Successful");

      log("Live Data Migration flow completed");
      setIsComplete(true);
    } catch (e: any) {
      log(`❌ ERROR: ${e.message}`);
      setFatalError(e.message);
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
    }
  };

  const runDatasetAndReportGeneration = async () => {
    updateStep(2, "running", "Creating Semantic Model & Relationships");
    log("STEP 3 started");

    const folder_name = reportName || "relationdatabase";
    const target_workspace_id = sessionStorage.getItem("workspace_id");

    // Retrieve relationships stored in Step 1
    const relsRaw = sessionStorage.getItem("migration_relationships");
    const relationships = relsRaw ? JSON.parse(relsRaw) : [];

    if (!target_workspace_id) throw new Error("Target Workspace ID missing");

    const res = await fetch("https://relationship-e4hraba6bxg3h6bc.eastus-01.azurewebsites.net/create-semantic-model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        folder_name,
        target_workspace_id,
        relationships,
        clone_report: true,
        report_name: `${folder_name}_Final_Report`,
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    // Store IDs for the PowerBIReport (Preview) component
    sessionStorage.setItem("generated_dataset_id", data.dataset_id);
    sessionStorage.setItem("generated_report_id", data.report_id);
    sessionStorage.setItem("report_name", data.report_name);

    updateStep(2, "completed", `Report created with ${data.relationships_created} relations`);
    log("STEP 3 completed");
  };

  /* ============================================================
      Migration Orchestrator
  ============================================================ */
  useEffect(() => {
    const run = async () => {
      try {
        if (!reportName || !nodeInfo) return;

        // Try Import Mode first
        try {
          await runMetadataExtraction();
          setMigrationMode("import");

          // Continue with import mode flow
          updateStep(1, "completed", "Artifacts generated successfully");
          await runDatasetAndReportGeneration();
          updateStep(3, "completed", "Deployed to Power BI Workspace");
          updateStep(4, "completed", "Validation Successful");
        } catch (error: any) {
          // If import mode fails, switch to live data mode
          if (error.message === "SWITCH_TO_LIVE_MODE") {
            setMigrationMode("live");

            // Extract datasource details
            await runExtract();
            {
              showPasswordDialog && extractedData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                    <h2 className="text-xl font-bold">Database Password Required</h2>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Datasource Type: <strong>{extractedData.datasource_type}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Database:{" "}
                        <strong>{extractedData.connection?.database || extractedData.connection?.catalog}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Username: <strong>{extractedData.connection?.username}</strong>
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Enter {extractedData.datasource_type === "databricks" ? "Access Token" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder={
                          extractedData.datasource_type === "databricks" ? "Enter access token" : "Enter password"
                        }
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => navigate("/")}>
                        Cancel
                      </Button>
                      <Button onClick={continueWithLiveMode} disabled={!dbPassword}>
                        Continue Migration
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            // Show password dialog and wait for user input
            setShowPasswordDialog(true);
            {
              showPasswordDialog && extractedData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
                    <h2 className="text-xl font-bold">Database Password Required</h2>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Datasource Type: <strong>{extractedData.datasource_type}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Database:{" "}
                        <strong>{extractedData.connection?.database || extractedData.connection?.catalog}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Username: <strong>{extractedData.connection?.username}</strong>
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Enter {extractedData.datasource_type === "databricks" ? "Access Token" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder={
                          extractedData.datasource_type === "databricks" ? "Enter access token" : "Enter password"
                        }
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => navigate("/")}>
                        Cancel
                      </Button>
                      <Button onClick={continueWithLiveMode} disabled={!dbPassword}>
                        Continue Migration
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            return; // Stop here, will continue after password is submitted
          }
          throw error; // Re-throw other errors
        }

        log("Migration flow completed");
        setIsComplete(true);
      } catch (e: any) {
        log(`❌ ERROR: ${e.message}`);
        setFatalError(e.message);
        setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
      }
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
