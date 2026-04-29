import React from "react";

// ─────────────────────────────────────────────
// Checkbox.jsx
// Renders a single checkbox for boolean fields.
// Handles: boolean data type
// Props from components.json:
//   variant          — "default" | "prominent"
//   linkedDocumentUrl — optional link shown next to label
// ─────────────────────────────────────────────

export default function Checkbox({
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

  const isReadonly   = state === "readonly";
  const isProminent  = props.variant === "prominent";

  return (
    <div className={`field-wrapper field-wrapper--checkbox ${isProminent ? "field-wrapper--prominent" : ""}`}>
      <label
        htmlFor={fieldId}
        className={`checkbox-label ${error ? "checkbox-label--error" : ""}`}
      >
        <input
          id={fieldId}
          name={fieldId}
          type="checkbox"
          checked={value === true}
          onChange={e => {
            onChange(fieldId, e.target.checked);
            if (onBlur) onBlur(fieldId);
          }}
          disabled={isReadonly || state === "disabled"}
          className="checkbox-input"
          aria-describedby={error ? `${fieldId}-error` : undefined}
          aria-invalid={!!error}
        />
        <span className="checkbox-text">
          {i18n.label}
          {props.linkedDocumentUrl && (
            <a
              href={props.linkedDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="checkbox-link"
              onClick={e => e.stopPropagation()}
            >
              View document
            </a>
          )}
        </span>
      </label>

      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">{error}</span>
      )}
    </div>
  );
}
