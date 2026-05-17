---
name: agentic-loop
description: Use when the user explicitly invokes $agentic-loop, names the agentic-loop skill, or directly asks to run/bootstrap the agentic loop; do not use automatically for ordinary review, planning, or implementation requests.
---

# Agentic Loop

Activation is opt-in only. Use this skill only when the user explicitly invokes
`$agentic-loop`, names the `agentic-loop` skill, or directly asks to run or
bootstrap the agentic loop. Do not auto-start it for ordinary review,
implementation, planning, or checklist requests.

Use this skill to turn an approved no-variant spec, plan, and checklist into a
bounded implementation loop with embedded subagent review and evidence. This is
not a review-only workflow: when plan artifacts are supplied, the owning agent
starts by executing the next incomplete checklist slice, then dispatches
subagent reviewers to find gaps and repairs. The global skill is
project-agnostic; the target repository should keep its own root
`AGENTIC_LOOP.md` runbook for local architecture rules, commands, live gates,
and accepted-risk policy.

## Decide The Mode

- **Bootstrap mode**: user asks to create or initialize a project-local
  runbook. Read `references/bootstrap-guide.md`, run the bootstrap script if
  useful, then refine the generated runbook after inspecting the project. When
  `ARCHITECTURE.md` or `docs/ARCHITECTURE.md` exists, use it as the primary
  architecture orientation source.
- **Loop mode**: user asks to run an implementation loop with embedded review,
  implement a plan with review rounds, or "go point by point through the plan
  and fix gaps". First check for root `AGENTIC_LOOP.md`. If it exists, use that
  as the only runtime protocol and do not read `references/loop-protocol.md`
  unless updating or debugging the skill. If root `AGENTIC_LOOP.md` is missing,
  bootstrap it automatically before continuing. Do not search or create
  alternate runbook paths.
- **Reviewer mode**: user asks for an independent review role. Read
  `references/reviewer-prompts.md`, dispatch at least one reviewer subagent
  when the subagent tool is available, and return findings only.

## Required Inputs For Loop Mode

Before implementation, identify:

- approved `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE`;
- `EVIDENCE_FILE`, if one exists;
- exact target scope and forbidden scope;
- root `AGENTIC_LOOP.md`, plus `AGENTS.md` or equivalent governing rules;
- `ARCHITECTURE.md` or `docs/ARCHITECTURE.md`, when present, as the compact
  project map for ownership, stack, runtime, data flow, and forbidden paths;
- live gates, credentials, external services, and manual approvals.

If root `AGENTIC_LOOP.md` is missing, create it automatically with the
bootstrap script, then refine the draft after reading the project's governing
docs. Do not overwrite an existing runbook without explicit user approval. Do
not use alternate runbook paths as canonical files. Do not run a multi-round
loop from an informal task description alone.

## Core Operating Rules

- Fix all P0/P1 findings before stopping.
- Fix P2 findings unless each one is explicitly recorded as accepted risk with
  reason, residual risk, and follow-up owner or gate.
- Treat documented commands, flags, URLs, ports, and modes as contracts that
  must be implemented, verified, blocked, or accepted as risk.
- Treat the loop as implementation-first: execute the next incomplete checklist
  slice before broad review when supplied plan artifacts are not yet complete.
- Keep reviewers out of scope ownership; they validate completed slices and
  report plan gaps, while the owning agent drives checklist execution.
- Run Impact Triage before reviewer dispatch; choose reviewer count and roles
  from size/risk instead of using a fixed number of agents.
- Use the Architecture Orientation from `AGENTIC_LOOP.md` and reviewer context
  packets to route work to the right apps, packages, runtime owners, and
  reviewer roles before reading full architecture docs.
- Use compact reviewer context packets, adaptive P2 caps, delta-only re-review,
  role fusion, and a finding ledger to reduce token and latency cost without
  weakening quality gates.
- Emit exactly one Progress Beacon per review cycle as a user-visible
  chat/commentary update after reviewer batches are deduplicated and before
  repair starts. Do not emit phase-by-phase beacons for orientation,
  implementation, verification, or final replay. Writing evidence or
  `.agentic-loop` state does not satisfy the beacon. Keep it short and continue
  working unless the user asks to pause. Include only severity counts, short
  problem classes, and what will be repaired or verified next.

Progress Beacon template:

