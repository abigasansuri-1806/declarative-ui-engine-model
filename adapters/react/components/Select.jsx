import React from "react";

// ─────────────────────────────────────────────
// Select.jsx
// Renders a dropdown select for enum fields.
// Handles: enum data type with source=static
// Props from components.json:
//   searchable — not implemented in native select, noted for future
//   clearable  — show empty option at top
// ─────────────────────────────────────────────

export default function Select({
  fieldId,
  value,
  onChange,
  onBlur,
  props     = {},
  i18n      = {},
  error,
  state,
  dataProps = {},
}) {
  if (state === "hidden") return null;

  const isReadonly = state === "readonly";
  const options    = dataProps.options || [];

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <select
        id={fieldId}
        name={fieldId}
        value={value || ""}
        onChange={e => onChange(fieldId, e.target.value || null)}
        onBlur={() => onBlur && onBlur(fieldId)}
        disabled={isReadonly || state === "disabled"}
        className={`field-input field-input--select ${error ? "field-input--error" : ""} ${isReadonly ? "field-input--readonly" : ""}`}
        aria-describedby={error ? `${fieldId}-error` : i18n.helpText ? `${fieldId}-help` : undefined}
        aria-invalid={!!error}
      >
        {/* Empty option */}
        <option value="">
          {i18n.placeholder || "Select an option"}
        </option>

        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {i18n.helpText && !error && (
        <span id={`${fieldId}-help`} className="field-help">{i18n.helpText}</span>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">{error}</span>
      )}
    </div>
  );
}
