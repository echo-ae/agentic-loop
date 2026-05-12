#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ARCHITECTURE_DOC_CANDIDATES = ["ARCHITECTURE.md", "docs/ARCHITECTURE.md", "docs/architecture.md"];
const ARCHITECTURE_SIGNAL_PATTERN =
  /\b(architecture|stack|boundary|owner|ownership|runtime|workflow|temporal|database|postgres|projection|contract|package|app|service|adapter|integration|source of truth|forbidden|must|must not|do not|invariant|queue|worker|api|route|data flow|publication|tracker)\b/i;

function parseArgs(argv) {
  const args = {
    project: process.cwd(),
    maxLines: 80,
    maxFiles: 40,
    include: [],
    exclude: [],
    architectureFiles: [],
    commands: [],
    knownFailures: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      args.project = argv[++index];
    } else if (arg === "--evidence") {
      args.evidence = argv[++index];
    } else if (arg === "--max-lines") {
      args.maxLines = Number.parseInt(argv[++index], 10);
    } else if (arg === "--max-files") {
      args.maxFiles = Number.parseInt(argv[++index], 10);
    } else if (arg === "--include") {
      args.include.push(argv[++index]);
    } else if (arg === "--exclude") {
      args.exclude.push(argv[++index]);
    } else if (arg === "--scope") {
      args.scope = argv[++index];
    } else if (arg === "--forbidden-scope") {
      args.forbiddenScope = argv[++index];
    } else if (arg === "--live-gates") {
      args.liveGates = argv[++index];
    } else if (arg === "--runtime-protocol") {
      args.runtimeProtocol = argv[++index];
    } else if (arg === "--impact-triage") {
      args.impactTriage = argv[++index];
    } else if (arg === "--current-slice") {
      args.currentSlice = argv[++index];
    } else if (arg === "--plan-excerpt") {
      args.planExcerpts = [...(args.planExcerpts ?? []), argv[++index]];
    } else if (arg === "--command" || arg === "--commands") {
      args.commands.push(argv[++index]);
    } else if (arg === "--known-failure" || arg === "--known-failures") {
      args.knownFailures.push(argv[++index]);
    } else if (arg === "--findings") {
      args.findings = argv[++index];
    } else if (arg === "--verification") {
      args.verification = argv[++index];
    } else if (arg === "--traceability") {
      args.traceability = argv[++index];
    } else if (arg === "--delta") {
      args.delta = argv[++index];
    } else if (arg === "--architecture-file") {
      args.architectureFiles.push(argv[++index]);
    } else if (arg === "--no-architecture") {
      args.noArchitecture = true;
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

function gitPathspecs(include, exclude) {
  const included = include.length > 0 ? include : exclude.length > 0 ? ["."] : [];
  return [...included, ...exclude.map((entry) => `:(exclude)${entry}`)];
}

function withPathspecs(args, pathspecs) {
  if (pathspecs.length === 0) {
    return args;
  }
  return [...args, "--", ...pathspecs];
}

function splitNonEmptyLines(text) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function limitLines(lines, maxLines, omittedLabel) {
  if (!Number.isFinite(maxLines) || maxLines <= 0) {
    return [];
  }
  if (lines.length <= maxLines) {
    return lines;
  }
  const visible = lines.slice(0, Math.max(0, maxLines - 1));
  return [...visible, `- ... ${lines.length - visible.length} ${omittedLabel} omitted`];
}

function listLines(text, fallback = "- none", maxLines = 40, omittedLabel = "lines") {
  const lines = splitNonEmptyLines(text);
  if (lines.length === 0) {
    return fallback;
  }
  return limitLines(
    lines.map((line) => `- ${line}`),
    maxLines,
    omittedLabel
  ).join("\n");
}

function blockLines(text, fallback = "- none", maxLines = 24, omittedLabel = "lines") {
  const lines = splitNonEmptyLines(text);
  if (lines.length === 0) {
    return fallback;
  }
  return limitLines(lines, maxLines, omittedLabel).join("\n");
}

function uniqueLines(...texts) {
  return [...new Set(texts.join("\n").split("\n").filter(Boolean))].join("\n");
}

function extractCurrentState(evidencePath) {
  if (!evidencePath) {
    return "";
  }
  try {
    const text = readFileSync(path.resolve(evidencePath), "utf8");
    const match = text.match(/^## Current State\s*\n([\s\S]*?)(?=\n## |\s*$)/m);
    if (!match) {
      return "";
    }
    return match[1].trim();
  } catch {
    return "";
  }
}

function readOptionalText(filePath) {
  if (!filePath) {
    return "";
  }
  try {
    return readFileSync(path.resolve(filePath), "utf8");
  } catch {
    return "";
  }
}

function compactArchitectureLine(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^#+\s+/, "")
    .trim()
    .slice(0, 220);
}

function readArchitectureOrientation(projectRoot, explicitFiles) {
  const candidates = explicitFiles.length > 0 ? explicitFiles : ARCHITECTURE_DOC_CANDIDATES;
  const sourceDocs = [];
  const headings = [];
  const signals = [];

  for (const candidate of candidates) {
    const relativePath = path.isAbsolute(candidate) ? path.relative(projectRoot, candidate) : candidate;
    const text = readOptionalText(path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate));
    if (!text) {
      continue;
    }
    sourceDocs.push(relativePath);
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (heading && headings.length < 12) {
        const level = heading[1].length;
        const title = compactArchitectureLine(heading[2]);
        headings.push(`${relativePath}:${lineNumber} ${"  ".repeat(Math.max(0, level - 1))}${title}`);
        continue;
      }
      const normalized = compactArchitectureLine(line);
      if (
        normalized &&
        normalized.length >= 24 &&
        ARCHITECTURE_SIGNAL_PATTERN.test(normalized) &&
        signals.length < 16
      ) {
        signals.push(`${relativePath}:${lineNumber} ${normalized}`);
      }
    }
  }

  if (sourceDocs.length === 0) {
    return "";
  }

  return [
    "Source docs:",
    ...sourceDocs.map((docPath) => `- ${docPath}`),
    "",
    "Key headings:",
    ...(headings.length > 0 ? headings.map((line) => `- ${line}`) : ["- none detected"]),
    "",
    "High-signal notes:",
    ...(signals.length > 0 ? signals.map((line) => `- ${line}`) : ["- none detected"])
  ].join("\n");
}

function sidecarPath(projectRoot, explicitPath, defaultRelativePath) {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }
  return path.join(projectRoot, defaultRelativePath);
}

