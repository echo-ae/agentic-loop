#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ENV_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test"
]);

const DEFAULT_OUTPUT = "AGENTIC_LOOP.md";
const ARCHITECTURE_DOC_CANDIDATES = ["ARCHITECTURE.md", "docs/ARCHITECTURE.md", "docs/architecture.md"];
const ARCHITECTURE_SIGNAL_PATTERN =
  /\b(architecture|stack|boundary|owner|ownership|runtime|workflow|temporal|database|postgres|projection|contract|package|app|service|adapter|integration|source of truth|forbidden|must|must not|do not|invariant|queue|worker|api|route|data flow|publication|tracker)\b/i;

function parseArgs(argv) {
  const args = {
    project: process.cwd(),
    output: undefined,
    dryRun: false,
    force: false,
    selfContained: false,
    includeAllScripts: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      args.project = argv[++index];
    } else if (arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--self-contained") {
      args.selfContained = true;
    } else if (arg === "--include-all-scripts") {
      args.includeAllScripts = true;
    } else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  bootstrap-project-runbook.mjs --project PATH [--output PATH] [--dry-run] [--force]

Options:
  --project PATH  Target repository. Defaults to current directory.
  --output PATH   Output file. Defaults to PROJECT/${DEFAULT_OUTPUT}.
  --dry-run       Print generated runbook instead of writing it.
  --force         Overwrite output when it exists.
  --self-contained
                  Generate the full standalone protocol. Default output is compact
                  and project-specific, assuming the global skill is available.
  --include-all-scripts
                  Include every root package.json script in compact output.
                  Default compact output lists only preferred verification scripts.

The scanner never reads .env files.`);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(projectRoot, relativePath, maxBytes = 120_000) {
  const fullPath = path.join(projectRoot, relativePath);
  if (!(await pathExists(fullPath))) {
    return undefined;
  }
  if (ENV_FILE_NAMES.has(path.basename(relativePath))) {
    return "[redacted env file not read]";
  }
  const fileStat = await stat(fullPath);
  if (!fileStat.isFile()) {
    return undefined;
  }
  const raw = await readFile(fullPath);
  return raw.subarray(0, maxBytes).toString("utf8");
}

async function listDirNames(projectRoot, relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  if (!(await pathExists(fullPath))) {
    return [];
  }
  const entries = await readdir(fullPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .sort();
}

function parsePackageScripts(packageJsonText) {
  if (!packageJsonText) {
    return {};
  }
  try {
    const parsed = JSON.parse(packageJsonText);
    const scripts = parsed && typeof parsed === "object" ? parsed.scripts : undefined;
    if (!scripts || typeof scripts !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(scripts).filter(([, value]) => typeof value === "string")
    );
  } catch {
    return {};
  }
}

function parsePackageJson(packageJsonText) {
  if (!packageJsonText) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(packageJsonText);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function hasDependency(packageJsonText, dependencyName) {
  const parsed = parsePackageJson(packageJsonText);
  if (!parsed) {
    return false;
  }
  return [
    parsed.dependencies,
    parsed.devDependencies,
    parsed.peerDependencies,
    parsed.optionalDependencies
  ].some((deps) => deps && Object.prototype.hasOwnProperty.call(deps, dependencyName));
}

function hasDependencyInAny(packageJsonTexts, dependencyName) {
  return packageJsonTexts.some((packageJsonText) => hasDependency(packageJsonText, dependencyName));
}

function collectEnvNames(texts) {
  const envNames = new Set();
  const envPattern = /\b[A-Z][A-Z0-9_]{2,}\b/g;
  for (const text of texts.filter(Boolean)) {
    for (const match of text.matchAll(envPattern)) {
      const name = match[0];
      if (
        name.includes("KEY") ||
        name.includes("TOKEN") ||
        name.includes("SECRET") ||
        name.includes("URL") ||
        name.includes("DATABASE") ||
        name.startsWith("E2E_") ||
        name.includes("LIVE") ||
        name.includes("TEMPORAL")
      ) {
        envNames.add(name);
      }
    }
  }
  return [...envNames].sort();
}

function compactArchitectureLine(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^#+\s+/, "")
    .trim()
    .slice(0, 220);
}

async function collectArchitectureOrientation(projectRoot, architectureDocs) {
  const docs = architectureDocs.length > 0 ? architectureDocs : ARCHITECTURE_DOC_CANDIDATES;
  const sourceDocs = [];
  const headings = [];
  const signals = [];

  for (const relativePath of docs) {
    const text = await readTextIfExists(projectRoot, relativePath, 90_000);
    if (!text) {
      continue;
    }
    sourceDocs.push(relativePath);
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (heading && headings.length < 16) {
        const level = heading[1].length;
        const title = compactArchitectureLine(heading[2]);
        headings.push(`${relativePath}:${lineNumber} ${"  ".repeat(Math.max(0, level - 1))}${title}`);
        continue;
      }
      const normalized = compactArchitectureLine(line);
      if (
        normalized &&
        normalized.length >= 24 &&
        ARCHITECTURE_SIGNAL_PATTERN.test(normalized) &&
        signals.length < 24
      ) {
        signals.push(`${relativePath}:${lineNumber} ${normalized}`);
      }
    }
  }

  if (sourceDocs.length === 0) {
    return "";
  }

  return `Source docs:
${listOrNone(unique(sourceDocs))}

Key headings:
${listOrNone(headings)}

High-signal architecture notes:
${listOrNone(signals)}

Agent use:
- Use this map to pick target-scope governing sections before Impact Triage.
- Expand the original architecture doc only when active scope, ownership, data flow, or forbidden shortcuts are unclear.`;
}

function collectVerificationCommands(scripts) {
  const preferredNames = [
    "typecheck",
    "lint",
    "format:check",
    "test",
    "test:unit",
    "test:integration",
    "test:e2e",
    "e2e",
    "build"
  ];

  return preferredNames
    .filter((name) => scripts[name])
    .map((name) => `npm run ${name}`);
}

function packageNameFromText(packageJsonText) {
  const parsed = parsePackageJson(packageJsonText);
  return typeof parsed?.name === "string" ? parsed.name : undefined;
}

function collectWorkspaceVerificationCommands(workspacePackages) {
  const preferredNames = [
    "typecheck",
    "lint",
    "format:check",
    "test",
    "test:unit",
    "test:integration",
    "test:e2e",
    "build"
  ];

  const commands = [];
  for (const workspacePackage of workspacePackages) {
    const scripts = parsePackageScripts(workspacePackage.text);
    const packageName = packageNameFromText(workspacePackage.text);
    for (const scriptName of preferredNames) {
      if (!scripts[scriptName]) {
        continue;
      }
      if (packageName) {
        commands.push(`npm --workspace ${packageName} run ${scriptName}`);
      } else {
        commands.push(`npm --prefix ${workspacePackage.relativeDir} run ${scriptName}`);
      }
    }
  }
  return commands;
}

function unique(values) {
  return [...new Set(values)];
}

async function detectFiles(projectRoot, candidates) {
  const found = [];
  for (const candidate of candidates) {
    if (await pathExists(path.join(projectRoot, candidate))) {
      found.push(candidate);
    }
  }
  return found;
}

async function inspectProject(projectRoot) {
  const packageJson = await readTextIfExists(projectRoot, "package.json");
  const scripts = parsePackageScripts(packageJson);
  const apps = await listDirNames(projectRoot, "apps");
  const packages = await listDirNames(projectRoot, "packages");
  const services = await listDirNames(projectRoot, "services");
  const libs = await listDirNames(projectRoot, "libs");
  const workspacePackages = [];

  for (const [baseDir, names] of [
    ["apps", apps],
    ["packages", packages],
    ["services", services],
    ["libs", libs]
  ]) {
    for (const name of names) {
      const relativeDir = `${baseDir}/${name}`;
      const text = await readTextIfExists(projectRoot, `${relativeDir}/package.json`);
      if (text) {
        workspacePackages.push({ relativeDir, text });
      }
    }
  }

  const packageJsonTexts = [packageJson, ...workspacePackages.map((workspacePackage) => workspacePackage.text)]
    .filter(Boolean);

  const governingDocs = await detectFiles(projectRoot, [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "ARCHITECTURE.md",
    "CONTRIBUTING.md",
    "docs/architecture.md",
    "docs/ARCHITECTURE.md"
  ]);
  const architectureDocs = governingDocs.filter((docPath) => /(^|\/)architecture\.md$/i.test(docPath));
  const architectureOrientation = await collectArchitectureOrientation(projectRoot, architectureDocs);

  const configs = await detectFiles(projectRoot, [
    "package.json",
    "pnpm-workspace.yaml",
    "yarn.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.ts",
    "vitest.config.ts",
    "jest.config.ts",
    "playwright.config.ts",
    "eslint.config.js",
    "prettier.config.js",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".github/workflows"
  ]);

  const docTexts = await Promise.all(
    ["AGENTS.md", "CLAUDE.md", "README.md", "ARCHITECTURE.md", "package.json"].map((file) =>
      readTextIfExists(projectRoot, file, 80_000)
    )
  );
  const searchableTexts = [...docTexts, ...packageJsonTexts];

  const stack = [];
  if (hasDependencyInAny(packageJsonTexts, "next")) stack.push("Next.js");
  if (hasDependencyInAny(packageJsonTexts, "react")) stack.push("React");
  if (hasDependencyInAny(packageJsonTexts, "typescript")) stack.push("TypeScript");
  if (
    hasDependencyInAny(packageJsonTexts, "@temporalio/workflow") ||
    hasDependencyInAny(packageJsonTexts, "@temporalio/worker")
  ) {
    stack.push("Temporal TypeScript");
  }
  if (hasDependencyInAny(packageJsonTexts, "@playwright/test")) stack.push("Playwright");
  if (hasDependencyInAny(packageJsonTexts, "vitest")) stack.push("Vitest");
  if (hasDependencyInAny(packageJsonTexts, "jest")) stack.push("Jest");

  return {
    projectRoot,
    governingDocs,
    configs,
    apps,
    packages,
    services,
    libs,
    stack,
    architectureOrientation,
    scripts,
    workspaceVerificationCommands: collectWorkspaceVerificationCommands(workspacePackages),
    verificationCommands: collectVerificationCommands(scripts),
    envNames: collectEnvNames(searchableTexts)
  };
}

function listOrNone(values) {
  if (values.length === 0) {
    return "- none detected";
  }
  return values.map((value) => `- ${value}`).join("\n");
}

function scriptTable(scripts) {
  const entries = Object.entries(scripts);
  if (entries.length === 0) {
    return "- none detected";
  }
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, command]) => `- \`${name}\`: \`${command}\``)
    .join("\n");
}

