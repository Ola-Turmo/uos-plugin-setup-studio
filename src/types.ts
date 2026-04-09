// Setup Studio Types
// Core types for preflight checks, apply previews, cleanup guidance, and handoff

export type PreflightStatus = "pass" | "fail" | "warning";

export interface PreflightCheck {
  id: string;
  title: string;
  description: string;
  status: PreflightStatus;
  blocked: boolean;
  remediation?: string;
  evidence?: Record<string, unknown>;
}

export interface ContractMismatch {
  contractId: string;
  expectedVersion: string;
  actualVersion: string;
  severity: "blocking" | "warning";
  affectedSurface: string;
  remediation: string;
}

export interface SetupPrerequisite {
  id: string;
  name: string;
  description: string;
  satisfied: boolean;
  remediation?: string;
}

export interface SideEffect {
  id: string;
  type: "create" | "update" | "delete" | "configure" | "write";
  target: string;
  description: string;
  reversible: boolean;
  riskLevel: "low" | "medium" | "high";
}

export interface ApplyPreview {
  setupId: string;
  sideEffects: SideEffect[];
  warnings: string[];
  totalChanges: number;
  estimatedDuration: string;
  canProceed: boolean;
  blockingIssues: string[];
}

export interface SetupStage {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface CleanupReport {
  setupId: string;
  stages: SetupStage[];
  revertedChanges: SideEffect[];
  remainingChanges: SideEffect[];
  nextSteps: string[];
  recoveryGuidance: string;
}

export interface HandoffState {
  setupId: string;
  workspaceId: string;
  cockpitUrl?: string;
  status: "ready" | "degraded";
  healthSummary: Record<string, "ok" | "degraded" | "error">;
  evidence: {
    provisioningOutput: unknown;
    completedStages: string[];
    contractValidation: ContractMismatch[];
  };
}

export interface SetupResult {
  setupId: string;
  success: boolean;
  preflightChecks: PreflightCheck[];
  contractMismatches: ContractMismatch[];
  stages: SetupStage[];
  cleanupReport?: CleanupReport;
  handoffState?: HandoffState;
  error?: string;
}

// Setup Flow States
export type SetupFlowState =
  | { phase: "idle" }
  | { phase: "preflight"; checks: PreflightCheck[] }
  | { phase: "preview"; preview: ApplyPreview }
  | { phase: "applying"; stages: SetupStage[] }
  | { phase: "partial_failure"; cleanup: CleanupReport }
  | { phase: "success"; handoff: HandoffState }
  | { phase: "blocked"; reasons: string[] };

// Contract version info
export interface ContractVersion {
  contractId: string;
  version: string;
  supportedVersions: string[];
}

export interface SetupManifestInput {
  companyName?: string;
  companySlug?: string;
  contractVersions?: ContractVersion[];
}
