---
name: agentic-reviewer-loop
description: Use when an approved implementation plan needs repeated implement-review-repair-verify rounds, independent review roles, final plan replay, escaped-finding handling, or project-local runbook bootstrap.
---

# Agentic Reviewer Loop

Use this skill to turn an approved no-variant spec, plan, and checklist into a
bounded implementation loop with embedded review and evidence. This is not a
review-only workflow: when plan artifacts are supplied, the owning agent starts
by executing the next incomplete checklist slice, then uses reviewers to find
gaps and repairs. The global skill is project-agnostic; the target repository
should keep its own root `AGENTIC_LOOP.md` runbook for local architecture rules,
commands, live gates, and accepted-risk policy.

## Decide The Mode

- **Bootstrap mode**: user asks to create or initialize a project-local
  runbook. Read `references/bootstrap-guide.md`, run the bootstrap script if
  useful, then refine the generated runbook after inspecting the project.
- **Loop mode**: user asks to run an implementation loop with embedded review,
  implement a plan with review rounds, or "go point by point through the plan
  and fix gaps". Read `references/loop-protocol.md`; if root `AGENTIC_LOOP.md`
  is missing, bootstrap it automatically before continuing. Do not search or
  create alternate runbook paths.
- **Reviewer mode**: user asks for an independent review role. Read
  `references/reviewer-prompts.md` and return findings only.

## Required Inputs For Loop Mode

Before implementation, identify:

- approved `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE`;
- `EVIDENCE_FILE`, if one exists;
- exact target scope and forbidden scope;
- root `AGENTIC_LOOP.md`, plus `AGENTS.md` or equivalent governing rules;
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
- Use compact reviewer context packets, adaptive P2 caps, delta-only re-review,
  role fusion, and a finding ledger to reduce token and latency cost without
  weakening quality gates.
- Maintain Loop State Artifacts for medium and larger work: Reviewer context
  packet, finding ledger, verification matrix, traceability matrix, and delta
  review packet.
- The canonical artifacts are named exactly: Reviewer context packet, finding
  ledger, verification matrix, traceability matrix, delta review packet.
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
- Use subagents only when the user explicitly authorized delegation or parallel
  agent work, and only to the depth justified by Impact Triage.

The detailed Implementation-First Contract lives in
`references/loop-protocol.md` and each generated project `AGENTIC_LOOP.md`.

## Useful Commands

Bootstrap a local runbook:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project .
```

Draft a reviewer context packet from repository state:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/draft-context-packet.mjs" \
  --project . \
  --evidence EVIDENCE_FILE \
  --max-lines 80
```

Build a traceability matrix draft from plan/checklist files:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/build-traceability-index.mjs" \
  --plan PLAN_FILE \
  --checklist CHECKLIST_FILE
```

Validate evidence loop state before final replay or stopping:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/validate-loop-state.mjs" \
  --evidence EVIDENCE_FILE
```

Preview without writing:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project . \
  --dry-run
```

For detailed loop steps, read `references/loop-protocol.md`.