function scriptTableForCommands(scripts, commands) {
  const scriptNames = new Set(
    commands
      .map((command) => command.match(/^npm run ([^\s]+)/)?.[1])
      .filter(Boolean)
  );
  const entries = Object.entries(scripts).filter(([name]) => scriptNames.has(name));
  if (entries.length === 0) {
    return "- none detected";
  }
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, command]) => `- \`${name}\`: \`${command}\``)
    .join("\n");
}

function renderRunbook(context) {
  const today = new Date().toISOString().slice(0, 10);
  const layout = [
    ...context.apps.map((name) => `apps/${name}`),
    ...context.packages.map((name) => `packages/${name}`),
    ...context.services.map((name) => `services/${name}`),
    ...context.libs.map((name) => `libs/${name}`)
  ];

  return `# Agentic Implementation Review Loop Runbook

Status: Draft generated ${today}

Purpose: define the project-specific workflow for turning an approved spec,
plan, and checklist into shipped, verified work. This is an implementation-first
loop with embedded review, not a review-only workflow.

This file extends the global \`$agentic-loop\` skill. It does not
replace feature specs, implementation plans, checklists, evidence files,
architecture docs, or repository instructions.

## 1. Project Identity

- Repository: \`${context.projectRoot}\`
- Detected stack: ${context.stack.length > 0 ? context.stack.join(", ") : "not detected"}
- Detected layout:
${listOrNone(layout)}

Review and refine this section manually. The bootstrap script uses heuristics
and does not understand product intent.

## 2. Governing Documents

Detected:

${listOrNone(context.governingDocs)}

Agents must read the governing docs that apply to the target scope before
starting a loop.

## Architecture Orientation

${context.architectureOrientation || "- none detected"}

Treat this as a compact navigation map, not as a replacement for the source
architecture documents. Expand the original architecture docs when ownership,
data flow, runtime boundaries, or forbidden shortcuts are unclear.

## 3. Detected Config Files

${listOrNone(context.configs)}

## 4. Non-Negotiable Invariants

Replace these draft bullets with project-specific rules:

- Preserve stable public contracts unless the approved plan says otherwise.
- Do not add silent fallbacks or bypasses for required runtime behavior.
- Validate boundary inputs before domain logic.
- Keep evidence synchronized with implementation and verification.

## 5. Required Inputs

Before starting a loop, identify:

- \`SPEC_FILE\`;
- \`PLAN_FILE\`;
- \`CHECKLIST_FILE\`;
- \`EVIDENCE_FILE\`;
- target scope;
- forbidden scope;
- live gates and external dependencies.

If any required planning artifact is missing, create or update it first. Do not
start a multi-round loop from an informal task description alone.

## 6. Implementation-First Contract

When \`SPEC_FILE\`, \`PLAN_FILE\`, and \`CHECKLIST_FILE\` are supplied, the loop
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

## 7. When To Use The Loop

Use the loop only when:

- an approved no-variant spec, implementation plan, and checklist exist;
- the task is large enough that one implementation pass is unlikely to be
  enough;
- the user wants multiple review and repair passes;
- stop criteria are explicit.

Do not use it for tiny fixes, quick answers, or unapproved exploratory work.

## 8. Impact Triage

Before dispatching reviewers, classify the work and record the decision in
evidence.

Size:

- \`small\`: one file, docs-only, localized UI polish, or a narrow test update.
- \`medium\`: several files within one module or one bounded product flow.
- \`large\`: cross-module work, public contracts, persistence, runtime,
  workflows, E2E, migration docs, or external adapters.
- \`critical\`: state corruption risk, external publication, live credentials,
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

- \`small\`: no subagents; owning agent performs labeled self-review.
- \`medium\`: one reviewer focused on the dominant risk axis.
- \`large\`: two or three reviewers with distinct roles.
- \`critical\`: at least three distinct reviewers plus strict final replay; raise
  max rounds only when the user authorizes a bounded extension.

Evidence must record size, risk axes, selected reviewer roles, omitted reviewer
roles, max rounds, and rationale.

## 9. Token And Latency Efficiency Rules

Quality gates take precedence over token savings. These rules reduce repeated
reading and reviewer overlap without weakening required review depth.

Use a single runtime protocol per loop:

- if root \`AGENTIC_LOOP.md\` exists, treat it as the runtime protocol;
- use the global skill protocol for bootstrap, updates, or debugging the skill
  itself, not as a second protocol inside reviewer prompts;
- do not load both project and global protocols into reviewer prompts.

Before dispatching reviewers, the owning agent should build a compact reviewer
context packet:

- scope, forbidden scope, and live gates;
- Architecture Orientation from this runbook unless explicitly irrelevant;
- Impact Triage decision and selected reviewer roles;
- changed files, diffstat, and short change summary;
- relevant plan/checklist excerpts, not the full plan when a narrow excerpt is
  enough;
- current evidence summary, commands already run, and known failures;
- finding ledger with open, fixed, duplicate, accepted-risk, and blocked items.

Adaptive P2 caps:

- \`small\`: all P0/P1, top 0-2 P2;
- \`medium\`: all P0/P1, top 3 P2;
- \`large\`: all P0/P1, top 5 P2;
- \`critical\`: all P0/P1, top 7 P2.

For \`medium\` scope, prefer role fusion when it preserves coverage, such as
\`Contract+Test\`, \`Runtime+Evidence\`, or \`Architecture+Evidence\`.

After repairs, prefer delta-only re-review. Send reviewers the fix diff, open
finding ledger, changed surfaces, and relevant evidence updates. Run a full
re-review only when repairs changed architecture, runtime, contracts,
persistence, E2E boundaries, or final replay found a gap.

### Loop State Artifacts

For medium, large, and critical loops, maintain compact state artifacts in the
evidence file or in clearly linked evidence-adjacent files.

Prefer canonical sidecar files under \`.agentic-loop/\` when inline evidence
would become noisy:

- \`.agentic-loop/context.md\`
- \`.agentic-loop/findings.md\`
- \`.agentic-loop/verification.md\`
- \`.agentic-loop/traceability.md\`
- \`.agentic-loop/delta.md\`

Keep the evidence file as the index by linking these files from \`Loop state
artifacts:\` and keeping only rolling state plus command summaries inline.

Reviewer context packet target: 80 lines or fewer unless scope is critical.
Use \`scripts/draft-context-packet.mjs --project . --evidence EVIDENCE_FILE
--max-lines 80 --max-files 40 --include TARGET_SCOPE --scope "current slice"\`
when available. Use repeated \`--include\` and \`--exclude\` flags to keep
packets scoped to the current work. Add \`--forbidden-scope\`, \`--live-gates\`,
\`--command\`, and \`--known-failure\` when those values are known; empty
sections are omitted instead of filled with placeholders. The script also reads
\`.agentic-loop/findings.md\`, \`.agentic-loop/verification.md\`,
\`.agentic-loop/traceability.md\`, and \`.agentic-loop/delta.md\` when present,
prioritizing P0/P1 open findings, \`gap_found\`, blocked/accepted-risk rows,
failed gates, then TODO rows.

\`\`\`markdown
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
\`\`\`

Use stable IDs instead of repeating long prose:

- plan items: \`PLAN-001\`, \`PLAN-002\`, ...
- checklist items: \`CHK-001\`, \`CHK-002\`, ...
- verification gates: \`GATE-001\`, \`GATE-002\`, ...
- findings: \`FIND-001\`, \`FIND-002\`, ...

When practical, record a short content hash for every plan/checklist item in the
traceability matrix.
Use \`scripts/build-traceability-index.mjs --plan PLAN_FILE --checklist
CHECKLIST_FILE --existing .agentic-loop/traceability.md\` when available, so
stable IDs survive plan insertions and later rounds can review only changed
rows.
Headings are not indexed by default; pass \`--include-headings\` only when
headings are actionable plan/checklist items.
For large plans, use \`--section\`, \`--ids\`, and \`--status\` to emit only
the active slice or replay target.

Finding ledger:

\`\`\`markdown
| id | severity | status | root cause | affected files | duplicate of | fixed by | verified by | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
\`\`\`

Verification matrix:

\`\`\`markdown
| changed surface | required command or gate | last result | required before stop | notes |
| --- | --- | --- | --- | --- |
\`\`\`

Traceability matrix:

\`\`\`markdown
| id | item hash | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- | --- |
\`\`\`

Final replay reads all changed, new, gap, blocked, accepted-risk, and
open-finding rows. For unchanged verified rows, use deterministic hash-based
spot checks instead of rereading the full plan every round.

Delta review packet:

\`\`\`markdown
- fixed finding ids:
- patch summary:
- changed files since last review:
- verification rerun:
- remaining open findings:
- new or changed risks:
\`\`\`

Rolling current state:

\`\`\`markdown
## Current State

- active slice:
- runtime protocol:
- plan/checklist ids changed:
- open findings:
- accepted risks:
- verification matrix status:
- traceability matrix status:
- latest delta packet:
\`\`\`

Reviewer read budget defaults to the context packet, finding ledger, relevant
matrix rows, and exact files in scope. Extra files are allowed only to validate a
concrete finding or resolve a stated uncertainty.

Evidence output budget: summarize command output in 3-8 lines, keep exact
command and exit status, and link full logs/artifacts instead of pasting them.

Use \`scripts/validate-loop-state.mjs --evidence EVIDENCE_FILE\` before final
replay and before stopping when available.

## 10. Progress Beacons

Progress Beacons are mandatory user-visible chat/commentary updates during the
loop, but they are intentionally sparse. Emit exactly one Progress Beacon per
review cycle, after reviewer batches are deduplicated and before repair starts.
Do not emit separate beacons after orientation, implementation, verification,
or final replay. Writing the same information only into the evidence file or
\`.agentic-loop\` sidecars does not satisfy this requirement.

Each beacon should contain only finding counts by severity, short problem
classes, and what will be repaired or verified next. Include P0 when present.
If a review cycle has no findings, emit one compact no-findings beacon. The
only extra user-visible update outside this cadence is a hard blocker that
requires user input, credentials, or approval.

Default format:

\`\`\`text
Progress Beacon:
Review Cycle N:
- findings: P0=0 P1=0 P2=0 P3=0
- classes: short issue classes, or none
- repair now: concrete fixes or verification next
\`\`\`

## 11. Review Roles

Use the global \`$agentic-loop\` roles unless this project overrides
them:

- Implementation agent;
- Architecture reviewer;
- Runtime reviewer;
- Contract and boundary reviewer;
- Test and E2E reviewer;
- Evidence reviewer;
- Final plan replay reviewer.

The owning agent must keep the plan moving. Reviewers validate completed slices
and identify gaps, but they do not own the implementation roadmap.

## 12. Project Scripts

Detected root package scripts:

${scriptTable(context.scripts)}

## 13. Default Verification Commands

Detected candidates:

${listOrNone(unique([...context.verificationCommands, ...context.workspaceVerificationCommands]))}

Refine this list by target area. Include exact package/workspace commands when
the repository uses a monorepo.

Suggested generic checks when they exist:

\`\`\`bash
npm run typecheck
npm run lint
npm run format:check
git diff --check
\`\`\`

## 14. Live Gates And Environment

Potential environment or live-gate names found in docs/scripts:

${listOrNone(context.envNames)}

Rules:

- Do not read or print secret values from \`.env\` files.
- Live gates are opt-in unless the user explicitly authorizes them.
- Record exact commands and outcomes for every live gate that is run.

## 15. Evidence Rules

Append a dated section to the evidence file after each meaningful round:

\`\`\`markdown
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
- \`command\`: passed
- \`command\`: failed, reason, follow-up

Accepted risks:
- none

Documented command and environment contract:
- checked:
- blocked:

Final plan replay:
- clean | gaps fixed | gaps blocked

Escaped findings from prior loop:
- none
\`\`\`

Do not paste huge command logs. Summarize relevant results and keep exact
commands.

## 16. Checklist Update Rules

Only check an item when:

- implementation exists;
- a relevant test or verification command proved it;
- the evidence file records that proof.

Do not check items because code "looks done". Do not leave stale checked items
after finding a gap.

## 17. Subagent Dispatch Rules

When subagents are used:

- choose reviewer count and roles from Impact Triage instead of using a fixed
  number of agents;
- send each reviewer a compact context packet instead of the full conversation
  or full planning corpus when a narrow packet is enough;
- use role fusion for \`medium\` scope when one combined reviewer can cover the
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
- treat subagents as visible ephemeral workers, not durable project chats or
  chat-history items;
- spawn normal Codex App subagents so their names and active status are visible
  in the status panel; pass the compact context packet and use full-thread
  context only when explicitly required by the task;
- keep each spawned child open while it is actively running so Codex App can
  show active subagent status in the status panel;
- after \`wait_agent\` returns a result, call \`close_agent\` for that child
  once findings or patches are integrated;
- do not leave idle, completed, failed, or superseded subagents open across a
  repair round, batch boundary, commit, or final response.

## 18. Reviewer Finding Batch Rules

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
- end with \`No more material findings within scope\` or
  \`Stopped at finding cap\`.

## 19. Failure Handling

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

## 20. Next Round Decision

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

## 21. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

The final answer must report every P2 accepted risk. If there are none, say so.

## 22. Stop Criteria

The loop may stop only when:

- every checklist item in scope is checked, blocked, or accepted as risk;
- every implemented slice traces back to the supplied spec, plan, or checklist;
- no open P0/P1 findings remain;
- all P2 findings are fixed or recorded as accepted risk;
- relevant verification has passed or is explicitly blocked;
- evidence records commands and outcomes;
- evidence records the Impact Triage decision and selected review depth;
- evidence records token/latency controls: context packet, adaptive P2 cap,
  re-review mode, and finding ledger status;
- no child agent remains open;
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

## 23. Escaped Findings

An escaped finding is any P0/P1/P2 discovered after the loop recorded its stop
criteria as satisfied.

When one appears:

1. fix it using normal severity rules;
2. record it under \`Escaped findings from prior loop\`;
3. state which stop criterion or review role missed it;
4. update this runbook or narrower plan/checklist if process failed;
5. restart the stability requirement from the repair point.

## 24. Final Response Requirements

The final answer must state:

- what changed;
- what was verified;
- what remains;
- every P2 accepted risk, or explicitly that there are none;
- every escaped finding handled, or explicitly that there were none.

Do not say "complete" if an acceptance gate remains open.

## 25. Bootstrap Follow-Up Checklist

- [ ] Project identity is manually corrected.
- [ ] Governing docs list is complete.
- [ ] Non-negotiable invariants match the project.
- [ ] Default verification commands are exact and tested.
- [ ] Live gates are explicit and do not expose secrets.
- [ ] Evidence file location and format are agreed.
- [ ] This runbook is linked from the main agent instructions.
`;
}

