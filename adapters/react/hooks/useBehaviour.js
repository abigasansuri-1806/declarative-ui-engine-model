import { useState, useCallback } from "react";
import { evaluate } from "../utils/conditionEvaluator";

// ─────────────────────────────────────────────
// useBehaviour.js
// React hook — evaluates behaviour rules from the AUT
// at runtime and manages field/section state.
//
// Usage:
//   const {
//     fieldStates,
//     sectionStates,
//     onFieldChange,
//     onStepEnter,
//   } = useBehaviour(behaviourRules, initialFieldStates, initialSectionStates);
//
// fieldStates:   { fieldId: "visible"|"hidden"|"readonly", ... }
// sectionStates: { sectionId: "visible"|"hidden", ... }
//
// onFieldChange(fieldId, formValues)
//   — called whenever a field value changes
//   — evaluates all rules triggered by that field
//   — returns { updatedValues } — values the engine wants to set
//     (e.g. setValue, setMax actions)
//
// onStepEnter(stepId, formValues)
//   — called when the user navigates to a new step
//   — evaluates rules with onStepEnter triggers
// ─────────────────────────────────────────────

// ── BUILD TRIGGER INDEX ───────────────────────
// Pre-indexes rules by their trigger field so we don't
// scan all rules on every field change.
// Returns: { fieldId: [rule, rule, ...], ... }
// Step-triggered rules are indexed separately.

function buildTriggerIndex(behaviourRules) {
  const fieldTriggers = {};
  const stepTriggers  = {};

  for (const rule of behaviourRules) {
    if (!rule.trigger) continue;

    if (rule.trigger.event === "onStepEnter") {
      const stepId = rule.trigger.stepId;
      if (!stepTriggers[stepId]) stepTriggers[stepId] = [];
      stepTriggers[stepId].push(rule);
    } else if (rule.trigger.field) {
      const fieldId = rule.trigger.field;
      if (!fieldTriggers[fieldId]) fieldTriggers[fieldId] = [];
      fieldTriggers[fieldId].push(rule);
    }
  }

  return { fieldTriggers, stepTriggers };
}

// ── BUILD INITIAL STATES ──────────────────────
// Derives initial field and section states from the AUT.

function buildInitialFieldStates(autSteps) {
  const states = {};
  for (const step of autSteps) {
    for (const section of step.sections) {
      for (const field of section.fields) {
        states[field.fieldId] = field.state || "visible";
      }
    }
  }
  return states;
}

function buildInitialSectionStates(autSteps) {
  const states = {};
  for (const step of autSteps) {
    for (const section of step.sections) {
      states[section.sectionId] = section.state || "visible";
    }
  }
  return states;
}

// ── EXECUTE ACTIONS ───────────────────────────
// Applies a list of actions and returns state updates.
// Returns:
// {
//   fieldStateUpdates:   { fieldId: newState, ... },
//   sectionStateUpdates: { sectionId: newState, ... },
//   valueUpdates:        { fieldId: newValue, ... },
//   maxUpdates:          { fieldId: newMax, ... },
//   notifications:       { fieldId: messageKey, ... }
// }

function executeActions(actions, formValues) {
  const fieldStateUpdates   = {};
  const sectionStateUpdates = {};
  const valueUpdates        = {};
  const maxUpdates          = {};
  const notifications       = {};

  for (const action of actions) {
    const { type, target, value, message } = action;

    switch (type) {

      case "show":
        if (target.startsWith("section_")) {
          sectionStateUpdates[target] = "visible";
        } else {
          fieldStateUpdates[target] = "visible";
        }
        break;

      case "hide":
        if (target.startsWith("section_")) {
          sectionStateUpdates[target] = "hidden";
        } else {
          fieldStateUpdates[target] = "hidden";
        }
        break;

      case "readonly":
        fieldStateUpdates[target] = "readonly";
        break;

      case "clear":
        valueUpdates[target] = null;
        break;

      case "setValue":
        valueUpdates[target] = value;
        break;

      case "setMax":
        // Resolve arithmetic value — { field, multiply }
        if (value && typeof value === "object" && value.field) {
          const base = Number(formValues[value.field]) || 0;
          maxUpdates[target] = value.multiply ? base * value.multiply : base;
        } else {
          maxUpdates[target] = value;
        }
        break;

      case "notify":
        notifications[target] = message;
        break;

      default:
        console.warn(`[useBehaviour] Unknown action type "${type}"`);
    }
  }

  return {
    fieldStateUpdates,
    sectionStateUpdates,
    valueUpdates,
    maxUpdates,
    notifications,
  };
}

