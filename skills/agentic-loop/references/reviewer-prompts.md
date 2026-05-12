# Reviewer Prompt Templates

Use these prompts for read-only reviewer subagents or for labeled self-review
passes when subagents are not authorized.

When these prompts are sent to subagents, treat them as visible ephemeral workers:
use compact packet context, avoid full-thread forks unless required, keep active
children open while they are running so Codex App can show their status panel
state, and close each child agent after the owning agent integrates its findings.

## Impact Triage Reviewer Prompt

Use this only when scope is ambiguous or critical and the user authorized
subagents.

```text
Review the approved plan/checklist and recommend review depth.

Inputs:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:
- PROJECT_RUNBOOK:
- TARGET_SCOPE:
- FORBIDDEN_SCOPE:
- LIVE_GATES:

Return:
- size: small | medium | large | critical
- risk axes:
- selected reviewer roles:
- omitted reviewer roles:
- max rounds:
- rationale:

Do not review implementation details yet. Do not edit files.
```

## Shared Reviewer Prompt

```text
Review the current implementation using the supplied reviewer context packet,
finding ledger, verification matrix, and traceability rows first.

Reference files, open only if the packet or matrix row is insufficient for a
concrete finding:
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
This is an implementation-first loop with embedded review.
Use the supplied reviewer context packet first. Read additional files only when
needed to validate a concrete finding or resolve a stated uncertainty.
Validate completed implementation slices against the supplied plan; do not make
yourself the driver of new implementation scope.
Use the supplied finding ledger before reporting duplicates.
Return all P0/P1 findings and P2 findings up to the adaptive cap in the context packet.
Do not stop after the first finding.
Group same-root-cause findings instead of repeating them.
End with "No more material findings within scope" or "Stopped at finding cap".
End with "Extra files read: none" or list every extra file read plus why it was needed.
Classify read mode as `packet-only`, `targeted-extra`, or `scope-expanded`.
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

## Reviewer Finding Batch Rules

- Return every P0/P1 found within assigned scope.
- Return P2 findings up to the adaptive cap set by Impact Triage.
- Omit P3 unless the user explicitly requested polish.
- Do not stop after the first finding.
- Group same-root-cause issues into one finding with multiple affected
  locations.
- Return overlap with another role when you have independent evidence or a
  role-specific angle; the owning agent deduplicates after collection.
- End with `No more material findings within scope` or
  `Stopped at finding cap`.
- End with `Extra files read: none` or a file-by-file reason list.
- Include read mode: `packet-only`, `targeted-extra`, or `scope-expanded`.

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

Use the traceability matrix first. Read full plan/checklist text only for rows
that are changed, new, missing implementation refs, missing verification refs,
gap-found, blocked, accepted-risk, linked to open findings, or selected by the
deterministic hash spot-check.

For each replayed row, classify:

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
