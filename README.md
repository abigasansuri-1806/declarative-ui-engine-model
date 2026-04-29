# Declarative UI Framework

A domain-agnostic, deterministic UI generation engine for regulated business domains (BFSI, Healthcare).

M.Tech Dissertation — BITS Pilani WILP · 2024TM93015

---

## What This Is

A low-code framework that generates UI from declarative JSON configuration. Given a form definition expressed across 8 layered config files, the engine produces an **Abstract UI Tree (AUT)** — a self-contained, framework-neutral representation of the UI that any adapter can render.

The engine is:
- **Deterministic** — same config always produces the same AUT
- **Domain-agnostic** — BFSI and Healthcare use cases share the same engine
- **Framework-neutral** — the AUT is consumed by pluggable adapters (React, Angular, Oracle JET)
- **Compliance-ready** — full audit trail, no probabilistic generation

---

## Repo Structure

```
declarative-ui-framework/
│
├── metamodel/
│   └── metamodel.json          ← component registry, constraint types, AUT node schema
│
├── engine/
│   ├── index.js                ← entry point
│   ├── loader.js               ← phase 1: load & validate
│   ├── merger.js               ← phase 2: merge layers per field
│   ├── producer.js             ← phase 3: produce AUT
│   └── validator.js            ← metamodel validation rules
│
├── configs/
│   └── loan-application/       ← BFSI loan application form
│       ├── manifest.json       ← entry point, ties all layers together
│       ├── data.json           ← field definitions and data types
│       ├── layout.json         ← step/section/field structure
│       ├── components.json     ← component mappings and props
│       ├── validation.json     ← constraints and validation rules
│       ├── behaviour.json      ← conditional logic and field dependencies
│       ├── workflow.json       ← step sequencing and navigation guards
│       └── i18n.json           ← labels, placeholders, error messages
│
├── adapters/
│   └── react/                  ← React adapter (renders AUT as React form)
│
├── output/                     ← generated AUT files (gitignored)
│
└── docs/                       ← diagrams and dissertation artifacts
```

---

## How to Run

**Prerequisites:** Node.js (no external dependencies)

**Run the engine:**
```bash
node engine/index.js configs/loan-application/manifest.json output/loan-application-aut.json
```

This runs all three phases and writes the AUT to `output/`.

**Expected output:**
```
── Phase 1 — Load & Validate
  ✓ Manifest loaded   loan-application-v1
  ✓ Layers loaded     data, layout, components, validation, behaviour, workflow, i18n
  ✓ Field Types
  ✓ Component Mappings
  ✓ Constraints
  ✓ Actions
  ✓ Field ID Consistency

── Phase 2 — Merge
  ✓ Fields merged          16 total
  ✓ Initial state resolved 12 visible, 4 hidden

── Phase 3 — Produce AUT
  ✓ AUT root emitted  loan-application-v1
  ✓ Steps             4
  ✓ Fields            12 visible, 4 initially hidden
  ✓ Constraints       22 total across all fields

  ✓ Engine complete — AUT produced successfully
```

---

## Architecture

```
  JSON Config (8 layers)
        │
        ▼
  ┌─────────────┐
  │   Engine    │  loader → merger → producer
  │             │  validated against metamodel
  └─────────────┘
        │
        ▼
  Abstract UI Tree (AUT)
        │
   ┌────┴────┐
   ▼         ▼
 React    Angular     (adapters — coming)
```

---

## Engine Pipeline

| Phase | File | Responsibility |
|---|---|---|
| 1 | loader.js | Read manifest, load all 8 layers, run metamodel validation |
| 2 | merger.js | Merge layers into per-field objects, resolve initial states |
| 3 | producer.js | Walk layout tree, emit AUT nodes |

---

## Current Prototype Scope

- Domain: BFSI — Loan Application form
- Adapter: React (in progress)
- Known limitations: fixed column layout (no responsive), hardcoded English titles (no i18n key references), remote validation async handling deferred

# declarative-ui-engine-model
 A Low-Code Framework For User Interface Generation  Using Declarative Configuration Models 
