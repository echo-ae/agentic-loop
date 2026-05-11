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

## 5. Review Roles

Use the global skill roles unless this project overrides them:

- Architecture reviewer:
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:

## 6. Verification Commands

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

## 7. Live Gates

Live or external checks are opt-in unless the user explicitly authorizes them.

- ...

## 8. Evidence Rules

Evidence file format:

```markdown
## Agentic Review Loop Round N, YYYY-MM-DD

Scope:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:

Findings:
- P1:
- P2:

Fixes:
- ...

Verification:
- `command`: passed

Accepted risks:
- none

Final plan replay:
- clean | gaps fixed | gaps blocked

Escaped findings from prior loop:
- none
```

## 9. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

## 10. Stop Criteria

The loop may stop only when:

- every checklist item in scope is checked, blocked, or accepted as risk;
- no open P0/P1 findings remain;
- all P2 findings are fixed or recorded as accepted risk;
- verification required by this file has passed or is explicitly blocked;
- evidence records commands and outcomes;
- final adversarial plan replay is recorded and clean;
- accepted-risk P2 and escaped findings are reported in the final answer.

## 11. Escaped Findings

If a later manual pass finds a P0/P1/P2 after the loop stopped:

1. fix it;
2. record it as escaped;
3. state which role or criterion missed it;
4. strengthen this runbook or the narrower plan/checklist when process failed;
5. restart the stability requirement.
