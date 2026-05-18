# Agentic Implementation Review Loop Protocol

This is the reusable loop. Project-specific rules belong in the target
repository's root `AGENTIC_LOOP.md`, `AGENTS.md`, architecture docs, and
planning files.

This is an implementation-first loop with embedded subagent review, not a
review-only workflow. Unless the user explicitly asks for review-only output,
the owning agent first establishes a saved no-variant spec, implementation
plan, and checklist, then executes the next incomplete checklist slice before
broad review, dispatches reviewer subagents to find gaps, repairs them, and
verifies the result.

## When To Use This

Use this loop when any of these are true:

- the user explicitly invokes `$agentic-loop` for implementation;
- the user supplies an approved no-variant spec, implementation plan, and
  checklist;
- the user supplies a checklist or informal goal and expects implementation,
  not review-only output;
- the task is large enough that one implementation pass is unlikely to be
  enough, or the user wants multiple review and repair passes.

Do not use this loop for tiny one-file fixes, quick answers, exploratory
brainstorming, or tasks where the user has not approved implementation yet.

## Planning Artifact Contract

- `SPEC_FILE`: approved or auto-authored no-variant spec.
- `PLAN_FILE`: approved or auto-authored implementation plan.
- `CHECKLIST_FILE`: execution checklist.
- `EVIDENCE_FILE`: evidence or audit log, if present or created.
- `TARGET_SCOPE`: exact files, packages, apps, routes, workflows, or tests.
- `FORBIDDEN_SCOPE`: files or behavior not to change.
- `LIVE_GATES`: external services, credentials, manual approvals, or opt-in
  checks that cannot be silently run.

Artifact source rules:

- Explicit spec/plan/checklist supplied by the user wins.
- Checklist-only input must be expanded by resolving linked artifacts or
  authoring the missing spec and plan.
- Informal goals in loop mode must be converted into saved no-variant spec,
  implementation plan, and checklist files before product code changes.
- Generated artifacts must follow the current project's accepted markdown
  naming, structure, and location conventions.

### Artifact Completeness Gate

Before product code changes, prove that the spec, plan, and checklist are
implementable without guessing.

The gate passes only when:

- the no-variant spec states scope, non-goals, invariants, target behavior,
  failure behavior, acceptance criteria, and verification gates;
- the implementation plan maps spec requirements to ordered implementation
  slices, owned surfaces, expected contract/data-flow changes, docs updates,
  and verification;
- the checklist contains concrete checkbox items with target files/modules,
  expected observable outcome, and exact verification command, gate, assertion,
  or evidence;
- no item relies on vague verbs such as "support", "update", "handle", or
  "improve" unless the object, behavior, surface, and proof are explicit;
- ambiguous, conflicting, placeholder, or unowned items are rewritten before
  implementation.

Run `node "$CODEX_HOME/skills/agentic-loop/scripts/validate-planning-artifacts.mjs" --spec SPEC_FILE --plan PLAN_FILE --checklist CHECKLIST_FILE`
when available. Treat failures as P1 artifact findings and revise the
artifacts before implementation.

## Impact Triage

Before dispatching reviewers, the owning agent performs triage and records the
decision in evidence. This is normally a self-triage by the owning agent, not a
separate subagent. Because loop-mode `$agentic-loop` authorizes reviewer
subagents by default, use a dedicated triage reviewer when scope is ambiguous or
critical enough to justify it.

Classify change size:

- `small`: one file, docs-only, localized UI polish, or a narrow test update.
- `medium`: several files within one module or one bounded product flow.
- `large`: cross-module work, public contracts, persistence, runtime,
  workflows, E2E, migration docs, or external adapters.
- `critical`: state corruption risk, publication to external systems, live
  credentials, billing/pricing, auth/security, Temporal orchestration, data
  migration, or any path where a failure can silently look successful.

Record risk axes:

- architecture or ownership boundaries;
- runtime/workflow/worker behavior;
- public contracts and boundary validation;
- persistence, migrations, or projections;
- browser UI or E2E paths;
- external services, live credentials, or publication;
- observability, evidence, or quality gates.

Choose review depth from triage:

Loop-mode `$agentic-loop` is explicit authorization to dispatch reviewer
subagents unless the user disables them in the same request.

- `small`: at least 1 reviewer subagent after the first meaningful change.
- `medium`: 2-3 reviewer subagents covering the highest-risk roles.
- `large`: 4-6 reviewer subagents, batched if needed to keep ownership clear.
- `critical`: 4-6 reviewer subagents plus strict final replay; batch reviewers
  when risk axes are independent or context packets must stay small.

