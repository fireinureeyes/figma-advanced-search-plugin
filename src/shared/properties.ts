import type { ComparatorSet } from './comparators';

/**
 * THE property table. Everything the UI knows about a property lives here;
 * everything the sandbox knows about how to *read* and *test* it lives in
 * `src/main/core/registry.ts`, keyed by the same strings.
 *
 * `registry.ts` is typed as `Record<PropertyKey, PropertyImpl>`, so adding a key
 * here without implementing it is a compile error rather than a silent no-op
 * (which is how `strokes-type` ended up matching nothing in v1).
 */

export type OptionSetId =
  | 'blendMode'
  | 'strokeAlign'
  | 'textAlignHorizontal'
  | 'textAlignVertical'
  | 'textDecoration'
  | 'autoLayoutPosition'
  | 'autoLayoutDirection'
  | 'interactionTrigger'
  | 'interactionAction';

export type InputKind = 'none' | 'number' | 'text' | 'select';

export type PropertyGroup =
  | 'General'
  | 'Appearance'
  | 'Effects'
  | 'Text'
  | 'Auto Layout'
  | 'Interactions';

export interface PropertyMeta {
  /** Text shown in the condition dropdown. Kept identical to the key so the UI reads as before. */
  label: string;
  group: PropertyGroup;
  comparators: ComparatorSet;
  input: InputKind;
  options?: OptionSetId;
  /** Implemented and testable, but not offered in the dropdown (parity with v1). */
  hidden?: boolean;
}

function p(
  group: PropertyGroup,
  comparators: ComparatorSet,
  input: InputKind,
  extra: Partial<PropertyMeta> = {},
): Omit<PropertyMeta, 'label'> {
  return { group, comparators, input, ...extra };
}

