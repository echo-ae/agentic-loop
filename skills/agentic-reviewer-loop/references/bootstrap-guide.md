# Bootstrap Guide

Bootstrap creates a project-local root `AGENTIC_LOOP.md` for a target
repository. The generated file is a draft: Codex must refine it after reading
the project's architecture, contributor rules, plans, CI, and test commands.

## When To Bootstrap

Bootstrap when:

- the user asks to add implementation-loop-with-review support to a project;
- a repository has approved specs/plans/checklists but no root `AGENTIC_LOOP.md`;
- an existing runbook is stale or too generic to guide verification.

Do not overwrite an existing project runbook silently.

The only canonical output path is root `AGENTIC_LOOP.md`. Do not create
alternate runbook paths. If a legacy/noncanonical runbook already exists, treat
it as source material to migrate into root `AGENTIC_LOOP.md`, not as the active
canonical file.

## Command

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project /path/to/project
```

Preview:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project /path/to/project \
  --dry-run
```

Overwrite intentionally:

```bash
node "$CODEX_HOME/skills/agentic-reviewer-loop/scripts/bootstrap-project-runbook.mjs" \
  --project /path/to/project \
  --output /path/to/project/AGENTIC_LOOP.md \
  --force
```

## What The Script Inspects

- `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and similar agent rules;
- `README.md`, `ARCHITECTURE.md`, and docs folders;
- root and workspace `package.json` scripts;
- known configs: Playwright, Vitest, Jest, Next.js, Vite, TypeScript, ESLint,
  Prettier, Docker Compose, Temporal configs, CI workflows;
- top-level `apps/`, `packages/`, `services/`, and `libs/` layout;
- environment variable names mentioned in scripts and docs.

The script intentionally does not read `.env` files.

## Model Refinement Checklist

After generation, Codex should:

1. Read the generated draft.
2. Read the project's governing docs and active migration plans.
3. Replace weak guesses with exact project rules.
4. Add project-specific default verification commands.
5. Add live gates and credentials policy without exposing secrets.
6. Add forbidden scopes and architecture boundaries.
7. Add accepted-risk rules and evidence file conventions.
8. Run a lightweight verification that the documented commands exist.

## Canonical Local File

The canonical project-local file is:

- `AGENTIC_LOOP.md`

Keep it in the repository root. Project-specific docs may link to it, but do
not create competing runbook paths.
