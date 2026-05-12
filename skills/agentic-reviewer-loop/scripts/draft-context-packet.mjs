#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { project: process.cwd(), maxLines: 80 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      args.project = argv[++index];
    } else if (arg === "--evidence") {
      args.evidence = argv[++index];
    } else if (arg === "--max-lines") {
      args.maxLines = Number.parseInt(argv[++index], 10);
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function runGit(projectRoot, args) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function listLines(text, fallback = "- none") {
  if (!text.trim()) {
    return fallback;
  }
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function uniqueLines(...texts) {
  return [...new Set(texts.join("\n").split("\n").filter(Boolean))].join("\n");
}

function extractCurrentState(evidencePath) {
  if (!evidencePath) {
    return "- TODO";
  }
  try {
    const text = readFileSync(path.resolve(evidencePath), "utf8");
    const match = text.match(/^## Current State\s*\n([\s\S]*?)(?=\n## |\s*$)/m);
    if (!match) {
      return "- Current State not found";
    }
    return match[1].trim() || "- Current State is empty";
  } catch (error) {
    return `- Could not read evidence: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function applyMaxLines(text, maxLines) {
  if (!Number.isFinite(maxLines) || maxLines <= 0) {
    return text;
  }
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return [
    ...lines.slice(0, Math.max(0, maxLines - 3)),
    "",
    `<!-- context packet truncated to ${maxLines} lines; rebuild with a higher --max-lines only when needed -->`
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: draft-context-packet.mjs --project /path/to/project [--evidence EVIDENCE.md] [--max-lines 80]");
    return;
  }

  const projectRoot = path.resolve(args.project);
  const branch = runGit(projectRoot, ["branch", "--show-current"]) || "unknown";
  const status = runGit(projectRoot, ["status", "--short"]);
  const diffStat = runGit(projectRoot, ["diff", "--stat"]);
  const stagedDiffStat = runGit(projectRoot, ["diff", "--cached", "--stat"]);
  const changedFiles = runGit(projectRoot, ["diff", "--name-only"]);
  const stagedFiles = runGit(projectRoot, ["diff", "--cached", "--name-only"]);
  const untrackedFiles = runGit(projectRoot, ["ls-files", "--others", "--exclude-standard"]);
  const currentState = extractCurrentState(args.evidence);

  const packet = `# Reviewer Context Packet Draft

- scope: TODO
- forbidden scope: TODO
- live gates: TODO
- runtime protocol: TODO
- branch: ${branch}
- impact triage: TODO
- current checklist slice: TODO

## Changed Files
${listLines(uniqueLines(changedFiles, stagedFiles, untrackedFiles))}

## Git Status
${listLines(status)}

## Diffstat
${diffStat || "- none"}

## Staged Diffstat
${stagedDiffStat || "- none"}

## Plan/Checklist Excerpts
- TODO: include only relevant item IDs and short excerpts.

## Current Evidence Summary
${currentState}

## Commands Already Run
- TODO

## Known Failures
- TODO

## Open Finding IDs
- TODO

## Accepted Risks
- TODO
`;

  console.log(applyMaxLines(packet, args.maxLines));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