const TABLE = {
  // ── General ────────────────────────────────────────────────────────────────
  'layer-name': p('General', 'text', 'text'),
  'page-name': p('General', 'text', 'text'),
  width: p('General', 'numeric', 'number'),
  height: p('General', 'numeric', 'number'),
  x: p('General', 'numeric', 'number'),
  y: p('General', 'numeric', 'number'),
  visibility: p('General', 'visible', 'none'),
  rotation: p('General', 'numeric', 'number'),
  'number-of-children': p('General', 'numeric', 'number'),
  'nested-level': p('General', 'numeric', 'number'),
  'number-of-points': p('General', 'numeric', 'number'),
  'is-locked': p('General', 'yesno', 'none'),
  'is-mask': p('General', 'yesno', 'none'),
  'export-setting': p('General', 'applied', 'none'),
  'overriden-properties': p('General', 'yesno', 'none'),

  // ── Appearance ─────────────────────────────────────────────────────────────
  // text input, not number: the literal value "Mixed" is a valid input here.
  'appearance-rounding': p('Appearance', 'numeric', 'text'),
  fill: p('Appearance', 'paint', 'text'),
  stroke: p('Appearance', 'numeric', 'number'),
  'stroke-color': p('Appearance', 'equality', 'text'),
  'appearance-opacity': p('Appearance', 'numeric', 'number'),
  'appearance-blendmode': p('Appearance', 'equality', 'select', { options: 'blendMode' }),
  'fills-blendmode': p('Appearance', 'equality', 'select', { options: 'blendMode' }),
  'fills-opacity': p('Appearance', 'numeric', 'number'),
  'fills-visibility': p('Appearance', 'visible', 'none'),
  'fills-remote': p('Appearance', 'remote', 'none'),
  'strokes-opacity': p('Appearance', 'numeric', 'number'),
  'strokes-blendmode': p('Appearance', 'equality', 'select', { options: 'blendMode' }),
  'strokes-visibility': p('Appearance', 'visible', 'none'),
  'strokes-type': p('Appearance', 'paint', 'text'),
  'strokes-align': p('Appearance', 'equality', 'select', { options: 'strokeAlign' }),
  // Implemented in v1 but never offered in the dropdown — kept hidden for parity.
  // Flip `hidden` to false to expose per-corner rounding.
  'corner-radius-top-left': p('Appearance', 'numeric', 'number', { hidden: true }),
  'corner-radius-top-right': p('Appearance', 'numeric', 'number', { hidden: true }),
  'corner-radius-bottom-left': p('Appearance', 'numeric', 'number', { hidden: true }),
  'corner-radius-bottom-right': p('Appearance', 'numeric', 'number', { hidden: true }),

  // ── Effects ────────────────────────────────────────────────────────────────
  'effect-drop_shadow': p('Effects', 'applied', 'none'),
  'effect-inner_shadow': p('Effects', 'applied', 'none'),
  'effect-layer_blur': p('Effects', 'applied', 'none'),
  'effect-background_blur': p('Effects', 'applied', 'none'),
  'effect-drop_shadow-positionx': p('Effects', 'numeric', 'number'),
  'effect-drop_shadow-positiony': p('Effects', 'numeric', 'number'),
  'effect-drop_shadow-blur': p('Effects', 'numeric', 'number'),
  'effect-drop_shadow-spread': p('Effects', 'numeric', 'number'),
  'effect-drop_shadow-color': p('Effects', 'equality', 'text'),
  'effect-drop_shadow-blendmode': p('Effects', 'equality', 'select', { options: 'blendMode' }),
  'effect-inner_shadow-positionx': p('Effects', 'numeric', 'number'),
  'effect-inner_shadow-positiony': p('Effects', 'numeric', 'number'),
  'effect-inner_shadow-blur': p('Effects', 'numeric', 'number'),
  'effect-inner_shadow-spread': p('Effects', 'numeric', 'number'),
  'effect-inner_shadow-color': p('Effects', 'equality', 'text'),
  'effect-inner_shadow-blendmode': p('Effects', 'equality', 'select', { options: 'blendMode' }),

  // ── Text ───────────────────────────────────────────────────────────────────
  'font-name': p('Text', 'equality', 'text'),
  'font-size': p('Text', 'numeric', 'number'),
  // text input, not number: "auto" is a valid value here.
  'line-height': p('Text', 'numeric', 'text'),
  'letter-spacing': p('Text', 'numeric', 'number'),
  'font-weight': p('Text', 'equality', 'number'),
  'text-horizontal-align': p('Text', 'equality', 'select', { options: 'textAlignHorizontal' }),
  'text-vertical-align': p('Text', 'equality', 'select', { options: 'textAlignVertical' }),
  'text-decoration': p('Text', 'equality', 'select', { options: 'textDecoration' }),
  'paragraph-indent': p('Text', 'numeric', 'number'),
  'paragraph-spacing': p('Text', 'numeric', 'number'),

  // ── Auto Layout ────────────────────────────────────────────────────────────
  autolayout: p('Auto Layout', 'applied', 'none'),
  'autolayout-position': p('Auto Layout', 'equality', 'select', { options: 'autoLayoutPosition' }),
  'autolayout-direction': p('Auto Layout', 'equality', 'select', { options: 'autoLayoutDirection' }),
  'autolayout-item-spacing': p('Auto Layout', 'numeric', 'number'),
  'autolayout-padding-top': p('Auto Layout', 'numeric', 'number'),
  'autolayout-padding-bottom': p('Auto Layout', 'numeric', 'number'),
  'autolayout-padding-left': p('Auto Layout', 'numeric', 'number'),
  'autolayout-padding-right': p('Auto Layout', 'numeric', 'number'),

  // ── Interactions ───────────────────────────────────────────────────────────
  interaction: p('Interactions', 'applied', 'none'),
  'interaction-trigger': p('Interactions', 'equality', 'select', { options: 'interactionTrigger' }),
  'interaction-action': p('Interactions', 'equality', 'select', { options: 'interactionAction' }),
  'flow-starting-point': p('Interactions', 'applied', 'none'),
} as const;

export type PropertyKey = keyof typeof TABLE;

export const PROPERTIES: Record<PropertyKey, PropertyMeta> = Object.keys(TABLE).reduce(
  (acc, key) => {
    acc[key as PropertyKey] = { label: key, ...(TABLE as any)[key] };
    return acc;
  },
  {} as Record<PropertyKey, PropertyMeta>,
);

export const PROPERTY_KEYS = Object.keys(PROPERTIES) as PropertyKey[];

export function isPropertyKey(key: string): key is PropertyKey {
  return Object.prototype.hasOwnProperty.call(PROPERTIES, key);
}

const GROUP_ORDER: PropertyGroup[] = [
  'General',
  'Appearance',
  'Effects',
  'Text',
  'Auto Layout',
  'Interactions',
];

/** Grouped, dropdown-ready, hidden keys removed. Drives the `<optgroup>`s. */
export const VISIBLE_PROPERTY_GROUPS: { group: PropertyGroup; keys: PropertyKey[] }[] =
  GROUP_ORDER.map((group) => ({
    group,
    keys: PROPERTY_KEYS.filter((key) => PROPERTIES[key].group === group && !PROPERTIES[key].hidden),
  })).filter((entry) => entry.keys.length > 0);

export const DEFAULT_PROPERTY: PropertyKey = 'layer-name';
