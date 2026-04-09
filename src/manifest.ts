import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "uos.plugin-setup-studio",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Plugin Setup Studio",
  description: "Guided setup with preflight checks, apply previews, partial-failure recovery, and handoff to platform operations.",
  author: "turmo.dev",
  categories: ["ui", "automation"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.dashboardWidget.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "health-widget",
        displayName: "Plugin Setup Studio",
        exportName: "DashboardWidget"
      }
    ]
  }
};

export default manifest;
