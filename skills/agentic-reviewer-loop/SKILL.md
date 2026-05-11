---
name: agentic-reviewer-loop
description: Use when an approved implementation plan needs repeated implement-review-repair-verify rounds, independent review roles, final plan replay, escaped-finding handling, or project-local runbook bootstrap.
---

# Agentic Reviewer Loop

Use this skill to turn an approved no-variant spec, plan, and checklist into a
bounded implementation loop with evidence. The global skill is project-agnostic;
the target repository should keep its own `agentic-review-loop.md` runbook for
local architecture rules, commands, live gates, and accepted-risk policy.

## Decide The Mode

- **Bootstrap mode**: user asks to create or initialize a project-local
  runbook. Read `references/bootstrap-guide.md`, run the bootstrap script if
  useful, then refine the generated runbook after inspecting the project.
- **Loop mode**: user asks to run an agentic review loop, implement a plan with
  review rounds, or "go point by point through the plan and fix gaps". Read
  `references/loop-protocol.md` and the project-local runbook.
- **Reviewer mode**: user asks for an independent review role. Read
  `references/reviewer-prompts.md` and return findings only.

## Required Inputs For Loop Mode

Before implementation, identify:

- approved `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE`;
- `EVIDENCE_FILE`, if one exists;
- exact target scope and forbidden scope;
- project-local `agentic-review-loop.md`, `AGENTS.md`, or equivalent rules;
- live gates, credentials, external services, and manual approvals.

If the project-local runbook is missing, bootstrap it first. Do not run a
multi-round loop from an informal task description alone.

## Core Operating Rules

- Fix all P0/P1 findings before stopping.
- Fix P2 findings unless each one is explicitly recorded as accepted risk with
  reason, residual risk, and follow-up owner or gate.
- Treat documented commands, flags, URLs, ports, and modes as contracts that
  must be implemented, verified, blocked, or accepted as risk.
- Run a final adversarial plan replay before stopping.
- If a later prompt finds a P0/P1/P2 after the loop previously stopped, record
  it as an escaped finding and strengthen the runbook or plan if process failed.
- Use subagents only when the user explicitly authorized delegation or parallel
  agent work.

## Useful Commands

Bootstrap a local runbook:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project . \
  --output ./agentic-review-loop.md
```

Preview without writing:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project . \
  --dry-run
```

For detailed loop steps, read `references/loop-protocol.md`.