Fallback to labeled self-review only when the subagent tool is unavailable, the
user explicitly disables subagents, or Impact Triage records that spawning a
child would be unsafe.

Record:

- size classification;
- risk axes;
- selected reviewer roles and why;
- max rounds for this loop;
- any reviewer roles intentionally omitted and why.

## Token And Latency Efficiency Rules

Quality gates take precedence over token savings. These rules reduce repeated
reading and reviewer overlap without weakening required review depth.

Use a single runtime protocol per loop:

- if root `AGENTIC_LOOP.md` exists, treat it as the runtime protocol;
- use the global skill protocol for bootstrap, updates, or debugging the skill
  itself, not as a second protocol inside reviewer prompts;
- do not load both project and global protocols into reviewer prompts.

Before dispatching reviewers, the owning agent should build a compact reviewer
context packet:

- scope, forbidden scope, and live gates;
- Impact Triage decision and selected reviewer roles;
- changed files, diffstat, and short change summary;
- relevant plan/checklist excerpts, not the full plan when a narrow excerpt is
  enough;
- current evidence summary, commands already run, and known failures;
- finding ledger with open, fixed, duplicate, accepted-risk, and blocked items.

Use exhaustive material finding collection:

- reviewers return every P0/P1/P2 finding found within the assigned scope;
- P3 is omitted unless the user explicitly requested polish;
- reviewers do not stop after the first issue;
- loop mode does not use P2 caps.

Use role fusion when it preserves coverage: for `medium` scope, prefer a single
combined reviewer such as `Contract+Test`, `Runtime+Evidence`, or
`Architecture+Evidence` when the risk axes are adjacent.

After repair, use delta review only as an intermediate accelerator:

- send reviewers the fix diff, open finding ledger, changed surfaces, and
  relevant evidence updates;
- do not re-send unchanged plan/spec/checklist content unless the previous
  finding touched that contract;
- final acceptance still requires full spec/plan/checklist replay against the
  implementation, traceability matrix, verification matrix, finding ledger, and
  evidence.

The owning agent owns deduplication through the finding ledger. Reviewers should
return overlapping findings when they have independent evidence; the owning
agent marks duplicates after collection.

### Loop State Artifacts

For medium, large, and critical loops, maintain compact state artifacts in the
evidence file or in clearly linked evidence-adjacent files. These artifacts are
the shared memory of the loop; reviewers should receive these instead of the
full conversation or full evidence history when possible.

Prefer canonical sidecar files under `.agentic-loop/` when the evidence file
would otherwise grow large:

- `.agentic-loop/context.md` for the latest reviewer context packet;
- `.agentic-loop/findings.md` for the finding ledger;
- `.agentic-loop/verification.md` for the verification matrix;
- `.agentic-loop/traceability.md` for the traceability matrix;
- `.agentic-loop/delta.md` for the latest delta review packet.

Keep the evidence file as the index: link these files from `Loop state
artifacts:` and keep only the rolling state plus command summaries inline.

#### Reviewer Context Packet Template

Keep the reviewer context packet short enough to paste into a reviewer prompt.
Target 80 lines or fewer unless the plan scope is critical.
Use `scripts/draft-context-packet.mjs --project . --evidence EVIDENCE_FILE
--max-lines 80 --max-files 40 --include TARGET_SCOPE --scope "current slice"`
when available. Use repeated `--include` and `--exclude` flags so reviewers see
only the scoped worktree surfaces. Add `--forbidden-scope`, `--live-gates`,
`--command`, and `--known-failure` when those values are known; empty sections
are omitted instead of filled with placeholders. The script also reads
`.agentic-loop/findings.md`, `.agentic-loop/verification.md`,
`.agentic-loop/traceability.md`, and `.agentic-loop/delta.md` when present,
prioritizing P0/P1 open findings, `gap_found`, blocked/accepted-risk rows,
failed gates, then TODO rows.

```markdown
Reviewer context packet:
- scope:
- forbidden scope:
- live gates:
- impact triage: size, risk axes, selected roles, omitted roles
- current checklist slice:
- changed files:
- diffstat:
- plan/checklist excerpts:
- current evidence summary:
- commands already run:
- known failures:
- open finding ids:
- accepted risks:
```

