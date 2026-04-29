import React, { useState, useCallback, useMemo } from "react";
import { useBehaviour }  from "./hooks/useBehaviour";
import { useValidation } from "./hooks/useValidation";
import StepRenderer      from "./StepRenderer";

// ─────────────────────────────────────────────
// FormEngine.jsx
// Root component of the React adapter.
// Responsibilities:
//   - Own formValues state (all field values)
//   - Own currentStepIndex state
//   - Wire useBehaviour and useValidation hooks
//   - Handle field changes — update values, fire behaviour, trigger validation
//   - Handle step navigation — forward (with guard evaluation) and back
//   - Handle form submission
//   - Render the active step via StepRenderer
//   - Render step progress indicator
// ─────────────────────────────────────────────

// ── BUILD INITIAL FORM VALUES ─────────────────
// Initialises every field to null.
// Boolean fields initialise to false (unchecked).

function buildInitialValues(autSteps) {
  const values = {};
  for (const step of autSteps) {
    for (const section of step.sections) {
      for (const field of section.fields) {
        values[field.fieldId] = field.dataType === "boolean" ? false : null;
      }
    }
  }
  return values;
}

// ── EXTRACT I18N MAPS ─────────────────────────
// Pulls error messages and action labels from the AUT's i18n layer.
// The AUT doesn't carry i18n directly — we read it from the raw
// i18n layer passed in as a prop.

function extractI18nMaps(i18nLayer) {
  return {
    errors:  i18nLayer?.errors  || {},
    actions: i18nLayer?.ui?.actions || {},
  };
}

// ── STEP PROGRESS INDICATOR ───────────────────

function StepProgress({ steps, currentIndex }) {
  return (
    <div className="step-progress" role="navigation" aria-label="Form progress">
      {steps.map((step, index) => (
        <div
          key={step.stepId}
          className={[
            "step-progress__item",
            index === currentIndex  ? "step-progress__item--active"    : "",
            index < currentIndex    ? "step-progress__item--completed" : "",
            index > currentIndex    ? "step-progress__item--upcoming"  : "",
          ].join(" ").trim()}
          aria-current={index === currentIndex ? "step" : undefined}
        >
          <div className="step-progress__dot">
            {index < currentIndex ? "✓" : index + 1}
          </div>
          <span className="step-progress__label">{step.title}</span>
        </div>
      ))}
    </div>
  );
}

// ── SUBMISSION RESULT ─────────────────────────

function SubmissionResult({ formId, onReset }) {
  return (
    <div className="submission-result">
      <div className="submission-result__icon">✓</div>
      <h2 className="submission-result__title">Application Submitted</h2>
      <p className="submission-result__body">
        Your application has been received. You will be contacted shortly.
      </p>
      <p className="submission-result__ref">
        Reference: {formId}-{Date.now()}
      </p>
      <button type="button" className="btn btn--secondary" onClick={onReset}>
        Start New Application
      </button>
    </div>
  );
}

// ── FORM ENGINE ───────────────────────────────

export default function FormEngine({ aut, i18nLayer }) {
  // ── State
  const [formValues,        setFormValues]        = useState(() => buildInitialValues(aut.steps));
  const [currentStepIndex,  setCurrentStepIndex]  = useState(0);
  const [submitted,         setSubmitted]          = useState(false);

  // ── i18n maps
  const { errors: i18nErrors, actions: i18nActions } = useMemo(
    () => extractI18nMaps(i18nLayer),
    [i18nLayer]
  );

  // ── Hooks
  const behaviour = useBehaviour(aut.steps, aut.behaviourRules);
  const validation = useValidation(aut.steps);

  // ── Current step
  const currentStep = aut.steps[currentStepIndex];
  const isFirst     = currentStepIndex === 0;
  const isLast      = currentStepIndex === aut.steps.length - 1;

  // ── Handle field change
  // Called by every field component via onChange(fieldId, value)
  // 1. Update formValues
  // 2. Fire behaviour rules triggered by this field
  // 3. Apply any value updates returned by behaviour (setValue, clear)

  const handleChange = useCallback((fieldId, value) => {
    setFormValues(prev => {
      const updated = { ...prev, [fieldId]: value };

      // Fire behaviour rules — may return value updates (setValue, clear, setMax)
      const valueUpdates = behaviour.onFieldChange(fieldId, updated);

      // Apply value updates if any
      if (valueUpdates && Object.keys(valueUpdates).length > 0) {
        return { ...updated, ...valueUpdates };
      }

      return updated;
    });
  }, [behaviour]);

  // ── Handle field blur
  // Called by field components via onBlur(fieldId)
  // Triggers validation for that field

  const handleBlur = useCallback((fieldId) => {
    setFormValues(prev => {
      validation.validate(fieldId, prev[fieldId], prev);
      return prev;
    });
  }, [validation]);

  // ── Handle step navigation
  const handleNext = useCallback(() => {
    if (currentStepIndex < aut.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, aut.steps.length]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // ── Handle submission
  const handleSubmit = useCallback(() => {
    // Run validation on all visible fields in the final step
    const finalStep = aut.steps[aut.steps.length - 1];
    const finalFieldIds = finalStep.sections
      .flatMap(s => s.fields)
      .filter(f => behaviour.fieldStates[f.fieldId] !== "hidden")
      .map(f => f.fieldId);

    const valid = validation.validateAll(formValues, finalFieldIds);
    if (!valid) return;

    // Write audit log entry if enabled
    if (aut.auditLog) {
      console.info("[AuditLog]", {
        formId:      aut.formId,
        submittedAt: new Date().toISOString(),
        domain:      aut.domain,
        version:     aut.version,
        fieldCount:  Object.keys(formValues).length,
      });
    console.info("[FormValues]", formValues);
    }

    setSubmitted(true);
  }, [aut, formValues, behaviour.fieldStates, validation]);

  // ── Handle reset
  const handleReset = useCallback(() => {
    setFormValues(buildInitialValues(aut.steps));
    setCurrentStepIndex(0);
    setSubmitted(false);
  }, [aut.steps]);

  // ── Submitted state
  if (submitted) {
    return <SubmissionResult formId={aut.formId} onReset={handleReset} />;
  }

  // ── Render
  return (
    <div className="form-engine" data-form-id={aut.formId} data-domain={aut.domain}>

      {/* Step progress */}
      {aut.navigation?.showStepProgress && (
        <StepProgress
          steps        = {aut.steps}
          currentIndex = {currentStepIndex}
        />
      )}

      {/* Active step */}
      <StepRenderer
        key          = {currentStep.stepId}
        step         = {currentStep}
        isFirst      = {isFirst}
        isLast       = {isLast}
        formValues   = {formValues}
        onChange     = {handleChange}
        onBlur       = {handleBlur}
        fieldStates  = {behaviour.fieldStates}
        sectionStates= {behaviour.sectionStates}
        errors       = {validation.errors}
        maxOverrides = {behaviour.maxOverrides}
        i18nErrors   = {i18nErrors}
        i18nActions  = {i18nActions}
        onBack       = {handleBack}
        onNext       = {handleNext}
        onSubmit     = {handleSubmit}
        onStepEnter  = {behaviour.onStepEnter}
      />

    </div>
  );
}
