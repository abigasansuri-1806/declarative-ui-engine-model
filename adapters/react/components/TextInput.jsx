import React from "react";

// ─────────────────────────────────────────────
// TextInput.jsx
// Renders a single-line text input.
// Handles: string, integer data types
// Props from components.json:
//   transform    — "uppercase" | "lowercase"
//   maskPattern  — input format hint (display only)
//   maskDisplay  — display mask for rendered value
//   inputMode    — "text" | "numeric" | "email" | "tel"
//   autoComplete — browser autocomplete hint
//   spellCheck   — boolean
// ─────────────────────────────────────────────

export default function TextInput({
  fieldId,
  value,
  onChange,
  onBlur,
  props = {},
  i18n  = {},
  error,
  state,
}) {
  if (state === "hidden") return null;

  const isReadonly = state === "readonly";

  function handleChange(e) {
    let val = e.target.value;
    if (props.transform === "uppercase") val = val.toUpperCase();
    if (props.transform === "lowercase") val = val.toLowerCase();
    onChange(fieldId, val);
  }

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <input
        id={fieldId}
        name={fieldId}
        type="text"
        value={value || ""}
        onChange={handleChange}
        onBlur={() => onBlur && onBlur(fieldId)}
        placeholder={i18n.placeholder || ""}
        readOnly={isReadonly}
        disabled={state === "disabled"}
        inputMode={props.inputMode || "text"}
        autoComplete={props.autoComplete || "off"}
        spellCheck={props.spellCheck !== undefined ? props.spellCheck : true}
        className={`field-input ${error ? "field-input--error" : ""} ${isReadonly ? "field-input--readonly" : ""}`}
        aria-describedby={error ? `${fieldId}-error` : i18n.helpText ? `${fieldId}-help` : undefined}
        aria-invalid={!!error}
      />

      {i18n.helpText && !error && (
        <span id={`${fieldId}-help`} className="field-help">{i18n.helpText}</span>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">{error}</span>
      )}
    </div>
  );
}
