import React from "react";

// ─────────────────────────────────────────────
// DatePicker.jsx
// Renders a date input.
// Handles: date data type
// Props from components.json:
//   maxDate          — upper bound (ISO string or "today")
//   minDate          — lower bound (ISO string)
//   calendarStartDay — "monday" | "sunday" (hint only for prototype)
// ─────────────────────────────────────────────

function resolveDate(dateStr) {
  if (!dateStr) return undefined;
  if (dateStr === "today") return new Date().toISOString().split("T")[0];
  return dateStr;
}

export default function DatePicker({
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
  const maxDate    = resolveDate(props.maxDate);
  const minDate    = resolveDate(props.minDate);

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <input
        id={fieldId}
        name={fieldId}
        type="date"
        value={value || ""}
        onChange={e => onChange(fieldId, e.target.value)}
        onBlur={() => onBlur && onBlur(fieldId)}
        max={maxDate}
        min={minDate}
        readOnly={isReadonly}
        disabled={state === "disabled"}
        className={`field-input field-input--date ${error ? "field-input--error" : ""} ${isReadonly ? "field-input--readonly" : ""}`}
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