```text
Review Cycle N:
- findings: P0=0 P1=0 P2=0 P3=0
- classes: short issue classes, or none
- repair now: concrete fixes or verification next
```
- Maintain Loop State Artifacts for medium and larger work: Reviewer context
  packet, finding ledger, verification matrix, traceability matrix, and delta
  review packet.
- The canonical artifacts are named exactly: Reviewer context packet, finding
  ledger, verification matrix, traceability matrix, delta review packet.
- Prefer canonical sidecar files under `.agentic-loop/` for large evidence:
  `context.md`, `findings.md`, `verification.md`, `traceability.md`, and
  `delta.md`.
- Use one runtime protocol per loop: project `AGENTIC_LOOP.md` when present;
  global references only for bootstrap, updates, or skill debugging.
- Keep evidence token-efficient with a rolling `Current State`, stable
  plan/checklist IDs, short item hashes, reviewer read budgets, and command
  output summaries instead of full logs.
- Apply the Read and output budget: reviewers declare read mode and evidence
  summarizes command output while linking full logs/artifacts.
- Require reviewers to batch material findings: all P0/P1, P2 up to the
  adaptive cap, no P3 unless requested, and no stopping after the first issue.
- Run a final adversarial plan replay before stopping.
- If a later prompt finds a P0/P1/P2 after the loop previously stopped, record
  it as an escaped finding and strengthen the runbook or plan if process failed.
- Loop-mode `$agentic-loop` requires visible Codex App subagent reviewers.
  Treat the user's explicit invocation of `$agentic-loop` for an
  implementation loop as authorization to spawn reviewer subagents unless the
  user disables subagents in the same request.
- Run Impact Triage before reviewer dispatch and choose reviewer count and
  roles from size/risk instead of using a fixed number:
  - small/docs-only loop: at least 1 reviewer subagent after the first
    meaningful change;
  - medium loop: 2-3 reviewer subagents covering the highest-risk roles;
  - large or high-risk loop: 4-6 reviewer subagents, batched if needed to keep
    ownership clear;
  - reviewer-only mode: at least 1 independent reviewer subagent unless the
    user asks for lead-agent-only review.
- Treat subagents as visible ephemeral workers: spawn normal Codex App
  subagents so their names and active status are visible in the status panel,
  give each one a clear role/scope prompt, keep each child open while it is
  running, collect the result, then call `close_agent` after findings or
  patches are integrated. Do not create, promote, or preserve child-agent
  threads as durable chat-history items; the loop cannot stop while any child
  agent remains open.
- Fallback to lead-agent self-review only when the subagent tool is unavailable,
  the user explicitly disables subagents, or Impact Triage records that
  spawning a child would be unsafe for the current environment. Record the
  fallback reason in the finding ledger or evidence file and label the pass as
  self-review, not independent review.

The reusable Implementation-First Contract reference lives in
`references/loop-protocol.md`; ordinary project loops should use the generated
project `AGENTIC_LOOP.md` copy instead.

## Useful Commands

Bootstrap a local runbook:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/bootstrap-project-runbook.mjs" \
  --project .
```

Generate a full self-contained runbook only when a project cannot depend on the
global skill:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/bootstrap-project-runbook.mjs" \
  --project . \
  --self-contained
```

Draft a reviewer context packet from repository state:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/draft-context-packet.mjs" \
  --project . \
  --evidence EVIDENCE_FILE \
  --max-lines 80 \
  --max-files 40 \
  --include TARGET_SCOPE \
  --architecture-file ARCHITECTURE.md \
  --scope "current slice" \
  --command "npm test: passed" \
  --known-failure "live gate not run"
```

Build a traceability matrix draft from plan/checklist files:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/build-traceability-index.mjs" \
  --plan PLAN_FILE \
  --checklist CHECKLIST_FILE \
  --existing .agentic-loop/traceability.md \
  --section "active slice" \
  --status TODO,gap_found
```

Use `--changed-only` for delta review packets and `--include-headings` only
when headings are actionable plan/checklist items. Use `--ids` for targeted
replay of known plan/checklist rows.

Validate evidence loop state before final replay or stopping:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/validate-loop-state.mjs" \
  --evidence EVIDENCE_FILE
```

Preview without writing:

```bash
node "$CODEX_HOME/skills/agentic-loop/scripts/bootstrap-project-runbook.mjs" \
  --project . \
  --dry-run
```

For detailed reusable protocol steps, read `references/loop-protocol.md` only
when bootstrapping, updating, or debugging the skill. Ordinary project loops
should use the project root `AGENTIC_LOOP.md`.