// ── EVALUATE RULE ─────────────────────────────
// Evaluates a single rule against current form values.
// Returns the result of executeActions for the matching branch.

function evaluateRule(rule, formValues) {
  // Rules with no condition always fire (e.g. lock_consents_on_review)
  const conditionMet = rule.condition
    ? evaluate(rule.condition, formValues)
    : true;

  const actionsToRun = conditionMet
    ? (rule.actions     || [])
    : (rule.elseActions || []);

  if (actionsToRun.length === 0) {
    return null;
  }

  return executeActions(actionsToRun, formValues);
}

// ── MERGE RESULTS ─────────────────────────────
// Merges multiple action results into one combined update object.

function mergeResults(results) {
  const merged = {
    fieldStateUpdates:   {},
    sectionStateUpdates: {},
    valueUpdates:        {},
    maxUpdates:          {},
    notifications:       {},
  };

  for (const result of results) {
    if (!result) continue;
    Object.assign(merged.fieldStateUpdates,   result.fieldStateUpdates);
    Object.assign(merged.sectionStateUpdates, result.sectionStateUpdates);
    Object.assign(merged.valueUpdates,        result.valueUpdates);
    Object.assign(merged.maxUpdates,          result.maxUpdates);
    Object.assign(merged.notifications,       result.notifications);
  }

  return merged;
}

// ── HOOK ──────────────────────────────────────

export function useBehaviour(autSteps, behaviourRules) {
  const [fieldStates,   setFieldStates]   = useState(() => buildInitialFieldStates(autSteps));
  const [sectionStates, setSectionStates] = useState(() => buildInitialSectionStates(autSteps));
  const [maxOverrides,  setMaxOverrides]  = useState({});
  const [notifications, setNotifications] = useState({});

  // Pre-build trigger index once
  const { fieldTriggers, stepTriggers } = buildTriggerIndex(behaviourRules);

  // ── onFieldChange ─────────────────────────────
  // Called by FormEngine whenever a field value changes.
  // Returns valueUpdates so FormEngine can apply them to formValues.

  const onFieldChange = useCallback((fieldId, formValues) => {
    const triggeredRules = fieldTriggers[fieldId] || [];
    if (triggeredRules.length === 0) return {};

    const results = triggeredRules.map(rule =>
      evaluateRule(rule, formValues)
    );

    const merged = mergeResults(results);

    // Apply field state updates
    if (Object.keys(merged.fieldStateUpdates).length > 0) {
      setFieldStates(prev => ({ ...prev, ...merged.fieldStateUpdates }));
    }

    // Apply section state updates
    if (Object.keys(merged.sectionStateUpdates).length > 0) {
      setSectionStates(prev => ({ ...prev, ...merged.sectionStateUpdates }));
    }

    // Apply max overrides
    if (Object.keys(merged.maxUpdates).length > 0) {
      setMaxOverrides(prev => ({ ...prev, ...merged.maxUpdates }));
    }

    // Apply notifications
    if (Object.keys(merged.notifications).length > 0) {
      setNotifications(prev => ({ ...prev, ...merged.notifications }));
      // Clear notifications after 3 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const next = { ...prev };
          Object.keys(merged.notifications).forEach(k => delete next[k]);
          return next;
        });
      }, 3000);
    }

    // Return value updates for FormEngine to apply to formValues
    return merged.valueUpdates;
  }, [fieldTriggers]);

  // ── onStepEnter ───────────────────────────────
  // Called by StepRenderer when the user navigates to a step.

  const onStepEnter = useCallback((stepId, formValues) => {
    const triggeredRules = stepTriggers[stepId] || [];
    if (triggeredRules.length === 0) return;

    const results = triggeredRules.map(rule =>
      evaluateRule(rule, formValues)
    );

    const merged = mergeResults(results);

    if (Object.keys(merged.fieldStateUpdates).length > 0) {
      setFieldStates(prev => ({ ...prev, ...merged.fieldStateUpdates }));
    }

    if (Object.keys(merged.sectionStateUpdates).length > 0) {
      setSectionStates(prev => ({ ...prev, ...merged.sectionStateUpdates }));
    }
  }, [stepTriggers]);

  // ── clearNotification ─────────────────────────
  const clearNotification = useCallback((fieldId) => {
    setNotifications(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  return {
    fieldStates,
    sectionStates,
    maxOverrides,
    notifications,
    onFieldChange,
    onStepEnter,
    clearNotification,
  };
}
