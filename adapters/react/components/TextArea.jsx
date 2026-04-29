import React from "react";

// ─────────────────────────────────────────────
// TextArea.jsx
// Renders a multi-line text input.
// Handles: text data type
// Props from components.json:
//   rows      — number of visible rows
//   resizable — whether the textarea can be resized
// ─────────────────────────────────────────────

export default function TextArea({
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

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <textarea
        id={fieldId}
        name={fieldId}
        value={value || ""}
        onChange={e => onChange(fieldId, e.target.value)}
        onBlur={() => onBlur && onBlur(fieldId)}
        placeholder={i18n.placeholder || ""}
        rows={props.rows || 3}
        readOnly={isReadonly}
        disabled={state === "disabled"}
        style={{ resize: props.resizable === false ? "none" : "vertical" }}
        className={`field-input field-input--textarea ${error ? "field-input--error" : ""} ${isReadonly ? "field-input--readonly" : ""}`}
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
