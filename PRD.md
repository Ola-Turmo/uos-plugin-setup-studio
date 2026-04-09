---
repo: "uos-plugin-setup-studio"
display_name: "@uos/plugin-setup-studio"
package_name: "@uos/plugin-setup-studio"
lane: "plugin"
artifact_class: "TypeScript package / guided setup UX"
maturity: "extracted package with strong UX and workflow focus"
generated_on: "2026-04-03"
assumptions: "Grounded in the current split-repo contents, package metadata, README/PRD alignment pass, and the Paperclip plugin scaffold presence where applicable; deeper module-level inspection should refine implementation detail as the code evolves."
autonomy_mode: "maximum-capability autonomous work with deep research and explicit learning loops"
---

# PRD: @uos/plugin-setup-studio

## 1. Product Intent

**Package / repo:** `@uos/plugin-setup-studio`  
**Lane:** plugin  
**Artifact class:** TypeScript package / guided setup UX  
**Current maturity:** extracted package with strong UX and workflow focus  
**Source-of-truth assumption:** Guided install/apply surface for the split workspace.
**Runtime form:** Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

@uos/plugin-setup-studio owns the guided installation and apply experience. Its job is to make UOS set up understandable, reversible, and fast-to-value while translating platform complexity into safe, opinionated workflows.

## 2. Problem Statement

Powerful platforms fail adoption when onboarding is opaque, destructive, or hard to recover from. Setup Studio must reduce fear, reveal consequences, and preserve reversibility even when the underlying system is complex.

## 3. Target Users and Jobs to Be Done

- Admins and operators installing or updating UOS.
- Implementation teams configuring environments and policies.
- Support and success teams diagnosing setup friction.
- Platform teams using setup telemetry to improve defaults.

## 4. Outcome Thesis

**North star:** A first-time user can reach successful setup quickly, understand what happened, and recover cleanly from errors without reading internal code or escalating to engineering.

### 12-month KPI targets
- First-run setup completion for the standard path reaches >= 85% without manual intervention.
- Median time from blank environment to validated ready state stays <= 20 minutes for maintained setup flows.
- Diff previews are shown for 100% of potentially destructive or stateful apply actions.
- Targeted recovery guidance resolves >= 80% of benchmark setup failures without requiring a repo maintainer.
- Setup telemetry covers >= 95% of major steps, checkpoints, and failure exits in the guided flow.

### Acceptance thresholds for the next implementation wave
- Fresh-environment setup is validated on the maintained target environments end to end.
- Rollback or revert paths exist for all partial-apply and interrupted-setup scenarios in scope.
- The UI and guided flow make prerequisite gaps explicit before any irreversible changes occur.
- Every critical setup stage emits enough evidence to support remote troubleshooting and audit review.

## 5. In Scope

- Guided setup, configuration capture, and apply flows.
- Plan previews, dependency checks, validation, and environment diagnostics.
- Rollback, undo, and recovery UX for failed or partial setup.
- Progress reporting and explanation of side effects.
- Instrumentation of onboarding friction and success paths.

## 6. Explicit Non-Goals

- Owning provider-specific integration logic.
- Owning steady-state operational monitoring after setup completes.
- Turning power-user workflows into opaque one-click magic without visibility.

## 7. Maximum Tool and Connection Surface

- This repo should assume it may use any connection, API, browser flow, CLI, document surface, dataset, or storage system materially relevant to completing the job, as long as the access pattern is lawful, auditable, and proportionate to risk.
- Do not artificially limit execution to the tools already named in the repo if adjacent systems are clearly required to close the loop.
- Prefer first-party APIs and direct integrations when available, but use browser automation, provider CLIs, structured import/export, and human-review queues when they are the most reliable path to completion.
- Treat communication systems, docs, spreadsheets, issue trackers, code hosts, cloud consoles, dashboards, databases, and admin panels as valid operating surfaces whenever the repo's job depends on them.
- Escalate only when the action is irreversible, privacy-sensitive, financially material, or likely to create external side effects without adequate review.

### Priority surfaces for setup workflows
- GitHub, Google Workspace, DNS/domain providers, email systems, secret managers, package registries, and cloud/deployment platforms such as Cloudflare, Vercel, Render, Docker hosts, or VPS targets required to get a real workspace from zero to ready state.
- Postgres/SQLite databases, object storage, auth providers, environment-variable stores, and admin consoles when setup requires validating or creating real backing services.
- Docs, forms, spreadsheets, ticketing, onboarding checklists, and browser-admin flows when user input, environment inspection, or manual checkpoints are part of safe setup.
- Local CLIs, package managers, template generators, migration/import tools, and recovery scripts whenever they materially shorten time-to-value without making the setup path opaque.

