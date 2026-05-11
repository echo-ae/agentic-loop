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

const DEFAULT_OUTPUT = "agentic-review-loop.md";

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

  return `# Agentic Review Loop Runbook

Status: Draft generated ${today}

Purpose: define the project-specific workflow for turning an approved spec,
plan, and checklist into a self-reviewing implementation loop.

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

## 6. Review Roles

Use the global \`$agentic-reviewer-loop\` roles unless this project overrides
them:

- Architecture reviewer;
- Runtime reviewer;
- Contract and boundary reviewer;
- Test and E2E reviewer;
- Evidence reviewer;
- Final plan replay reviewer.

## 7. Project Scripts

Detected root package scripts:

${scriptTable(context.scripts)}

## 8. Default Verification Commands

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

## 9. Live Gates And Environment

Potential environment or live-gate names found in docs/scripts:

${listOrNone(context.envNames)}

Rules:

- Do not read or print secret values from \`.env\` files.
- Live gates are opt-in unless the user explicitly authorizes them.
- Record exact commands and outcomes for every live gate that is run.

## 10. Evidence Rules

Append a dated section to the evidence file after each meaningful round:

\`\`\`markdown
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

## 11. Accepted Risk Policy

P0/P1 may not be accepted as risk.

P2 may be accepted only when the evidence records:

- finding;
- reason it is acceptable now;
- residual risk;
- follow-up owner or gate.

The final answer must report every P2 accepted risk. If there are none, say so.

## 12. Stop Criteria

The loop may stop only when:

- every checklist item in scope is checked, blocked, or accepted as risk;
- no open P0/P1 findings remain;
- all P2 findings are fixed or recorded as accepted risk;
- relevant verification has passed or is explicitly blocked;
- evidence records commands and outcomes;
- live gates are passed or explicitly left open as opt-in gates;
- final adversarial plan replay is recorded and clean;
- documented commands, flags, URLs, ports, and modes are implemented, verified,
  blocked, or accepted as risk;
- final answer reports accepted-risk P2 findings and escaped findings.

Recommended stability rule: stop after a clean final plan replay plus one
subsequent clean review round.

## 13. Escaped Findings

An escaped finding is any P0/P1/P2 discovered after the loop recorded its stop
criteria as satisfied.

When one appears:

1. fix it using normal severity rules;
2. record it under \`Escaped findings from prior loop\`;
3. state which stop criterion or review role missed it;
4. update this runbook or narrower plan/checklist if process failed;
5. restart the stability requirement from the repair point.

## 14. Bootstrap Follow-Up Checklist

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
