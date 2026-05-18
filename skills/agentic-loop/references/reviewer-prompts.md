# Reviewer Prompt Templates

Use these prompts for read-only reviewer subagents or for labeled fallback
self-review passes when the subagent tool is unavailable, the user disables
subagents, or Impact Triage records that spawning a child would be unsafe.

When these prompts are sent to subagents, treat them as visible ephemeral workers:
spawn normal Codex App subagents so their names and active status are visible in
the status panel, use compact packet context, keep active children open while
they are running, close each child agent after the owning agent integrates its
findings, and do not create, promote, or preserve child-agent threads as durable
chat-history items.

## Impact Triage Reviewer Prompt

Use this when scope is ambiguous or critical enough to justify a triage
subagent.

```text
Review the supplied or auto-authored spec/plan/checklist and recommend review
depth.

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

Role: [Architecture | Artifact Completeness | Runtime | Contract | E2E | Evidence | Final Plan Replay | Red-Team Evidence Audit]
Scope:
- Include:
- Exclude:

Return only findings that can change implementation, verification, checklist, or evidence quality.
Use P0/P1/P2/P3 severity.
This is an implementation-first loop with embedded subagent review.
Use the supplied reviewer context packet first. Read additional files only when
needed to validate a concrete finding or resolve a stated uncertainty.
Validate completed implementation slices against the supplied or auto-authored
spec/plan/checklist; do not make yourself the driver of new implementation
scope.
Use the supplied finding ledger before reporting duplicates.
Return every material P0/P1/P2 finding in your assigned scope.
Do not stop after the first finding.
Group same-root-cause findings instead of repeating them.
End with "No more material findings within scope".
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

- Return every material P0/P1/P2 finding found within assigned scope.
- Omit P3 unless the user explicitly requested polish.
- Do not stop after the first finding.
- Group same-root-cause issues into one finding with multiple affected
  locations.
- Return overlap with another role when you have independent evidence or a
  role-specific angle; the owning agent deduplicates after collection.
- End with `No more material findings within scope`.
- End with `Extra files read: none` or a file-by-file reason list.
- Include read mode: `packet-only`, `targeted-extra`, or `scope-expanded`.

## Architecture Reviewer Focus

- no-variant spec drift;
- ownership and boundary violations;
- hidden fallbacks, silent degradation, or alternate runtimes;
- legacy-direct paths;
- missing architecture documentation updates.

## Artifact Completeness Reviewer Focus

Review before product code changes. The artifacts pass only when the agent can
implement without guessing.

Check that:

- every material spec requirement has scope, non-goal or boundary context,
  target behavior, failure behavior, acceptance criteria, and verification;
- every plan step maps to spec requirements, owned files/modules/routes, data
  or contract changes, docs updates when needed, and verification;
- every checklist item names the target surface, exact observable outcome, and
  verification command, gate, assertion, or evidence;
- vague verbs such as "support", "update", "handle", "improve", or "fix" are
  expanded into explicit behavior and proof;
- conflicts, placeholders, unowned surfaces, or missing acceptance criteria are
  returned as P1 artifact findings.

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

Run a full replay against the original spec, plan, checklist, implementation,
traceability matrix, verification matrix, finding ledger, and evidence. Hashes
may help detect drift, but they do not replace full replay.

For each replayed row, classify:

- `implemented_and_verified`;
- `implemented_fail_closed`;
- `blocked_live_or_external_gate`;
- `accepted_risk`;
- `not_in_scope_with_reason`;
- `gap_found`.

Treat documented commands, environment variables, URLs, ports, flags, and modes
as contracts. Documentation alone is not proof.

## Red-Team Evidence Audit Focus

Try to disprove completion. Look for:

- untraced spec, plan, or checklist rows;
- stale checked items without implementation and verification proof;
- skipped gates reported as complete;
- hidden fallbacks, bypasses, or silent degradation;
- accepted risks without reason, residual risk, and follow-up owner or gate;
- final-answer claims that are not backed by commands or evidence.

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
