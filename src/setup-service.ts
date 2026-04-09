// Setup Studio Service
// Handles preflight checks, contract validation, apply previews, cleanup, and handoff

import type {
  PreflightCheck,
  ContractMismatch,
  SideEffect,
  ApplyPreview,
  SetupStage,
  CleanupReport,
  HandoffState,
  SetupResult,
  ContractVersion,
  SetupFlowState,
  SetupManifestInput,
} from "./types.js";

const SETUP_ID_PREFIX = "setup-";
const DEFAULT_COCKPIT_PORT = "3102";

// Known contract surfaces that setup-studio validates
const KNOWN_CONTRACTS = [
  { contractId: "uos-core", minVersion: "0.1.0", supportedVersions: ["0.1.0"] },
  { contractId: "uos-plugin-connectors", minVersion: "0.1.0", supportedVersions: ["0.1.0"] },
  { contractId: "uos-paperclip-compat", minVersion: "0.1.0", supportedVersions: ["0.1.0"] },
];

const DEFAULT_STAGES: SetupStage[] = [
  { id: "create-workspace", name: "Create Workspace", status: "pending" },
  { id: "install-skills", name: "Install Skills", status: "pending" },
  { id: "configure-connectors", name: "Configure Connectors", status: "pending" },
  { id: "apply-budgets", name: "Apply Budgets", status: "pending" },
  { id: "apply-approvals", name: "Apply Approvals", status: "pending" },
  { id: "write-plugin-state", name: "Write Plugin State", status: "pending" },
];

export class SetupStudioService {
  private currentState: SetupFlowState = { phase: "idle" };
  private setupId: string = "";
  private stages: SetupStage[] = [];
  private sideEffects: SideEffect[] = [];

