"use strict";

// ─────────────────────────────────────────────
// merger.js
// Phase 2 of the engine pipeline.
// Responsibilities:
//   - Build a behaviour index: fieldId → rule IDs that reference it
//   - Merge data + components + validation + i18n per field
//   - Resolve initial field state from fieldStates in metamodel
//   - Produce a fieldIndex: fieldId → merged field object
//   - Produce a sectionIndex: sectionId → initial visibility state
//   - Return everything the producer needs to build the AUT
// ─────────────────────────────────────────────

// ── HELPERS ──────────────────────────────────

// Build a lookup map from an array keyed by a given property
function indexBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
}

// ── BUILD BEHAVIOUR INDEX ─────────────────────
// For each behaviour rule, find every field it references —
// either as a trigger field or as an action/elseAction target.
// Returns: { fieldId: [ruleId, ruleId, ...], ... }

function buildBehaviourIndex(behaviourLayer) {
  const index = {};

  function addToIndex(fieldId, ruleId) {
    if (!fieldId) return;
    if (!index[fieldId]) index[fieldId] = [];
    if (!index[fieldId].includes(ruleId)) {
      index[fieldId].push(ruleId);
    }
  }

  for (const rule of behaviourLayer.rules) {
    // Index trigger field
    if (rule.trigger && rule.trigger.field) {
      addToIndex(rule.trigger.field, rule.id);
    }

    // Index all action targets (skip section targets)
    const allActions = [...(rule.actions || []), ...(rule.elseActions || [])];
    for (const action of allActions) {
      if (action.target && !action.target.startsWith("section_")) {
        addToIndex(action.target, rule.id);
      }
    }

    // Index fields referenced inside condition operands
    if (rule.condition) {
      const condFields = extractFieldsFromCondition(rule.condition);
      for (const fieldId of condFields) {
        addToIndex(fieldId, rule.id);
      }
    }
  }

  return index;
}

// Recursively extract all field IDs referenced in a condition object
function extractFieldsFromCondition(condition) {
  const fields = [];
  if (!condition) return fields;

  if (condition.field) {
    // Simple comparison condition
    fields.push(condition.field);
  } else if (condition.operands) {
    // Compound condition — recurse into each operand
    for (const operand of condition.operands) {
      fields.push(...extractFieldsFromCondition(operand));
    }
  }

  return fields;
}

// ── BUILD SECTION BEHAVIOUR INDEX ────────────
// Same as behaviour index but for section targets.
// Returns: { sectionId: [ruleId, ...], ... }

function buildSectionBehaviourIndex(behaviourLayer) {
  const index = {};

  for (const rule of behaviourLayer.rules) {
    const allActions = [...(rule.actions || []), ...(rule.elseActions || [])];
    for (const action of allActions) {
      if (action.target && action.target.startsWith("section_")) {
        if (!index[action.target]) index[action.target] = [];
        if (!index[action.target].includes(rule.id)) {
          index[action.target].push(rule.id);
        }
      }
    }
  }

  return index;
}

// ── RESOLVE INITIAL FIELD STATE ───────────────
// Determines whether a field starts as visible or hidden.
// A field is initially hidden if any behaviour rule's elseActions
// contain a hide action targeting it — meaning the default
// state when the trigger condition is false is hidden.
// All other fields default to "visible".

function resolveInitialState(fieldId, behaviourLayer, metamodel) {
  const defaultState = metamodel.fieldStates.defaultState; // "visible"

  for (const rule of behaviourLayer.rules) {
    // If elseActions hide this field, it starts hidden
    // (condition is false on initial load)
    if (rule.elseActions) {
      for (const action of rule.elseActions) {
        if (action.type === "hide" && action.target === fieldId) {
          return "hidden";
        }
      }
    }
  }

  return defaultState;
}

// ── RESOLVE INITIAL SECTION STATE ────────────
// Same logic for sections.

function resolveInitialSectionState(sectionId, behaviourLayer, metamodel) {
  const defaultState = metamodel.fieldStates.defaultState;

  for (const rule of behaviourLayer.rules) {
    if (rule.elseActions) {
      for (const action of rule.elseActions) {
        if (action.type === "hide" && action.target === sectionId) {
          return "hidden";
        }
      }
    }
  }

  return defaultState;
}

// ── RESOLVE I18N FOR FIELD ────────────────────
// Pulls label, placeholder and helpText from the i18n layer.
// Falls back to the fieldId itself if no i18n entry exists.

