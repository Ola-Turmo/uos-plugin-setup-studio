# @uos/plugin-setup-studio

@uos/plugin-setup-studio is the guided setup and apply surface for UOS. It owns onboarding, configuration capture, preflight checks, plan preview, and human-readable apply flows on top of `@uos/core`. It does not own the canonical apply engine, ongoing health dashboards, or provider connector lifecycle.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## What This Repo Owns

- Guided setup, scoping, configuration capture, and apply confirmation UX.
- Preflight checks, dependency validation, and environment diagnostics before apply.
- Plan previews, side-effect explanations, and operator-facing evidence before changes land.
- Failure recovery, undo guidance, and retry flows around `@uos/core` transactions.
- Instrumentation of onboarding friction and success paths.

## Runtime Form

- Plugin-first operator surface that translates core plans into a guided installation and configuration experience.

## Highest-Value Workflows

- New install with progressive disclosure and environment checks.
- Configuration changes with diff preview and safe apply confirmation.
- Failure recovery with targeted remediation guidance and clear next steps.
- Re-running setup safely after partial application or environment drift is detected elsewhere.
- Telemetry-informed UX iteration based on real setup friction data.

## Key Connections and Operating Surfaces

- GitHub, Google Workspace, DNS/domain providers, email systems, secret managers, package registries, and cloud/deployment platforms needed to get a real workspace from zero to ready state.
- Postgres/SQLite databases, object storage, auth providers, environment-variable stores, and admin consoles when setup requires validating or creating real backing services.
- Docs, forms, spreadsheets, ticketing, onboarding checklists, and browser-admin flows when user input or manual checkpoints are part of safe setup.
- Local CLIs, package managers, template generators, migration/import tools, and recovery scripts whenever they materially shorten time-to-value without turning this repo into the core engine.

## KPI Targets

- First-run setup completion for the standard path reaches >= 85% without manual intervention.
- Median time from blank environment to validated ready state stays <= 20 minutes for maintained setup flows.
- Diff previews are shown for 100% of potentially destructive or stateful apply actions.
- Targeted recovery guidance resolves >= 80% of benchmark setup failures without requiring a repo maintainer.

## Implementation Backlog

### Now
- Map the canonical setup paths and turn each into reproducible, evidence-producing guided flows.
- Add stronger preflight checks for domains, secrets, databases, and provider prerequisites.
- Make recovery and revert guidance first-class outputs instead of buried implementation details.

### Next
- Reduce setup friction by collapsing repeated prompts and auto-filling safely discoverable context.
- Instrument setup abandonment and friction analytics so prioritization follows evidence.
- Improve handoff from setup into core transactions and cockpit visibility.

### Later
- Support reusable setup blueprints for different company profiles and target environments.
- Add policy-aware delegated setup flows with review checkpoints for higher-risk environments.

## Local Plugin Use

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"<absolute-path-to-this-repo>","isLocalPath":true}'
```

## Validation

```bash
npm install
npm test
npm run plugin:typecheck
npm run plugin:test
```
