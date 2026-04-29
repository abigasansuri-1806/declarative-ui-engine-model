"use strict";

// ─────────────────────────────────────────────
// loader.js
// Phase 1 of the engine pipeline.
// Responsibilities:
//   - Read manifest.json from a given path
//   - Locate and load all 8 layer files referenced in the manifest
//   - Parse each file, reporting malformed JSON clearly
//   - Run all metamodel validations via validator.js
//   - Return a structured LoadResult — either layers ready to go,
//     or a full error report. Never throws.
// ─────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");
const { validateAll } = require("./validator");

// ── HELPERS ──────────────────────────────────

// Safely read and parse a JSON file.
// Returns { ok: true, data } or { ok: false, error: string }
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${filePath}` };
  }
  try {
    const raw  = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `Malformed JSON in ${filePath}: ${e.message}` };
  }
}

// ── LOAD MANIFEST ────────────────────────────
// Reads and validates the manifest file.
// Ensures required fields are present before proceeding.

function loadManifest(manifestPath) {
  const res = readJSON(manifestPath);
  if (!res.ok) return { ok: false, error: res.error };

  const manifest = res.data;
  const required = ["id", "version", "domain", "locale", "layers"];
  const missing  = required.filter(k => !manifest[k]);

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Manifest is missing required fields: ${missing.join(", ")}`,
    };
  }

  const requiredLayers = [
    "data", "layout", "components",
    "validation", "behaviour", "workflow", "i18n",
  ];
  const missingLayers = requiredLayers.filter(l => !manifest.layers[l]);

  if (missingLayers.length > 0) {
    return {
      ok: false,
      error: `Manifest.layers is missing entries for: ${missingLayers.join(", ")}`,
    };
  }

  return { ok: true, data: manifest };
}

// ── LOAD ALL LAYERS ──────────────────────────
// Reads every layer file referenced in the manifest.
// Resolves paths relative to the manifest's directory.
// Returns all layers or a list of file-level errors.

function loadLayers(manifest, manifestDir) {
  const errors  = [];
  const loaded  = {};

  for (const [layerName, relativePath] of Object.entries(manifest.layers)) {
    const absolutePath = path.resolve(manifestDir, relativePath);
    const res = readJSON(absolutePath);

    if (!res.ok) {
      errors.push(res.error);
    } else {
      loaded[layerName] = res.data;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, layers: loaded };
}

// ── LOAD METAMODEL ───────────────────────────
// Reads metamodel.json from the engine's own directory.
// The metamodel is always co-located with the engine, not the config.

function loadMetamodel(engineDir) {
  const metamodelPath = path.resolve(engineDir, "../metamodel/metamodel.json");
  const res = readJSON(metamodelPath);
  if (!res.ok) {
    return { ok: false, error: `Could not load metamodel: ${res.error}` };
  }
  return { ok: true, data: res.data };
}

// ── MAIN LOAD FUNCTION ───────────────────────
// Orchestrates the full loading pipeline.
// Called by index.js with the path to manifest.json.
//
// Returns a LoadResult:
// {
//   ok: true,
//   manifest: {...},
//   layers: { data, layout, components, validation, behaviour, workflow, i18n },
//   metamodel: {...}
// }
// or
// {
//   ok: false,
//   phase: "manifest" | "files" | "validation",
//   errors: string[]
// }

function load(manifestPath) {
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const engineDir   = __dirname;

  // ── Step 1: Load metamodel
  const metamodelResult = loadMetamodel(engineDir);
  if (!metamodelResult.ok) {
    return { ok: false, phase: "metamodel", errors: [metamodelResult.error] };
  }
  const metamodel = metamodelResult.data;

  // ── Step 2: Load and validate manifest structure
  const manifestResult = loadManifest(manifestPath);
  if (!manifestResult.ok) {
    return { ok: false, phase: "manifest", errors: [manifestResult.error] };
  }
  const manifest = manifestResult.data;

  // ── Step 3: Load all layer files
  const layersResult = loadLayers(manifest, manifestDir);
  if (!layersResult.ok) {
    return { ok: false, phase: "files", errors: layersResult.errors };
  }
  const layers = layersResult.layers;

  // ── Step 4: Run all metamodel validations
  const validationReport = validateAll(layers, metamodel);
  if (!validationReport.valid) {
    return {
      ok: false,
      phase: "validation",
      errors: validationReport.errors,
      summary: validationReport.summary,
    };
  }

  // ── All clear — return everything the engine needs
  return {
    ok: true,
    manifest,
    layers,
    metamodel,
    summary: validationReport.summary,
  };
}

module.exports = { load };