### Selection rules
- Start by identifying the systems that would let the repo complete the real job end to end, not just produce an intermediate artifact.
- Use the narrowest safe action for high-risk domains, but not the narrowest tool surface by default.
- When one system lacks the evidence or authority needed to finish the task, step sideways into the adjacent system that does have it.
- Prefer a complete, reviewable workflow over a locally elegant but operationally incomplete one.

## 8. Autonomous Operating Model

This PRD assumes **maximum-capability autonomous work**. The repo should not merely accept tasks; it should research deeply, compare options, reduce uncertainty, ship safely, and learn from every outcome. Autonomy here means higher standards for evidence, reversibility, observability, and knowledge capture—not just faster execution.

### Required research before every material task
1. Read the repo README, this PRD, touched source modules, existing tests, and recent change history before proposing a solution.
1. Trace impact across adjacent UOS repos and shared contracts before changing interfaces, schemas, or runtime behavior.
1. Prefer evidence over assumption: inspect current code paths, add repro cases, and study real failure modes before implementing a fix.
1. Use external official documentation and standards for any upstream dependency, provider API, framework, CLI, or format touched by the task.
1. For non-trivial work, compare at least two approaches and explicitly choose based on reversibility, operational safety, and long-term maintainability.

### Repo-specific decision rules
- Clarity and reversibility beat minimal click count when the tradeoff matters.
- The user should see what will happen before high-impact changes execute.
- Validation and diagnostics are core product behavior, not optional polish.
- Hidden state or irreversible wizard steps are design failures.

### Mandatory escalation triggers
- Flows involving secrets, destructive changes, or tenancy-wide impact.
- UX shortcuts that bypass validation or make rollback ambiguous.
- Any setup action that changes compliance-sensitive configuration by default.

## 9. Continuous Learning Requirements

### Required learning loop after every task
- Every completed task must leave behind at least one durable improvement: a test, benchmark, runbook, migration note, ADR, or automation asset.
- Capture the problem, evidence, decision, outcome, and follow-up questions in repo-local learning memory so the next task starts smarter.
- Promote repeated fixes into reusable abstractions, templates, linters, validators, or code generation rather than solving the same class of issue twice.
- Track confidence and unknowns; unresolved ambiguity becomes a research backlog item, not a silent assumption.
- Prefer instrumented feedback loops: telemetry, evaluation harnesses, fixtures, or replayable traces should be added whenever feasible.

### Repo-specific research agenda
- Which setup steps cause the most abandonment or confusion?
- What diagnostics can be automated before users hit failure?
- Which platform concepts require better explainability or previewing?
- How should dry-run, apply, and rollback experiences differ for novices vs. experts?
- What benchmarks from best-in-class onboarding flows can be adapted here?

### Repo-specific memory objects that must stay current
- Friction map by setup step.
- Validation rule catalog.
- Remediation playbook library.
- Rollback casebook.
- Preview comprehension issues log.

## 10. Core Workflows the Repo Must Master

1. New install with progressive disclosure and environment checks.
1. Configuration changes with diff preview and safe apply.
1. Failure recovery with targeted remediation guidance.
1. Rollback or revert after partial application.
1. Telemetry-informed UX iteration based on real friction data.

## 11. Interfaces and Dependencies

- Paperclip plugin scaffold for worker, manifest, UI, and validation surfaces.

- `@uos/core` for apply/orchestration execution.
- `@uos/plugin-connectors` for integration-specific prerequisites.
- `@uos/plugin-operations-cockpit` for handoff into steady-state monitoring.
- Department overlays that may contribute setup options or defaults.

## 12. Implementation Backlog

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

## 13. Risks and Mitigations

- Polished UX hiding dangerous side effects.
- Incomplete diagnostics causing repeated support loops.
- Setup flows becoming too generic to reflect real platform constraints.
- Rollback promises that the underlying system cannot honor.

## 14. Definition of Done

A task in this repo is only complete when all of the following are true:

- The code, configuration, or skill behavior has been updated with clear intent.
- Tests, evals, replay cases, or validation artifacts were added or updated to protect the changed behavior.
- Documentation, runbooks, or decision records were updated when the behavior, contract, or operating model changed.
- The task produced a durable learning artifact rather than only a code diff.
- Cross-repo consequences were checked wherever this repo touches shared contracts, orchestration, or downstream users.

### Repo-specific completion requirements
- User-facing behavior is explained through previews, validation, and recovery guidance.
- Instrumentation exists to learn from the flow after release.
- Support or operator playbooks are updated for any new failure mode.

## 15. Recommended Repo-Local Knowledge Layout

- `/docs/research/` for research briefs, benchmark notes, and upstream findings.
- `/docs/adrs/` for decision records and contract changes.
- `/docs/lessons/` for task-by-task learning artifacts and postmortems.
- `/evals/` for executable quality checks, golden cases, and regression suites.
- `/playbooks/` for operator runbooks, migration guides, and incident procedures.
