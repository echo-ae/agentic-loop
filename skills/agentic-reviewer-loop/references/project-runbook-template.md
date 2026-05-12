# Agentic Implementation Review Loop Runbook

Status: Draft

Purpose: define the project-specific workflow for turning an approved spec,
plan, and checklist into shipped, verified work. This is an implementation-first
loop with embedded review, not a review-only workflow.

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

## 5. Implementation-First Contract

When `SPEC_FILE`, `PLAN_FILE`, and `CHECKLIST_FILE` are supplied, the loop
starts from execution, not review.

Required behavior:

- the owning agent executes the next incomplete or weak checklist slice before
  asking reviewers to challenge it;
- review rounds validate and repair completed implementation slices; they do
  not replace checklist-driven execution;
- reviewers must not become the primary drivers of implementation scope;
- new work discovered by reviewers must map back to the supplied spec, plan, or
  checklist, or be recorded as an explicit plan gap before implementation;
- the loop cannot stop because review is clean if checklist items remain
  unimplemented, unverified, unblocked, or unaccepted as risk.

## 6. When To Use The Loop

Use the loop only when:

- an approved no-variant spec, implementation plan, and checklist exist;
- the task is large enough that one implementation pass is unlikely to be
  enough;
- the user wants multiple review and repair passes;
- stop criteria are explicit.

Do not use it for tiny fixes, quick answers, or unapproved exploratory work.

## 7. Impact Triage

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

## 8. Token And Latency Efficiency Rules

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

Adaptive P2 caps:

- `small`: all P0/P1, top 0-2 P2;
- `medium`: all P0/P1, top 3 P2;
- `large`: all P0/P1, top 5 P2;
- `critical`: all P0/P1, top 7 P2.

For `medium` scope, prefer role fusion when it preserves coverage, such as
`Contract+Test`, `Runtime+Evidence`, or `Architecture+Evidence`.

After repairs, prefer delta-only re-review. Send reviewers the fix diff, open
finding ledger, changed surfaces, and relevant evidence updates. Run a full
re-review only when repairs changed architecture, runtime, contracts,
persistence, E2E boundaries, or final replay found a gap.

### Loop State Artifacts

For medium, large, and critical loops, maintain compact state artifacts in the
evidence file or in clearly linked evidence-adjacent files.

Reviewer context packet target: 80 lines or fewer unless scope is critical.

```markdown
Reviewer context packet:
- scope:
- forbidden scope:
- live gates:
- impact triage:
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

Use stable IDs instead of repeating long prose:

- plan items: `PLAN-001`, `PLAN-002`, ...
- checklist items: `CHK-001`, `CHK-002`, ...
- verification gates: `GATE-001`, `GATE-002`, ...
- findings: `FIND-001`, `FIND-002`, ...

When practical, record a short content hash for every plan/checklist item in the
traceability matrix.

Finding ledger:

```markdown
| id | severity | status | root cause | affected files | duplicate of | fixed by | verified by | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Verification matrix:

```markdown
| changed surface | required command or gate | last result | required before stop | notes |
| --- | --- | --- | --- | --- |
```

Traceability matrix:

```markdown
| id | item hash | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- | --- |
```

Delta review packet:

```markdown
- fixed finding ids:
- patch summary:
- changed files since last review:
- verification rerun:
- remaining open findings:
- new or changed risks:
```

Rolling current state:

```markdown
## Current State

- active slice:
- runtime protocol:
- plan/checklist ids changed:
- open findings:
- accepted risks:
- verification matrix status:
- traceability matrix status:
- latest delta packet:
```

Reviewer read budget defaults to the context packet, finding ledger, relevant
matrix rows, and exact files in scope. Extra files are allowed only to validate a
concrete finding or resolve a stated uncertainty.

Evidence output budget: summarize command output in 3-8 lines, keep exact
command and exit status, and link full logs/artifacts instead of pasting them.

## 9. Review Roles

Use the global skill roles unless this project overrides them:

- Implementation agent:
- Architecture reviewer:
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:

The owning agent must keep the plan moving. Reviewers validate completed slices
and identify gaps, but they do not own the implementation roadmap.

