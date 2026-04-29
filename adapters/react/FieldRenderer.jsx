import React from "react";

import TextInput    from "./components/TextInput";
import TextArea     from "./components/TextArea";
import DatePicker   from "./components/DatePicker";
import CurrencyInput from "./components/CurrencyInput";
import SliderInput  from "./components/SliderInput";
import Select       from "./components/Select";
import RadioGroup   from "./components/RadioGroup";
import Checkbox     from "./components/Checkbox";

// ─────────────────────────────────────────────
// FieldRenderer.jsx
// The Abstract Factory dispatcher.
// Receives a fieldNode from the AUT and renders
// the correct component based on field.component.
//
// This is the only place in the adapter that knows
// the mapping from component name → React component.
// Adding a new component type means adding one line here.
//
// Props:
//   field        — AUT fieldNode
//   value        — current value from formValues
//   onChange     — (fieldId, value) => void
//   onBlur       — (fieldId) => void
//   fieldState   — current state from useBehaviour
//   error        — resolved error string or null
//   maxOverride  — dynamic max from useBehaviour setMax
//   i18nErrors   — error message map from i18n layer
// ─────────────────────────────────────────────

// ── COMPONENT REGISTRY ────────────────────────
// Maps component name strings (from AUT) to React components.
// Validated at render time — unknown components render a fallback.

const COMPONENT_REGISTRY = {
  TextInput,
  TextArea,
  DatePicker,
  CurrencyInput,
  SliderInput,
  Select,
  RadioGroup,
  Checkbox,
};

// ── RESOLVE ERROR MESSAGE ─────────────────────
// Converts an error key like "loan_amount.min" to a
// human-readable string using the i18n error map.
// Falls back to the key itself if no translation found.

function resolveErrorMessage(errorKeys, i18nErrors) {
  if (!errorKeys || errorKeys.length === 0) return null;
  const key = errorKeys[0]; // Show first error only
  return (i18nErrors && i18nErrors[key]) || key;
}

// ── FALLBACK COMPONENT ────────────────────────
// Renders when an unknown component name is encountered.
// Visible in development, helps catch config errors early.

function UnknownComponent({ field }) {
  return (
    <div className="field-unknown">
      <span>⚠ Unknown component: <code>{field.component}</code> for field <code>{field.fieldId}</code></span>
    </div>
  );
}

// ── FIELD RENDERER ────────────────────────────

export default function FieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  fieldState,
  errors,
  maxOverride,
  i18nErrors,
}) {
  // If field is hidden, render nothing
  // (components also check this, but short-circuit here for clarity)
  if (fieldState === "hidden") return null;

  // Look up the component in the registry
  const Component = COMPONENT_REGISTRY[field.component];

  if (!Component) {
    return <UnknownComponent field={field} />;
  }

  // Resolve error message from i18n
  const errorMessage = resolveErrorMessage(errors?.[field.fieldId], i18nErrors);

  return (
    <Component
      fieldId    = {field.fieldId}
      value      = {value}
      onChange   = {onChange}
      onBlur     = {onBlur}
      props      = {field.props}
      i18n       = {field.i18n}
      error      = {errorMessage}
      state      = {fieldState}
      dataProps  = {field.dataProps}
      maxOverride= {maxOverride}
    />
  );
}
