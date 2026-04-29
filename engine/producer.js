"use strict";

// ─────────────────────────────────────────────
// producer.js
// Phase 3 of the engine pipeline.
// Responsibilities:
//   - Walk the layout tree: steps → sections → fields
//   - Emit a properly shaped AUT node for each level
//   - Resolve workflow guards per step
//   - Assemble the autRoot — the complete output artifact
// ─────────────────────────────────────────────

// ── EMIT FIELD NODE ───────────────────────────
// Produces a single AUT fieldNode from a merged field object.
// Shape defined in metamodel.autNodeSchema.fieldNode

function emitFieldNode(fieldId, fieldIndex) {
  const field = fieldIndex[fieldId];

  if (!field) {
    throw new Error(`[producer] Cannot emit fieldNode — "${fieldId}" not found in fieldIndex`);
  }

  return {
    nodeType:          "field",
    fieldId:           field.fieldId,
    dataType:          field.dataType,
    dataProps:         field.dataProps,
    component:         field.component,
    props:             field.props,
    state:             field.state,
    required:          field.required,
    constraints:       field.constraints,
    behaviourBindings: field.behaviourBindings,
    i18n:              field.i18n,
  };
}

// ── EMIT SECTION NODE ─────────────────────────
// Produces a sectionNode containing its ordered fieldNodes.
// Shape defined in metamodel.autNodeSchema.sectionNode

function emitSectionNode(section, fieldIndex, sectionIndex) {
  const sectionMeta = sectionIndex[section.id] || { state: "visible", behaviourBindings: [] };

  // Emit each field in the order defined by layout
  const fieldNodes = section.fields.map(fieldId =>
    emitFieldNode(fieldId, fieldIndex)
  );

  return {
    nodeType:          "section",
    sectionId:         section.id,
    title:             section.title,
    collapsible:       section.collapsible === true,
    optional:          section.optional   === true,
    columns:           section.columns    || 1,
    reflow:            section.reflow     || "compress",
    state:             sectionMeta.state,
    behaviourBindings: sectionMeta.behaviourBindings,
    fields:            fieldNodes,
  };
}

// ── RESOLVE STEP GUARDS ───────────────────────
// Looks up the guards for a given step from the workflow layer.
// Returns an empty array if the step has no guards defined.

function resolveStepGuards(stepId, workflowLayer) {
  const workflowStep = workflowLayer.workflow.steps.find(s => s.id === stepId);
  if (!workflowStep) return [];
  return workflowStep.guards || [];
}

// ── RESOLVE STEP NEXT ─────────────────────────
// Looks up the next step ID from the workflow layer.

function resolveStepNext(stepId, workflowLayer) {
  const workflowStep = workflowLayer.workflow.steps.find(s => s.id === stepId);
  if (!workflowStep) return null;
  return workflowStep.next || null;
}

// ── RESOLVE STEP ON COMPLETE ──────────────────
// Looks up onComplete definition from the workflow layer (final step only).

function resolveStepOnComplete(stepId, workflowLayer) {
  const workflowStep = workflowLayer.workflow.steps.find(s => s.id === stepId);
  if (!workflowStep || !workflowStep.onComplete) return null;
  return workflowStep.onComplete;
}

// ── EMIT STEP NODE ────────────────────────────
// Produces a stepNode containing its ordered sectionNodes.
// Guards and navigation are resolved from the workflow layer.
// Shape defined in metamodel.autNodeSchema.stepNode

function emitStepNode(step, fieldIndex, sectionIndex, workflowLayer) {
  // Emit each section in the order defined by layout
  const sectionNodes = step.sections.map(section =>
    emitSectionNode(section, fieldIndex, sectionIndex)
  );

  const onComplete = resolveStepOnComplete(step.id, workflowLayer);

  const stepNode = {
    nodeType:   "step",
    stepId:     step.id,
    title:      step.title,
    state:      "visible",
    next:       resolveStepNext(step.id, workflowLayer),
    guards:     resolveStepGuards(step.id, workflowLayer),
    sections:   sectionNodes,
  };

  // Only attach onComplete if it exists (final step)
  if (onComplete) stepNode.onComplete = onComplete;

  return stepNode;
}

// ── EMIT AUT ROOT ─────────────────────────────
// Produces the autRoot — the top-level AUT node.
// This is the single artifact passed to any adapter.
// Shape defined in metamodel.autNodeSchema.autRoot

function emitAutRoot(manifest, layers, fieldIndex, sectionIndex, behaviourRules) {
  const layout   = layers.layout.layout;
  const workflow = layers.workflow;

  // Walk layout steps and emit each as a stepNode
  const stepNodes = layout.steps.map(step =>
    emitStepNode(step, fieldIndex, sectionIndex, workflow)
  );

  return {
    nodeType:       "form",
    formId:         manifest.id,
    version:        manifest.version,
    domain:         manifest.domain,
    locale:         manifest.locale,
    layoutType:     layout.type,
    initialStep:    workflow.workflow.initialStep,
    navigation:     workflow.workflow.navigation,
    steps:          stepNodes,
    behaviourRules: behaviourRules,
    auditLog:       manifest.rendererHints && manifest.rendererHints.auditLog === true,
  };
}

// ── MAIN PRODUCE FUNCTION ─────────────────────
// Called by index.js after a successful merge.
// Returns a ProduceResult:
// {
//   ok: true,
//   aut: { nodeType: "form", ... }  ← the complete Abstract UI Tree
// }
// or
// {
//   ok: false,
//   errors: string[]
// }

function produce(manifest, layers, mergeResult) {
  const { fieldIndex, sectionIndex, behaviourRules } = mergeResult;
  const errors = [];

  let aut;
  try {
    aut = emitAutRoot(manifest, layers, fieldIndex, sectionIndex, behaviourRules);
  } catch (e) {
    errors.push(e.message);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, aut };
}

module.exports = { produce };