function markdownRows(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line))
    .filter((line) => !/^\|\s*id\s*\|/i.test(line))
    .filter((line) => !/^\|\s*changed surface\s*\|/i.test(line));
}

function priorityForLine(line) {
  const text = line.toLowerCase();
  if (/\|\s*p0\s*\|/.test(text) && /\|\s*open\s*\|/.test(text)) return 0;
  if (/\|\s*p1\s*\|/.test(text) && /\|\s*open\s*\|/.test(text)) return 1;
  if (/\|\s*gap_found\s*\|?$/i.test(line)) return 2;
  if (/\bfailed\b|\bfail\b/.test(text)) return 3;
  if (/\bblocked_live_or_external_gate\b|\|\s*blocked\s*\|/.test(text)) return 4;
  if (/\|\s*accepted_risk\s*\|/.test(text)) return 5;
  if (/\|\s*p2\s*\|/.test(text) && /\|\s*open\s*\|/.test(text)) return 6;
  if (/\bmissing\b|\brequired\b/.test(text)) return 7;
  if (/\|\s*todo\s*\|?$/i.test(line) || /\btodo\b/.test(text)) return 8;
  return 20;
}

function prioritizeRows(rows) {
  return rows
    .map((line, index) => ({ line, index, priority: priorityForLine(line) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map((row) => row.line);
}

function relevantFindingRows(text) {
  const rows = markdownRows(text).filter((line) => /\|\s*FIND-\d+/.test(line));
  const relevant = rows.filter((line) => /\|\s*(open|accepted_risk|blocked)\s*\|/i.test(line));
  return prioritizeRows(relevant).join("\n");
}

function relevantTraceabilityRows(text) {
  const rows = markdownRows(text).filter((line) => /\|\s*(PLAN|CHK)-\d+/.test(line));
  const relevant = rows.filter((line) =>
    /\|\s*(TODO|gap_found|accepted_risk|blocked_live_or_external_gate)\s*\|?$/i.test(line)
  );
  return prioritizeRows(relevant).join("\n");
}

function relevantVerificationRows(text) {
  const rows = markdownRows(text);
  const relevant = rows.filter((line) => /\b(TODO|failed|fail|blocked|required|missing)\b/i.test(line));
  return prioritizeRows(relevant).join("\n");
}

function relevantDelta(text) {
  return splitNonEmptyLines(text)
    .filter((line) => !/^#/.test(line) || /^#{1,3}\s/.test(line))
    .slice(0, 24)
    .join("\n");
}

function extractCurrentStateField(currentState, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = currentState.match(new RegExp(`^-\\s*${escaped}:\\s*(.*)$`, "im"));
  const value = match?.[1]?.trim();
  if (!value || /^(todo|none detected)$/i.test(value)) {
    return "";
  }
  return value;
}

function asList(values) {
  return values.filter(Boolean).map((value) => `- ${value}`).join("\n");
}

function section(title, body) {
  const normalized = body.trim();
  if (!normalized || normalized === "- none") {
    return "";
  }
  return `\n## ${title}\n${normalized}\n`;
}

function metadataLine(label, value) {
  const normalized = String(value ?? "").trim();
  return normalized ? `- ${label}: ${normalized}` : undefined;
}

function capsFor(maxLines, maxFiles) {
  if (!Number.isFinite(maxLines) || maxLines <= 0) {
    return {
      changedFiles: maxFiles,
      status: 40,
      diffstat: 24,
      stagedDiffstat: 16,
      architecture: 28,
      evidence: 32,
      stateRows: 20
    };
  }
  const scale = Math.min(1, Math.max(0.45, maxLines / 100));
  return {
    changedFiles: Math.max(8, Math.min(maxFiles, Math.floor(36 * scale))),
    status: Math.max(8, Math.floor(28 * scale)),
    diffstat: Math.max(5, Math.floor(16 * scale)),
    stagedDiffstat: Math.max(4, Math.floor(10 * scale)),
    architecture: Math.max(8, Math.floor(18 * scale)),
    evidence: Math.max(10, Math.floor(22 * scale)),
    stateRows: Math.max(5, Math.floor(14 * scale))
  };
}

function renderPacket(data, caps) {
  const scope = data.scope || (data.include.length > 0 ? data.include.join(", ") : "");
  const forbiddenScope = data.forbiddenScope || (data.exclude.length > 0 ? data.exclude.join(", ") : "");
  const metadata = [
    metadataLine("scope", scope),
    metadataLine("forbidden scope", forbiddenScope),
    metadataLine("live gates", data.liveGates),
    metadataLine("runtime protocol", data.runtimeProtocol),
    metadataLine("branch", data.branch),
    metadataLine("impact triage", data.impactTriage),
    metadataLine("current checklist slice", data.currentSlice),
    metadataLine("include filters", data.include.length > 0 ? data.include.join(", ") : ""),
    metadataLine("exclude filters", data.exclude.length > 0 ? data.exclude.join(", ") : "")
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    section("Architecture Orientation", blockLines(data.architectureOrientation, "", caps.architecture, "architecture lines")),
    section("Changed Files", listLines(data.changedFiles, "", caps.changedFiles, "changed files")),
    section("Git Status", listLines(data.status, "", caps.status, "status lines")),
    section("Diffstat", blockLines(data.diffStat, "", caps.diffstat, "diffstat lines")),
    section("Staged Diffstat", blockLines(data.stagedDiffStat, "", caps.stagedDiffstat, "staged diffstat lines")),
    section("Plan/Checklist Excerpts", asList(data.planExcerpts)),
    section("Current Evidence Summary", blockLines(data.currentState, "", caps.evidence, "evidence lines")),
    section("Commands Already Run", asList(data.commands)),
    section("Known Failures", asList(data.knownFailures)),
    section("Open Finding IDs", asList([data.openFindings])),
    section("Accepted Risks", asList([data.acceptedRisks])),
    section("Open Finding Rows", blockLines(data.findings, "", caps.stateRows, "finding rows")),
    section("Gap/Blocked Traceability Rows", blockLines(data.traceability, "", caps.stateRows, "traceability rows")),
    section("Verification Rows Needing Attention", blockLines(data.verification, "", caps.stateRows, "verification rows")),
    section("Latest Delta Summary", blockLines(data.delta, "", caps.stateRows, "delta lines"))
  ].join("");

  return `# Reviewer Context Packet Draft\n\n${metadata || "- metadata unavailable"}\n${sections}`;
}

function countLines(text) {
  return text.split("\n").length;
}

function renderWithinBudget(data, maxLines, initialCaps) {
  if (!Number.isFinite(maxLines) || maxLines <= 0) {
    return renderPacket(data, initialCaps);
  }

  const caps = { ...initialCaps };
  const minimums = {
    changedFiles: 6,
    status: 5,
    diffstat: 3,
    stagedDiffstat: 2,
    architecture: 5,
    evidence: 8,
    stateRows: 4
  };
  const shrinkOrder = ["status", "diffstat", "stagedDiffstat", "changedFiles", "architecture", "evidence", "stateRows"];

  let packet = renderPacket(data, caps);
  while (countLines(packet) > maxLines) {
    const target = shrinkOrder.find((name) => caps[name] > minimums[name]);
    if (!target) {
      break;
    }
    caps[target] -= 1;
    packet = renderPacket(data, caps);
  }

  if (countLines(packet) <= maxLines) {
    return packet;
  }

  const emergencyCaps = {
    changedFiles: 4,
    status: 3,
    diffstat: 2,
    stagedDiffstat: 1,
    architecture: 3,
    evidence: 5,
    stateRows: 3
  };
  return `${renderPacket(data, emergencyCaps)}
<!-- context packet exceeded ${maxLines} lines after priority compression; increase --max-lines only when a reviewer needs the omitted details -->`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: draft-context-packet.mjs --project /path/to/project [--evidence EVIDENCE.md] [--max-lines 80] [--max-files 40] [--include PATH] [--exclude PATH] [--scope TEXT] [--forbidden-scope TEXT] [--live-gates TEXT] [--runtime-protocol TEXT] [--impact-triage TEXT] [--current-slice TEXT] [--plan-excerpt TEXT] [--command TEXT] [--known-failure TEXT] [--findings FILE] [--verification FILE] [--traceability FILE] [--delta FILE] [--architecture-file FILE] [--no-architecture]"
    );
    return;
  }

  const projectRoot = path.resolve(args.project);
  const pathspecs = gitPathspecs(args.include, args.exclude);
  const branch = runGit(projectRoot, ["branch", "--show-current"]) || "unknown";
  const status = runGit(projectRoot, withPathspecs(["status", "--short"], pathspecs));
  const diffStat = runGit(projectRoot, withPathspecs(["diff", "--stat"], pathspecs));
  const stagedDiffStat = runGit(projectRoot, withPathspecs(["diff", "--cached", "--stat"], pathspecs));
  const changedFiles = runGit(projectRoot, withPathspecs(["diff", "--name-only"], pathspecs));
  const stagedFiles = runGit(projectRoot, withPathspecs(["diff", "--cached", "--name-only"], pathspecs));
  const untrackedFiles = runGit(
    projectRoot,
    withPathspecs(["ls-files", "--others", "--exclude-standard"], pathspecs)
  );
  const currentState = extractCurrentState(args.evidence);
  const findings = relevantFindingRows(
    readOptionalText(sidecarPath(projectRoot, args.findings, ".agentic-loop/findings.md"))
  );
  const verification = relevantVerificationRows(
    readOptionalText(sidecarPath(projectRoot, args.verification, ".agentic-loop/verification.md"))
  );
  const traceability = relevantTraceabilityRows(
    readOptionalText(sidecarPath(projectRoot, args.traceability, ".agentic-loop/traceability.md"))
  );
  const delta = relevantDelta(readOptionalText(sidecarPath(projectRoot, args.delta, ".agentic-loop/delta.md")));
  const architectureOrientation = args.noArchitecture
    ? ""
    : readArchitectureOrientation(projectRoot, args.architectureFiles);

  const data = {
    branch,
    include: args.include,
    exclude: args.exclude,
    scope: args.scope,
    forbiddenScope: args.forbiddenScope,
    liveGates: args.liveGates,
    runtimeProtocol: args.runtimeProtocol || extractCurrentStateField(currentState, "runtime protocol"),
    impactTriage: args.impactTriage,
    currentSlice: args.currentSlice || extractCurrentStateField(currentState, "active slice"),
    planExcerpts: args.planExcerpts ?? [],
    commands: args.commands,
    knownFailures: args.knownFailures,
    status,
    diffStat,
    stagedDiffStat,
    changedFiles: uniqueLines(changedFiles, stagedFiles, untrackedFiles),
    architectureOrientation,
    currentState,
    openFindings: extractCurrentStateField(currentState, "open findings"),
    acceptedRisks: extractCurrentStateField(currentState, "accepted risks"),
    findings,
    verification,
    traceability,
    delta
  };

  console.log(renderWithinBudget(data, args.maxLines, capsFor(args.maxLines, args.maxFiles)));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
