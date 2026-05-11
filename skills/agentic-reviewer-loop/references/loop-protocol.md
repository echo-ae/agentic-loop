# Agentic Review Loop Protocol

This is the reusable loop. Project-specific rules belong in the target
repository's root `AGENTIC_LOOP.md`, `AGENTS.md`, architecture docs, and
planning files.

## When To Use This

Use this loop only when all are true:

- there is an approved no-variant spec, implementation plan, and checklist;
- the task is large enough that one implementation pass is unlikely to be
  enough;
- the user wants multiple review and repair passes without a new prompt after
  each pass;
- the work can be bounded by explicit stop criteria.

Do not use this loop for tiny one-file fixes, quick answers, exploratory
brainstorming, or tasks where the user has not approved implementation yet.

## Required Inputs

- `SPEC_FILE`: approved no-variant spec.
- `PLAN_FILE`: approved implementation plan.
- `CHECKLIST_FILE`: execution checklist.
- `EVIDENCE_FILE`: evidence or audit log, if present.
- `TARGET_SCOPE`: exact files, packages, apps, routes, workflows, or tests.
- `FORBIDDEN_SCOPE`: files or behavior not to change.
- `LIVE_GATES`: external services, credentials, manual approvals, or opt-in
  checks that cannot be silently run.

## Automatic Project Runbook Preflight

Before loop execution, check only for root `AGENTIC_LOOP.md`.

If it is missing:

1. Read `references/bootstrap-guide.md`.
2. Run the bootstrap script with `--project <repo-root>` and no explicit
   `--output`, so it creates `<repo-root>/AGENTIC_LOOP.md`.
3. Read the generated draft plus the project's governing docs.
4. Refine the draft before starting Round 0.
5. Record in evidence that auto-bootstrap happened.

Do not search for, create, or treat any project-specific alternate runbook path
as canonical.

If a noncanonical legacy runbook exists, use it only as migration input for the
root `AGENTIC_LOOP.md`.

If required planning artifacts are missing, create or update them before
starting the loop.

## Canonical User Prompt

```text
Run the agentic review loop for:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:
- EVIDENCE_FILE:

Implement the plan, then review and repair until the stop criteria are met.
Use subagents for independent review roles.
Fix all P0/P1 findings. Fix P2 findings unless they are explicitly recorded as accepted risk.
Do not stop after the first pass.
```

The phrase `Use subagents` is intentional. Agents may only spawn subagents when
the user explicitly asks for delegation or parallel agent work.

## Severity Rules

- `P0`: implementation is unusable, corrupts state, violates a core invariant,
  or cannot run.
- `P1`: required plan behavior is missing or materially wrong.
- `P2`: correctness, maintainability, observability, or test-quality issue that
  should be fixed before closure.
- `P3`: polish or future improvement, not required for the current gate.

P0 and P1 must be fixed. P2 must be fixed unless accepted risk is recorded with
finding, reason, residual risk, and follow-up owner or gate.

P3 must not expand the current scope unless the user explicitly asks for polish.

## Role Model

The owning implementation agent remains responsible for final integration and
verification.

### Implementation Agent

Responsibilities:

- read the spec, plan, checklist, current evidence, `AGENTIC_LOOP.md`, and
  governing docs;
- inspect current code before editing;
- implement the next checklist item or repair batch;
- keep changes scoped;
- run relevant tests;
- update checklist and evidence only when implementation is actually verified;
- integrate reviewer findings.

### Review Roles

Run these roles with subagents when the user authorizes delegation. Otherwise,
perform them sequentially as self-review and label them as such.

- **Architecture Reviewer**: spec drift, ownership boundaries, hidden fallbacks,
  silent degradation, legacy-direct paths, duplicated architecture, missing
  architecture docs.
- **Runtime Reviewer**: workflow determinism, task queues, workers, retries,
  cancellation, idempotency, side-effect ordering, synthetic-success paths.
- **Contract And Boundary Reviewer**: validation, unsafe casts, public contract
  leaks, duplicated shapes, malformed external adapter responses.
- **Test And E2E Reviewer**: mocks instead of product behavior, skipped UI
  interactions, missing negative tests, route or adapter shortcuts, flakiness.
- **Evidence Reviewer**: checked items without proof, stale evidence, live gates
  marked complete without opt-in runs, accepted risks without reason/residual
  risk/follow-up, missing command summaries, documented commands or modes that
  were never implemented or verified.
- **Final Plan Replay Reviewer**: every plan step and checklist item literally
  matches implementation, verification, blocked status, or accepted risk;
  documented commands and environment contracts do not drift from runtime
  reality; features are not merely documented; checked items use direct proof
  when practical; blocked items should not be implementable now.

## Round Algorithm

### Round 0: Orientation

1. Ensure root `AGENTIC_LOOP.md` exists; auto-bootstrap it if missing.
2. Read spec, plan, checklist, evidence, `AGENTIC_LOOP.md`, and governing docs.
3. Run `git status --short`.
4. Identify unrelated dirty worktree changes.
5. Build a local round plan from the checklist.

### Round 1: Implementation Pass

1. Execute the next incomplete or weak checklist slice.
2. Prefer tests before implementation for new or risky behavior.
3. Make narrowly scoped edits.
4. Run the smallest relevant verification command.
5. Update checklist and evidence only after verification.

### Round 2: Independent Review Pass

Dispatch or perform the review roles. Findings must include:

```text
## Finding N
Severity: P0 | P1 | P2 | P3
Files: path:line
Plan item: exact checklist or plan item
Problem: concise explanation
Required fix: concrete change
Suggested verification: exact command or assertion
```

