#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

function hasAll(text, label, phrases, errors) {
  for (const phrase of phrases) {
    if (!text.includes(phrase)) {
      errors.push(`${label} is missing: ${phrase}`);
    }
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
      "active slice:",
      "runtime protocol:",
      "open findings:",
      "accepted risks:",
      "verification matrix status:",
      "traceability matrix status:",
      "latest delta packet:",
      "Loop state artifacts:",
      "reviewer context packet:",
      "finding ledger:",
      "verification matrix:",
      "traceability matrix:",
      "delta review packet:",
      "Read and output budget:",
      "reviewer read mode:",
      "extra files read:",
      "command output summary:"
    ],
    errors
  );

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
