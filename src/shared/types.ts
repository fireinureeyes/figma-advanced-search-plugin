/**
 * Domain types shared by the sandbox (main) and the UI iframe.
 * Nothing in this file may reference the `figma` global or DOM APIs.
 */

export type ObjectScope = 'current-page' | 'all-pages' | 'current-selection';

/** Values of the "Find all …" dropdown. Boolean ops are matched via `booleanOperation`. */
export type ElementType =
  | 'ANY'
  | 'UNION'
  | 'SUBTRACT'
  | 'INTERSECT'
  | 'EXCLUDE'
  | 'COMPONENT'
  | 'ELLIPSE'
  | 'FRAME'
  | 'GROUP'
  | 'INSTANCE'
  | 'LINE'
  | 'POLYGON'
  | 'RECTANGLE'
  | 'SECTION'
  | 'STAR'
  | 'TEXT'
  | 'VECTOR';

export type FilterLogic = 'AND' | 'OR';

export interface FilterCondition {
  /** `null` for the first row (there is no logic dropdown on it). */
  logic: FilterLogic | null;
  key: string;
  comparison: string;
  value: string;
}

export interface Query {
  scope: ObjectScope;
  elementType: ElementType;
  filters: FilterCondition[];
}

/** One matched node, as shown in the results table. */
export interface ElementRow {
  id: string;
  name: string;
  pageName: string;
}

/**
 * Which rows the user ticked. Sent as a *spec* rather than a list of ids so that
 * a 200k-match result set stays a few bytes instead of several megabytes.
 */
export type SelectionSpec =
  | { mode: 'all'; except: string[] }
  | { mode: 'only'; only: string[] };

export type ActionType = 'select' | 'delete' | 'duplicate' | 'rename' | 'export';

export interface RenameOptions {
  newName: string;
  replaceText: string;
}

export interface ExportOptions {
  scale: string;
  format: string;
  suffix: string;
}

/** Summary of a paint array, compact enough to send over postMessage. */
export type PaintSummary =
  | { kind: 'SOLID'; hex: string }
  | { kind: 'GRADIENT' }
  | { kind: 'IMAGE' }
  | { kind: 'VIDEO' };

/** What a property reader returns for `identify` / `load from selection`. */
export type ReadValue = string | number | boolean | PaintSummary | 'N/A';
