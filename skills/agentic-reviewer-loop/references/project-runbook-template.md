# Agentic Review Loop Runbook

Status: Draft

Purpose: define the project-specific workflow for turning an approved spec,
plan, and checklist into a self-reviewing implementation loop.

This file extends the global `$agentic-reviewer-loop` skill. It does not replace
feature specs, implementation plans, checklists, evidence files, architecture
docs, or repository instructions.

## 1. Project Identity

- Repository:
- Primary product/runtime:
- Source of truth:
- Orchestration/runtime:
- Main user-facing app:

## 2. Governing Documents

- Agent instructions:
- Architecture docs:
- Migration or roadmap docs:
- Test and verification docs:

## 3. Non-Negotiable Invariants

- ...

## 4. Required Inputs

Before starting a loop, identify:

- `SPEC_FILE`;
- `PLAN_FILE`;
- `CHECKLIST_FILE`;
- `EVIDENCE_FILE`;
- target scope;
- forbidden scope;
- live gates and external dependencies.

If any required planning artifact is missing, create or update it first. Do not
start a multi-round loop from an informal task description alone.

## 5. When To Use The Loop

Use the loop only when:

- an approved no-variant spec, implementation plan, and checklist exist;
- the task is large enough that one implementation pass is unlikely to be
  enough;
- the user wants multiple review and repair passes;
- stop criteria are explicit.

Do not use it for tiny fixes, quick answers, or unapproved exploratory work.

## 6. Impact Triage

Before dispatching reviewers, classify the work and record the decision in
evidence.

Size:

- `small`: one file, docs-only, localized UI polish, or a narrow test update.
- `medium`: several files within one module or one bounded product flow.
- `large`: cross-module work, public contracts, persistence, runtime,
  workflows, E2E, migration docs, or external adapters.
- `critical`: state corruption risk, external publication, live credentials,
  billing/pricing, auth/security, orchestration, data migration, or silent
  success risk.

Risk axes:

- architecture or ownership boundaries;
- runtime/workflow/worker behavior;
- public contracts and boundary validation;
- persistence, migrations, or projections;
- browser UI or E2E paths;
- external services, live credentials, or publication;
- observability, evidence, or quality gates.

Review depth:

- `small`: no subagents; owning agent performs labeled self-review.
- `medium`: one reviewer focused on the dominant risk axis.
- `large`: two or three reviewers with distinct roles.
- `critical`: at least three distinct reviewers plus strict final replay; raise
  max rounds only when the user authorizes a bounded extension.

Evidence must record size, risk axes, selected reviewer roles, omitted reviewer
roles, max rounds, and rationale.

## 7. Review Roles

Use the global skill roles unless this project overrides them:

- Implementation agent:
- Architecture reviewer:
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:

## 8. Verification Commands

Default commands:

```bash
# Fill in exact project commands.
```

Targeted commands by area:

- UI:
- Runtime:
- Contracts:
- Persistence:
- E2E:

## 9. Live Gates

Live or external checks are opt-in unless the user explicitly authorizes them.

- ...

## 10. Evidence Rules

Evidence file format:

```markdown
## Agentic Review Loop Round N, YYYY-MM-DD

Scope:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:

Impact triage:
- size:
- risk axes:
- selected reviewer roles:
- omitted reviewer roles:
- max rounds:

Review roles run (selected roles only; omitted roles must be explained in
Impact triage):
- Architecture reviewer:
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:

Findings:
- P1:
- P2:

Fixes:
- ...

Verification:
- `command`: passed

Accepted risks:
- none

Documented command and environment contract:
- checked:
- blocked:

Final plan replay:
- clean | gaps fixed | gaps blocked

Escaped findings from prior loop:
- none
```

Do not paste huge command logs. Summarize relevant results and keep exact
commands.

## 11. Checklist Update Rules

Only check an item when:

- implementation exists;
- a relevant test or verification command proved it;
- the evidence file records that proof.

Do not check items because code "looks done". Do not leave stale checked items
after finding a gap.

## 12. Subagent Dispatch Rules

When subagents are used:

- choose reviewer count and roles from Impact Triage instead of using a fixed
  number of agents;
- give each subagent exact files, scope, forbidden scope, and governing
  invariants;
- prefer read-only reviewer subagents after implementation passes;
- keep architectural decisions with the owning agent;
- do not delegate the immediate critical-path blocker when the owning agent can
  fix it directly faster;
- close subagents when their findings have been integrated.

## 13. Failure Handling

If a verification command fails:

1. Reproduce or inspect the failure.
2. Classify it as in-scope, unrelated existing failure, environment failure, or
   live-gate failure.
3. Fix in-scope failures immediately.
4. Record unrelated or environment failures in evidence with exact command and
   symptom.
5. Do not claim the full gate passed when a required command failed.

Project debugging-note location:

- ...

## 14. Next Round Decision

Start another review round when any of these are true:

- a P0/P1 finding was fixed;
- a P2 finding was fixed and the affected area has not been re-reviewed;
- checklist items changed from unchecked to checked;
- evidence was materially updated;
- verification exposed a new failure;
- architecture, runtime, contract, or E2E boundaries changed;
- final plan replay found a gap;
- a documented command, environment flag, URL, port, or mode was corrected.

## 15. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

## 16. Stop Criteria

The loop may stop only when:

- every checklist item in scope is checked, blocked, or accepted as risk;
- no open P0/P1 findings remain;
- all P2 findings are fixed or recorded as accepted risk;
- verification required by this file has passed or is explicitly blocked;
- evidence records commands and outcomes;
- evidence records the Impact Triage decision and selected review depth;
- live gates are passed or explicitly left open as opt-in gates;
- final adversarial plan replay is recorded and clean;
- documented commands, flags, URLs, ports, and modes are implemented,
  verified, blocked, or accepted as risk;
- accepted-risk P2 and escaped findings are reported in the final answer.

Recommended stability rule: stop after a clean final plan replay plus one
subsequent clean review round.

Recommended budget rule: default maximum is 10 review rounds. If open P0/P1
findings remain, stop and report blockers instead of continuing blindly. The
user can explicitly authorize another bounded block of rounds.

## 17. Escaped Findings

If a later manual pass finds a P0/P1/P2 after the loop stopped:

1. fix it;
2. record it as escaped;
3. state which role or criterion missed it;
4. strengthen this runbook or the narrower plan/checklist when process failed;
5. restart the stability requirement.

## 18. Final Response Requirements

The final answer must state:

- what changed;
- what was verified;
- what remains;
- every P2 accepted risk, or explicitly that there are none;
- every escaped finding handled, or explicitly that there were none.

Do not say "complete" if an acceptance gate remains open.
