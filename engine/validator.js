"use strict";

// ─────────────────────────────────────────────
// validator.js
// Validates each config layer against the metamodel.
// All functions return { valid: boolean, errors: string[] }
// so the engine can collect all errors before stopping.
// ─────────────────────────────────────────────

// ── HELPER ──────────────────────────────────

function result(errors) {
  return { valid: errors.length === 0, errors };
}

// ── 1. VALIDATE FIELD DATA TYPES ────────────
// Every field type in data.json must exist in metamodel.dataTypes

function validateFieldTypes(dataLayer, metamodel) {
  const errors = [];
  const knownTypes = Object.keys(metamodel.dataTypes);

  for (const field of dataLayer.fields) {
    if (!field.type) {
      errors.push(`[data] Field "${field.id}" is missing a type`);
      continue;
    }
    if (!knownTypes.includes(field.type)) {
      errors.push(
        `[data] Field "${field.id}" has unknown type "${field.type}". ` +
        `Known types: ${knownTypes.join(", ")}`
      );
    }

    // If enum, must have source
    if (field.type === "enum" && !field.source) {
      errors.push(`[data] Enum field "${field.id}" is missing required prop "source"`);
    }

    // If enum with source=static, must have options array
    if (field.type === "enum" && field.source === "static" && (!field.options || field.options.length === 0)) {
      errors.push(`[data] Enum field "${field.id}" has source=static but no options defined`);
    }

    // If currency, must have currency code
    if (field.type === "currency" && !field.currency) {
      errors.push(`[data] Currency field "${field.id}" is missing required prop "currency"`);
    }
  }

  return result(errors);
}

// ── 2. VALIDATE COMPONENT MAPPINGS ──────────
// Every component in components.json must:
// (a) exist in metamodel.components
// (b) be compatible with the field's data type
// (c) only use props defined in the component's prop schema

function validateComponentMappings(componentsLayer, dataLayer, metamodel) {
  const errors = [];

  // Build a fieldId → dataType lookup from data layer
  const fieldTypeMap = {};
  for (const field of dataLayer.fields) {
    fieldTypeMap[field.id] = field.type;
  }

  const knownComponents = Object.keys(metamodel.components);

  for (const mapping of componentsLayer.components) {
    const { fieldId, component, props = {} } = mapping;

    // (a) Component must exist in registry
    if (!knownComponents.includes(component)) {
      errors.push(
        `[components] Field "${fieldId}" maps to unknown component "${component}". ` +
        `Known components: ${knownComponents.join(", ")}`
      );
      continue;
    }

    // Field must exist in data layer
    if (!fieldTypeMap[fieldId]) {
      errors.push(`[components] Field "${fieldId}" in components.json not found in data.json`);
      continue;
    }

    const dataType = fieldTypeMap[fieldId];
    const componentDef = metamodel.components[component];

    // (b) Component must be compatible with field's data type
    if (!componentDef.compatibleTypes.includes(dataType)) {
      errors.push(
        `[components] Field "${fieldId}" has type "${dataType}" but component "${component}" ` +
        `only supports: ${componentDef.compatibleTypes.join(", ")}`
      );
    }

    // (c) Props must be defined in the component's prop schema
    const knownProps = Object.keys(componentDef.props);
    for (const propKey of Object.keys(props)) {
      if (!knownProps.includes(propKey)) {
        errors.push(
          `[components] Field "${fieldId}" component "${component}" ` +
          `has unknown prop "${propKey}". Known props: ${knownProps.join(", ")}`
        );
      }
    }
  }

  return result(errors);
}

// ── 3. VALIDATE CONSTRAINTS ──────────────────
// Every constraint in validation.json must:
// (a) exist in metamodel.constraints
// (b) have all required props
// (c) be applicable to the field's data type

function validateConstraints(validationLayer, dataLayer, metamodel) {
  const errors = [];

  // Build fieldId → dataType lookup
  const fieldTypeMap = {};
  for (const field of dataLayer.fields) {
    fieldTypeMap[field.id] = field.type;
  }

  const knownConstraints = Object.keys(metamodel.constraints);

  for (const rule of validationLayer.rules) {
    const { fieldId, constraints = [] } = rule;

    if (!fieldTypeMap[fieldId]) {
      errors.push(`[validation] Field "${fieldId}" in validation.json not found in data.json`);
      continue;
    }

    const dataType = fieldTypeMap[fieldId];

    for (const constraint of constraints) {
      const { type } = constraint;

      // (a) Constraint type must exist
      if (!knownConstraints.includes(type)) {
        errors.push(
          `[validation] Field "${fieldId}" has unknown constraint type "${type}". ` +
          `Known types: ${knownConstraints.join(", ")}`
        );
        continue;
      }

      const constraintDef = metamodel.constraints[type];

      // (b) Required props must be present
      for (const requiredProp of constraintDef.requiredProps) {
        if (constraint[requiredProp] === undefined || constraint[requiredProp] === null) {
          errors.push(
            `[validation] Field "${fieldId}" constraint "${type}" ` +
            `is missing required prop "${requiredProp}"`
          );
        }
      }

      // (c) Constraint must be applicable to this data type
      if (
        constraintDef.applicableTypes &&
        !constraintDef.applicableTypes.includes(dataType)
      ) {
        errors.push(
          `[validation] Field "${fieldId}" (type: "${dataType}") ` +
          `cannot use constraint "${type}" which only applies to: ` +
          `${constraintDef.applicableTypes.join(", ")}`
        );
      }
    }
  }

  return result(errors);
}

