#!/usr/bin/env node
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const skillDir = path.join(root, "skills", "agentic-loop");

const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/bootstrap-guide.md",
  "references/loop-protocol.md",
  "references/project-runbook-template.md",
  "references/reviewer-prompts.md",
  "scripts/build-traceability-index.mjs",
  "scripts/bootstrap-project-runbook.mjs",
  "scripts/draft-context-packet.mjs",
  "scripts/validate-loop-state.mjs"
];

const rootRequiredFiles = ["README.md", "scripts/install-macos.sh", "scripts/install-windows.ps1"];

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

for (const file of rootRequiredFiles) {
  try {
    await access(path.join(root, file));
  } catch {
    errors.push(`Missing required repository file: ${file}`);
  }
}

const skillMd = await readFile(path.join(skillDir, "SKILL.md"), "utf8").catch(() => "");
if (!/^---\nname: agentic-loop\n/m.test(skillMd)) {
  errors.push("SKILL.md frontmatter must declare name: agentic-loop");
}
if (!/^description: Use when /m.test(skillMd)) {
  errors.push('SKILL.md description should start with "Use when".');
}
const frontmatterDescription = skillMd.match(/^description: (.+)$/m)?.[1] ?? "";
if (!frontmatterDescription.includes("$agentic-loop") || !frontmatterDescription.includes("explicitly")) {
  errors.push("SKILL.md description must make activation explicit via $agentic-loop.");
}
if (!frontmatterDescription.includes("do not use automatically")) {
  errors.push("SKILL.md description must forbid automatic activation.");
}
if (skillMd.length > 12000) {
  errors.push("SKILL.md is too large; move detail into references.");
}

const openaiYaml = await readFile(path.join(skillDir, "agents", "openai.yaml"), "utf8").catch(() => "");
if (!openaiYaml.includes("default_prompt:")) {
  errors.push("agents/openai.yaml must include interface.default_prompt.");
}
if (!openaiYaml.includes("$agentic-loop")) {
  errors.push("agents/openai.yaml default_prompt must mention $agentic-loop.");
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
for (const phrase of [
  "Quick Start",
  "```mermaid",
  "Node.js 20",
  "Codex App with skills support",
  "install-windows.ps1",
  "PowerShell",
  "Activation is opt-in only",
  ".agentic-loop/",
  "git rm --cached .agentic-loop/*.md"
]) {
  if (!readme.includes(phrase)) {
    errors.push(`README.md must include open-source usage phrase: ${phrase}.`);
  }
}

const windowsInstaller = await readFile(path.join(root, "scripts", "install-windows.ps1"), "utf8").catch(() => "");
for (const phrase of [
  "agentic-loop",
  "agentic-reviewer-loop",
  "ExecutionPolicy Bypass",
  "CODEX_HOME",
  "-LiteralPath",
  "SymbolicLink",
  "Restart Codex App"
]) {
  if (!windowsInstaller.includes(phrase)) {
    errors.push(`scripts/install-windows.ps1 must include Windows installer phrase: ${phrase}.`);
  }
}

const bootstrapScript = await readFile(
  path.join(skillDir, "scripts", "bootstrap-project-runbook.mjs"),
  "utf8"
).catch(() => "");
const draftContextPacketScript = await readFile(
  path.join(skillDir, "scripts", "draft-context-packet.mjs"),
  "utf8"
).catch(() => "");
const buildTraceabilityIndexScript = await readFile(
  path.join(skillDir, "scripts", "build-traceability-index.mjs"),
  "utf8"
).catch(() => "");
const validateLoopStateScript = await readFile(
  path.join(skillDir, "scripts", "validate-loop-state.mjs"),
  "utf8"
).catch(() => "");
const reviewerPrompts = await readFile(path.join(skillDir, "references", "reviewer-prompts.md"), "utf8").catch(() => "");
if (!bootstrapScript.includes('const DEFAULT_OUTPUT = "AGENTIC_LOOP.md";')) {
  errors.push("bootstrap script must default to root AGENTIC_LOOP.md.");
}
if (!bootstrapScript.includes("--self-contained") || !bootstrapScript.includes("renderCompactRunbook")) {
  errors.push("bootstrap script must default to compact output and support --self-contained.");
}
if (!bootstrapScript.includes("--include-all-scripts") || !bootstrapScript.includes("scriptTableForCommands")) {
  errors.push("bootstrap script must keep compact script output by default and support --include-all-scripts.");
}
if (!bootstrapScript.includes("Architecture Orientation") || !bootstrapScript.includes("collectArchitectureOrientation")) {
  errors.push("bootstrap script must include Architecture Orientation extraction.");
}
if (!draftContextPacketScript.includes("Reviewer Context Packet Draft")) {
  errors.push("draft context packet script must emit Reviewer Context Packet Draft.");
}
if (!draftContextPacketScript.includes("--max-lines") || !draftContextPacketScript.includes("--evidence")) {
  errors.push("draft context packet script must support --evidence and --max-lines.");
}
if (
  !draftContextPacketScript.includes("--max-files") ||
  !draftContextPacketScript.includes("--include") ||
  !draftContextPacketScript.includes("--exclude") ||
  !draftContextPacketScript.includes("--scope") ||
  !draftContextPacketScript.includes("--forbidden-scope") ||
  !draftContextPacketScript.includes("--live-gates") ||
  !draftContextPacketScript.includes("--command") ||
  !draftContextPacketScript.includes("--known-failure") ||
  !draftContextPacketScript.includes("--architecture-file") ||
  !draftContextPacketScript.includes("--no-architecture") ||
  !draftContextPacketScript.includes("priority compression")
) {
  errors.push("draft context packet script must support priority-aware compression, architecture orientation, scope fields, commands, failures, --max-files, --include, and --exclude.");
}
for (const phrase of ["--findings", "--verification", "--traceability", "--delta"]) {
  if (!draftContextPacketScript.includes(phrase)) {
    errors.push(`draft context packet script must support sidecar summary flag: ${phrase}.`);
  }
}
if (!buildTraceabilityIndexScript.includes("Traceability Matrix Draft")) {
  errors.push("build traceability index script must emit Traceability Matrix Draft.");
}
if (!buildTraceabilityIndexScript.includes("--existing") || !buildTraceabilityIndexScript.includes("--changed-only")) {
  errors.push("build traceability index script must support --existing and --changed-only.");
}
if (!buildTraceabilityIndexScript.includes("--include-headings")) {
  errors.push("build traceability index script must keep headings opt-in with --include-headings.");
}
for (const phrase of ["--section", "--ids", "--status"]) {
  if (!buildTraceabilityIndexScript.includes(phrase)) {
    errors.push(`build traceability index script must support active-slice filter: ${phrase}.`);
  }
}
if (!validateLoopStateScript.includes("Loop state validation passed")) {
  errors.push("validate loop state script must emit a success message.");
}
if (!validateLoopStateScript.includes("TRACEABILITY_STATUSES") || !validateLoopStateScript.includes("referencedMarkdownPaths")) {
  errors.push("validate loop state script must validate statuses and linked artifact paths.");
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

for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["bootstrap script", bootstrapScript],
  ["README.md", readme]
]) {
  if (!text.includes("Architecture Orientation")) {
    errors.push(`${label} must include Architecture Orientation guidance.`);
  }
}

