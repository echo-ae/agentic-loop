# Reviewer Prompt Templates

Use these prompts for read-only reviewer subagents or for labeled self-review
passes when subagents are not authorized.

## Shared Reviewer Prompt

```text
Review the current implementation against:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:
- PROJECT_RUNBOOK:

Role: [Architecture | Runtime | Contract | E2E | Evidence | Final Plan Replay]
Scope:
- Include:
- Exclude:

Return only findings that can change implementation, verification, checklist, or evidence quality.
Use P0/P1/P2/P3 severity.
Do not suggest unrelated refactors.
Do not edit files.

Finding format:
## Finding N
Severity: P0 | P1 | P2 | P3
Files: path:line
Plan item: exact checklist or plan item
Problem: concise explanation
Required fix: concrete change
Suggested verification: exact command or assertion
```

## Architecture Reviewer Focus

- no-variant spec drift;
- ownership and boundary violations;
- hidden fallbacks, silent degradation, or alternate runtimes;
- legacy-direct paths;
- missing architecture documentation updates.

## Runtime Reviewer Focus

- workflow determinism;
- worker/task-queue registration;
- retries, cancellation, rollback, and idempotency;
- event-history consistency;
- synthetic success or no-op execution paths.

## Contract And Boundary Reviewer Focus

- weak input validation;
- unsafe casts and duplicated transport shapes;
- public contracts leaking storage, filesystem, credentials, or implementation
  details;
- malformed adapter responses that can pass as valid state.

## Test And E2E Reviewer Focus

- tests that assert mocks instead of product behavior;
- E2E paths that skip required UI actions;
- missing negative tests for boundary failure;
- hidden route, bridge, or direct-database shortcuts;
- flaky selectors or assertions.

## Evidence Reviewer Focus

- checked checklist items without matching proof;
- stale evidence after code changes;
- live gates marked complete without opt-in command output;
- accepted risks missing reason/residual risk/follow-up;
- documented commands or modes that were never implemented or verified.

## Final Plan Replay Reviewer Focus

Read every plan step and checklist item literally. For each one, classify:

- `implemented_and_verified`;
- `implemented_fail_closed`;
- `blocked_live_or_external_gate`;
- `accepted_risk`;
- `gap_found`.

Treat documented commands, environment variables, URLs, ports, flags, and modes
as contracts. Documentation alone is not proof.

## Bounded Repair Worker Prompt

```text
Implement this specific finding:
- Severity:
- Files you may edit:
- Files you must not edit:
- Required behavior:
- Required tests:

You are not alone in the codebase. Do not revert edits made by others.
List changed files and verification commands in your final answer.
```
