"use strict";

// ─────────────────────────────────────────────
// conditionEvaluator.js
// Pure utility — no React, no side effects.
// Evaluates a structured condition object from the AUT
// against the current form values.
//
// Two condition shapes (defined in metamodel.conditionOperators):
//
// Simple comparison:
//   { field: "loan_type", op: "==", value: "HOME" }
//
// Compound:
//   { operator: "AND", operands: [condition, condition, ...] }
//   { operator: "OR",  operands: [condition, condition, ...] }
//
// Returns: boolean
// ─────────────────────────────────────────────

// ── COMPARISON OPERATORS ──────────────────────

const operators = {
  "==":  (a, b) => a == b,   // loose equality — handles null == null, "0" == 0 edge cases
  "!=":  (a, b) => a != b,
  ">":   (a, b) => Number(a) >  Number(b),
  "<":   (a, b) => Number(a) <  Number(b),
  ">=":  (a, b) => Number(a) >= Number(b),
  "<=":  (a, b) => Number(a) <= Number(b),
};

// ── RESOLVE VALUE ─────────────────────────────
// Normalises a field value for comparison.
// Empty string is treated as null — a field with no input
// is considered empty regardless of whether it's "" or null.

function resolveValue(val) {
  if (val === "" || val === undefined) return null;
  return val;
}

// ── EVALUATE SIMPLE CONDITION ─────────────────
// Evaluates a single { field, op, value } condition.

function evaluateSimple(condition, formValues) {
  const { field, op, value: expectedValue } = condition;

  if (!operators[op]) {
    console.warn(`[conditionEvaluator] Unknown operator "${op}" — defaulting to false`);
    return false;
  }

  const actualValue   = resolveValue(formValues[field]);
  const resolvedExpected = resolveValue(expectedValue);

  return operators[op](actualValue, resolvedExpected);
}

// ── EVALUATE COMPOUND CONDITION ───────────────
// Evaluates { operator: "AND"|"OR", operands: [...] }
// Recursively evaluates each operand.

function evaluateCompound(condition, formValues) {
  const { operator, operands } = condition;

  if (!operands || operands.length === 0) {
    console.warn("[conditionEvaluator] Compound condition has no operands — defaulting to false");
    return false;
  }

  if (operator === "AND") {
    return operands.every(operand => evaluate(operand, formValues));
  }

  if (operator === "OR") {
    return operands.some(operand => evaluate(operand, formValues));
  }

  console.warn(`[conditionEvaluator] Unknown compound operator "${operator}" — defaulting to false`);
  return false;
}

// ── MAIN EVALUATE FUNCTION ────────────────────
// Entry point — dispatches to simple or compound evaluation
// based on the condition shape.
//
// Usage:
//   evaluate({ field: "loan_type", op: "==", value: "HOME" }, formValues)
//   → true if formValues.loan_type === "HOME"

function evaluate(condition, formValues) {
  if (!condition) return false;

  // Compound condition — has operator + operands
  if (condition.operator && condition.operands) {
    return evaluateCompound(condition, formValues);
  }

  // Simple condition — has field + op + value
  if (condition.field && condition.op) {
    return evaluateSimple(condition, formValues);
  }

  console.warn("[conditionEvaluator] Unrecognised condition shape:", condition);
  return false;
}

export { evaluate };
