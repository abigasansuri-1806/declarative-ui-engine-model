import { useState, useCallback } from "react";
import { evaluate } from "../utils/conditionEvaluator";

// ─────────────────────────────────────────────
// useValidation.js
// React hook — evaluates field constraints from the AUT
// against current form values and manages error state.
//
// Usage:
//   const { errors, validate, validateAll, clearError } = useValidation(autSteps);
//
// validate(fieldId, value, formValues)
//   — evaluates all constraints for a single field
//   — updates errors state
//   — returns true if valid, false if not
//
// validateAll(formValues, fieldIds)
//   — validates a set of fields at once (used by step guards)
//   — returns true if ALL fields pass
// ─────────────────────────────────────────────

// ── CONSTRAINT EVALUATORS ─────────────────────
// One function per constraint type.
// Each returns null if valid, or an error message key if invalid.

const constraintEvaluators = {

  // ── Simple value constraints ─────────────────

  min: (value, constraint) => {
    if (value === null || value === "") return null;
    return Number(value) < constraint.value ? constraint.message : null;
  },

  max: (value, constraint) => {
    if (value === null || value === "") return null;
    return Number(value) > constraint.value ? constraint.message : null;
  },

  minLength: (value, constraint) => {
    if (value === null || value === "") return null;
    return String(value).length < constraint.value ? constraint.message : null;
  },

  maxLength: (value, constraint) => {
    if (value === null || value === "") return null;
    return String(value).length > constraint.value ? constraint.message : null;
  },

  exactLength: (value, constraint) => {
    if (value === null || value === "") return null;
    return String(value).replace(/\s/g, "").length !== constraint.value
      ? constraint.message
      : null;
  },

  pattern: (value, constraint) => {
    if (value === null || value === "") return null;
    const regex = new RegExp(constraint.value);
    return !regex.test(String(value)) ? constraint.message : null;
  },

  mustBeTrue: (value, constraint) => {
    return value !== true ? constraint.message : null;
  },

  // ── Date-based constraints ───────────────────

  minAge: (value, constraint) => {
    if (!value) return null;
    const dob   = new Date(value);
    const today = new Date();
    const age   = today.getFullYear() - dob.getFullYear();
    const hasBirthdayPassed =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    const actualAge = hasBirthdayPassed ? age : age - 1;
    return actualAge < constraint.value ? constraint.message : null;
  },

  maxAge: (value, constraint) => {
    if (!value) return null;
    const dob   = new Date(value);
    const today = new Date();
    const age   = today.getFullYear() - dob.getFullYear();
    const hasBirthdayPassed =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    const actualAge = hasBirthdayPassed ? age : age - 1;
    return actualAge > constraint.value ? constraint.message : null;
  },

  // ── Cross-field constraints ──────────────────

  crossField: (value, constraint, formValues) => {
    if (value === null || value === "") return null;
    const { rule } = constraint;

    // Resolve right operand — may reference another field with arithmetic
    let rightValue;
    if (rule.right && rule.right.field) {
      const baseValue = Number(formValues[rule.right.field]) || 0;
      rightValue = rule.right.multiply ? baseValue * rule.right.multiply : baseValue;
    } else {
      rightValue = rule.right;
    }

    const leftValue = Number(formValues[rule.left]) || 0;
    const ops = {
      "<=": (a, b) => a <= b,
      ">=": (a, b) => a >= b,
      "==": (a, b) => a === b,
      "!=": (a, b) => a !== b,
      "<":  (a, b) => a < b,
      ">":  (a, b) => a > b,
    };
    const opFn = ops[rule.operator];
    if (!opFn) return null;
    return !opFn(leftValue, rightValue) ? constraint.message : null;
  },

  notEqualTo: (value, constraint, formValues) => {
    if (value === null || value === "") return null;
    const otherValue = formValues[constraint.value];
    return value === otherValue ? constraint.message : null;
  },

  conditionalMin: (value, constraint, formValues) => {
    if (value === null || value === "") return null;
    // Only apply if condition is met
    if (!evaluate(constraint.when
      ? { field: Object.keys(constraint)[0], op: "==", value: constraint.when.split(" == ")[1] }
      : constraint.condition, formValues)) return null;

    const baseValue   = Number(formValues[constraint.value.field]) || 0;
    const minRequired = constraint.value.multiply
      ? baseValue * constraint.value.multiply
      : baseValue;
    return Number(value) < minRequired ? constraint.message : null;
  },

  // ── Conditional constraints ──────────────────

  requiredWhen: (value, constraint, formValues) => {
    // Parse the "when" string into a condition object for the evaluator
    const condition = parseWhenString(constraint.when);
    if (!condition) return null;
    const conditionMet = evaluate(condition, formValues);
    if (!conditionMet) return null;
    // Condition is met — field is required
    const isEmpty = value === null || value === "" || value === undefined;
    return isEmpty ? constraint.message : null;
  },

  conditional: (value, constraint, formValues) => {
    // Parse the "when" condition
    const condition = parseWhenString(constraint.when);
    if (!condition) return null;
    const conditionMet = evaluate(condition, formValues);
    if (!conditionMet) return null;
    // Condition met — evaluate the inner "then" constraint
    const innerEvaluator = constraintEvaluators[constraint.then.type];
    if (!innerEvaluator) return null;
    return innerEvaluator(value, constraint.then, formValues);
  },

  // ── Checksum constraints ─────────────────────

  luhn: (value, constraint) => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, "");
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 !== 0 ? constraint.message : null;
  },

  // ── Remote validation ────────────────────────
  // Deferred for prototype — always passes client-side
  remote: () => null,

};

