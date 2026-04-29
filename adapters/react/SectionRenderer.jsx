import React, { useState } from "react";
import FieldRenderer from "./FieldRenderer";

// ─────────────────────────────────────────────
// SectionRenderer.jsx
// Renders a single AUT sectionNode.
// Responsibilities:
//   - Respect section visibility state from useBehaviour
//   - Render fields in the correct column layout
//   - Handle collapsible toggle
//   - Apply reflow:compress when fields are hidden
//     (only render visible fields in the grid)
// ─────────────────────────────────────────────

export default function SectionRenderer({
  section,
  sectionState,
  formValues,
  onChange,
  onBlur,
  fieldStates,
  errors,
  maxOverrides,
  i18nErrors,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Section hidden — render nothing
  if (sectionState === "hidden") return null;

  // Section visible but collapsed — render header only
  const isCollapsed = section.collapsible && collapsed;

  // For reflow:compress — only pass visible fields to the grid
  // so hidden fields don't leave empty grid slots
  const visibleFields = section.fields.filter(
    field => fieldStates[field.fieldId] !== "hidden"
  );

  return (
    <div className="section-wrapper">

      {/* Section header */}
      <div className="section-header">
        <h3 className="section-title">{section.title}</h3>

        {section.collapsible && (
          <button
            type="button"
            className="section-toggle"
            onClick={() => setCollapsed(prev => !prev)}
            aria-expanded={!isCollapsed}
            aria-controls={`section-${section.sectionId}`}
          >
            {isCollapsed ? "Show" : "Hide"}
          </button>
        )}
      </div>

      {/* Section body */}
      {!isCollapsed && (
        <div
          id={`section-${section.sectionId}`}
          className="section-body"
          style={{
            display:             "grid",
            gridTemplateColumns: `repeat(${section.columns || 1}, 1fr)`,
            gap:                 "16px",
          }}
        >
          {visibleFields.map(field => (
            <FieldRenderer
              key       = {field.fieldId}
              field     = {field}
              value     = {formValues[field.fieldId]}
              onChange  = {onChange}
              onBlur    = {onBlur}
              fieldState= {fieldStates[field.fieldId] || "visible"}
              errors    = {errors}
              maxOverride={maxOverrides?.[field.fieldId]}
              i18nErrors= {i18nErrors}
            />
          ))}
        </div>
      )}

    </div>
  );
}
