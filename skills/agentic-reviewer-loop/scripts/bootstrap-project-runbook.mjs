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

function parseArgs(argv) {
  const args = {
    project: process.cwd(),
    output: undefined,
    dryRun: false,
    force: false
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

This file extends the global \`$agentic-reviewer-loop\` skill. It does not
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

Reviewer context packet target: 80 lines or fewer unless scope is critical.

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
| plan/checklist item | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- |
\`\`\`

Delta review packet:

\`\`\`markdown
- fixed finding ids:
- patch summary:
- changed files since last review:
- verification rerun:
- remaining open findings:
- new or changed risks:
\`\`\`

## 10. Review Roles

Use the global \`$agentic-reviewer-loop\` roles unless this project overrides
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

## 11. Project Scripts

Detected root package scripts:

${scriptTable(context.scripts)}

## 12. Default Verification Commands

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

## 13. Live Gates And Environment

Potential environment or live-gate names found in docs/scripts:

${listOrNone(context.envNames)}

Rules:

- Do not read or print secret values from \`.env\` files.
- Live gates are opt-in unless the user explicitly authorizes them.
- Record exact commands and outcomes for every live gate that is run.

## 14. Evidence Rules

Append a dated section to the evidence file after each meaningful round:

\`\`\`markdown
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

## 15. Checklist Update Rules

Only check an item when:

- implementation exists;
- a relevant test or verification command proved it;
- the evidence file records that proof.

Do not check items because code "looks done". Do not leave stale checked items
after finding a gap.

## 16. Subagent Dispatch Rules

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
- close subagents when their findings have been integrated.

## 17. Reviewer Finding Batch Rules

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

## 18. Failure Handling

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

## 19. Next Round Decision

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

## 20. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

The final answer must report every P2 accepted risk. If there are none, say so.

## 21. Stop Criteria

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

## 22. Escaped Findings

An escaped finding is any P0/P1/P2 discovered after the loop recorded its stop
criteria as satisfied.

When one appears:

1. fix it using normal severity rules;
2. record it under \`Escaped findings from prior loop\`;
3. state which stop criterion or review role missed it;
4. update this runbook or narrower plan/checklist if process failed;
5. restart the stability requirement from the repair point.

## 23. Final Response Requirements

The final answer must state:

- what changed;
- what was verified;
- what remains;
- every P2 accepted risk, or explicitly that there are none;
- every escaped finding handled, or explicitly that there were none.

Do not say "complete" if an acceptance gate remains open.

## 24. Bootstrap Follow-Up Checklist

- [ ] Project identity is manually corrected.
- [ ] Governing docs list is complete.
- [ ] Non-negotiable invariants match the project.
- [ ] Default verification commands are exact and tested.
- [ ] Live gates are explicit and do not expose secrets.
- [ ] Evidence file location and format are agreed.
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
  const output = renderRunbook(context);

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
