# @uos/plugin-setup-studio

@uos/plugin-setup-studio owns the guided installation and apply experience. Its job is to make UOS set up understandable, reversible, and fast-to-value while translating platform complexity into safe, opinionated workflows.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## What This Repo Owns

- Guided setup, configuration capture, and apply flows.
- Plan previews, dependency checks, validation, and environment diagnostics.
- Rollback, undo, and recovery UX for failed or partial setup.
- Progress reporting and explanation of side effects.
- Instrumentation of onboarding friction and success paths.

## Runtime Form

- Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

## Highest-Value Workflows

- New install with progressive disclosure and environment checks.
- Configuration changes with diff preview and safe apply.
- Failure recovery with targeted remediation guidance.
- Rollback or revert after partial application.
- Telemetry-informed UX iteration based on real friction data.

## Key Connections and Operating Surfaces

- GitHub, Google Workspace, DNS/domain providers, email systems, secret managers, package registries, and cloud/deployment platforms such as Cloudflare, Vercel, Render, Docker hosts, or VPS targets required to get a real workspace from zero to ready state.
- Postgres/SQLite databases, object storage, auth providers, environment-variable stores, and admin consoles when setup requires validating or creating real backing services.
- Docs, forms, spreadsheets, ticketing, onboarding checklists, and browser-admin flows when user input, environment inspection, or manual checkpoints are part of safe setup.
- Local CLIs, package managers, template generators, migration/import tools, and recovery scripts whenever they materially shorten time-to-value without making the setup path opaque.

## KPI Targets

- First-run setup completion for the standard path reaches >= 85% without manual intervention.
- Median time from blank environment to validated ready state stays <= 20 minutes for maintained setup flows.
- Diff previews are shown for 100% of potentially destructive or stateful apply actions.
- Targeted recovery guidance resolves >= 80% of benchmark setup failures without requiring a repo maintainer.

## Implementation Backlog

### Now
- Map the canonical setup paths and turn each into a reproducible, evidence-producing guided flow.
- Add stronger preflight checks for domains, secrets, databases, and provider prerequisites.
- Make failure recovery and revert steps first-class outputs instead of buried implementation details.

### Next
- Reduce setup friction by collapsing repeated prompts and auto-filling safely discoverable context.
- Instrument setup abandonment and friction analytics so the flow can be prioritized with real evidence.
- Improve handoff from setup to core provisioning and cockpit visibility.

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
