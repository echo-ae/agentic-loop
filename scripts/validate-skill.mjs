#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
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

if (errors.length > 0) {
  console.error("Skill validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Skill validation passed.");
