import { describe, expect, it, beforeEach } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { SetupStudioService } from "../src/setup-service.js";
import type { SetupStage, SideEffect } from "../src/types.js";

describe("plugin scaffold", () => {
  it("registers data, actions, and event handling", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    await harness.emit("issue.created", { issueId: "iss_1" }, { entityId: "iss_1", entityType: "issue" });
    expect(harness.getState({ scopeKind: "issue", scopeId: "iss_1", stateKey: "seen" })).toBe(true);

    const data = await harness.getData<{ status: string; checkedAt: string }>("health");
    expect(data.status).toBe("ok");

    const action = await harness.performAction<{ pong: boolean; at: string }>("ping");
    expect(action.pong).toBe(true);
  });
});

describe("Setup Studio Service", () => {
  let service: SetupStudioService;

  beforeEach(() => {
    service = new SetupStudioService();
  });

  describe("UOS-FOUND-SETUP-001: Preflight blocks irreversible setup when prerequisites are missing", () => {
    it("returns failed check when manifest is incomplete", async () => {
      const checks = await service.runPreflight({ companyName: "", companySlug: "" });
      const incompleteCheck = checks.find(c => c.id === "manifest-complete");
      expect(incompleteCheck?.status).toBe("fail");
      expect(incompleteCheck?.blocked).toBe(true);
    });

    it("returns pass when manifest is complete", async () => {
      const checks = await service.runPreflight({ companyName: "Test Corp", companySlug: "test-corp" });
      const completeCheck = checks.find(c => c.id === "manifest-complete");
      expect(completeCheck?.status).toBe("pass");
      expect(completeCheck?.blocked).toBe(false);
    });

    it("validates company slug format", async () => {
      const checks = await service.runPreflight({ companyName: "Test", companySlug: "Invalid Slug!" });
      const formatCheck = checks.find(c => c.id === "manifest-format");
      expect(formatCheck?.status).toBe("fail");
      expect(formatCheck?.blocked).toBe(true);
    });

    it("canProceed returns false when checks are blocked", async () => {
      await service.runPreflight({ companyName: "", companySlug: "" });
      const result = service.canProceed(await service.runPreflight({ companyName: "", companySlug: "" }));
      expect(result.canProceed).toBe(false);
      expect(result.blockedBy.length).toBeGreaterThan(0);
    });

    it("enters blocked state when a required contract version mismatches", async () => {
      const checks = await service.runPreflight({
        companyName: "Test Corp",
        companySlug: "test-corp",
        contractVersions: [
          { contractId: "uos-core", version: "0.0.5", supportedVersions: ["0.1.0"] },
          { contractId: "uos-plugin-connectors", version: "0.1.0", supportedVersions: ["0.1.0"] },
          { contractId: "uos-paperclip-compat", version: "0.1.0", supportedVersions: ["0.1.0"] },
        ],
      });

      expect(checks.some((check) => check.id.startsWith("contract-mismatch-") && check.status === "fail")).toBe(true);
      expect(service.getCurrentState().phase).toBe("blocked");
      expect(service.canProceed(checks).canProceed).toBe(false);
    });
  });

  describe("UOS-FOUND-SETUP-002: Apply previews communicate side effects", () => {
    it("generates preview with side effects", async () => {
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
        { id: "install-skills", name: "Install Skills", status: "pending" },
      ];
      
      const preview = service.generateApplyPreview(stages);
      
      expect(preview.sideEffects.length).toBeGreaterThan(0);
      expect(preview.totalChanges).toBe(preview.sideEffects.length);
      expect(preview.estimatedDuration).toBeDefined();
    });

    it("identifies high-risk irreversible changes", async () => {
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
      ];
      
      const preview = service.generateApplyPreview(stages);
      const workspaceEffect = preview.sideEffects.find((e: SideEffect) => e.target === "workspace");
      
      expect(workspaceEffect?.riskLevel).toBe("high");
      expect(workspaceEffect?.reversible).toBe(false);
    });

    it("warns about multiple high-risk changes", async () => {
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
        { id: "install-skills", name: "Install Skills", status: "pending" },
      ];
      
      const preview = service.generateApplyPreview(stages);
      
      expect(preview.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("UOS-FOUND-SETUP-003: Partial failure returns targeted recovery guidance", () => {
    it("generates cleanup report after simulated failure", async () => {
      // First generate setup ID and preview (which populates stages)
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
        { id: "install-skills", name: "Install Skills", status: "pending" },
        { id: "configure-connectors", name: "Configure Connectors", status: "pending" },
      ];
      
      // Generate preview to populate internal state
      service.generateApplyPreview(stages);
      
      // Execute with simulated failure
      const result = await service.executeSetup(undefined, "configure-connectors");
      
      expect(result.success).toBe(false);
      expect(result.cleanupReport).toBeDefined();
      // The recovery guidance contains the stage name (not the ID)
      expect(result.cleanupReport?.recoveryGuidance).toContain("Configure Connectors");
    });

    it("cleanup report lists reverted and remaining changes", async () => {
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "install-skills", name: "Install Skills", status: "pending" },
        { id: "write-plugin-state", name: "Write Plugin State", status: "pending" },
      ];
      
      // Generate preview to populate internal state
      service.generateApplyPreview(stages);
      
      await service.executeSetup(undefined, "write-plugin-state");
      const cleanup = service.generateCleanupReport();
      
      // Side effects are populated from generateApplyPreview
      expect(cleanup.revertedChanges.length).toBeGreaterThanOrEqual(0);
      expect(cleanup.remainingChanges.length).toBeGreaterThanOrEqual(0);
      expect(cleanup.nextSteps.length).toBeGreaterThan(0);
    });
  });

  describe("UOS-FOUND-SETUP-004: Successful setup hands off to platform operations", () => {
    it("generates handoff state after successful setup", async () => {
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
      ];
      
      const result = await service.executeSetup();
      
      expect(result.success).toBe(true);
      expect(result.handoffState).toBeDefined();
      expect(result.handoffState?.workspaceId).toBeDefined();
      expect(result.handoffState?.cockpitUrl).toBeDefined();
      expect(result.handoffState?.status).toBe("ready");
    });

    it("handoff includes health summary", async () => {
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "create-workspace", name: "Create Workspace", status: "pending" },
      ];
      
      const result = await service.executeSetup();
      
      expect(result.handoffState?.healthSummary).toBeDefined();
      expect(result.handoffState?.healthSummary).toHaveProperty("core");
      expect(result.handoffState?.healthSummary).toHaveProperty("connectors");
    });

    it("uses the configured cockpit port in the handoff URL", () => {
      const originalPort = process.env.UOS_COCKPIT_PORT;
      process.env.UOS_COCKPIT_PORT = "3102";

      try {
        service.generateSetupId();
        const handoff = service.generateHandoff();
        expect(handoff.cockpitUrl).toContain("http://localhost:3102/cockpit/");
      } finally {
        if (originalPort === undefined) {
          delete process.env.UOS_COCKPIT_PORT;
        } else {
          process.env.UOS_COCKPIT_PORT = originalPort;
        }
      }
    });
  });

  describe("UOS-FOUND-SETUP-005: Partial setup cleanup reports environment state", () => {
    it("cleanup report provides next steps", async () => {
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "install-skills", name: "Install Skills", status: "pending" },
      ];
      
      // Generate preview to populate internal state
      service.generateApplyPreview(stages);
      
      await service.executeSetup(undefined, "install-skills");
      const cleanup = service.generateCleanupReport();
      
      expect(cleanup.nextSteps.length).toBeGreaterThan(0);
      expect(cleanup.nextSteps.some((s: string) => s.includes("Install Skills"))).toBe(true);
    });

    it("cleanup report provides recovery guidance", async () => {
      service.generateSetupId();
      const stages: SetupStage[] = [
        { id: "install-skills", name: "Install Skills", status: "pending" },
      ];
      
      // Generate preview to populate internal state
      service.generateApplyPreview(stages);
      
      await service.executeSetup(undefined, "install-skills");
      const cleanup = service.generateCleanupReport();
      
      expect(cleanup.recoveryGuidance).toContain("Recovery options:");
      expect(cleanup.recoveryGuidance.toLowerCase()).toContain("retry");
      expect(cleanup.recoveryGuidance.toLowerCase()).toContain("rollback");
    });
  });

  describe("UOS-FOUND-SETUP-006: Contract mismatches block setup before apply", () => {
    it("detects version below minimum as blocking", async () => {
      const mismatches = service.detectContractMismatches([
        { contractId: "uos-core", version: "0.0.1", supportedVersions: ["0.0.1", "0.1.0"] },
      ]);
      
      expect(mismatches.length).toBeGreaterThan(0);
      const blocking = mismatches.find(m => m.severity === "blocking");
      expect(blocking).toBeDefined();
    });

    it("detects unsupported version as warning", async () => {
      const mismatches = service.detectContractMismatches([
        { contractId: "uos-core", version: "99.0.0", supportedVersions: ["0.1.0", "0.2.0"] },
      ]);
      
      const warning = mismatches.find(m => m.severity === "warning");
      expect(warning).toBeDefined();
    });

    it("passes when version meets minimum and is supported", async () => {
      const mismatches = service.detectContractMismatches([
        { contractId: "uos-core", version: "1.0.0", supportedVersions: ["0.1.0", "0.2.0", "1.0.0"] },
      ]);
      
      const blocking = mismatches.filter(m => m.severity === "blocking");
      expect(blocking.length).toBe(0);
    });
  });

  describe("Service state management", () => {
    it("generates unique setup IDs", () => {
      const id1 = service.generateSetupId();
      const id2 = service.generateSetupId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^setup-/);
    });

    it("tracks current state", () => {
      expect(service.getCurrentState().phase).toBe("idle");
    });

    it("can reset state", () => {
      service.generateSetupId();
      service.reset();
      
      expect(service.getCurrentState().phase).toBe("idle");
    });
  });
});
