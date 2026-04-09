import * as React from "react";
import { useState } from "react";
import { usePluginAction, usePluginData, type PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";

// Types - shared with worker
type PreflightCheck = {
  id: string;
  title: string;
  description: string;
  status: "pass" | "fail" | "warning";
  blocked: boolean;
  remediation?: string;
};

type SetupPhase = "idle" | "preflight" | "preview" | "applying" | "partial_failure" | "success" | "blocked";

type SideEffect = {
  id: string;
  type: "create" | "update" | "delete" | "configure" | "write";
  target: string;
  description: string;
  reversible: boolean;
  riskLevel: "low" | "medium" | "high";
};

type ApplyPreview = {
  setupId: string;
  sideEffects: SideEffect[];
  warnings: string[];
  totalChanges: number;
  estimatedDuration: string;
  canProceed: boolean;
  blockingIssues: string[];
};

type SetupStage = {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

type CleanupReport = {
  setupId: string;
  stages: SetupStage[];
  revertedChanges: SideEffect[];
  remainingChanges: SideEffect[];
  nextSteps: string[];
  recoveryGuidance: string;
};

type HandoffState = {
  setupId: string;
  workspaceId: string;
  cockpitUrl?: string;
  status: "ready" | "degraded";
  healthSummary: Record<string, "ok" | "degraded" | "error">;
};

type PreflightResult = {
  checks: PreflightCheck[];
  canProceed: { canProceed: boolean; blockedBy: string[] };
  state: { phase: SetupPhase };
};

type ApplyResult = {
  setupId: string;
  success: boolean;
  stages: SetupStage[];
  cleanupReport?: CleanupReport;
  handoffState?: HandoffState;
  error?: string;
};

// Helper hook for typed actions
function useSetupAction<ActionType>(actionName: string) {
  const action = usePluginAction(actionName);
  return async (params?: Record<string, unknown>): Promise<ActionType> => {
    return action(params) as Promise<ActionType>;
  };
}

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data: healthData, loading: healthLoading, error: healthError } = usePluginData<{ status: string; checkedAt: string }>("health");
  
  const ping = useSetupAction<{ pong: boolean; at: string }>("ping");
  const runPreflight = useSetupAction<PreflightResult>("setup.preflight");
  const runPreview = useSetupAction<{ preview: ApplyPreview }>("setup.preview");
  const runApply = useSetupAction<ApplyResult>("setup.apply");
  const reset = useSetupAction<{ success: boolean }>("setup.reset");

  const [phase, setPhase] = useState<SetupPhase>("idle");
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheck[]>([]);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [stages, setStages] = useState<SetupStage[]>([]);
  const [cleanup, setCleanup] = useState<CleanupReport | null>(null);
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Define setup stages
  const defaultStages: SetupStage[] = [
    { id: "create-workspace", name: "Create Workspace", status: "pending" },
    { id: "install-skills", name: "Install Skills", status: "pending" },
    { id: "configure-connectors", name: "Configure Connectors", status: "pending" },
    { id: "apply-budgets", name: "Apply Budgets", status: "pending" },
    { id: "apply-approvals", name: "Apply Approvals", status: "pending" },
    { id: "write-plugin-state", name: "Write Plugin State", status: "pending" },
  ];

  const handleRunPreflight = async () => {
    setError(null);
    const result = await runPreflight({ companyName: "Test Company", companySlug: "test-company" });
    setPreflightChecks(result.checks);
    setPhase(result.canProceed.canProceed ? "preflight" : "blocked");
  };

  const handleRunPreview = async () => {
    setError(null);
    const result = await runPreview({ stages: defaultStages } as Record<string, unknown>);
    setPreview(result.preview);
    setPhase("preview");
  };

  const handleRunApply = async () => {
    setError(null);
    setStages([...defaultStages]);
    setPhase("applying");
    const result = await runApply({});
    
    if (result.success) {
      setHandoff(result.handoffState ?? null);
      setPhase("success");
    } else if (result.cleanupReport) {
      setCleanup(result.cleanupReport);
      setPhase("partial_failure");
    } else {
      setError(result.error ?? "Unknown error");
      setPhase("idle");
    }
  };

  const handleSimulateFailure = async () => {
    setError(null);
    setStages([...defaultStages]);
    setPhase("applying");
    const result = await runApply({ simulateFailure: "configure-connectors" });
    
    if (result.cleanupReport) {
      setCleanup(result.cleanupReport);
      setPhase("partial_failure");
    }
  };

  const handleReset = async () => {
    await reset({});
    setPhase("idle");
    setPreflightChecks([]);
    setPreview(null);
    setStages([]);
    setCleanup(null);
    setHandoff(null);
    setError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
      case "complete":
      case "ok":
        return "#22c55e";
      case "fail":
      case "error":
        return "#ef4444";
      case "warning":
      case "degraded":
      case "running":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const renderPreflightChecks = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <h4 style={{ margin: 0 }}>Preflight Checks</h4>
      {preflightChecks.map((check) => (
        <div key={check.id} style={{ 
          padding: "0.5rem", 
          border: "1px solid #e5e7eb", 
          borderRadius: "4px",
          borderLeftWidth: "3px",
          borderLeftColor: getStatusColor(check.status)
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ 
              display: "inline-block", 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              backgroundColor: getStatusColor(check.status)
            }} />
            <strong>{check.title}</strong>
            {check.blocked && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>[BLOCKING]</span>}
          </div>
          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
            {check.description}
          </div>
          {check.status === "fail" && check.remediation && (
            <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.25rem" }}>
              Remediation: {check.remediation}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const blockedChecks = preflightChecks.filter((check) => check.status === "fail" || check.blocked);
  const blockedContractChecks = blockedChecks.filter((check) =>
    /contract/i.test(check.id) || /contract/i.test(check.title) || /contract/i.test(check.description),
  );

  const renderPreview = () => preview ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <h4 style={{ margin: 0 }}>Apply Preview</h4>
      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
        <div>Setup ID: {preview.setupId}</div>
        <div>Total Changes: {preview.totalChanges}</div>
        <div>Estimated Duration: {preview.estimatedDuration}</div>
      </div>
      
      {preview.warnings.length > 0 && (
        <div style={{ 
          padding: "0.5rem", 
          backgroundColor: "#fef3c7", 
          borderRadius: "4px",
          fontSize: "0.875rem"
        }}>
          <strong>Warnings:</strong>
          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      
      <div style={{ marginTop: "0.5rem" }}>
        <strong>Side Effects:</strong>
        {preview.sideEffects.map((effect) => (
          <div key={effect.id} style={{ 
            display: "flex", 
            gap: "0.5rem", 
            alignItems: "center",
            padding: "0.25rem 0",
            fontSize: "0.875rem"
          }}>
            <span style={{ 
              color: effect.riskLevel === "high" ? "#ef4444" : 
                     effect.riskLevel === "medium" ? "#f59e0b" : "#22c55e"
            }}>
              {effect.riskLevel.toUpperCase()}
            </span>
            <span>{effect.description}</span>
            <span style={{ color: "#6b7280" }}>({effect.reversible ? "reversible" : "irreversible"})</span>
          </div>
        ))}
      </div>
      
      {!preview.canProceed && (
        <div style={{ 
          padding: "0.5rem", 
          backgroundColor: "#fee2e2", 
          borderRadius: "4px",
          color: "#ef4444"
        }}>
          <strong>Cannot Proceed:</strong>
          <ul style={{ margin: "0.25rem 0 0 1.25rem" }}>
            {preview.blockingIssues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  const renderStages = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <h4 style={{ margin: "0 0 0.5rem 0" }}>Setup Progress</h4>
      {stages.map((stage) => (
        <div key={stage.id} style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.5rem",
          padding: "0.25rem 0"
        }}>
          <span style={{ 
            display: "inline-block", 
            width: "12px", 
            height: "12px", 
            borderRadius: "50%", 
            backgroundColor: getStatusColor(stage.status)
          }} />
          <span style={{ 
            textDecoration: stage.status === "skipped" ? "line-through" : "none",
            color: stage.status === "pending" ? "#6b7280" : "inherit"
          }}>
            {stage.name}
          </span>
          {stage.status === "running" && (
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>running...</span>
          )}
          {stage.status === "failed" && stage.error && (
            <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{stage.error}</span>
          )}
        </div>
      ))}
    </div>
  );

  const renderCleanup = () => cleanup ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <h4 style={{ margin: 0, color: "#f59e0b" }}>Partial Failure - Cleanup Report</h4>
      
      {cleanup.revertedChanges.length > 0 && (
        <div>
          <strong>Reverted Changes:</strong>
          <ul style={{ margin: "0.25rem 0 0 1.25rem" }}>
            {cleanup.revertedChanges.map((c: SideEffect) => <li key={c.id}>{c.description}</li>)}
          </ul>
        </div>
      )}
      
      {cleanup.remainingChanges.length > 0 && (
        <div style={{ color: "#ef4444" }}>
          <strong>Remaining Changes (require manual cleanup):</strong>
          <ul style={{ margin: "0.25rem 0 0 1.25rem" }}>
            {cleanup.remainingChanges.map((c: SideEffect) => <li key={c.id}>{c.description}</li>)}
          </ul>
        </div>
      )}
      
      <div style={{ 
        padding: "0.5rem", 
        backgroundColor: "#f3f4f6", 
        borderRadius: "4px",
        fontSize: "0.875rem"
      }}>
        <strong>Recovery Guidance:</strong>
        <pre style={{ margin: "0.25rem 0 0 0", whiteSpace: "pre-wrap" }}>
          {cleanup.recoveryGuidance}
        </pre>
      </div>
      
      <div>
        <strong>Next Steps:</strong>
        <ol style={{ margin: "0.25rem 0 0 1.25rem" }}>
          {cleanup.nextSteps.map((step, i) => <li key={i} style={{ marginBottom: "0.25rem" }}>{step}</li>)}
        </ol>
      </div>
    </div>
  ) : null;

  const renderSuccess = () => handoff ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "#22c55e" }}>
      <h4 style={{ margin: 0 }}>Setup Complete - Handoff to Operations</h4>
      <div style={{ color: "#1f2937" }}>
        <div><strong>Workspace ID:</strong> {handoff.workspaceId}</div>
        <div><strong>Setup ID:</strong> {handoff.setupId}</div>
        {handoff.cockpitUrl && (
          <div><strong>Cockpit URL:</strong> <a href={handoff.cockpitUrl}>{handoff.cockpitUrl}</a></div>
        )}
        <div><strong>Status:</strong> {handoff.status}</div>
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        <strong>Health Summary:</strong>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          {Object.entries(handoff.healthSummary).map(([key, value]) => (
            <span key={key} style={{ 
              padding: "0.25rem 0.5rem", 
              backgroundColor: getStatusColor(value) + "20",
              color: getStatusColor(value),
              borderRadius: "4px",
              fontSize: "0.75rem"
            }}>
              {key}: {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (healthLoading) return <div>Loading plugin health...</div>;
  if (healthError) return <div>Plugin error: {healthError.message}</div>;

  return (
    <div style={{ display: "grid", gap: "0.75rem", padding: "1rem", maxWidth: "600px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Plugin Setup Studio</strong>
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          Phase: <span style={{ 
            padding: "0.125rem 0.375rem", 
            backgroundColor: "#e5e7eb", 
            borderRadius: "4px" 
          }}>{phase}</span>
        </span>
      </div>

      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
        Health: <span style={{ color: getStatusColor(healthData?.status ?? "unknown") }}>
          {healthData?.status ?? "unknown"}
        </span>
      </div>

      {error && (
        <div style={{ 
          padding: "0.5rem", 
          backgroundColor: "#fee2e2", 
          borderRadius: "4px", 
          color: "#ef4444",
          fontSize: "0.875rem"
        }}>
          Error: {error}
        </div>
      )}

      {phase === "idle" && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button 
            onClick={() => void handleRunPreflight()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Run Preflight
          </button>
          <button 
            onClick={() => void handleReset()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Reset
          </button>
        </div>
      )}

      {(phase === "preflight" || phase === "blocked") && renderPreflightChecks()}

      {phase === "preflight" && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            onClick={() => void handleRunPreview()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "4px" }}
          >
            Generate Preview
          </button>
          <button 
            onClick={() => void handleReset()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Reset
          </button>
        </div>
      )}

      {phase === "blocked" && (
        <div style={{ 
          padding: "0.5rem", 
          backgroundColor: "#fee2e2", 
          borderRadius: "4px",
          color: "#ef4444",
          fontSize: "0.875rem"
        }}>
          Setup is blocked due to preflight failures. Resolve the issues above before proceeding.
          {blockedChecks.length > 0 && (
            <div style={{ marginTop: "0.75rem", color: "#7f1d1d" }}>
              <strong>Blocking contract mismatches:</strong>
              <ul style={{ margin: "0.25rem 0 0 1.25rem" }}>
                {(blockedContractChecks.length > 0 ? blockedContractChecks : blockedChecks).map((check) => (
                  <li key={check.id} style={{ marginBottom: "0.5rem" }}>
                    <div><strong>{check.title}</strong></div>
                    <div>{check.description}</div>
                    {check.remediation && (
                      <div style={{ marginTop: "0.25rem" }}>Remediation: {check.remediation}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase === "preview" && renderPreview()}

      {phase === "preview" && preview?.canProceed && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            onClick={() => void handleRunApply()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "4px" }}
          >
            Apply Setup
          </button>
          <button 
            onClick={() => void handleSimulateFailure()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#f59e0b", color: "white", border: "none", borderRadius: "4px" }}
          >
            Simulate Failure
          </button>
        </div>
      )}

      {phase === "applying" && renderStages()}

      {phase === "partial_failure" && renderCleanup()}

      {phase === "partial_failure" && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            onClick={() => void handleReset()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Start Over
          </button>
        </div>
      )}

      {phase === "success" && renderSuccess()}

      {phase === "success" && (
        <button 
          onClick={() => void handleReset()}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          New Setup
        </button>
      )}

      <button 
        onClick={() => void ping()}
        style={{ padding: "0.5rem", cursor: "pointer", fontSize: "0.75rem" }}
      >
        Ping Worker
      </button>
    </div>
  );
}
