#!/usr/bin/env node
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const skillDir = path.join(root, "skills", "agentic-reviewer-loop");

const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/bootstrap-guide.md",
  "references/loop-protocol.md",
  "references/project-runbook-template.md",
  "references/reviewer-prompts.md",
  "scripts/bootstrap-project-runbook.mjs"
];

const errors = [];
const fixedP2Rule = ["top", "5-7", "P2"].join(" ");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

for (const file of requiredFiles) {
  try {
    await access(path.join(skillDir, file));
  } catch {
    errors.push(`Missing required file: ${file}`);
  }
}

const skillMd = await readFile(path.join(skillDir, "SKILL.md"), "utf8").catch(() => "");
if (!/^---\nname: agentic-reviewer-loop\n/m.test(skillMd)) {
  errors.push("SKILL.md frontmatter must declare name: agentic-reviewer-loop");
}
if (!/^description: Use when /m.test(skillMd)) {
  errors.push('SKILL.md description should start with "Use when".');
}
if (skillMd.length > 12000) {
  errors.push("SKILL.md is too large; move detail into references.");
}

const openaiYaml = await readFile(path.join(skillDir, "agents", "openai.yaml"), "utf8").catch(() => "");
if (!openaiYaml.includes("default_prompt:")) {
  errors.push("agents/openai.yaml must include interface.default_prompt.");
}
if (!openaiYaml.includes("$agentic-reviewer-loop")) {
  errors.push("agents/openai.yaml default_prompt must mention $agentic-reviewer-loop.");
}
if (!openaiYaml.includes("checklist-driven implement")) {
  errors.push("agents/openai.yaml default_prompt must frame the loop as checklist-driven implementation.");
}

const skillFiles = await listFiles(skillDir).catch(() => []);
for (const file of skillFiles) {
  const relativePath = path.relative(skillDir, file);
  const text = await readFile(file, "utf8").catch(() => "");
  if (/agentic-review-loop\.md|000-agentic-review-loop\.md/.test(text)) {
    errors.push(`Noncanonical runbook filename found in ${relativePath}; use AGENTIC_LOOP.md.`);
  }
  if (text.includes(fixedP2Rule)) {
    errors.push(`${relativePath} must use the adaptive P2 cap instead of a fixed numeric P2 rule.`);
  }
}

const readme = await readFile(path.join(root, "README.md"), "utf8").catch(() => "");
if (readme.includes(fixedP2Rule)) {
  errors.push("README.md must use the adaptive P2 cap instead of a fixed numeric P2 rule.");
}

const bootstrapScript = await readFile(
  path.join(skillDir, "scripts", "bootstrap-project-runbook.mjs"),
  "utf8"
).catch(() => "");
if (!bootstrapScript.includes('const DEFAULT_OUTPUT = "AGENTIC_LOOP.md";')) {
  errors.push("bootstrap script must default to root AGENTIC_LOOP.md.");
}
for (const [label, text] of [
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["reviewer prompts", await readFile(path.join(skillDir, "references", "reviewer-prompts.md"), "utf8").catch(() => "")],
  ["bootstrap script", bootstrapScript]
]) {
  if (!text.includes("Impact Triage")) {
    errors.push(`${label} must include Impact Triage guidance.`);
  }
  if (!text.includes("Reviewer Finding Batch Rules")) {
    errors.push(`${label} must include Reviewer Finding Batch Rules.`);
  }
}

for (const [label, text] of [
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["bootstrap script", bootstrapScript]
]) {
  if (!text.includes("Token And Latency Efficiency Rules")) {
    errors.push(`${label} must include Token And Latency Efficiency Rules.`);
  }
  for (const phrase of ["context packet", "adaptive P2 cap", "finding ledger", "delta-only re-review", "role fusion"]) {
    if (!text.includes(phrase)) {
      errors.push(`${label} must include token-efficiency phrase: ${phrase}.`);
    }
  }
}

for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["reviewer prompts", await readFile(path.join(skillDir, "references", "reviewer-prompts.md"), "utf8").catch(() => "")],
  ["bootstrap script", bootstrapScript]
]) {
  if (!text.includes("implementation-first")) {
    errors.push(`${label} must frame the loop as implementation-first.`);
  }
  if (label !== "reviewer prompts" && !text.includes("Implementation-First Contract")) {
    errors.push(`${label} must include or reference the Implementation-First Contract.`);
  }
  if (!text.includes("completed implementation slices") && !text.includes("completed slices")) {
    errors.push(`${label} must state that reviewers validate completed implementation slices.`);
  }
}

if (errors.length > 0) {
  console.error("Skill validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Skill validation passed.");
