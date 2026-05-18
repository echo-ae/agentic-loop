#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CURRENT_STATE_FIELDS = [
  "active slice",
  "runtime protocol",
  "artifact source",
  "spec/plan/checklist ids changed",
  "artifact completeness gate status",
  "open findings",
  "accepted risks",
  "verification matrix status",
  "traceability matrix status",
  "latest delta packet"
];

const ARTIFACT_FIELDS = [
  "reviewer context packet",
  "finding ledger",
  "verification matrix",
  "traceability matrix",
  "delta review packet"
];

const READ_BUDGET_FIELDS = ["reviewer read mode", "extra files read", "command output summary"];
const READ_MODES = new Set(["packet-only", "targeted-extra", "scope-expanded"]);
const FINDING_STATUSES = new Set(["open", "fixed", "duplicate", "accepted_risk", "blocked"]);
const TRACEABILITY_STATUSES = new Set([
  "implemented_and_verified",
  "implemented_fail_closed",
  "blocked_live_or_external_gate",
  "accepted_risk",
  "not_in_scope_with_reason",
  "gap_found"
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence") {
      args.evidence = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function getSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`));
  return match?.[1]?.trim() ?? "";
}

function extractBulletField(section, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^-\\s*${escaped}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim();
}

function isPlaceholder(value) {
  return !value || /^(todo|tbd|n\/a\?|\.{3})$/i.test(value.trim());
}

function hasAll(text, label, phrases, errors) {
  for (const phrase of phrases) {
    if (!text.includes(phrase)) {
      errors.push(`${label} is missing: ${phrase}`);
    }
  }
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }
  const cells = [];
  let current = "";
  let escaping = false;
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const char = trimmed[index];
    if (char === "|" && !escaping) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
    escaping = char === "\\" && !escaping;
    if (char !== "\\") {
      escaping = false;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function validateTableStatuses(text, errors) {
  for (const line of text.split("\n")) {
    const cells = splitMarkdownRow(line);
    if (cells.length < 3) {
      continue;
    }
    const id = cells[0];
    if (/^(SPEC|PLAN|CHK)-\d{3,}$/.test(id)) {
      const status = cells[cells.length - 1];
      if (!TRACEABILITY_STATUSES.has(status)) {
        errors.push(`traceability row ${id} has invalid status: ${status || "<empty>"}`);
      }
    }
    if (/^FIND-\d{3,}$/.test(id)) {
      const status = cells[2];
      if (!FINDING_STATUSES.has(status)) {
        errors.push(`finding row ${id} has invalid status: ${status || "<empty>"}`);
      }
    }
  }
}

function referencedMarkdownPaths(value) {
  if (!value) {
    return [];
  }
  const paths = [];
  const pattern = /(?:^|[\s,(])((?:\.\/)?(?:\.agentic-loop\/)?[A-Za-z0-9._/-]+\.md)(?=$|[\s,).])/g;
  for (const match of value.matchAll(pattern)) {
    paths.push(match[1]);
  }
  return paths;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateLinkedArtifacts(evidencePath, artifactSection, errors) {
  const baseDir = path.dirname(evidencePath);
  for (const field of ARTIFACT_FIELDS) {
    const value = extractBulletField(artifactSection, field);
    if (isPlaceholder(value)) {
      errors.push(`Loop state artifacts field is empty or placeholder: ${field}`);
      continue;
    }
    for (const relativePath of referencedMarkdownPaths(value)) {
      const absolutePath = path.resolve(baseDir, relativePath);
      if (!(await pathExists(absolutePath))) {
        errors.push(`Loop state artifact path does not exist for ${field}: ${relativePath}`);
      }
    }
  }
}

function validateRequiredFields(sectionLabel, section, fields, errors) {
  if (!section) {
    errors.push(`missing section: ## ${sectionLabel}`);
    return;
  }
  for (const field of fields) {
    const value = extractBulletField(section, field);
    if (isPlaceholder(value)) {
      errors.push(`${sectionLabel} field is empty or placeholder: ${field}`);
    }
  }
}

function validateReadBudget(readBudgetSection, errors) {
  validateRequiredFields("Read and output budget", readBudgetSection, READ_BUDGET_FIELDS, errors);
  const mode = extractBulletField(readBudgetSection, "reviewer read mode");
  if (mode && !READ_MODES.has(mode)) {
    errors.push(`reviewer read mode must be one of ${[...READ_MODES].join(", ")}; got ${mode}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.evidence) {
    console.log("Usage: validate-loop-state.mjs --evidence EVIDENCE.md");
    return;
  }

  const evidencePath = path.resolve(args.evidence);
  const text = await readFile(evidencePath, "utf8");
  const errors = [];

  hasAll(
    text,
    "evidence",
    [
      "## Current State",
      "Loop state artifacts:",
      "Read and output budget:",
      "reviewer context packet:",
      "finding ledger:",
      "verification matrix:",
      "traceability matrix:",
      "delta review packet:"
    ],
    errors
  );

  const currentState = getSection(text, "Current State");
  const roundSection = text.match(/## Agentic Review Loop Round[\s\S]*$/m)?.[0] ?? text;
  const artifactSection = roundSection;
  const readBudgetSection = roundSection;

  validateRequiredFields("Current State", currentState, CURRENT_STATE_FIELDS, errors);
  await validateLinkedArtifacts(evidencePath, artifactSection, errors);
  validateReadBudget(readBudgetSection, errors);
  validateTableStatuses(text, errors);

  if (errors.length > 0) {
    console.error("Loop state validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Loop state validation passed.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