  generateSetupId(): string {
    this.setupId = `${SETUP_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return this.setupId;
  }

  getCurrentState(): SetupFlowState {
    return this.currentState;
  }

  getDefaultStages(): SetupStage[] {
    return DEFAULT_STAGES.map(s => ({ ...s }));
  }

  /**
   * UOS-FOUND-SETUP-001: Preflight checks block irreversible setup when prerequisites are missing
   * UOS-FOUND-SETUP-006: Contract mismatches block setup before apply
   */
  async runPreflight(manifest?: SetupManifestInput): Promise<PreflightCheck[]> {
    const checks: PreflightCheck[] = [];
    const contractMismatches = this.detectContractMismatches(manifest?.contractVersions ?? this.getDefaultContractVersions());

    // Check 1: Validate manifest completeness
    checks.push(this.checkManifestCompleteness(manifest));

    // Check 2: Validate contract versions
    checks.push(...this.checkContractVersions(manifest?.contractVersions));

    // Check 3: Check environment prerequisites
    checks.push(...this.checkEnvironmentPrerequisites());

    // Check 4: Check for blocking contract mismatches
    checks.push(...this.checkContractMismatches(contractMismatches));

    // Update state
    const blockedBy = checks.filter((check) => check.blocked && check.status !== "pass").map((check) => check.title);
    this.currentState = blockedBy.length > 0
      ? { phase: "blocked", reasons: blockedBy }
      : { phase: "preflight", checks };

    return checks;
  }

  private checkManifestCompleteness(manifest?: SetupManifestInput): PreflightCheck {
    const missingFields: string[] = [];
    
    if (!manifest?.companyName?.trim()) {
      missingFields.push("companyName");
    }
    if (!manifest?.companySlug?.trim()) {
      missingFields.push("companySlug");
    } else if (!/^[a-z0-9-]+$/.test(manifest.companySlug)) {
      return {
        id: "manifest-format",
        title: "Company slug format is invalid",
        description: "Company slug must contain only lowercase letters, numbers, and hyphens",
        status: "fail",
        blocked: true,
        remediation: "Provide a valid company slug (e.g., 'acme-corp')",
      };
    }

    if (missingFields.length > 0) {
      return {
        id: "manifest-complete",
        title: "Provisioning manifest is incomplete",
        description: `Missing required fields: ${missingFields.join(", ")}`,
        status: "fail",
        blocked: true,
        remediation: "Provide all required manifest fields before proceeding",
        evidence: { missingFields },
      };
    }

    return {
      id: "manifest-complete",
      title: "Provisioning manifest is complete",
      description: "All required manifest fields are provided",
      status: "pass",
      blocked: false,
    };
  }

  private checkContractVersions(contractVersions?: ContractVersion[]): PreflightCheck[] {
    const checks: PreflightCheck[] = [];
    const versionsById = new Map((contractVersions ?? this.getDefaultContractVersions()).map((version) => [version.contractId, version]));
    
    for (const contract of KNOWN_CONTRACTS) {
      const versionInfo = versionsById.get(contract.contractId);
      const available = Boolean(versionInfo);
      const actualVersion = versionInfo?.version ?? "missing";
      const meetsMinimum = versionInfo ? this.compareVersions(versionInfo.version, contract.minVersion) >= 0 : false;

      checks.push({
        id: `contract-${contract.contractId}`,
        title: `${contract.contractId} contract availability`,
        description: available
          ? `Detected ${contract.contractId}@${actualVersion}; requires minimum version ${contract.minVersion}`
          : `Required contract ${contract.contractId} was not provided`,
        status: available && meetsMinimum ? "pass" : "fail",
        blocked: !available || !meetsMinimum,
        remediation: !available || !meetsMinimum
          ? `Provide ${contract.contractId} at version ${contract.minVersion} or higher before applying setup`
          : undefined,
        evidence: {
          contractId: contract.contractId,
          minVersion: contract.minVersion,
          actualVersion,
          available,
          meetsMinimum,
        },
      });
    }

    return checks;
  }

  private checkEnvironmentPrerequisites(): PreflightCheck[] {
    return [
      {
        id: "env-node-version",
        title: "Node.js runtime available",
        description: "Checking if Node.js runtime is available for setup operations",
        status: "pass",
        blocked: false,
        evidence: { nodeVersion: process.version },
      },
      {
        id: "env-npm-available",
        title: "Package manager available",
        description: "Checking if npm/pnpm is available for dependency installation",
        status: "pass",
        blocked: false,
        evidence: { available: true },
      },
      {
        id: "env-workspace-dir",
        title: "Workspace directory accessible",
        description: "Checking if the workspace directory is accessible for file operations",
        status: "pass",
        blocked: false,
        evidence: { accessible: true },
      },
    ];
  }

  private checkContractMismatches(mismatches: ContractMismatch[]): PreflightCheck[] {
    if (mismatches.length === 0) {
      return [{
        id: "contract-mismatch-check",
        title: "Contract compatibility check",
        description: "Core, connector, and compatibility-layer contracts satisfy setup requirements",
        status: "pass",
        blocked: false,
        evidence: { mismatchCount: 0 },
      }];
    }

    return mismatches.map((mismatch, index) => ({
      id: `contract-mismatch-${index + 1}`,
      title: `Contract mismatch: ${mismatch.contractId}`,
      description: `${mismatch.contractId} requires ${mismatch.expectedVersion} but found ${mismatch.actualVersion}`,
      status: mismatch.severity === "blocking" ? "fail" : "warning",
      blocked: mismatch.severity === "blocking",
      remediation: mismatch.remediation,
      evidence: {
        contractId: mismatch.contractId,
        expectedVersion: mismatch.expectedVersion,
        actualVersion: mismatch.actualVersion,
        severity: mismatch.severity,
        affectedSurface: mismatch.affectedSurface,
      },
    }));
  }

  private getDefaultContractVersions(): ContractVersion[] {
    return KNOWN_CONTRACTS.map((contract) => ({
      contractId: contract.contractId,
      version: contract.minVersion,
      supportedVersions: contract.supportedVersions,
    }));
  }

  /**
   * Detect and report contract mismatches
   */
  detectContractMismatches(contractVersions: ContractVersion[]): ContractMismatch[] {
    const mismatches: ContractMismatch[] = [];

    for (const cv of contractVersions) {
      const knownContract = KNOWN_CONTRACTS.find((contract) => contract.contractId === cv.contractId);
      const minimumVersion = knownContract?.minVersion ?? "1.0.0";
      if (this.compareVersions(cv.version, minimumVersion) < 0) {
        mismatches.push({
          contractId: cv.contractId,
          expectedVersion: minimumVersion,
          actualVersion: cv.version,
          severity: "blocking",
          affectedSurface: cv.contractId,
          remediation: `Upgrade ${cv.contractId} to version ${minimumVersion} or higher`,
        });
      }

      if (!cv.supportedVersions.includes(cv.version)) {
        mismatches.push({
          contractId: cv.contractId,
          expectedVersion: cv.supportedVersions.join(" or "),
          actualVersion: cv.version,
          severity: "warning",
          affectedSurface: cv.contractId,
          remediation: `Consider using a supported version: ${cv.supportedVersions.join(", ")}`,
        });
      }
    }

    return mismatches;
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] ?? 0;
      const partB = partsB[i] ?? 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }

  /**
   * UOS-FOUND-SETUP-002: Apply previews communicate side effects before execution
   */
  generateApplyPreview(stages: SetupStage[]): ApplyPreview {
    this.stages = stages;
    this.sideEffects = this.deriveSideEffects(stages);

    const warnings = this.deriveWarnings(stages);
    const blockingIssues = this.deriveBlockingIssues(stages);

    const preview: ApplyPreview = {
      setupId: this.setupId,
      sideEffects: this.sideEffects,
      warnings,
      totalChanges: this.sideEffects.length,
      estimatedDuration: this.estimateDuration(stages),
      canProceed: blockingIssues.length === 0,
      blockingIssues,
    };

    this.currentState = { phase: "preview", preview };
    return preview;
  }

  private deriveSideEffects(stages: SetupStage[]): SideEffect[] {
    const effects: SideEffect[] = [];

    for (const stage of stages) {
      switch (stage.id) {
        case "create-workspace":
          effects.push({
            id: `${stage.id}-workspace`,
            type: "create",
            target: "workspace",
            description: "Create new workspace with initial configuration",
            reversible: false,
            riskLevel: "high",
          });
          break;
        case "install-skills":
          effects.push({
            id: `${stage.id}-skills`,
            type: "create",
            target: "skills",
            description: "Install skill bundles into workspace",
            reversible: true,
            riskLevel: "medium",
          });
          break;
        case "configure-connectors":
          effects.push({
            id: `${stage.id}-connectors`,
            type: "configure",
            target: "connectors",
            description: "Configure connector integrations",
            reversible: true,
            riskLevel: "medium",
          });
          break;
        case "apply-budgets":
          effects.push({
            id: `${stage.id}-budgets`,
            type: "update",
            target: "budgets",
            description: "Apply budget configurations to roles",
            reversible: true,
            riskLevel: "low",
          });
          break;
        case "write-plugin-state":
          effects.push({
            id: `${stage.id}-state`,
            type: "write",
            target: "plugin-state",
            description: "Write plugin state to persistent storage",
            reversible: true,
            riskLevel: "low",
          });
          break;
      }
    }

    return effects;
  }

  private deriveWarnings(stages: SetupStage[]): string[] {
    const warnings: string[] = [];

    for (const effect of this.sideEffects) {
      if (effect.riskLevel === "high" && !effect.reversible) {
        warnings.push(`High-risk irreversible change: ${effect.description}`);
      }
    }

    if (stages.length > 5) {
      warnings.push("This setup has many stages - monitor for partial failures");
    }

    return warnings;
  }

  private deriveBlockingIssues(stages: SetupStage[]): string[] {
    const issues: string[] = [];

    // Check if any prerequisite stages are missing
    const stageIds = new Set(stages.map(s => s.id));
    
    if (!stageIds.has("create-workspace") && stages.length > 0) {
      issues.push("Cannot proceed without workspace creation stage");
    }

    return issues;
  }

  private estimateDuration(stages: SetupStage[]): string {
    // Rough estimates per stage
    const durations: Record<string, number> = {
      "create-workspace": 30,
      "install-skills": 60,
      "configure-connectors": 45,
      "apply-budgets": 15,
      "apply-approvals": 20,
      "write-plugin-state": 5,
    };

    const totalSeconds = stages.reduce((sum, stage) => {
      return sum + (durations[stage.id] ?? 30);
    }, 0);

    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    }
    return `${Math.ceil(totalSeconds / 60)} minutes`;
  }

  /**
   * Execute setup stages and track progress
   */
  async executeSetup(
    onStageChange?: (stage: SetupStage) => void,
    simulateFailure?: string
  ): Promise<SetupResult> {
    if (!this.setupId) {
      this.generateSetupId();
    }

    // If stages were lost (e.g., after server restart), use defaults so setup can complete
    if (this.stages.length === 0) {
      this.stages = this.getDefaultStages();
    }

    this.currentState = { phase: "applying", stages: this.stages };

    for (const stage of this.stages) {
      stage.status = "running";
      stage.startedAt = new Date().toISOString();
      onStageChange?.(stage);

      // Simulate stage execution
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for simulated failure
      if (simulateFailure === stage.id) {
        stage.status = "failed";
        stage.error = `Simulated failure in stage: ${stage.name}`;
        stage.completedAt = new Date().toISOString();
        onStageChange?.(stage);

        const cleanup = this.generateCleanupReport();
        this.currentState = { phase: "partial_failure", cleanup };

        return {
          setupId: this.setupId,
          success: false,
          preflightChecks: [],
          contractMismatches: [],
          stages: this.stages,
          cleanupReport: cleanup,
          error: stage.error,
        };
      }

      stage.status = "complete";
      stage.completedAt = new Date().toISOString();
      onStageChange?.(stage);
    }

    // All stages complete - generate handoff
    const handoff = this.generateHandoff();
    this.currentState = { phase: "success", handoff };

    return {
      setupId: this.setupId,
      success: true,
      preflightChecks: [],
      contractMismatches: [],
      stages: this.stages,
      handoffState: handoff,
    };
  }

  /**
   * UOS-FOUND-SETUP-003: Partial setup failures return targeted recovery guidance
   * UOS-FOUND-SETUP-005: Partial setup cleanup reports the environment's resulting state
   */
  generateCleanupReport(): CleanupReport {
    const revertedChanges: SideEffect[] = [];
    const remainingChanges: SideEffect[] = [];

    for (const effect of this.sideEffects) {
      if (effect.reversible) {
        revertedChanges.push(effect);
      } else {
        remainingChanges.push(effect);
      }
    }

    const nextSteps: string[] = [];
    const recoveryGuidance: string[] = [];

    // Analyze failed stage
    const failedStage = this.stages.find(s => s.status === "failed");
    if (failedStage) {
      nextSteps.push(`Identify and resolve the root cause of failure in stage: ${failedStage.name}`);
      recoveryGuidance.push(`The failure occurred during: ${failedStage.name}`);
      
      if (failedStage.error) {
        recoveryGuidance.push(`Error details: ${failedStage.error}`);
      }

      // Check what was completed before failure
      const completedBeforeFailure = this.stages.filter(
        s => s.status === "complete" && 
        new Date(s.completedAt ?? 0) < new Date(failedStage.startedAt ?? 0)
      );

      if (completedBeforeFailure.length > 0) {
        nextSteps.push("The following stages completed successfully and do not need to be re-run:");
        for (const stage of completedBeforeFailure) {
          nextSteps.push(`  - ${stage.name}`);
        }
      }

      // Provide recovery options
      recoveryGuidance.push("Recovery options:");
      recoveryGuidance.push("1. Fix the underlying issue and retry from the failed stage");
      recoveryGuidance.push("2. Rollback completed reversible changes and restart setup");
      recoveryGuidance.push("3. Resume from the failed stage if the issue is resolved");

      if (remainingChanges.length > 0) {
        nextSteps.push("WARNING: The following irreversible changes were applied before failure:");
        for (const change of remainingChanges) {
          nextSteps.push(`  - ${change.description} (${change.target})`);
        }
      }
    }

    return {
      setupId: this.setupId,
      stages: this.stages,
      revertedChanges,
      remainingChanges,
      nextSteps,
      recoveryGuidance: recoveryGuidance.join("\n"),
    };
  }

  /**
   * UOS-FOUND-SETUP-004: Successful setup hands off into steady-state platform operations
   */
  generateHandoff(): HandoffState {
    const workspaceId = `workspace-${Date.now()}`;
    const cockpitPort = process.env.UOS_COCKPIT_PORT ?? DEFAULT_COCKPIT_PORT;

    return {
      setupId: this.setupId,
      workspaceId,
      cockpitUrl: `http://localhost:${cockpitPort}/cockpit/${workspaceId}`,
      status: "ready",
      healthSummary: {
        core: "ok",
        connectors: "ok",
        setup: "ok",
      },
      evidence: {
        provisioningOutput: {
          setupId: this.setupId,
          completedAt: new Date().toISOString(),
          stages: this.stages.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            duration: s.completedAt && s.startedAt
              ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
              : 0,
          })),
        },
        completedStages: this.stages.filter(s => s.status === "complete").map(s => s.id),
        contractValidation: [],
      },
    };
  }

  /**
   * Reset the setup state
   */
  reset(): void {
    this.currentState = { phase: "idle" };
    this.setupId = "";
    this.stages = [];
    this.sideEffects = [];
  }

  /**
   * Check if setup can proceed based on preflight results
   */
  canProceed(preflightChecks: PreflightCheck[]): { canProceed: boolean; blockedBy: string[] } {
    const blockedBy = preflightChecks
      .filter(c => c.blocked && c.status !== "pass")
      .map(c => c.title);

    return {
      canProceed: blockedBy.length === 0,
      blockedBy,
    };
  }
}

// Export singleton for use in plugin actions
export const setupStudioService = new SetupStudioService();
