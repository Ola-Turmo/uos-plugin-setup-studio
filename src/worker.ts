import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { setupStudioService } from "./setup-service.js";
import type {
  SetupStage,
  ContractVersion,
} from "./types.js";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      const issueId = event.entityId ?? "unknown";
      await ctx.state.set({ scopeKind: "issue", scopeId: issueId, stateKey: "seen" }, true);
      ctx.logger.info("Observed issue.created", { issueId });
    });

    // Basic health check
    ctx.data.register("health", async () => {
      return { status: "ok", checkedAt: new Date().toISOString() };
    });

    // Ping action for testing
    ctx.actions.register("ping", async () => {
      ctx.logger.info("Ping action invoked");
      return { pong: true, at: new Date().toISOString() };
    });

    // Setup Studio Actions

    /**
     * Run preflight checks before setup
     * UOS-FOUND-SETUP-001: Blocks irreversible setup when prerequisites are missing
     * UOS-FOUND-SETUP-006: Blocks setup when contract mismatches exist
     */
    ctx.actions.register("setup.preflight", async (params: { companyName?: string; companySlug?: string }) => {
      const checks = await setupStudioService.runPreflight(params);
      return {
        checks,
        canProceed: setupStudioService.canProceed(checks),
        state: setupStudioService.getCurrentState(),
      };
    });

    /**
     * Generate apply preview showing side effects
     * UOS-FOUND-SETUP-002: Shows meaningful side effects before execution
     */
    ctx.actions.register("setup.preview", async (params: Record<string, unknown>) => {
      const stages = (params.stages as SetupStage[]) ?? [];
      const preview = setupStudioService.generateApplyPreview(stages);
      return { preview };
    });

    /**
     * Execute setup with progress tracking
     * UOS-FOUND-SETUP-003: Returns targeted recovery guidance on partial failure
     * UOS-FOUND-SETUP-004: Hands off to platform operations on success
     */
    ctx.actions.register("setup.apply", async (params?: { simulateFailure?: string }) => {
      const result = await setupStudioService.executeSetup(
        (_stage) => {
          // Stage update logging would go here
        },
        params?.simulateFailure
      );
      return result;
    });

    /**
     * Get current setup state
     */
    ctx.actions.register("setup.state", async () => {
      return setupStudioService.getCurrentState();
    });

    /**
     * Reset setup state
     */
    ctx.actions.register("setup.reset", async () => {
      setupStudioService.reset();
      return { success: true };
    });

    /**
     * Detect contract mismatches
     * UOS-FOUND-SETUP-006: Contract mismatches block setup before apply
     */
    ctx.actions.register("setup.checkContracts", async (params: Record<string, unknown>) => {
      const contractVersions = (params.contractVersions as ContractVersion[]) ?? [];
      const mismatches = setupStudioService.detectContractMismatches(contractVersions);
      return {
        mismatches,
        canProceed: mismatches.filter(m => m.severity === "blocking").length === 0,
      };
    });

    /**
     * Get cleanup report for partial failure
     * UOS-FOUND-SETUP-005: Reports environment state after partial failure
     */
    ctx.actions.register("setup.cleanupReport", async () => {
      const cleanup = setupStudioService.generateCleanupReport();
      return cleanup;
    });

    /**
     * Get handoff state after successful setup
     * UOS-FOUND-SETUP-004: Successful setup hands off into platform operations
     */
    ctx.actions.register("setup.handoff", async () => {
      const handoff = setupStudioService.generateHandoff();
      return handoff;
    });

    // Data registrations for setup state
    ctx.data.register("setup.state", async () => {
      return setupStudioService.getCurrentState();
    });

    ctx.data.register("setup.health", async () => {
      const state = setupStudioService.getCurrentState();
      let status: "ok" | "degraded" | "error" = "ok";
      
      if (state.phase === "blocked") {
        status = "error";
      } else if (state.phase === "partial_failure") {
        status = "degraded";
      }
      
      return {
        status,
        phase: state.phase,
        checkedAt: new Date().toISOString(),
      };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Plugin worker is running" };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