function resolveI18n(fieldId, i18nLayer) {
  const entry = i18nLayer.fields && i18nLayer.fields[fieldId];
  if (!entry) {
    return { label: fieldId, placeholder: null, helpText: null };
  }
  return {
    label:       entry.label       || fieldId,
    placeholder: entry.placeholder || null,
    helpText:    entry.helpText    || null,
  };
}

// ── MERGE SINGLE FIELD ────────────────────────
// Assembles one merged field object from all relevant layers.
// This is the core merge operation — called once per field ID.

function mergeField(fieldId, indexes, layers, metamodel) {
  const { dataIndex, componentIndex, validationIndex, behaviourIndex } = indexes;

  // ── Data layer
  const dataField = dataIndex[fieldId];
  if (!dataField) {
    throw new Error(`[merger] Field "${fieldId}" not found in data layer`);
  }

  // ── Components layer
  const componentMapping = componentIndex[fieldId];
  if (!componentMapping) {
    throw new Error(`[merger] Field "${fieldId}" has no component mapping`);
  }

  // ── Validation layer
  const validationRule = validationIndex[fieldId] || { required: false, constraints: [] };

  // ── Behaviour bindings
  const behaviourBindings = behaviourIndex[fieldId] || [];

  // ── Initial state
  const initialState = resolveInitialState(fieldId, layers.behaviour, metamodel);

  // ── i18n
  const i18n = resolveI18n(fieldId, layers.i18n);

  // ── Assembled merged field object
  return {
    fieldId,
    dataType:   dataField.type,
    // Carry forward data-level intrinsic props that the producer may need
    dataProps:  buildDataProps(dataField),
    component:  componentMapping.component,
    props:      componentMapping.props || {},
    state:      initialState,
    required:   validationRule.required === true,
    constraints: validationRule.constraints || [],
    behaviourBindings,
    i18n,
  };
}

// Extract non-structural props from a data field definition
// (everything except id, type, nullable)
function buildDataProps(dataField) {
  const excluded = new Set(["id", "type", "nullable"]);
  const props = {};
  for (const [k, v] of Object.entries(dataField)) {
    if (!excluded.has(k)) props[k] = v;
  }
  return props;
}

// ── MERGE ALL FIELDS ──────────────────────────
// Builds a fieldIndex: { fieldId: mergedField, ... }
// Called once during Phase 2.

function mergeAllFields(layers, metamodel) {
  const errors = [];

  // Build lookup indexes from each layer
  const dataIndex       = indexBy(layers.data.fields, "id");
  const componentIndex  = indexBy(layers.components.components, "fieldId");
  const validationIndex = indexBy(layers.validation.rules, "fieldId");
  const behaviourIndex  = buildBehaviourIndex(layers.behaviour);

  const indexes = { dataIndex, componentIndex, validationIndex, behaviourIndex };

  const fieldIndex = {};

  for (const field of layers.data.fields) {
    try {
      fieldIndex[field.id] = mergeField(field.id, indexes, layers, metamodel);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, fieldIndex };
}

// ── BUILD SECTION INDEX ───────────────────────
// Builds a sectionIndex: { sectionId: { state } }
// So the producer knows each section's initial visibility.

function buildSectionIndex(layers, metamodel) {
  const sectionBehaviourIndex = buildSectionBehaviourIndex(layers.behaviour);
  const sectionIndex = {};

  for (const step of layers.layout.layout.steps) {
    for (const section of step.sections) {
      sectionIndex[section.id] = {
        state:             resolveInitialSectionState(section.id, layers.behaviour, metamodel),
        behaviourBindings: sectionBehaviourIndex[section.id] || [],
      };
    }
  }

  return sectionIndex;
}

// ── MAIN MERGE FUNCTION ───────────────────────
// Called by index.js after a successful load.
// Returns a MergeResult:
// {
//   ok: true,
//   fieldIndex:   { fieldId: mergedField, ... },
//   sectionIndex: { sectionId: { state, behaviourBindings }, ... },
//   behaviourRules: [ all behaviour rules — passed through to AUT root ]
// }
// or
// {
//   ok: false,
//   errors: string[]
// }

function merge(layers, metamodel) {
  // Merge all fields
  const fieldResult = mergeAllFields(layers, metamodel);
  if (!fieldResult.ok) {
    return { ok: false, errors: fieldResult.errors };
  }

  // Build section index
  const sectionIndex = buildSectionIndex(layers, metamodel);

  return {
    ok: true,
    fieldIndex:    fieldResult.fieldIndex,
    sectionIndex,
    behaviourRules: layers.behaviour.rules,
  };
}

module.exports = { merge };