// ── 4. VALIDATE ACTIONS ──────────────────────
// Every action type in behaviour.json must exist in metamodel.actions
// and must have all required props

function validateActions(behaviourLayer, metamodel) {
  const errors = [];
  const knownActions = Object.keys(metamodel.actions);

  for (const rule of behaviourLayer.rules) {
    const allActions = [
      ...(rule.actions || []),
      ...(rule.elseActions || []),
    ];

    for (const action of allActions) {
      const { type } = action;

      // Action type must exist
      if (!knownActions.includes(type)) {
        errors.push(
          `[behaviour] Rule "${rule.id}" has unknown action type "${type}". ` +
          `Known types: ${knownActions.join(", ")}`
        );
        continue;
      }

      // Required props must be present
      const actionDef = metamodel.actions[type];
      for (const requiredProp of actionDef.requiredProps) {
        if (action[requiredProp] === undefined || action[requiredProp] === null) {
          errors.push(
            `[behaviour] Rule "${rule.id}" action "${type}" ` +
            `is missing required prop "${requiredProp}"`
          );
        }
      }
    }
  }

  return result(errors);
}

// ── 5. VALIDATE FIELD ID CONSISTENCY ─────────
// Every field referenced across all layers must exist in data.json
// This catches typos and missing field definitions early

function validateFieldIdConsistency(layers, dataLayer) {
  const errors = [];
  const knownFieldIds = new Set(dataLayer.fields.map(f => f.id));

  // Check layout
  for (const step of layers.layout.layout.steps) {
    for (const section of step.sections) {
      for (const fieldId of section.fields) {
        if (!knownFieldIds.has(fieldId)) {
          errors.push(`[layout] Step "${step.id}" section "${section.id}" references unknown field "${fieldId}"`);
        }
      }
    }
  }

  // Check workflow guard fields
  for (const step of layers.workflow.workflow.steps) {
    for (const guard of step.guards || []) {
      for (const fieldId of guard.fields || []) {
        if (!knownFieldIds.has(fieldId)) {
          errors.push(`[workflow] Step "${step.id}" guard references unknown field "${fieldId}"`);
        }
      }
    }
  }

  // Check behaviour targets
  for (const rule of layers.behaviour.rules) {
    const allActions = [...(rule.actions || []), ...(rule.elseActions || [])];
    for (const action of allActions) {
      // Only validate field targets — sections start with "section_"
      if (action.target && !action.target.startsWith("section_")) {
        if (!knownFieldIds.has(action.target)) {
          errors.push(`[behaviour] Rule "${rule.id}" action targets unknown field "${action.target}"`);
        }
      }
    }
    // Check trigger field
    if (rule.trigger && rule.trigger.field && !knownFieldIds.has(rule.trigger.field)) {
      errors.push(`[behaviour] Rule "${rule.id}" trigger references unknown field "${rule.trigger.field}"`);
    }
  }

  return result(errors);
}

// ── RUN ALL VALIDATIONS ───────────────────────
// Called by loader.js with all layers and the metamodel.
// Returns a combined report across all validation checks.

function validateAll(layers, metamodel) {
  const checks = [
    { name: "Field Types",          fn: () => validateFieldTypes(layers.data, metamodel) },
    { name: "Component Mappings",   fn: () => validateComponentMappings(layers.components, layers.data, metamodel) },
    { name: "Constraints",          fn: () => validateConstraints(layers.validation, layers.data, metamodel) },
    { name: "Actions",              fn: () => validateActions(layers.behaviour, metamodel) },
    { name: "Field ID Consistency", fn: () => validateFieldIdConsistency(layers, layers.data) },
  ];

  const report = { valid: true, errors: [], summary: [] };

  for (const check of checks) {
    const res = check.fn();
    report.summary.push({ check: check.name, valid: res.valid, errorCount: res.errors.length });
    if (!res.valid) {
      report.valid = false;
      report.errors.push(...res.errors);
    }
  }

  return report;
}

module.exports = {
  validateAll,
  validateFieldTypes,
  validateComponentMappings,
  validateConstraints,
  validateActions,
  validateFieldIdConsistency,
};
