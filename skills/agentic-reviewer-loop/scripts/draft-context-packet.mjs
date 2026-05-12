#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { project: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      args.project = argv[++index];
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: draft-context-packet.mjs --project /path/to/project");
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

  console.log(`# Reviewer Context Packet Draft

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
- TODO

## Commands Already Run
- TODO

## Known Failures
- TODO

## Open Finding IDs
- TODO

## Accepted Risks
- TODO
`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
