import type { PaintSummary } from '../../shared/types';
import { isGradient } from './compare';
import { rgbToHex } from './color';

/**
 * Per-node facts the traversal already knows. Computing them here instead of
 * walking `node.parent` for every property test removes an O(depth) parent walk
 * per node per filter — a large part of v1's cost on deep documents.
 */
export interface NodeCtx {
  pageName: string;
  pageId: string;
  /** The node's page. Carried so no property has to reach for `figma.root.children`. */
  page: PageNode | null;
  /** Ancestors up to (but not including) the page. Top-level node = 0. */
  depth: number;
  scope: string;
}

export function findPage(node: BaseNode | null): PageNode | null {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE') current = current.parent;
  return (current as PageNode) || null;
}

export function getPageName(node: BaseNode): string {
  const page = findPage(node);
  return page ? page.name : '';
}

export function getPageId(node: BaseNode): string {
  const page = findPage(node);
  return page ? page.id : '';
}

/** v1 `getNodeNestedLevel`: ancestors until the parent is the page. */
export function getNestedLevel(node: BaseNode): number {
  let level = 0;
  let current: BaseNode | null = node;
  while (current && current.parent && current.parent.type !== 'PAGE') {
    level++;
    current = current.parent;
  }
  return level;
}

/** Context for a single node outside of a traversal (identify / load-selection). */
export function contextFor(node: SceneNode, scope: string): NodeCtx {
  const page = findPage(node);
  return {
    pageName: page ? page.name : '',
    pageId: page ? page.id : '',
    page,
    depth: getNestedLevel(node),
    scope,
  };
}

export function countVectorPoints(node: any): number {
  if (node.type !== 'VECTOR') return 0;
  return node.vectorPaths.reduce(
    (acc: number, path: any) => acc + path.data.split(' ').length / 3,
    0,
  );
}

export function paintsOf(node: any, field: 'fills' | 'strokes'): readonly any[] | null {
  if (!(field in node)) return null;
  const paints = node[field];
  return Array.isArray(paints) ? paints : null;
}

/** Compact, postMessage-safe description of a paint array. */
export function summarisePaints(paints: readonly any[] | null): PaintSummary | 'N/A' {
  if (!paints || paints.length === 0) return 'N/A';
  const solid = paints.find((paint) => paint.type === 'SOLID');
  if (solid) return { kind: 'SOLID', hex: rgbToHex(solid.color) };
  if (paints.some((paint) => paint.type === 'VIDEO')) return { kind: 'VIDEO' };
  if (paints.some((paint) => paint.type === 'IMAGE')) return { kind: 'IMAGE' };
  if (paints.some(isGradient)) return { kind: 'GRADIENT' };
  return 'N/A';
}

/** Paint opacity defaults to fully opaque when the field is absent. */
export function paintOpacity(paint: any): number {
  return typeof paint.opacity === 'number' ? paint.opacity : 1;
}

export function firstEffect(node: any, type: string): any | null {
  if (!('effects' in node) || !Array.isArray(node.effects)) return null;
  return node.effects.find((effect: any) => effect.type === type) || null;
}

export function hasEffect(node: any, type: string): boolean {
  if (!('effects' in node) || !Array.isArray(node.effects)) return false;
  return node.effects.some((effect: any) => effect.type === type);
}

/**
 * `style.remote` requires an async lookup, so results are memoised per style id.
 * Cleared whenever a new scan starts.
 */
const remoteStyleCache = new Map<string, boolean>();

export function clearStyleCache(): void {
  remoteStyleCache.clear();
}

export async function isFillStyleRemote(node: any): Promise<boolean> {
  const styleId = node.fillStyleId;
  if (typeof styleId !== 'string' || styleId === '') return false;
  const cached = remoteStyleCache.get(styleId);
  if (cached !== undefined) return cached;
  let remote = false;
  try {
    const style = await figma.getStyleByIdAsync(styleId);
    remote = Boolean(style && style.remote);
  } catch {
    remote = false;
  }
  remoteStyleCache.set(styleId, remote);
  return remote;
}

/**
 * A flow starting point always lives on the node's own page, so only that page
 * is inspected.
 *
 * v1 looped over `figma.root.children` for the "whole document" scope. Under
 * `documentAccess: "dynamic-page"` that only worked because v1 called
 * `loadAllPagesAsync()` up front; with pages loaded one at a time it would throw
 * on the first page that has not been read yet.
 */
export function isFlowStartingPoint(node: SceneNode, page: PageNode | null): boolean {
  if (!page || page.type !== 'PAGE') return false;
  try {
    return page.flowStartingPoints.some((flow: { nodeId: string }) => flow.nodeId === node.id);
  } catch {
    // Page not loaded (should not happen inside a scan, but never throw here).
    return false;
  }
}
