import { COMPARATOR_SETS } from '../shared/comparators';
import { PROPERTIES, type PropertyKey } from '../shared/properties';
import type { PaintSummary, ReadValue } from '../shared/types';

/**
 * Maps a value read off a node to "which comparison + which value should the
 * filter row show".
 *
 * v1 did this with a ~250-line switch in the identify handler and another
 * ~360-line block for load-from-selection — 40 of those cases were the identical
 * "put the result in the value field". The rule is actually a function of the
 * property's comparator set, so it fits in one small table.
 */
export interface RowValues {
  comparison?: string;
  value?: string;
  /** No sensible representation — skip this property entirely. */
  skip?: boolean;
}

function isPaintSummary(value: ReadValue): value is PaintSummary {
  return typeof value === 'object' && value !== null && 'kind' in (value as any);
}

function paintRow(value: PaintSummary, colorComparison: string): RowValues {
  switch (value.kind) {
    case 'SOLID':
      return { comparison: colorComparison, value: value.hex };
    case 'GRADIENT':
      return { comparison: 'is-gradient' };
    case 'IMAGE':
      return { comparison: 'is-image' };
    case 'VIDEO':
      return { comparison: 'is-video' };
    default:
      return { skip: true };
  }
}

export function valuesForProperty(key: PropertyKey, value: ReadValue): RowValues {
  if (value === 'N/A' || value === undefined || value === null) return { skip: true };

  const meta = PROPERTIES[key];

  switch (meta.comparators) {
    case 'visible':
      return { comparison: value === true ? 'is-visible' : 'is-not-visible' };
    case 'applied':
      return { comparison: value === true ? 'is-applied' : 'is-not-applied' };
    case 'remote':
      return { comparison: value === true ? 'is-remote' : 'is-not-remote' };
    case 'yesno':
      return { comparison: value === true ? 'yes' : 'no' };
    case 'paint':
      return isPaintSummary(value) ? paintRow(value, 'is-of-color') : { skip: true };
    case 'text':
      // Default comparison for name-like properties stays "contains", as in v1.
      return { comparison: COMPARATOR_SETS.text[0].value, value: String(value) };
    case 'equality':
      if (isPaintSummary(value)) return paintRow(value, 'equals');
      return { comparison: 'equals', value: String(value) };
    case 'numeric':
    default:
      return { comparison: 'equals', value: String(value) };
  }
}

/**
 * Order in which "Load all from selection" generates conditions.
 * Deliberately the same list and order as v1 so the produced filter stack looks
 * familiar — effects and per-corner rounding stay out of it.
 */
export const LOAD_SELECTION_ORDER: PropertyKey[] = [
  'layer-name',
  'page-name',
  'width',
  'height',
  'x',
  'y',
  'rotation',
  'number-of-children',
  'nested-level',
  'number-of-points',
  'appearance-rounding',
  'fill',
  'stroke-color',
  'appearance-opacity',
  'stroke',
  'appearance-blendmode',
  'fills-blendmode',
  'fills-opacity',
  'strokes-opacity',
  'strokes-blendmode',
  'strokes-visibility',
  'strokes-align',
  'font-name',
  'font-size',
  'line-height',
  'letter-spacing',
  'font-weight',
  'text-horizontal-align',
  'text-vertical-align',
  'text-decoration',
  'paragraph-indent',
  'paragraph-spacing',
  'autolayout',
  'autolayout-position',
  'autolayout-direction',
  'autolayout-item-spacing',
  'autolayout-padding-top',
  'autolayout-padding-bottom',
  'autolayout-padding-left',
  'autolayout-padding-right',
  'fills-visibility',
  'fills-remote',
  'visibility',
  'is-locked',
  'is-mask',
  'export-setting',
  'overriden-properties',
];

/** v1 skipped a vector point count of 0; everything else is skipped on 'N/A'. */
export function shouldSkipForLoad(key: PropertyKey, value: ReadValue): boolean {
  if (key === 'number-of-points' && (value === 0 || value === '0')) return true;
  return false;
}

/**
 * Identify (⌖) is slightly different from load-from-selection: when the property
 * has a real value, only the value is filled in and the user's chosen comparison
 * ("is larger than", "does not contain", …) is left alone — same as v1.
 */
export function valuesForIdentify(key: PropertyKey, value: ReadValue): RowValues {
  const base = valuesForProperty(key, value);
  if (base.skip) return base;

  const set = PROPERTIES[key].comparators;
  const carriesMeaningInComparison =
    set === 'visible' ||
    set === 'applied' ||
    set === 'remote' ||
    set === 'yesno' ||
    set === 'paint' ||
    isPaintSummary(value);

  return carriesMeaningInComparison ? base : { value: base.value };
}