// ── PARSE WHEN STRING ─────────────────────────
// Converts a "when" string like "loan_type == HOME"
// into a structured condition object the evaluator understands.
// Handles simple comparisons only — compound handled separately.

function parseWhenString(when) {
  if (!when || typeof when !== "string") return null;

  for (const op of ["!=", "==", ">=", "<=", ">", "<"]) {
    if (when.includes(op)) {
      const [left, right] = when.split(op).map(s => s.trim());
      const value = right === "null" ? null : right;
      return { field: left, op, value };
    }
  }
  return null;
}

// ── EVALUATE SINGLE CONSTRAINT ────────────────

function evaluateConstraint(constraint, value, formValues) {
  const evaluator = constraintEvaluators[constraint.type];
  if (!evaluator) {
    console.warn(`[useValidation] No evaluator for constraint type "${constraint.type}"`);
    return null;
  }
  return evaluator(value, constraint, formValues);
}

// ── BUILD FIELD CONSTRAINT MAP ────────────────
// Flattens the AUT steps into a fieldId → constraints lookup.

function buildConstraintMap(autSteps) {
  const map = {};
  for (const step of autSteps) {
    for (const section of step.sections) {
      for (const field of section.fields) {
        map[field.fieldId] = {
          constraints: field.constraints || [],
          required:    field.required,
        };
      }
    }
  }
  return map;
}

// ── HOOK ──────────────────────────────────────

export function useValidation(autSteps) {
  const [errors, setErrors] = useState({});
  const constraintMap = buildConstraintMap(autSteps);

  // Validate a single field — called onBlur or onChange
  const validate = useCallback((fieldId, value, formValues) => {
    const fieldDef = constraintMap[fieldId];
    if (!fieldDef) return true;

    const fieldErrors = [];

    // Check required first
    const isEmpty = value === null || value === "" || value === undefined;
    if (fieldDef.required && isEmpty) {
      fieldErrors.push(`${fieldId}.required`);
    }

    // Evaluate each constraint
    if (!isEmpty) {
      for (const constraint of fieldDef.constraints) {
        const error = evaluateConstraint(constraint, value, formValues);
        if (error) fieldErrors.push(error);
      }
    }

    setErrors(prev => ({
      ...prev,
      [fieldId]: fieldErrors.length > 0 ? fieldErrors : null,
    }));

    return fieldErrors.length === 0;
  }, [constraintMap]);

  // Validate a set of fields at once — called by step guards
  const validateAll = useCallback((formValues, fieldIds) => {
    const newErrors = {};
    let allValid = true;

    for (const fieldId of fieldIds) {
      const value   = formValues[fieldId];
      const fieldDef = constraintMap[fieldId];
      if (!fieldDef) continue;

      const fieldErrors = [];
      const isEmpty = value === null || value === "" || value === undefined;

      if (fieldDef.required && isEmpty) {
        fieldErrors.push(`${fieldId}.required`);
      }

      if (!isEmpty) {
        for (const constraint of fieldDef.constraints) {
          const error = evaluateConstraint(constraint, value, formValues);
          if (error) fieldErrors.push(error);
        }
      }

      if (fieldErrors.length > 0) {
        newErrors[fieldId] = fieldErrors;
        allValid = false;
      }
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return allValid;
  }, [constraintMap]);

  // Clear error for a single field — called when user starts typing
  const clearError = useCallback((fieldId) => {
    setErrors(prev => ({ ...prev, [fieldId]: null }));
  }, []);

  return { errors, validate, validateAll, clearError };
}