## 10. Verification Commands

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

## 11. Live Gates

Live or external checks are opt-in unless the user explicitly authorizes them.

- ...

## 12. Evidence Rules

Evidence file format:

```markdown
## Current State

- active slice:
- runtime protocol:
- plan/checklist ids changed:
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

Impact triage:
- size:
- risk axes:
- selected reviewer roles:
- omitted reviewer roles:
- max rounds:

Token and latency controls:
- context packet:
- adaptive P2 cap:
- re-review mode: full | delta
- finding ledger:

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
- Runtime reviewer:
- Contract and boundary reviewer:
- Test and E2E reviewer:
- Evidence reviewer:
- Final plan replay reviewer:

Reviewer batch status:
- cap:
- status: no more material findings | stopped at finding cap

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

## 13. Checklist Update Rules

Only check an item when:

- implementation exists;
- a relevant test or verification command proved it;
- the evidence file records that proof.

Do not check items because code "looks done". Do not leave stale checked items
after finding a gap.

## 14. Subagent Dispatch Rules

When subagents are used:

- choose reviewer count and roles from Impact Triage instead of using a fixed
  number of agents;
- send each reviewer a compact context packet instead of the full conversation
  or full planning corpus when a narrow packet is enough;
- use role fusion for `medium` scope when one combined reviewer can cover the
  selected risk axes without losing coverage;
- use delta-only re-review after repairs unless the changed surface requires a
  full re-review;
- give each subagent exact files, scope, forbidden scope, and governing
  invariants;
- prefer read-only reviewer subagents after implementation passes;
- keep architectural decisions with the owning agent;
- keep implementation-scope ownership with the owning agent;
- do not delegate the immediate critical-path blocker when the owning agent can
  fix it directly faster;
- close subagents when their findings have been integrated.

## 15. Reviewer Finding Batch Rules

Reviewers must batch material findings instead of stopping after the first good
issue.

Rules:

- return every P0/P1 finding found within the assigned scope;
- return P2 findings up to the adaptive cap set by Impact Triage;
- omit P3 unless the user explicitly requested polish;
- do not stop after the first finding;
- group same-root-cause findings into one finding with multiple affected
  locations;
- return overlapping findings when the reviewer has independent evidence or a
  role-specific angle;
- deduplication happens in the owning agent after all reviewer batches are
  collected;
- end with `No more material findings within scope` or
  `Stopped at finding cap`.

## 16. Failure Handling

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

## 17. Next Round Decision

Start another review round when any of these are true:

- a P0/P1 finding was fixed;
- a P2 finding was fixed and the affected area has not been re-reviewed;
- checklist items changed from unchecked to checked;
- evidence was materially updated;
- verification exposed a new failure;
- architecture, runtime, contract, or E2E boundaries changed;
- final plan replay found a gap;
- a documented command, environment flag, URL, port, or mode was corrected.
- the finding ledger changed status for any P0/P1/P2 item.

## 18. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

## 19. Stop Criteria

The loop may stop only when:

- every checklist item in scope is checked, blocked, or accepted as risk;
- every implemented slice traces back to the supplied spec, plan, or checklist;
- no open P0/P1 findings remain;
- all P2 findings are fixed or recorded as accepted risk;
- verification required by this file has passed or is explicitly blocked;
- evidence records commands and outcomes;
- evidence records the Impact Triage decision and selected review depth;
- evidence records token/latency controls: context packet, adaptive P2 cap,
  re-review mode, and finding ledger status;
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

## 20. Escaped Findings

If a later manual pass finds a P0/P1/P2 after the loop stopped:

1. fix it;
2. record it as escaped;
3. state which role or criterion missed it;
4. strengthen this runbook or the narrower plan/checklist when process failed;
5. restart the stability requirement.

## 21. Final Response Requirements

The final answer must state:

- what changed;
- what was verified;
- what remains;
- every P2 accepted risk, or explicitly that there are none;
- every escaped finding handled, or explicitly that there were none.

Do not say "complete" if an acceptance gate remains open.
