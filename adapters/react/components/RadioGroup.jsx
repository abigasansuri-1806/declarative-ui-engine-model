import React from "react";

// ─────────────────────────────────────────────
// RadioGroup.jsx
// Renders a group of radio buttons for enum fields.
// Handles: enum data type
// Props from components.json:
//   orientation  — "horizontal" | "vertical"
//   displayStyle — "default" | "card" | "button"
// ─────────────────────────────────────────────

export default function RadioGroup({
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

  const isReadonly    = state === "readonly";
  const options       = dataProps.options || [];
  const orientation   = props.orientation  || "vertical";
  const displayStyle  = props.displayStyle || "default";

  return (
    <div className="field-wrapper">
      <fieldset
        className={`radio-group radio-group--${orientation} radio-group--${displayStyle} ${error ? "radio-group--error" : ""}`}
        aria-describedby={error ? `${fieldId}-error` : i18n.helpText ? `${fieldId}-help` : undefined}
      >
        <legend className="field-label">{i18n.label}</legend>

        {options.map(opt => (
          <label
            key={opt.value}
            className={`radio-option radio-option--${displayStyle} ${value === opt.value ? "radio-option--selected" : ""}`}
          >
            <input
              type="radio"
              name={fieldId}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => {
                if (!isReadonly) {
                  onChange(fieldId, opt.value);
                  if (onBlur) onBlur(fieldId);
                }
              }}
              disabled={isReadonly || state === "disabled"}
              className="radio-input"
            />
            <span className="radio-label">{opt.label}</span>
          </label>
        ))}
      </fieldset>

      {i18n.helpText && !error && (
        <span id={`${fieldId}-help`} className="field-help">{i18n.helpText}</span>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">{error}</span>
      )}
    </div>
  );
}
