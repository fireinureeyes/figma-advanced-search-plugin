import type { SelectionSpec } from '../../../shared/types';

/**
 * Turns the UI's selection spec into a predicate.
 *
 * v1 posted every ticked id (up to hundreds of thousands of strings) with each
 * Execute. The spec form carries only the *differences* from "all ticked", which
 * is what the UI actually tracks.
 */
export function selectionFilter(spec: SelectionSpec | undefined): (node: SceneNode) => boolean {
  if (!spec) return () => true;
  if (spec.mode === 'all') {
    if (!spec.except || spec.except.length === 0) return () => true;
    const excluded = new Set(spec.except);
    return (node) => !excluded.has(node.id);
  }
  const included = new Set(spec.only || []);
  return (node) => included.has(node.id);
}