Invalidate and rebuild the packet when target scope, selected roles, changed
files, checklist status, open findings, accepted risks, or verification evidence
change materially.

Use stable IDs instead of repeating long prose:

- spec requirements: `SPEC-001`, `SPEC-002`, ...
- plan items: `PLAN-001`, `PLAN-002`, ...
- checklist items: `CHK-001`, `CHK-002`, ...
- verification gates: `GATE-001`, `GATE-002`, ...
- findings: `FIND-001`, `FIND-002`, ...

When practical, record a short content hash for every spec, plan, and checklist
item in the traceability matrix. Hashes may help detect drift, but they do not
replace the final full replay.
Use `scripts/build-traceability-index.mjs --spec SPEC_FILE --plan PLAN_FILE
--checklist CHECKLIST_FILE --existing .agentic-loop/traceability.md` when
creating or refreshing item IDs and hashes. Reuse existing IDs by hash before
assigning new ones so plan insertions do not force later rows to churn.
Headings are not indexed by default; pass `--include-headings` only when
headings are actionable plan/checklist items.
For large plans, use `--section`, `--ids`, and `--status` to emit only the
active slice or replay target.

#### Finding Ledger Schema

Track every P0/P1/P2 finding in a compact ledger. Do not rely on prose history
alone.

```markdown
| id | severity | status | root cause | affected files | duplicate of | fixed by | verified by | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Allowed statuses: `open`, `fixed`, `duplicate`, `accepted_risk`, `blocked`.

#### Verification Matrix

Maintain a matrix that maps changed surfaces to required proof. Use it to avoid
both over-running broad checks and under-running required checks.

```markdown
| changed surface | required command or gate | last result | required before stop | notes |
| --- | --- | --- | --- | --- |
```

Examples: contract changes require contract tests and typecheck; workflow
changes require worker/workflow tests and any Temporal gate required by the
plan; browser flow changes require targeted UI or Playwright proof.

#### Traceability Matrix

Track spec, plan, and checklist execution explicitly so final replay can verify
the full table against code and evidence.

```markdown
| spec id | plan id | checklist id | item hash | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
```

Allowed statuses: `implemented_and_verified`, `implemented_fail_closed`,
`blocked_live_or_external_gate`, `accepted_risk`, `not_in_scope_with_reason`,
`gap_found`.

Final replay must read the original spec, plan, checklist, all traceability
rows, every open or recently fixed finding, every blocked or accepted-risk row,
the verification matrix, and evidence.

#### Delta Review Packet

After repairs, a delta packet may accelerate intermediate re-review. It is not
final acceptance evidence.

```markdown
Delta review packet:
- fixed finding ids:
- patch summary:
- changed files since last review:
- verification rerun:
- remaining open findings:
- new or changed risks:
```

#### Rolling Current State

Keep a compact `Current State` block at the top of the evidence file. Move older
round detail below it as archive/history. Reviewers should receive `Current
State`, the relevant state artifacts, and the latest delta rather than the full
evidence history.

```markdown
## Current State

