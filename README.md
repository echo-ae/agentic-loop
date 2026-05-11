# Agentic Reviewer Loop

A portable Codex App skill for running implementation work as a bounded loop:

1. implement from an approved spec, plan, and checklist;
2. review with independent roles;
3. repair all P0/P1 findings and unresolved P2 findings;
4. verify with evidence;
5. replay the plan point by point before stopping.

The reusable skill is project-agnostic. Each target repository should also keep a
project-local root `AGENTIC_LOOP.md` runbook with its own architecture rules,
verification commands, live gates, and accepted-risk policy.

## Repository Layout

```text
.
├── README.md
├── LICENSE
├── package.json
├── scripts/
│   ├── install-macos.sh
│   └── validate-skill.mjs
└── skills/
    └── agentic-reviewer-loop/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── references/
        │   ├── bootstrap-guide.md
        │   ├── loop-protocol.md
        │   ├── project-runbook-template.md
        │   └── reviewer-prompts.md
        └── scripts/bootstrap-project-runbook.mjs
```

## Install In Codex App On macOS

From this repository root:

```bash
./scripts/install-macos.sh --symlink
```

Use `--copy` instead of `--symlink` if you want Codex to use a snapshot of the
skill rather than the working tree:

```bash
./scripts/install-macos.sh --copy
```

The installer writes to:

```text
$CODEX_HOME/skills/agentic-reviewer-loop
```

If `CODEX_HOME` is not set, it defaults to:

```text
$HOME/.codex
```

Restart Codex App after installing or updating the skill.

## Install From A Future GitHub Repository

After publishing this repository, Codex can install the skill by path:

```bash
python3 "$HOME/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo OWNER/REPO \
  --path skills/agentic-reviewer-loop
```

Replace `OWNER/REPO` with the published repository.

## Usage

When loop mode starts, the skill expects a root `AGENTIC_LOOP.md`. If it is
missing, the agent should bootstrap it automatically before running the loop.

Bootstrap a project-local runbook:

```text
$agentic-reviewer-loop bootstrap this project
```

Run a bounded agentic review loop:

```text
$agentic-reviewer-loop run the agentic review loop for:
- SPEC_FILE: docs/123-feature-no-variant-spec.md
- PLAN_FILE: docs/124-feature-implementation-plan.md
- CHECKLIST_FILE: docs/125-feature-checklist.md
- EVIDENCE_FILE: docs/126-feature-evidence.md
Use subagents for independent review.
Fix all P0/P1. Fix P2 or record accepted risk.
```

The skill intentionally separates two layers:

- global method: this repository;
- project contract: generated and then maintained inside each target project.

## Bootstrap Script

The skill includes a deterministic project scanner:

```bash
node skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs \
  --project /path/to/project
```

The script does not read `.env` files. It inspects project metadata, package
scripts, known config files, docs, and CI definitions, then creates a draft
runbook. Codex should refine that draft after reading the project architecture
and migration docs.

## Validation

Run:

```bash
npm run validate
```

This checks that the installable skill has the required structure and metadata.
