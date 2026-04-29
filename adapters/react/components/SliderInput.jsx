import React from "react";

// ─────────────────────────────────────────────
// SliderInput.jsx
// Renders a range slider with numeric display.
// Handles: integer data type
// Props from components.json:
//   step        — slider increment
//   showLabels  — show min/max labels below slider
//   labelFormat — format string e.g. "{value} months"
// ─────────────────────────────────────────────

function formatLabel(format, value) {
  if (!format) return String(value);
  return format.replace("{value}", value);
}

export default function SliderInput({
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
  const min        = dataProps.min || 0;
  const max        = dataProps.max || 100;
  const step       = props.step    || 1;
  const current    = value || min;

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <div className="slider-current-value">
        {formatLabel(props.labelFormat, current)}
      </div>

      <input
        id={fieldId}
        name={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={e => onChange(fieldId, Number(e.target.value))}
        onMouseUp={() => onBlur && onBlur(fieldId)}
        onTouchEnd={() => onBlur && onBlur(fieldId)}
        disabled={isReadonly || state === "disabled"}
        className={`field-slider ${error ? "field-slider--error" : ""}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-label={i18n.label}
      />

      {props.showLabels && (
        <div className="slider-labels">
          <span>{formatLabel(props.labelFormat, min)}</span>
          <span>{formatLabel(props.labelFormat, max)}</span>
        </div>
      )}

      {i18n.helpText && !error && (
        <span id={`${fieldId}-help`} className="field-help">{i18n.helpText}</span>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">{error}</span>
      )}
    </div>
  );
}
