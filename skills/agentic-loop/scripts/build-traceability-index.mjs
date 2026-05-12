#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    plan: [],
    checklist: [],
    existing: undefined,
    changedOnly: false,
    includeHeadings: false,
    sections: [],
    ids: [],
    statuses: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      args.plan.push(argv[++index]);
    } else if (arg === "--checklist") {
      args.checklist.push(argv[++index]);
    } else if (arg === "--existing") {
      args.existing = argv[++index];
    } else if (arg === "--changed-only") {
      args.changedOnly = true;
    } else if (arg === "--include-headings") {
      args.includeHeadings = true;
    } else if (arg === "--section") {
      args.sections.push(argv[++index]);
    } else if (arg === "--ids") {
      args.ids.push(...parseListArgument(argv[++index]));
    } else if (arg === "--status") {
      args.statuses.push(...parseListArgument(argv[++index]).map((status) => status.toLowerCase()));
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function parseListArgument(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeItem(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hashItem(text) {
  return createHash("sha256").update(normalizeItem(text)).digest("hex").slice(0, 12);
}

function escapeCell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function excerpt(text, maxLength = 96) {
  const normalized = normalizeItem(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function extractItems(text, sourcePath, preferredKind, options) {
  const items = [];
  const lines = text.split("\n");
  const headingStack = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    const checkbox = line.match(/^\s*[-*]\s+\[[ xX-]\]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (heading) {
      const level = heading[1].length;
      headingStack.splice(level - 1);
      headingStack[level - 1] = heading[2];
      const normalizedHeading = normalizeItem(heading[2]).toLowerCase();
      if (!options.includeHeadings || (heading[1] === "#" && ["plan", "checklist"].includes(normalizedHeading))) {
        continue;
      }
      items.push({
        kind: "heading",
        line: index + 1,
        sectionPath: headingStack.filter(Boolean).join(" / "),
        sourcePath,
        text: heading[2]
      });
    } else if (checkbox) {
      items.push({
        kind: "checkbox",
        line: index + 1,
        sectionPath: headingStack.filter(Boolean).join(" / "),
        sourcePath,
        text: checkbox[1]
      });
    } else if (preferredKind === "plan" && numbered) {
      items.push({
        kind: "numbered",
        line: index + 1,
        sectionPath: headingStack.filter(Boolean).join(" / "),
        sourcePath,
        text: numbered[1]
      });
    }
  }
  return items.filter((item) => normalizeItem(item.text).length > 0 && matchesSection(item, options.sections));
}

function matchesSection(item, sectionFilters) {
  if (!sectionFilters || sectionFilters.length === 0) {
    return true;
  }
  const haystack = normalizeItem(`${item.sectionPath ?? ""} ${item.text}`).toLowerCase();
  return sectionFilters.some((section) => haystack.includes(normalizeItem(section).toLowerCase()));
}

async function readItems(files, preferredKind, options) {
  const all = [];
  for (const file of files) {
    const absolute = path.resolve(file);
    const text = await readFile(absolute, "utf8");
    all.push(...extractItems(text, file, preferredKind, options));
  }
  return all;
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
  return cells;
}

function unescapeCell(text) {
  return text.replace(/\\\|/g, "|").trim();
}

function parseExistingRows(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const cells = splitMarkdownRow(line);
    if (cells.length < 8) {
      continue;
    }
    const [id, itemHash, itemExcerpt, source, implementationRefs, verificationRefs, evidenceRefs, status] =
      cells.map(unescapeCell);
    if (id === "id" || /^-+$/.test(id)) {
      continue;
    }
    if (!/^(PLAN|CHK)-\d{3,}$/.test(id)) {
      continue;
    }
    rows.push({
      id,
      itemHash,
      itemExcerpt,
      source,
      implementationRefs,
      verificationRefs,
      evidenceRefs,
      status
    });
  }
  return rows;
}

async function readExistingRows(existingPath) {
  if (!existingPath) {
    return [];
  }
  try {
    return parseExistingRows(await readFile(path.resolve(existingPath), "utf8"));
  } catch {
    return [];
  }
}

function nextIdCounter(prefix, existingRows) {
  let max = 0;
  for (const row of existingRows) {
    const match = row.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return max + 1;
}

function buildRows(prefix, items, existingRows) {
  const queuesByHash = new Map();
  for (const row of existingRows.filter((existingRow) => existingRow.id.startsWith(`${prefix}-`))) {
    const key = row.itemHash;
    const rows = queuesByHash.get(key) ?? [];
    rows.push(row);
    queuesByHash.set(key, rows);
  }

  let nextId = nextIdCounter(prefix, existingRows);
  const usedIds = new Set();
  const currentRows = [];

  for (const item of items) {
    const itemHash = hashItem(item.text);
    const reusableRows = queuesByHash.get(itemHash) ?? [];
    const reused = reusableRows.shift();
    const source = `${item.sourcePath}:${item.line}`;
    if (reused) {
      usedIds.add(reused.id);
      currentRows.push({
        ...reused,
        itemHash,
        itemExcerpt: excerpt(item.text),
        source,
        sectionPath: item.sectionPath,
        changed: reused.source !== source,
        isNew: false
      });
      continue;
    }

    const id = `${prefix}-${String(nextId).padStart(3, "0")}`;
    nextId += 1;
    currentRows.push({
      id,
      itemHash,
      itemExcerpt: excerpt(item.text),
      source,
      sectionPath: item.sectionPath,
      implementationRefs: "TODO",
      verificationRefs: "TODO",
      evidenceRefs: "TODO",
      status: "TODO",
      changed: true,
      isNew: true
    });
  }

  const removedRows = existingRows.filter(
    (row) => row.id.startsWith(`${prefix}-`) && !usedIds.has(row.id)
  );
  return { currentRows, removedRows };
}

function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.ids.length > 0 && !filters.ids.includes(row.id)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(String(row.status || "TODO").toLowerCase())) {
      return false;
    }
    return true;
  });
}

function renderRows(rows) {
  return rows
    .map(
      (row) =>
        `| ${escapeCell(row.id)} | ${escapeCell(row.itemHash)} | ${escapeCell(row.itemExcerpt)} | ${escapeCell(row.source)} | ${escapeCell(row.implementationRefs || "TODO")} | ${escapeCell(row.verificationRefs || "TODO")} | ${escapeCell(row.evidenceRefs || "TODO")} | ${escapeCell(row.status || "TODO")} |`
    )
    .join("\n");
}

function renderRemovedRows(rows) {
  if (rows.length === 0) {
    return "- none";
  }
  return rows
    .map(
      (row) =>
        `| ${escapeCell(row.id)} | ${escapeCell(row.itemHash)} | ${escapeCell(row.itemExcerpt)} | ${escapeCell(row.source)} |`
    )
    .join("\n");
}

function renderMatrix(rows) {
  return `| id | item hash | item excerpt | source | implementation refs | verification refs | evidence refs | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${renderRows(rows)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (args.plan.length === 0 && args.checklist.length === 0)) {
    console.log(
      "Usage: build-traceability-index.mjs --plan PLAN.md --checklist CHECKLIST.md [--existing .agentic-loop/traceability.md] [--changed-only] [--include-headings] [--section TEXT] [--ids PLAN-001,CHK-002] [--status TODO,gap_found]"
    );
    return;
  }

  const [planItems, checklistItems, existingRows] = await Promise.all([
    readItems(args.plan, "plan", args),
    readItems(args.checklist, "checklist", args),
    readExistingRows(args.existing)
  ]);

  const plan = buildRows("PLAN", planItems, existingRows);
  const checklist = buildRows("CHK", checklistItems, existingRows);
  const filters = {
    ids: args.ids,
    statuses: args.statuses
  };
  const currentRows = filterRows([...plan.currentRows, ...checklist.currentRows], filters);
  const removedRows = filterRows([...plan.removedRows, ...checklist.removedRows], filters);
  const changedRows = currentRows.filter((row) => row.isNew);

  if (args.changedOnly) {
    console.log(`# Traceability Matrix Delta

Rows below are new hash rows since the existing matrix. Stable-hash rows keep
their IDs even when line numbers move. Removed rows are listed separately so the
owner can update evidence without forcing reviewers to reread unchanged verified
rows.

${renderMatrix(changedRows)}

## Removed Rows

| id | item hash | item excerpt | previous source |
| --- | --- | --- | --- |
${renderRemovedRows(removedRows)}
`);
    return;
  }

  console.log(`# Traceability Matrix Draft

Draft statuses use \`TODO\`; replace them with \`implemented_and_verified\`,
\`implemented_fail_closed\`, \`blocked_live_or_external_gate\`,
\`accepted_risk\`, or \`gap_found\` as evidence accumulates.

Existing IDs are reused by item hash when \`--existing\` is supplied. New IDs are
assigned after the highest existing ID for each prefix to avoid row churn.

${renderMatrix(currentRows)}

## Removed Rows From Existing Matrix

These rows existed in the previous matrix but were not found in the current
plan/checklist inputs. Keep them in evidence only if they still explain an
accepted risk or historical gate.

| id | item hash | item excerpt | previous source |
| --- | --- | --- | --- |
${renderRemovedRows(removedRows)}
`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
