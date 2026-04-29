"use strict";

// ─────────────────────────────────────────────
// index.js
// Entry point for the UI Meta-Model Engine.
// Orchestrates the three pipeline phases:
//   Phase 1 — Load & Validate  (loader.js)
//   Phase 2 — Merge            (merger.js)
//   Phase 3 — Produce AUT      (producer.js)
//
// Usage:
//   node index.js <path-to-manifest.json> [output-path]
//
// Example:
//   node index.js ./config/manifest.json ./output/aut.json
// ─────────────────────────────────────────────

const fs      = require("fs");
const path    = require("path");
const { load }    = require("./loader");
const { merge }   = require("./merger");
const { produce } = require("./producer");

// ── CONSOLE HELPERS ───────────────────────────

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const GRAY   = "\x1b[90m";

function log(symbol, color, label, value = "") {
  console.log(`  ${color}${symbol}${RESET} ${BOLD}${label}${RESET}${value ? `  ${GRAY}${value}${RESET}` : ""}`);
}

function printHeader(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ${RESET}`);
}

function printErrors(phase, errors) {
  console.log(`\n${RED}${BOLD}✗ Failed at phase: ${phase}${RESET}`);
  errors.forEach(e => console.log(`  ${RED}•${RESET} ${e}`));
  console.log();
}

// ── WRITE OUTPUT ──────────────────────────────

function writeOutput(aut, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(aut, null, 2), "utf8");
}

// ── AUT STATS ─────────────────────────────────
// Walks the AUT and collects summary statistics for display

function collectStats(aut) {
  let totalFields   = 0;
  let hiddenFields  = 0;
  let hiddenSections = 0;
  let totalConstraints = 0;

  for (const step of aut.steps) {
    for (const section of step.sections) {
      if (section.state === "hidden") hiddenSections++;
      for (const field of section.fields) {
        totalFields++;
        if (field.state === "hidden") hiddenFields++;
        totalConstraints += field.constraints.length;
      }
    }
  }

  return {
    steps:           aut.steps.length,
    totalFields,
    hiddenFields,
    visibleFields:   totalFields - hiddenFields,
    hiddenSections,
    totalConstraints,
    behaviourRules:  aut.behaviourRules.length,
  };
}

// ── MAIN ──────────────────────────────────────

function main() {
  const args         = process.argv.slice(2);
  const manifestPath = args[0];
  const outputPath   = args[1] || "./output/aut.json";

  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════╗`);
  console.log(`║     UI Meta-Model Engine  v1.0.0         ║`);
  console.log(`╚══════════════════════════════════════════╝${RESET}`);

  if (!manifestPath) {
    console.log(`\n${RED}Usage: node index.js <manifest.json> [output.json]${RESET}\n`);
    process.exit(1);
  }

  // ── PHASE 1: LOAD & VALIDATE ─────────────────
  printHeader("Phase 1 — Load & Validate");

  const loaded = load(manifestPath);

  if (!loaded.ok) {
    printErrors(loaded.phase, loaded.errors);
    process.exit(1);
  }

  log("✓", GREEN, "Manifest loaded",  loaded.manifest.id);
  log("✓", GREEN, "Domain",           loaded.manifest.domain);
  log("✓", GREEN, "Locale",           loaded.manifest.locale);
  log("✓", GREEN, "Layers loaded",    Object.keys(loaded.layers).join(", "));
  log("✓", GREEN, "Fields in schema", loaded.layers.data.fields.length);

  console.log(`\n  ${GRAY}Validation checks:${RESET}`);
  loaded.summary.forEach(s =>
    log("✓", GREEN, s.check)
  );

  // ── PHASE 2: MERGE ────────────────────────────
  printHeader("Phase 2 — Merge");

  const merged = merge(loaded.layers, loaded.metamodel);

  if (!merged.ok) {
    printErrors("merge", merged.errors);
    process.exit(1);
  }

  const fieldCount   = Object.keys(merged.fieldIndex).length;
  const sectionCount = Object.keys(merged.sectionIndex).length;
  const hiddenFields = Object.values(merged.fieldIndex)
    .filter(f => f.state === "hidden").length;
  const hiddenSections = Object.values(merged.sectionIndex)
    .filter(s => s.state === "hidden").length;

  log("✓", GREEN, "Fields merged",          `${fieldCount} total`);
  log("✓", GREEN, "Initial state resolved", `${fieldCount - hiddenFields} visible, ${hiddenFields} hidden`);
  log("✓", GREEN, "Sections indexed",       `${sectionCount} total, ${hiddenSections} initially hidden`);
  log("✓", GREEN, "Behaviour rules",        `${merged.behaviourRules.length} carried through`);

  // ── PHASE 3: PRODUCE AUT ──────────────────────
  printHeader("Phase 3 — Produce AUT");

  const result = produce(loaded.manifest, loaded.layers, merged);

  if (!result.ok) {
    printErrors("produce", result.errors);
    process.exit(1);
  }

  const stats = collectStats(result.aut);

  log("✓", GREEN, "AUT root emitted",    result.aut.formId);
  log("✓", GREEN, "Steps",               stats.steps);
  log("✓", GREEN, "Fields",              `${stats.visibleFields} visible, ${stats.hiddenFields} initially hidden`);
  log("✓", GREEN, "Constraints",         `${stats.totalConstraints} total across all fields`);
  log("✓", GREEN, "Behaviour rules",     stats.behaviourRules);

  // ── WRITE OUTPUT ──────────────────────────────
  printHeader("Output");

  try {
    writeOutput(result.aut, outputPath);
    log("✓", GREEN, "AUT written to", path.resolve(outputPath));
  } catch (e) {
    printErrors("output", [e.message]);
    process.exit(1);
  }

  // ── DONE ──────────────────────────────────────
  console.log(`\n${GREEN}${BOLD}  ✓ Engine complete — AUT produced successfully${RESET}`);
  console.log(`${GRAY}  Form: ${result.aut.formId} · Domain: ${result.aut.domain} · ${stats.steps} steps · ${stats.totalFields} fields${RESET}\n`);
}

main();