- active slice:
- runtime protocol:
- artifact source:
- spec/plan/checklist ids changed:
- artifact completeness gate status:
- open findings:
- accepted risks:
- verification matrix status:
- traceability matrix status:
- latest delta packet:
```

#### Architecture Orientation

When the project has `ARCHITECTURE.md` or `docs/ARCHITECTURE.md`, bootstrap and
context-packet helpers should include a compact Architecture Orientation block.
Use it as the first map for ownership, stack, runtime/data-flow boundaries,
forbidden shortcuts, and reviewer-role selection.

The owning agent should read the compact Architecture Orientation before Impact
Triage. Read the full architecture document only when the active slice touches
unclear ownership, cross-package boundaries, workflow/runtime behavior,
persistence, browser-facing data flow, or a forbidden shortcut.

Reviewer packets should include the Architecture Orientation unless the user
explicitly disables it or the scope is docs-only and architecture-independent.
Subagents should receive the compact orientation plus exact target files rather
than the full architecture document by default.

#### Read Budget And Output Budget

Reviewer read budget:

- default: reviewer context packet, finding ledger, relevant matrix rows, and
  exact files in scope;
- extra files are allowed only to validate a concrete finding or resolve a
  stated uncertainty;
- every reviewer must report `Extra files read: none` or list paths with a
  reason.

Evidence output budget:

- summarize command output in 3-8 lines;
- keep exact command, exit status, and decisive failure/success lines;
- link or name full logs/artifacts instead of pasting them;
- do not paste long diffs, generated files, dependency logs, or full test output
  unless the exact content is the finding.

Use `scripts/validate-loop-state.mjs --evidence EVIDENCE_FILE` before final
replay and before stopping when available.

## Progress Beacons

Progress Beacons are mandatory user-visible chat/commentary updates during the
loop, but they are intentionally sparse. Emit exactly one beacon per review
cycle, after reviewer batches are deduplicated and before repair starts. Do not
emit separate beacons after orientation, implementation, verification, or final
replay. Writing the same information only into the evidence file or
`.agentic-loop` sidecars does not satisfy this requirement.

The beacon answers only three questions:

- how many findings exist by severity, including P0 when present;
- which short classes of problems were found;
- what the owning agent will repair or verify next.

If a review cycle has no findings, still emit one compact no-findings beacon.
The only extra user-visible update allowed outside this cadence is a hard
blocker that requires user input, credentials, or approval.

Default format:

```text
Progress Beacon:
Review Cycle N:
- findings: P0=0 P1=0 P2=0 P3=0
- classes: short issue classes, or none
- repair now: concrete fixes or verification next
```

Do not paste long logs, diffs, secrets, or raw credential values. Continue
working after the beacon unless the user explicitly says to pause, stop, or
change direction.

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
implementation, then start the loop immediately unless the user asked only to
draft planning documents.

## Implementation-First Contract

Once `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE` exist, the loop starts from
execution, not review.

Required behavior:

- the owning agent executes the next incomplete or weak checklist slice before
  asking reviewers to challenge it;
- review rounds validate and repair completed implementation slices; they do
  not replace checklist-driven execution;
- reviewers must not become the primary drivers of implementation scope;
- new work discovered by reviewers must map back to the spec, plan, or
  checklist, or be recorded as an explicit artifact gap before implementation;
- the loop cannot stop because review is clean if checklist items remain
  unimplemented, unverified, unblocked, or unaccepted as risk.

## Canonical User Prompt

```text
Run the implementation loop with embedded review for:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:
- EVIDENCE_FILE:

Implement the plan, then review and repair until the stop criteria are met.
Dispatch reviewer subagents according to Impact Triage.
Fix all P0/P1 findings. Fix P2 findings unless they are explicitly recorded as accepted risk.
Do not stop after the first pass.
```

The phrase `Dispatch reviewer subagents` is intentional. In loop mode,
`$agentic-loop` itself is the user's explicit authorization for reviewer
subagents unless the same request disables them.

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

- read `AGENTIC_LOOP.md`, current evidence state, active traceability rows,
  and governing docs relevant to the target scope;
- open full spec, plan, or checklist text only when active rows/excerpts are
  missing, stale, ambiguous, risky, or marked as gap/blocked/accepted-risk;
- inspect current code before editing;
- implement the next checklist item or repair batch;
- keep changes scoped;
- run relevant tests;
- update checklist and evidence only when implementation is actually verified;
- integrate reviewer findings.

The owning agent must keep the plan moving. Reviewers validate completed slices
and identify gaps, but they do not own the implementation roadmap.

### Candidate Review Roles

Select from these roles according to Impact Triage. Run selected roles with
visible reviewer subagents by default in loop mode. Perform selected roles
sequentially as self-review only when the subagent tool is unavailable, the user
explicitly disables subagents, or Impact Triage records that spawning a child
would be unsafe.

- **Architecture Reviewer**: spec drift, ownership boundaries, hidden fallbacks,
  silent degradation, legacy-direct paths, duplicated architecture, missing
  architecture docs.
- **Artifact Completeness Reviewer**: spec, plan, and checklist are detailed
  enough to implement without guessing; every material item has scope, owned
  surface, observable behavior, acceptance criteria, and verification proof.
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
- **Final Plan Replay Reviewer**: matrix-first plan replay; changed, risky,
  missing-proof, open-finding, accepted-risk, blocked, and sampled rows match
  implementation, verification, blocked status, or accepted risk; documented
  commands and environment contracts do not drift from runtime reality;
  features are not merely documented; checked items use direct proof when
  practical; blocked items should not be implementable now.

## Round Algorithm

### Round 0: Orientation

1. Ensure root `AGENTIC_LOOP.md` exists; auto-bootstrap it if missing.
2. Read `AGENTIC_LOOP.md`, its Architecture Orientation, the current evidence state, and the plan/checklist
   rows needed for the active slice. Read full spec/plan/checklist text only
   when matrix rows or excerpts are missing, changed, risky, or ambiguous.
3. Resolve or create `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE`.
4. Run the Artifact Completeness Gate. If it fails, revise the artifacts before
   product code changes.
5. Run Impact Triage and choose review depth, reviewer roles, and max rounds.
6. Build the reviewer context packet and initialize or update the finding
   ledger, verification matrix, and traceability matrix.
7. Run `git status --short`.
8. Identify unrelated dirty worktree changes.
9. Build a local round plan from the checklist.
10. Do not emit a Progress Beacon during orientation; record scope, architecture
   owner map, selected reviewer roles, and immediate implementation slice in
   evidence or `.agentic-loop` state.

### Round 1: Implementation Pass

1. Execute the next incomplete or weak checklist slice. If no slice has been
   implemented yet, do not start with a broad review pass.
2. Prefer tests before implementation for new or risky behavior.
3. Make narrowly scoped edits.
4. Run the smallest relevant verification command.
5. Update checklist and evidence only after verification.
6. Do not emit a Progress Beacon after implementation; record changed files,
   verification result, and selected reviewer roles in evidence or sidecars.

### Round 2: Independent Review Pass

Dispatch or perform the reviewer roles selected by Impact Triage. Reviewers
validate completed implementation slices against the supplied plan. They do not
choose new product scope.

When reviewer batches finish, emit the single review-cycle Progress Beacon with
finding counts by severity, short problem classes, and the repair order.

Findings must include:

```text
## Finding N
Severity: P0 | P1 | P2 | P3
Files: path:line
Plan item: exact checklist or plan item
Problem: concise explanation
Required fix: concrete change
Suggested verification: exact command or assertion
```

### Reviewer Finding Batch Rules

Reviewers must batch material findings instead of stopping after the first good
issue.

Rules:

- return every P0/P1/P2 finding found within the assigned scope;
- omit P3 unless the user explicitly requested polish;
- do not stop after the first finding;
- if several findings have the same root cause, group them into one finding
  with multiple affected locations;
- if a finding overlaps another reviewer role, still return it when this
  reviewer has independent evidence or a role-specific angle;
- deduplication happens in the owning agent after all reviewer batches are
  collected, not inside individual reviewers;
- end with `No more material findings within scope`.

### Round 3: Repair Pass

1. Sort by severity.
2. Fix all P0/P1 first.
3. Fix P2 unless accepted risk is justified.
4. Add regression tests where practical.
5. Update evidence with fixes and verification.
6. Do not emit a Progress Beacon after repair; record fixed finding ids,
   deferred or accepted P2 candidates, and verification to rerun in evidence.

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

Do not emit a Progress Beacon after verification. Record command results,
blocked live gates, and broader verification needs in evidence or sidecars.

### Round 5: Final Adversarial Spec/Plan/Checklist Replay

Replay the user's manual audit prompt:

```text
Take the plan and go point by point. For each point, analyze how well it is implemented, find gaps, and fix them immediately.
```

Read the original spec, plan, checklist, traceability matrix, verification
matrix, finding ledger, and evidence. Hashes may help detect drift, but they do
not replace full replay.

For every replayed row, classify it as:

- `implemented_and_verified`;
- `implemented_fail_closed`;
- `blocked_live_or_external_gate`;
- `accepted_risk`;
- `not_in_scope_with_reason`;
- `gap_found`.

For every documented command, environment variable, URL, port, feature flag, or
mode, verify that code implements it, tests prove it, it is blocked, or it is
accepted as risk.

Fix every `gap_found` item immediately unless it is a live/external gate that
cannot be run silently. If replay fixes any P0/P1/P2, append evidence and run at
least one additional review round.

### Round 6: Red-Team Evidence Audit

Try to disprove completion before stopping. Look for stale checked items,
skipped gates, hidden fallbacks, undocumented deviations, claims without
commands, accepted risks without required detail, and untraced
spec/plan/checklist rows.

The loop may only stop after a clean final replay, a clean red-team evidence
audit, and one subsequent clean review round.

Do not emit a Progress Beacon before final replay. If final replay finds gaps,
record them as findings and include them in the next review-cycle beacon.

## Next Round Decision

Start another review round when any are true:

- a P0/P1 finding was fixed in the previous round;
- a P2 finding was fixed and the affected area has not been re-reviewed;
- a spec, plan, or checklist artifact was created or materially changed;
- checklist items changed from unchecked to checked;
- evidence was materially updated;
- verification exposed a new failure;
- implementation touched architecture, runtime, contract, or E2E boundaries;
- final plan replay found any gap;
- red-team evidence audit found any gap;
- a documented command, environment flag, URL, port, or mode was corrected.
- the finding ledger changed status for any P0/P1/P2 item.

## Stop Criteria

Stop only when all are true:

- every spec requirement, plan item, and checklist item in scope is
  implemented and verified, fail-closed, blocked by a live/external gate,
  accepted as risk, or explicitly out of scope with reason;
- artifact completeness gate passed before product code changes, or the
  remaining blocker is explicitly recorded and no product code changes were
  made beyond planning artifacts;
- every implemented slice traces back to the spec, plan, and checklist;
- no open P0/P1 findings;
- all P2 findings fixed or recorded as accepted risk;
- relevant tests, typecheck, lint, format, and diff checks pass or are
  explicitly blocked;
- evidence records verification commands and outcomes;
- evidence records the Impact Triage decision and selected review depth;
- evidence records context packet, finding ledger status, verification matrix,
  and traceability matrix;
- live gates are passed or explicitly left open as opt-in gates;
- full final adversarial spec/plan/checklist replay is recorded and clean;
- red-team evidence audit is recorded and clean;
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
## Current State

- active slice:
- runtime protocol:
- artifact source:
- spec/plan/checklist ids changed:
- artifact completeness gate status:
- open findings:
- accepted risks:
- verification matrix status:
- traceability matrix status:
- latest delta packet:

## Agentic Review Loop Round N, YYYY-MM-DD

Scope:
- SPEC_FILE:
- PLAN_FILE:
- CHECKLIST_FILE:
- EVIDENCE_FILE:

Planning artifact status:
- source: user-supplied | checklist-expanded | auto-authored
- no-variant spec:
- implementation plan:
- checklist:
- artifact completeness gate:
- traceability coverage:

Impact triage:
- size:
- risk axes:
- selected reviewer roles:
- omitted reviewer roles:
- max rounds:

Context and state controls:
- context packet:
- finding ledger:
- delta review packets:
- final replay mode: full spec/plan/checklist replay

Implementation progress:
- checklist slice executed:
- traceability:
- verification:

Loop state artifacts:
- reviewer context packet:
- finding ledger:
- verification matrix:
- traceability matrix:
- delta review packet:

Read and output budget:
- reviewer read mode: packet-only | targeted-extra | scope-expanded
- extra files read:
- command output summary:
- full logs/artifacts:

Review roles run (selected roles only; omitted roles must be explained in
Impact triage):
- Architecture reviewer:
- Artifact completeness reviewer:
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:
- Red-team evidence auditor:

Reviewer batch status:
- status: no more material findings within scope

Findings:
- P0:
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

Red-team evidence audit:
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

For required reviewer subagent dispatch:

- choose reviewer count and roles from Impact Triage instead of using a fixed
  number of agents;
- send each reviewer a compact context packet instead of the full conversation
  or full planning corpus when a narrow packet is enough;
- use role fusion for `medium` scope when one combined reviewer can cover the
  selected risk axes without losing coverage;
- use delta review only as an intermediate repair accelerator; final acceptance
  always requires full spec/plan/checklist replay;
- give each subagent exact files, scope, forbidden scope, and governing
  invariants;
- do not ask two agents to edit the same files at the same time unless write
  ownership is explicitly disjoint;
- prefer read-only reviewer subagents after each implementation pass;
- keep architectural decisions with the owning agent;
- keep implementation-scope ownership with the owning agent;
- do not delegate the immediate critical-path blocker if the owning agent can
  fix it directly faster;
- treat subagents as visible ephemeral workers, not durable project chats or
  chat-history items;
- spawn normal Codex App subagents so their names and active status are visible
  in the status panel; pass the compact context packet and use full-thread
  context only when explicitly required by the task;
- keep each spawned child open while it is actively running so Codex App can
  show active subagent status in the status panel;
- after `wait_agent` returns a result, call `close_agent` for that child once
  findings or patches are integrated;
- do not leave idle, completed, failed, or superseded subagents open across a
  repair round, batch boundary, commit, or final response.

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

Before stopping or committing a completed batch, verify that no spawned
subagents remain open. If a subagent cannot be closed, record it as a blocked
operational issue and do not claim the loop is fully closed.

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
Ran the implementation loop with embedded review for <plan>.

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
