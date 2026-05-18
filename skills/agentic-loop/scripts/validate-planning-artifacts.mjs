#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PLACEHOLDER_PATTERN = /\b(TODO|TBD|FIXME|XXX|placeholder|later)\b/i;
const OPEN_ENDED_PATTERN = /\b(etc\.?|and so on|as needed|as appropriate|maybe|probably|misc|various)\b/i;
const SURFACE_PATTERN =
  /\b(apps|packages|src|docs|move-to-typescript|routes?|api|workflow|activity|component|module|package|database|db|postgres|temporal|worker|ui|e2e)\b|[A-Za-z0-9._/-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md)|\/api\/[A-Za-z0-9/_-]+/i;
const PROOF_PATTERN =
  /\b(test|typecheck|lint|build|playwright|e2e|verify|verification|gate|command|evidence|assert|acceptance|snapshot|manual check)\b|`[^`]*(?:npm|pnpm|yarn|node|npx|cargo|pytest|vitest|playwright)[^`]*`/i;
const REQUIREMENT_PATTERN = /\b(must|shall|required|invariant|acceptance|verify|fail closed|non-goal|out of scope|forbidden|scope)\b/i;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--spec") {
      args.spec = argv[++index];
    } else if (arg === "--plan") {
      args.plan = argv[++index];
    } else if (arg === "--checklist") {
      args.checklist = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return [
    "Usage: validate-planning-artifacts.mjs --spec SPEC.md --plan PLAN.md --checklist CHECKLIST.md",
    "",
    "Fails when planning artifacts are too vague to implement without guessing."
  ].join("\n");
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text) {
  return normalize(text).split(/\s+/).filter(Boolean).length;
}

function parseListItems(text, options = {}) {
  const items = [];
  const lines = text.split("\n");
  let current = null;

  const flush = () => {
    if (current && normalize(current.parts.join(" ")).length > 0) {
      items.push({
        line: current.line,
        marker: current.marker,
        text: normalize(current.parts.join(" "))
      });
    }
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*#{1,6}\s+/.test(line)) {
      flush();
      continue;
    }

    const checkbox = line.match(/^(\s*)[-*]\s+\[[ xX-]\]\s+(.+)$/);
    const numbered = line.match(/^(\s*)\d+\.\s+(.+)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.+)$/);
    const markerMatch =
      checkbox ??
      (options.includeNumbered ? numbered : null) ??
      (options.includeBullets ? bullet : null);

    if (markerMatch) {
      const indent = markerMatch[1].length;
      const marker = checkbox ? "checkbox" : numbered ? "numbered" : "bullet";
      const startsNewItem = !current || indent <= current.indent;
      if (startsNewItem) {
        flush();
        current = {
          indent,
          line: index + 1,
          marker,
          parts: [markerMatch[2].trim()]
        };
      } else {
        current.parts.push(markerMatch[2].trim());
      }
      continue;
    }

    if (current) {
      const trimmed = line.trim();
      if (trimmed) {
        current.parts.push(trimmed);
      }
    }
  }

  flush();
  return items;
}

function extractChecklistItems(text) {
  return parseListItems(text).filter((item) => item.marker === "checkbox");
}

function extractPlanItems(text) {
  return parseListItems(text, { includeNumbered: true }).filter((item) =>
    ["checkbox", "numbered"].includes(item.marker)
  );
}

function hasHeading(text, pattern) {
  return text.split("\n").some((line) => /^#{1,6}\s+/.test(line) && pattern.test(line));
}

async function readArtifact(label, filePath, findings) {
  if (!filePath) {
    findings.push(`${label}: missing CLI argument`);
    return "";
  }
  const absolute = path.resolve(filePath);
  let text = "";
  try {
    text = await readFile(absolute, "utf8");
  } catch (error) {
    findings.push(`${label}: cannot read ${filePath}: ${error.message}`);
    return "";
  }
  if (normalize(text).length < 200) {
    findings.push(`${label}: content is too short to guide implementation without guessing`);
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    findings.push(`${label}: contains placeholder text such as TODO/TBD/FIXME`);
  }
  if (OPEN_ENDED_PATTERN.test(text)) {
    findings.push(`${label}: contains open-ended wording such as etc/as needed/maybe`);
  }
  return text;
}

function validateSpec(text, findings) {
  if (!text) {
    return;
  }
  const anchors = [
    ["scope or target boundary", /\b(scope|target|boundary|in scope)\b/i],
    ["non-goals or forbidden scope", /\b(non-goals?|out of scope|forbidden|must not)\b/i],
    ["requirements or invariants", /\b(requirements?|invariants?|must|shall)\b/i],
    ["acceptance or verification criteria", /\b(acceptance|verification|gates?|done criteria)\b/i]
  ];
  for (const [label, pattern] of anchors) {
    if (!hasHeading(text, pattern) && !pattern.test(text)) {
      findings.push(`SPEC_FILE: missing ${label}`);
    }
  }
  const requirementItems = parseListItems(text, { includeBullets: true, includeNumbered: true }).filter((item) =>
    REQUIREMENT_PATTERN.test(item.text)
  );
  if (requirementItems.length === 0) {
    findings.push("SPEC_FILE: no concrete requirement or invariant bullets detected");
  }
}

function validatePlan(text, findings) {
  if (!text) {
    return;
  }
  const items = extractPlanItems(text);
  if (items.length === 0) {
    findings.push("PLAN_FILE: no ordered or checkbox implementation items detected");
    return;
  }
  for (const item of items) {
    if (wordCount(item.text) < 8) {
      findings.push(`PLAN_FILE:${item.line}: item is too short: ${item.text}`);
    }
    if (!SURFACE_PATTERN.test(item.text)) {
      findings.push(`PLAN_FILE:${item.line}: item lacks an implementation surface or owned path`);
    }
  }
  if (!PROOF_PATTERN.test(text)) {
    findings.push("PLAN_FILE: missing verification commands, gates, or acceptance proof");
  }
}

function validateChecklist(text, findings) {
  if (!text) {
    return;
  }
  const items = extractChecklistItems(text);
  if (items.length === 0) {
    findings.push("CHECKLIST_FILE: no markdown checkbox items detected");
    return;
  }
  for (const item of items) {
    if (wordCount(item.text) < 10) {
      findings.push(`CHECKLIST_FILE:${item.line}: checkbox is too short: ${item.text}`);
    }
    if (!SURFACE_PATTERN.test(item.text)) {
      findings.push(`CHECKLIST_FILE:${item.line}: checkbox lacks target file, module, route, or surface`);
    }
    if (!PROOF_PATTERN.test(item.text)) {
      findings.push(`CHECKLIST_FILE:${item.line}: checkbox lacks verification command, gate, assertion, or evidence`);
    }
    if (OPEN_ENDED_PATTERN.test(item.text) || PLACEHOLDER_PATTERN.test(item.text)) {
      findings.push(`CHECKLIST_FILE:${item.line}: checkbox contains placeholder or open-ended wording`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const findings = [];
  const [specText, planText, checklistText] = await Promise.all([
    readArtifact("SPEC_FILE", args.spec, findings),
    readArtifact("PLAN_FILE", args.plan, findings),
    readArtifact("CHECKLIST_FILE", args.checklist, findings)
  ]);

  validateSpec(specText, findings);
  validatePlan(planText, findings);
  validateChecklist(checklistText, findings);

  if (findings.length > 0) {
    console.error("Planning artifact completeness validation failed:");
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Planning artifact completeness validation passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
