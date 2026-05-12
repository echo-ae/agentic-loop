#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { plan: [], checklist: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      args.plan.push(argv[++index]);
    } else if (arg === "--checklist") {
      args.checklist.push(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function normalizeItem(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hashItem(text) {
  return createHash("sha256").update(normalizeItem(text)).digest("hex").slice(0, 12);
}

function escapeCell(text) {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function excerpt(text, maxLength = 96) {
  const normalized = normalizeItem(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function extractItems(text, sourcePath, preferredKind) {
  const items = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    const checkbox = line.match(/^\s*[-*]\s+\[[ xX-]\]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (heading) {
      const normalizedHeading = normalizeItem(heading[2]).toLowerCase();
      if (heading[1] === "#" && ["plan", "checklist"].includes(normalizedHeading)) {
        continue;
      }
      items.push({ kind: "heading", line: index + 1, sourcePath, text: heading[2] });
    } else if (checkbox) {
      items.push({ kind: "checkbox", line: index + 1, sourcePath, text: checkbox[1] });
    } else if (preferredKind === "plan" && numbered) {
      items.push({ kind: "numbered", line: index + 1, sourcePath, text: numbered[1] });
    }
  }
  return items.filter((item) => normalizeItem(item.text).length > 0);
}

async function readItems(files, preferredKind) {
  const all = [];
  for (const file of files) {
    const absolute = path.resolve(file);
    const text = await readFile(absolute, "utf8");
    all.push(...extractItems(text, file, preferredKind));
  }
  return all;
}

function renderRows(prefix, items) {
  return items
    .map((item, index) => {
      const id = `${prefix}-${String(index + 1).padStart(3, "0")}`;
      const source = `${item.sourcePath}:${item.line}`;
      return `| ${id} | ${hashItem(item.text)} | ${escapeCell(excerpt(item.text))} | ${escapeCell(source)} | TODO | TODO | TODO | TODO |`;
    })
    .join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (args.plan.length === 0 && args.checklist.length === 0)) {
    console.log("Usage: build-traceability-index.mjs --plan PLAN.md --checklist CHECKLIST.md");
    return;
  }

  const planItems = await readItems(args.plan, "plan");
  const checklistItems = await readItems(args.checklist, "checklist");

  console.log(`# Traceability Matrix Draft

Draft statuses use \`TODO\`; replace them with \`implemented_and_verified\`,
\`implemented_fail_closed\`, \`blocked_live_or_external_gate\`,
\`accepted_risk\`, or \`gap_found\` as evidence accumulates.

| id | item hash | item excerpt | source | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${renderRows("PLAN", planItems)}
${renderRows("CHK", checklistItems)}
`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