function renderCompactRunbook(context, options) {
  const today = new Date().toISOString().slice(0, 10);
  const layout = [
    ...context.apps.map((name) => `apps/${name}`),
    ...context.packages.map((name) => `packages/${name}`),
    ...context.services.map((name) => `services/${name}`),
    ...context.libs.map((name) => `libs/${name}`)
  ];

  return `# Agentic Implementation Review Loop Runbook

Status: Draft generated ${today}

Purpose: project-specific runtime protocol for using the global
\`$agentic-loop\` skill in this repository. Keep this file compact:
local architecture rules, exact commands, live gates, evidence paths, and risk
policy belong here; reusable loop mechanics stay in the skill.

## Project Identity

- Repository: \`${context.projectRoot}\`
- Detected stack: ${context.stack.length > 0 ? context.stack.join(", ") : "not detected"}
- Detected layout:
${listOrNone(layout)}

Review and refine this section manually. The bootstrap script uses heuristics
and does not understand product intent.

## Governing Documents

Detected:

${listOrNone(context.governingDocs)}

Agents must read the governing docs that apply to the target scope before
starting a loop.

## Architecture Orientation

${context.architectureOrientation || "- none detected"}

Use this as the first navigation map for Impact Triage and reviewer context.
Expand the original architecture docs only when the active scope needs more
detail.

## Local Invariants

Replace or extend these draft bullets with project-specific rules:

- Preserve stable public contracts unless the approved plan says otherwise.
- Do not add silent fallbacks or bypasses for required runtime behavior.
- Validate boundary inputs before domain logic.
- Keep evidence synchronized with implementation and verification.

## Runtime Protocol

- Use this root \`AGENTIC_LOOP.md\` as the only runtime protocol for ordinary
  implementation loops.
- Do not also load the global \`references/loop-protocol.md\` unless updating,
  debugging, or bootstrapping the skill itself.
- Start from supplied \`SPEC_FILE\`, \`PLAN_FILE\`, and \`CHECKLIST_FILE\`.
- Run Impact Triage, then implement the next incomplete checklist slice before
  broad review.
- Reviewers validate completed implementation slices and plan gaps; they do not
  own product scope.
- Fix all P0/P1 findings before stopping. Fix P2 findings unless each one is
  recorded as accepted risk with reason, residual risk, and follow-up owner or
  gate.
- Use subagents only when the user explicitly authorizes delegation or parallel
  agent work. Treat authorized subagents as visible ephemeral workers: spawn
  normal Codex App subagents so their names and active status are visible in the
  status panel, pass compact packet context, keep them visible while running,
  collect the result, then call \`close_agent\` after integration. Do not
  create, promote, or preserve child-agent threads as durable chat-history
  items.

## Token And State Controls

- Build a reviewer context packet with Architecture Orientation before
  dispatching reviewers.
- Use \`.agentic-loop/context.md\`, \`.agentic-loop/findings.md\`,
  \`.agentic-loop/verification.md\`, \`.agentic-loop/traceability.md\`, and
  \`.agentic-loop/delta.md\` for reusable state when evidence grows large.
- Keep \`Current State\` at the top of the evidence file.
- Use stable plan/checklist IDs, short item hashes, adaptive P2 caps,
  delta-only re-review, and matrix-first final replay.
- In final replay, read all changed, new, gap, blocked, accepted-risk, and
  open-finding rows. Spot-check unchanged verified rows by deterministic item
  hash instead of rereading the full plan every round.

## Progress Beacons

Emit exactly one mandatory user-visible chat/commentary update per review cycle,
after reviewer findings are deduplicated and before repair starts. Evidence or
\`.agentic-loop\` writes do not satisfy the beacon. Include only severity
counts, short problem classes, and what will be repaired or verified next.
Format: \`Review Cycle N: findings P0=0 P1=0 P2=0 P3=0; classes: ...; repair now: ...\`.
Continue working unless the user asks to pause or redirect.

## Project Scripts

Detected preferred root verification scripts:

${options.includeAllScripts ? scriptTable(context.scripts) : scriptTableForCommands(context.scripts, context.verificationCommands)}

${options.includeAllScripts ? "" : "Bootstrap omitted non-verification root scripts to keep this file compact. Regenerate with `--include-all-scripts` only when the full script list is useful."}

## Default Verification Commands

Detected candidates:

${listOrNone(unique([...context.verificationCommands, ...context.workspaceVerificationCommands]))}

Refine this list by target area and keep exact package/workspace commands.

## Live Gates And Environment

Potential environment or live-gate names found in docs/scripts:

${listOrNone(context.envNames)}

Rules:

- Do not read or print secret values from \`.env\` files.
- Live gates are opt-in unless the user explicitly authorizes them.
- Record exact commands and outcomes for every live gate that is run.

## Evidence Skeleton

\`\`\`markdown
## Current State

- active slice:
- runtime protocol: AGENTIC_LOOP.md
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

Loop state artifacts:
- reviewer context packet: .agentic-loop/context.md
- finding ledger: .agentic-loop/findings.md
- verification matrix: .agentic-loop/verification.md
- traceability matrix: .agentic-loop/traceability.md
- delta review packet: .agentic-loop/delta.md

Read and output budget:
- reviewer read mode: packet-only | targeted-extra | scope-expanded
- extra files read:
- command output summary:
- full logs/artifacts:

Findings:
- P1:
- P2:

Verification:
- \`command\`: passed | failed | blocked

Accepted risks:
- none

Final plan replay:
- clean | gaps fixed | gaps blocked
\`\`\`

## Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

The final answer must report every P2 accepted risk. If there are none, say so.

## Stop Criteria

The loop may stop only when checklist items in scope are implemented, blocked,
or accepted as risk; open P0/P1 findings are gone; P2 findings are fixed or
recorded; required verification is passed or explicitly blocked; evidence is
current; no child agent remains open; final matrix-first replay is clean; and
the final answer reports P2 accepted risks and escaped findings.

## Bootstrap Follow-Up Checklist

- [ ] Project identity is manually corrected.
- [ ] Governing docs list is complete.
- [ ] Local invariants match the project.
- [ ] Default verification commands are exact and tested.
- [ ] Live gates are explicit and do not expose secrets.
- [ ] Evidence file location and sidecar state policy are agreed.
- [ ] This runbook is linked from the main agent instructions.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.project);
  const outputPath = path.resolve(args.output ?? path.join(projectRoot, DEFAULT_OUTPUT));

  if (!(await pathExists(projectRoot))) {
    throw new Error(`Project path does not exist: ${projectRoot}`);
  }

  const projectStat = await stat(projectRoot);
  if (!projectStat.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectRoot}`);
  }

  const context = await inspectProject(projectRoot);
  const output = args.selfContained ? renderRunbook(context) : renderCompactRunbook(context, args);

  if (args.dryRun) {
    process.stdout.write(output);
    return;
  }

  if (!args.force && fs.existsSync(outputPath)) {
    throw new Error(`Output already exists: ${outputPath}. Use --force to overwrite.`);
  }

  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
