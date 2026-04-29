import React, { useState } from "react";

// ─────────────────────────────────────────────
// CurrencyInput.jsx
// Renders a currency amount input with optional slider.
// Handles: currency data type
// Props from components.json:
//   currencySymbol    — e.g. "₹"
//   thousandSeparator — show formatted display value
//   showSlider        — render a range slider below the input
//   sliderStep        — slider increment
// maxOverride — dynamic max from useBehaviour setMax action
// ─────────────────────────────────────────────

function formatWithCommas(num) {
  if (!num && num !== 0) return "";
  return Number(num).toLocaleString("en-IN");
}

export default function CurrencyInput({
  fieldId,
  value,
  onChange,
  onBlur,
  props       = {},
  i18n        = {},
  error,
  state,
  dataProps   = {},
  maxOverride,
}) {
  if (state === "hidden") return null;

  const isReadonly = state === "readonly";
  const min        = dataProps.min || 0;
  const max        = maxOverride || dataProps.max || 10000000;
  const symbol     = props.currencySymbol || "₹";
  const step       = props.sliderStep || 1000;

  // Keep a raw string for the text input to allow free typing
  const [displayValue, setDisplayValue] = useState(value ? String(value) : "");

  function handleInputChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setDisplayValue(raw);
    onChange(fieldId, raw === "" ? null : Number(raw));
  }

  function handleSliderChange(e) {
    const num = Number(e.target.value);
    setDisplayValue(String(num));
    onChange(fieldId, num);
  }

  function handleBlur() {
    if (onBlur) onBlur(fieldId);
  }

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {i18n.label}
      </label>

      <div className="currency-input-wrapper">
        <span className="currency-symbol">{symbol}</span>
        <input
          id={fieldId}
          name={fieldId}
          type="text"
          inputMode="numeric"
          value={props.thousandSeparator && !document.activeElement?.id === fieldId
            ? formatWithCommas(displayValue)
            : displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={i18n.placeholder || ""}
          readOnly={isReadonly}
          disabled={state === "disabled"}
          className={`field-input field-input--currency ${error ? "field-input--error" : ""} ${isReadonly ? "field-input--readonly" : ""}`}
          aria-describedby={error ? `${fieldId}-error` : i18n.helpText ? `${fieldId}-help` : undefined}
          aria-invalid={!!error}
        />
      </div>

      {props.showSlider && !isReadonly && (
        <div className="slider-wrapper">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value || min}
            onChange={handleSliderChange}
            className="field-slider"
            aria-label={`${i18n.label} slider`}
          />
          <div className="slider-labels">
            <span>{symbol}{formatWithCommas(min)}</span>
            <span>{symbol}{formatWithCommas(max)}</span>
          </div>
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
