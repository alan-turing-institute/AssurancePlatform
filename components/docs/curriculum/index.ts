/**
 * Curriculum Components Index
 *
 * LIGHTWEIGHT exports only. Heavy components must be imported directly.
 *
 * `CaseViewerWrapper` lazy-loads `read-only-case-canvas.tsx`, which pulls in
 * the real case editor's node/edge components and ELK layout engine — keep
 * it out of this barrel's own import graph.
 *
 * @module curriculum
 */

// Lightweight wrapper - lazy loads the read-only case canvas
export { default as CaseViewerWrapper } from "./case-viewer-wrapper";