### Round 3: Repair Pass

1. Sort by severity.
2. Fix all P0/P1 first.
3. Fix P2 unless accepted risk is justified.
4. Add regression tests where practical.
5. Update evidence with fixes and verification.

### Round 4: Verification Pass

Run verification from narrow to broad:

1. targeted unit tests;
2. targeted integration tests;
3. targeted browser or E2E tests;
4. typecheck;
5. lint;
6. format check;
7. diff whitespace check;
8. full test suite when the plan requires repo-wide proof.

Live gates remain opt-in unless the user explicitly authorizes them.

### Round 5: Final Adversarial Plan Replay

Replay the user's manual audit prompt:

```text
Take the plan and go point by point. For each point, analyze how well it is implemented, find gaps, and fix them immediately.
```

For every plan step and checklist item, classify it as:

- `implemented_and_verified`;
- `implemented_fail_closed`;
- `blocked_live_or_external_gate`;
- `accepted_risk`;
- `gap_found`.

For every documented command, environment variable, URL, port, feature flag, or
mode, verify that code implements it, tests prove it, it is blocked, or it is
accepted as risk.

Fix every `gap_found` item immediately unless it is a live/external gate that
cannot be run silently. If replay fixes any P0/P1/P2, append evidence and run at
least one additional review round.

The loop may only stop after a clean final plan replay and one subsequent clean
review round.

## Next Round Decision

Start another review round when any are true:

- a P0/P1 finding was fixed in the previous round;
- a P2 finding was fixed and the affected area has not been re-reviewed;
- checklist items changed from unchecked to checked;
- evidence was materially updated;
- verification exposed a new failure;
- implementation touched architecture, runtime, contract, or E2E boundaries;
- final plan replay found any gap;
- a documented command, environment flag, URL, port, or mode was corrected.

## Stop Criteria

Stop only when all are true:

- every checklist item in scope is checked, blocked, or accepted as risk;
- no open P0/P1 findings;
- all P2 findings fixed or recorded as accepted risk;
- relevant tests, typecheck, lint, format, and diff checks pass or are
  explicitly blocked;
- evidence records verification commands and outcomes;
- live gates are passed or explicitly left open as opt-in gates;
- final adversarial plan replay is recorded and clean;
- documented commands, flags, URLs, ports, and modes are implemented, verified,
  blocked, or accepted as risk;
- final answer reports accepted-risk P2 findings and escaped findings.

Recommended stability rule: stop after a clean final plan replay plus one
subsequent clean review round.

Recommended budget rule: default maximum is 10 review rounds. If open P0/P1
findings remain, stop and report blockers instead of continuing blindly. The
user can explicitly authorize another bounded block of rounds.

## Evidence Template

```markdown
## Agentic Review Loop Round N, YYYY-MM-DD

Scope:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:

Review roles run:
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
- `command`: failed, reason, follow-up

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

## Checklist Update Rules

Only check an item when:

- the implementation exists;
- a relevant test or verification command proved it;
- the evidence file records that proof.

Do not check an item because the code "looks done".

Do not leave stale checked items after finding a gap. Either fix the gap
immediately or temporarily change the checklist item to unchecked with a note.

## Subagent Dispatch Rules

When subagents are used:

- give each subagent exact files, scope, forbidden scope, and governing
  invariants;
- do not ask two agents to edit the same files at the same time unless write
  ownership is explicitly disjoint;
- prefer read-only reviewer subagents after each implementation pass;
- keep architectural decisions with the owning agent;
- do not delegate the immediate critical-path blocker if the owning agent can
  fix it directly faster;
- close subagents when their findings have been integrated.

Use `references/reviewer-prompts.md` for reviewer and bounded repair prompt
templates.

## Failure Handling

If a verification command fails:

1. Reproduce or inspect the failure.
2. Classify it as in-scope, unrelated existing failure, environment failure, or
   live-gate failure.
3. Fix in-scope failures immediately.
4. Record unrelated or environment failures in evidence with exact command and
   symptom.
5. Do not claim the full gate passed when a required command failed.

If the root cause is unclear, create or update a project debugging note and
continue systematic debugging according to the project runbook.

## Escaped Findings

An escaped finding is any P0/P1/P2 issue discovered after the loop previously
recorded its stop criteria as satisfied, especially when the user asks for a
manual "go point by point and fix gaps" pass.

When one appears:

1. Fix it using normal severity rules.
2. Record it under `Escaped findings from prior loop`.
3. State which stop criterion or review role missed it.
4. Update the project runbook or narrower plan/checklist if process failed.
5. Restart the stability requirement from the repair point.

The goal is not to claim that no future issue can ever be found. The goal is to
turn every escaped issue into either a stronger process check or an explicit,
auditable limitation.

## Final Response Shape

```text
Ran the agentic review loop for <plan>.

Fixed:
- ...

Verified:
- ...

Accepted P2 risks:
- none | ...

Escaped findings handled:
- none | ...

Remaining:
- ...
```

Do not say "complete" if an acceptance gate remains open.

If there are no accepted-risk P2 findings, say that explicitly. If there are
accepted-risk P2 findings, include for each:

- the finding;
- why it was accepted instead of fixed in the current loop;
- residual risk;
- follow-up owner or gate.

If there were no escaped findings in the current loop, say that explicitly. If
there were escaped findings, include for each:

- the finding;
- why the previous loop missed it;
- what process or checklist rule was strengthened;
- how the fix was verified.
