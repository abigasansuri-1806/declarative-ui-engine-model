import React, { useEffect } from "react";
import SectionRenderer from "./SectionRenderer";

// ─────────────────────────────────────────────
// StepRenderer.jsx
// Renders a single AUT stepNode.
// Responsibilities:
//   - Fire onStepEnter when this step becomes active
//   - Render all sections via SectionRenderer
//   - Evaluate step guards before forward navigation
//   - Render Back / Continue / Submit navigation buttons
// ─────────────────────────────────────────────

// ── EVALUATE GUARD ────────────────────────────
// Evaluates a single step guard against current form values.
// Returns { pass: boolean, message: string|null }

function evaluateGuard(guard, formValues, fieldStates) {
  switch (guard.type) {

    case "validationPass": {
      // All listed fields must have no errors AND be filled if required
      // At this layer we just check that visible required fields have values
      const failingFields = (guard.fields || []).filter(fieldId => {
        // Skip hidden fields — they don't need to pass
        if (fieldStates[fieldId] === "hidden") return false;
        const val = formValues[fieldId];
        // Boolean fields: false counts as not passing (mustBeTrue constraint)
        if (typeof val === "boolean") return val !== true;
        return val === null || val === undefined || val === "";
      });
      return {
        pass:    failingFields.length === 0,
        message: failingFields.length > 0
          ? `Please complete all required fields before continuing`
          : null,
      };
    }

    case "conditionalValidationPass": {
      // Only validate listed fields if the "when" condition is met
      if (!guard.when) return { pass: true, message: null };

      // Parse simple "field == VALUE" condition
      const [left, right] = guard.when.split("==").map(s => s.trim());
      const conditionMet  = formValues[left] === right;
      if (!conditionMet) return { pass: true, message: null };

      const failingFields = (guard.fields || []).filter(fieldId => {
        if (fieldStates[fieldId] === "hidden") return false;
        const val = formValues[fieldId];
        return val === null || val === undefined || val === "";
      });
      return {
        pass:    failingFields.length === 0,
        message: failingFields.length > 0
          ? `Please complete all required fields before continuing`
          : null,
      };
    }

    case "eligibilityCheck": {
      // Evaluate structured rule — { field, op, value }
      const { field, op, value } = guard.rule || {};
      if (!field || !op) return { pass: true, message: null };

      const actual = Number(formValues[field]) || 0;
      const ops    = {
        ">=": (a, b) => a >= b,
        "<=": (a, b) => a <= b,
        ">":  (a, b) => a > b,
        "<":  (a, b) => a < b,
        "==": (a, b) => a === b,
      };
      const opFn = ops[op];
      const pass = opFn ? opFn(actual, value) : true;
      return {
        pass,
        message: !pass ? guard.message : null,
      };
    }

    default:
      return { pass: true, message: null };
  }
}

// ── STEP RENDERER ─────────────────────────────

export default function StepRenderer({
  step,
  isFirst,
  isLast,
  formValues,
  onChange,
  onBlur,
  fieldStates,
  sectionStates,
  errors,
  maxOverrides,
  i18nErrors,
  i18nActions,
  onBack,
  onNext,
  onSubmit,
  onStepEnter,
}) {
  // Fire onStepEnter when this step mounts
  useEffect(() => {
    if (onStepEnter) onStepEnter(step.stepId, formValues);
  }, [step.stepId]);

  function handleNext() {
    // Evaluate all guards before allowing navigation
    for (const guard of step.guards || []) {
      const result = evaluateGuard(guard, formValues, fieldStates);
      if (!result.pass) {
        if (guard.onFail === "showMessage" && result.message) {
          alert(result.message);
        }
        // blockNavigation — just return without proceeding
        return;
      }
    }
    onNext();
  }

  function handleSubmit() {
    // Evaluate guards on final step before submitting
    for (const guard of step.guards || []) {
      const result = evaluateGuard(guard, formValues, fieldStates);
      if (!result.pass) return;
    }
    onSubmit();
  }

  return (
    <div className="step-wrapper">

      {/* Step title */}
      <h2 className="step-title">{step.title}</h2>

      {/* Sections */}
      <div className="step-sections">
        {step.sections.map(section => (
          <SectionRenderer
            key          = {section.sectionId}
            section      = {section}
            sectionState = {sectionStates[section.sectionId] || "visible"}
            formValues   = {formValues}
            onChange     = {onChange}
            onBlur       = {onBlur}
            fieldStates  = {fieldStates}
            errors       = {errors}
            maxOverrides = {maxOverrides}
            i18nErrors   = {i18nErrors}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="step-navigation">

        {!isFirst && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onBack}
          >
            {i18nActions?.back || "Previous"}
          </button>
        )}

        <div className="step-navigation__spacer" />

        {!isLast && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleNext}
          >
            {i18nActions?.next || "Continue"}
          </button>
        )}

        {isLast && (
          <button
            type="button"
            className="btn btn--submit"
            onClick={handleSubmit}
          >
            {i18nActions?.submit || "Submit Application"}
          </button>
        )}

      </div>
    </div>
  );
}