for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["bootstrap script", bootstrapScript],
  ["README.md", readme]
]) {
  const normalized = text.replace(/\s+/g, " ");
  if (!normalized.includes("Progress Beacon") && !normalized.includes("Progress Beacons")) {
    errors.push(`${label} must require Progress Beacons.`);
  }
  if (!normalized.includes("user-visible chat/commentary")) {
    errors.push(`${label} must require user-visible chat/commentary Progress Beacons.`);
  }
  if (!normalized.includes("does not satisfy") && !normalized.includes("do not count as beacons")) {
    errors.push(`${label} must state that evidence/sidecar writes do not satisfy Progress Beacons.`);
  }
  if (!normalized.includes("exactly one") || !normalized.includes("per review cycle")) {
    errors.push(`${label} must require exactly one Progress Beacon per review cycle.`);
  }
  if (!normalized.includes("severity counts") && !normalized.includes("finding counts by severity")) {
    errors.push(`${label} must require severity counts in Progress Beacons.`);
  }
  if (!normalized.includes("problem classes")) {
    errors.push(`${label} must require short problem classes in Progress Beacons.`);
  }
}

for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["reviewer prompts", reviewerPrompts],
  ["bootstrap script", bootstrapScript]
]) {
  const normalized = text.replace(/\s+/g, " ");
  if (!normalized.includes("visible ephemeral workers")) {
    errors.push(`${label} must require visible ephemeral subagent lifecycle.`);
  }
  if (!normalized.includes("status panel")) {
    errors.push(`${label} must keep active subagents visible in the status panel.`);
  }
  if (!normalized.includes("chat-history items")) {
    errors.push(`${label} must prevent child-agent threads from becoming chat-history items.`);
  }
}
for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["bootstrap script", bootstrapScript]
]) {
  const normalized = text.replace(/\s+/g, " ");
  if (!normalized.includes("normal Codex App subagents")) {
    errors.push(`${label} must use normal Codex App subagents for visible status.`);
  }
  if (!normalized.includes("close_agent")) {
    errors.push(`${label} must require close_agent after subagent result integration.`);
  }
}

for (const [label, text] of [
  ["SKILL.md", skillMd],
  ["loop protocol", await readFile(path.join(skillDir, "references", "loop-protocol.md"), "utf8").catch(() => "")],
  [
    "project runbook template",
    await readFile(path.join(skillDir, "references", "project-runbook-template.md"), "utf8").catch(() => "")
  ],
  ["bootstrap script", bootstrapScript]
]) {
  for (const phrase of [
    "Loop State Artifacts",
    "Reviewer context packet",
    "finding ledger",
    "verification matrix",
    "traceability matrix",
    "delta review packet",
    ".agentic-loop/",
    "Current State",
    "runtime protocol",
    "item hash",
    "Read and output budget",
    "build-traceability-index.mjs",
    "validate-loop-state.mjs"
  ]) {
    if (!text.includes(phrase)) {
      errors.push(`${label} must include loop-state artifact phrase: ${phrase}.`);
    }
  }
}

if (!reviewerPrompts.includes("Extra files read")) {
  errors.push("reviewer prompts must require reviewers to report extra files read.");
}
if (!reviewerPrompts.includes("packet-only") || !reviewerPrompts.includes("targeted-extra")) {
  errors.push("reviewer prompts must require reviewer read mode classification.");
}

if (errors.length > 0) {
  console.error("Skill validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Skill validation passed.");
