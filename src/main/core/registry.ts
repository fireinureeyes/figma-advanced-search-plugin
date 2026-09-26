import type { PropertyKey } from '../../shared/properties';
import type { ReadValue } from '../../shared/types';
import {
  compareMaybeNumber,
  compareMaybeString,
  compareNumbers,
  comparePaintColor,
  comparePaintKind,
  compareRgbaToHex,
  matchesFlag,
  normalizeHex,
} from '../utils/compare';
import {
  countVectorPoints,
  firstEffect,
  hasEffect,
  isFillStyleRemote,
  isFlowStartingPoint,
  paintOpacity,
  paintsOf,
  summarisePaints,
  type NodeCtx,
} from '../utils/node';

/**
 * Every property is implemented exactly once, here.
 *
 * `read`  → powers the ⌖ identify button and "Load all from selection".
 * `test`  → powers filtering.
 *
 * In v1 these two lived in three separate switch statements (identify, the
 * load-selection payload, and the filter loop) which had already drifted apart.
 *
 * Both may return a promise; the evaluator awaits only entries marked `async`,
 * so the synchronous 99% of the table stays on the fast path.
 *
 * Node access is deliberately untyped (`any`): every reader guards with a
 * runtime `in` check, and threading Figma's mixin unions through 80 entries adds
 * casts without adding safety.
 */
export interface PropertyImpl {
  read(node: any, ctx: NodeCtx): ReadValue | Promise<ReadValue>;
  test(node: any, ctx: NodeCtx, value: string, comparison: string): boolean | Promise<boolean>;
  async?: true;
}

// ── small factories ──────────────────────────────────────────────────────────

type Get<T> = (node: any, ctx: NodeCtx) => T;

/**
 * `undefined` → the property does not apply to this node type
 *               (falls back to `missing` if provided, otherwise never matches).
 * `null`      → present but not comparable (figma.mixed) → never matches.
 */
function numeric(
  get: Get<number | undefined | null>,
  opts: { missing?: number; tolerance?: number } = {},
): PropertyImpl {
  const { missing, tolerance = 0 } = opts;
  return {
    read: (node, ctx) => {
      const raw = get(node, ctx);
      if (typeof raw === 'number') return raw;
      if (raw === null) return 'Mixed';
      return missing !== undefined ? missing : 'N/A';
    },
    test: (node, ctx, value, comparison) => {
      const raw = get(node, ctx);
      if (typeof raw === 'number') return compareMaybeNumber(raw, value, comparison, tolerance);
      if (raw === undefined && missing !== undefined) {
        return compareMaybeNumber(missing, value, comparison, tolerance);
      }
      return false;
    },
  };
}

function text(get: Get<string | undefined>): PropertyImpl {
  return {
    read: (node, ctx) => {
      const raw = get(node, ctx);
      return raw === undefined ? 'N/A' : raw;
    },
    test: (node, ctx, value, comparison) => compareMaybeString(get(node, ctx), value, comparison),
  };
}

/**
 * Two-state property. `get` returns `undefined` when the property does not apply
 * — in which case nothing matches, mirroring v1's "guard, else leave false".
 */
function flag(get: Get<boolean | undefined>, positive: string): PropertyImpl {
  return {
    read: (node, ctx) => {
      const raw = get(node, ctx);
      return raw === undefined ? 'N/A' : raw;
    },
    test: (node, ctx, _value, comparison) => {
      const raw = get(node, ctx);
      return raw === undefined ? false : matchesFlag(raw, comparison, positive);
    },
  };
}

/** Numeric property of the first effect of `type` (drop shadow / inner shadow). */
function effectNumeric(type: string, pick: (effect: any) => number): PropertyImpl {
  return numeric((node) => {
    const effect = firstEffect(node, type);
    return effect ? pick(effect) : undefined;
  });
}

function effectColor(type: string): PropertyImpl {
  return {
    read: (node) => {
      const effect = firstEffect(node, type);
      if (!effect || !effect.color) return 'N/A';
      return summarisePaints([{ type: 'SOLID', color: effect.color }]);
    },
    test: (node, _ctx, value, comparison) => {
      const effect = firstEffect(node, type);
      if (!effect || !effect.color) return false;
      return compareRgbaToHex(effect.color, normalizeHex(value), comparison);
    },
  };
}

function effectBlend(type: string): PropertyImpl {
  return text((node) => {
    const effect = firstEffect(node, type);
    return effect ? effect.blendMode : undefined;
  });
}

/** Paint-array property (`fills` / `strokes`) compared by paint kind. */
function paintKind(field: 'fills' | 'strokes'): PropertyImpl {
  return {
    read: (node) => summarisePaints(paintsOf(node, field)),
    test: (node, _ctx, value, comparison) => {
      const paints = paintsOf(node, field);
      if (!paints) return false;
      return comparePaintKind(paints, normalizeHex(value), comparison);
    },
  };
}

function paintBlendMode(field: 'fills' | 'strokes'): PropertyImpl {
  return {
    read: (node) => {
      const paints = paintsOf(node, field);
      if (!paints || paints.length === 0) return 'N/A';
      return paints[0].blendMode === undefined ? 'N/A' : paints[0].blendMode;
    },
    test: (node, _ctx, value, comparison) => {
      const paints = paintsOf(node, field);
      if (!paints) return false;
      // `''` for an absent blendMode keeps v1's "does-not-equal matches" result.
      return paints.some((paint) =>
        compareMaybeString(paint.blendMode === undefined ? '' : paint.blendMode, value, comparison),
      );
    },
  };
}

function paintOpacityProp(field: 'fills' | 'strokes'): PropertyImpl {
  return {
    read: (node) => {
      const paints = paintsOf(node, field);
      if (!paints || paints.length === 0) return 'N/A';
      return paintOpacity(paints[0]) * 100;
    },
    test: (node, _ctx, value, comparison) => {
      const paints = paintsOf(node, field);
      if (!paints) return false;
      const target = parseFloat(value) / 100;
      if (Number.isNaN(target)) return false;
      return paints.some((paint) =>
        compareNumbers(paintOpacity(paint), target, comparison, 0.01),
      );
    },
  };
}

function paintVisibility(field: 'fills' | 'strokes'): PropertyImpl {
  return {
    read: (node) => {
      const paints = paintsOf(node, field);
      if (!paints || paints.length === 0) return 'N/A';
      return paints[0].visible !== false;
    },
    test: (node, _ctx, _value, comparison) => {
      const paints = paintsOf(node, field);
      if (!paints) return false;
      return paints.some((paint) => matchesFlag(paint.visible !== false, comparison, 'is-visible'));
    },
  };
}

function cornerRadius(corner: string): PropertyImpl {
  return numeric((node) => {
    if (!('cornerRadius' in node)) return undefined;
    return corner in node ? node[corner] : undefined;
  });
}

const INTERACTIVE_TYPES = ['FRAME', 'COMPONENT', 'INSTANCE'];

// ── the registry ─────────────────────────────────────────────────────────────

export const REGISTRY: Record<PropertyKey, PropertyImpl> = {
  // ── General ────────────────────────────────────────────────────────────────
  'layer-name': text((node) => node.name || ''),
  'page-name': text((_node, ctx) => ctx.pageName || ''),
  width: numeric((node) => ('width' in node ? node.width : undefined)),
  height: numeric((node) => ('height' in node ? node.height : undefined)),
  x: numeric((node) => ('x' in node ? node.x : undefined)),
  y: numeric((node) => ('y' in node ? node.y : undefined)),
  visibility: flag((node) => ('visible' in node ? node.visible : undefined), 'is-visible'),
  rotation: numeric((node) => ('rotation' in node ? node.rotation : undefined)),
  'number-of-children': numeric((node) => ('children' in node ? node.children.length : undefined), {
    missing: 0,
  }),
  'nested-level': numeric((_node, ctx) => ctx.depth),
  'number-of-points': {
    read: (node) => countVectorPoints(node),
    test: (node, _ctx, value, comparison) =>
      node.type === 'VECTOR'
        ? compareMaybeNumber(countVectorPoints(node), value, comparison)
        : false,
  },
  'is-locked': flag((node) => ('locked' in node ? node.locked : undefined), 'yes'),
  'is-mask': flag((node) => ('isMask' in node ? node.isMask : undefined), 'yes'),
  'export-setting': flag(
    (node) =>
      'exportSettings' in node
        ? Boolean(node.exportSettings && node.exportSettings.length > 0)
        : undefined,
    'is-applied',
  ),
  'overriden-properties': {
    read: (node) => (node.type === 'INSTANCE' ? node.overrides.length > 0 : false),
    // v1 parity: a non-instance counts as "no overrides", so `no` matches it.
    test: (node, _ctx, _value, comparison) => {
      const hasOverrides = node.type === 'INSTANCE' ? node.overrides.length > 0 : false;
      return matchesFlag(hasOverrides, comparison, 'yes');
    },
  },

  // ── Appearance ─────────────────────────────────────────────────────────────
  'appearance-rounding': {
    read: (node) => {
      if (!('cornerRadius' in node)) return 0;
      return typeof node.cornerRadius === 'number' ? node.cornerRadius : 'Mixed';
    },
    test: (node, _ctx, value, comparison) => {
      if ('cornerRadius' in node) {
        if (typeof node.cornerRadius === 'number') {
          return compareMaybeNumber(node.cornerRadius, value, comparison);
        }
        // figma.mixed — the literal input "Mixed" matches it.
        return typeof node.cornerRadius === 'symbol' && value === 'Mixed';
      }
      return compareMaybeNumber(0, value, comparison);
    },
  },
  fill: paintKind('fills'),
  stroke: numeric((node) => ('strokeWeight' in node ? (node.strokeWeight ?? null) : undefined), {
    missing: 0,
  }),
  'stroke-color': {
    read: (node) => summarisePaints(paintsOf(node, 'strokes')),
    test: (node, _ctx, value, comparison) => {
      const paints = paintsOf(node, 'strokes');
      if (!paints) return false;
      return comparePaintColor(paints, normalizeHex(value), comparison);
    },
  },
  'appearance-opacity': {
    read: (node) => ('opacity' in node ? node.opacity * 100 : 'N/A'),
    test: (node, _ctx, value, comparison) => {
      if (!('opacity' in node)) return false;
      const target = parseFloat(value) / 100;
      if (Number.isNaN(target)) return false;
      return compareNumbers(node.opacity, target, comparison, 0.01);
    },
  },
  'appearance-blendmode': text((node) => ('blendMode' in node ? node.blendMode : undefined)),
  'fills-blendmode': paintBlendMode('fills'),
  'fills-opacity': paintOpacityProp('fills'),
  'fills-visibility': paintVisibility('fills'),
  'fills-remote': {
    async: true,
    read: (node) => isFillStyleRemote(node),
    test: async (node, _ctx, _value, comparison) =>
      matchesFlag(await isFillStyleRemote(node), comparison, 'is-remote'),
  },
  'strokes-opacity': paintOpacityProp('strokes'),
  'strokes-blendmode': paintBlendMode('strokes'),
  'strokes-visibility': paintVisibility('strokes'),
  'strokes-type': paintKind('strokes'),
  'strokes-align': {
    read: (node) => {
      const paints = paintsOf(node, 'strokes');
      if (!paints || paints.length === 0 || !('strokeAlign' in node)) return 'N/A';
      return node.strokeAlign;
    },
    test: (node, _ctx, value, comparison) => {
      const paints = paintsOf(node, 'strokes');
      if (!paints || paints.length === 0 || !('strokeAlign' in node)) return false;
      return compareMaybeString(node.strokeAlign, value, comparison);
    },
  },
  'corner-radius-top-left': cornerRadius('topLeftRadius'),
  'corner-radius-top-right': cornerRadius('topRightRadius'),
  'corner-radius-bottom-left': cornerRadius('bottomLeftRadius'),
  'corner-radius-bottom-right': cornerRadius('bottomRightRadius'),

  // ── Effects ────────────────────────────────────────────────────────────────
  'effect-drop_shadow': flag((node) => hasEffect(node, 'DROP_SHADOW'), 'is-applied'),
  'effect-inner_shadow': flag((node) => hasEffect(node, 'INNER_SHADOW'), 'is-applied'),
  'effect-layer_blur': flag((node) => hasEffect(node, 'LAYER_BLUR'), 'is-applied'),
  'effect-background_blur': flag((node) => hasEffect(node, 'BACKGROUND_BLUR'), 'is-applied'),
  'effect-drop_shadow-positionx': effectNumeric('DROP_SHADOW', (e) => e.offset.x),
  'effect-drop_shadow-positiony': effectNumeric('DROP_SHADOW', (e) => e.offset.y),
  'effect-drop_shadow-blur': effectNumeric('DROP_SHADOW', (e) => e.radius),
  'effect-drop_shadow-spread': effectNumeric('DROP_SHADOW', (e) => e.spread),
  'effect-drop_shadow-color': effectColor('DROP_SHADOW'),
  'effect-drop_shadow-blendmode': effectBlend('DROP_SHADOW'),
  'effect-inner_shadow-positionx': effectNumeric('INNER_SHADOW', (e) => e.offset.x),
  'effect-inner_shadow-positiony': effectNumeric('INNER_SHADOW', (e) => e.offset.y),
  'effect-inner_shadow-blur': effectNumeric('INNER_SHADOW', (e) => e.radius),
  'effect-inner_shadow-spread': effectNumeric('INNER_SHADOW', (e) => e.spread),
  'effect-inner_shadow-color': effectColor('INNER_SHADOW'),
  'effect-inner_shadow-blendmode': effectBlend('INNER_SHADOW'),

  // ── Text ───────────────────────────────────────────────────────────────────
  'font-name': {
    read: (node) => {
      if (!('fontName' in node)) return 'N/A';
      return typeof node.fontName === 'symbol' ? 'Mixed' : node.fontName.family;
    },
    test: (node, _ctx, value, comparison) => {
      if (!('fontName' in node)) return false;
      const family = typeof node.fontName === 'object' ? node.fontName.family : '';
      return compareMaybeString(typeof family === 'string' ? family : '', value, comparison);
    },
  },
  'font-size': numeric((node) =>
    'fontSize' in node ? (typeof node.fontSize === 'number' ? node.fontSize : null) : undefined,
  ),
  'line-height': {
    read: (node) => {
      if (!('lineHeight' in node)) return 'N/A';
      const lh = node.lineHeight;
      if (typeof lh === 'object' && lh !== null) return lh.unit === 'AUTO' ? 'Auto' : lh.value;
      return typeof lh === 'number' ? lh : 'N/A';
    },
    test: (node, _ctx, value, comparison) => {
      if (!('lineHeight' in node)) return false;
      const lh = node.lineHeight;
      // "auto" is a magic value here and ignores the comparison, as in v1.
      if (String(value).toLowerCase() === 'auto') {
        return typeof lh === 'object' && lh !== null && lh.unit === 'AUTO';
      }
      if (typeof lh === 'object' && lh !== null && 'value' in lh) {
        return compareMaybeNumber(lh.value, value, comparison);
      }
      return false;
    },
  },
  // v1 parity: only PERCENT letter spacing is comparable; PIXELS never matches.
  'letter-spacing': numeric((node) => {
    if (!('letterSpacing' in node)) return undefined;
    const ls = node.letterSpacing;
    if (typeof ls === 'object' && ls !== null && ls.unit === 'PERCENT') return ls.value;
    return null;
  }),
  'font-weight': text((node) =>
    'fontWeight' in node && node.fontWeight !== undefined ? String(node.fontWeight) : undefined,
  ),
  'text-horizontal-align': text((node) =>
    'textAlignHorizontal' in node ? node.textAlignHorizontal : undefined,
  ),
  'text-vertical-align': text((node) =>
    'textAlignVertical' in node ? node.textAlignVertical : undefined,
  ),
  'text-decoration': text((node) =>
    'textDecoration' in node && typeof node.textDecoration === 'string'
      ? node.textDecoration
      : undefined,
  ),
  'paragraph-indent': numeric((node) =>
    'paragraphIndent' in node ? node.paragraphIndent : undefined,
  ),
  'paragraph-spacing': numeric((node) =>
    'paragraphSpacing' in node ? node.paragraphSpacing : undefined,
  ),

  // ── Auto Layout ────────────────────────────────────────────────────────────
  autolayout: flag(
    (node) => ('layoutMode' in node ? node.layoutMode !== 'NONE' : undefined),
    'is-applied',
  ),
  'autolayout-position': text((node) =>
    'primaryAxisAlignItems' in node ? node.primaryAxisAlignItems : undefined,
  ),
  'autolayout-direction': {
    read: (node) => {
      if (!('layoutMode' in node)) return 'N/A';
      return node.layoutMode !== 'NONE' ? node.layoutMode : 'N/A';
    },
    test: (node, _ctx, value, comparison) => {
      if (!('layoutMode' in node)) return false;
      return compareMaybeString(node.layoutMode, String(value).toUpperCase(), comparison);
    },
  },
  'autolayout-item-spacing': numeric((node) =>
    'itemSpacing' in node ? node.itemSpacing : undefined,
  ),
  'autolayout-padding-top': numeric((node) =>
    'layoutMode' in node ? node.paddingTop : undefined,
  ),
  'autolayout-padding-bottom': numeric((node) =>
    'layoutMode' in node ? node.paddingBottom : undefined,
  ),
  'autolayout-padding-left': numeric((node) =>
    'layoutMode' in node ? node.paddingLeft : undefined,
  ),
  'autolayout-padding-right': numeric((node) =>
    'layoutMode' in node ? node.paddingRight : undefined,
  ),

  // ── Interactions ───────────────────────────────────────────────────────────
  interaction: {
    read: (node) =>
      INTERACTIVE_TYPES.indexOf(node.type) !== -1
        ? Boolean(
            node.reactions &&
              node.reactions.some((reaction: any) => reaction.action !== null && reaction.action !== undefined),
          )
        : 'N/A',
    // v1 parity: non-frame/component/instance never matches, not even "is not applied".
    test: (node, _ctx, _value, comparison) => {
      if (INTERACTIVE_TYPES.indexOf(node.type) === -1) return false;
      const hasInteraction = Boolean(
        node.reactions &&
          node.reactions.some(
            (reaction: any) => reaction.action !== null && reaction.action !== undefined,
          ),
      );
      return matchesFlag(hasInteraction, comparison, 'is-applied');
    },
  },
  'interaction-trigger': {
    read: (node) => {
      if (!('reactions' in node) || !node.reactions.length) return 'N/A';
      const withTrigger = node.reactions.find((reaction: any) => reaction.trigger);
      return withTrigger ? withTrigger.trigger.type : 'N/A';
    },
    test: (node, _ctx, value, comparison) => {
      if (!('reactions' in node)) return false;
      return node.reactions.some((reaction: any) => {
        if (!reaction.trigger) return false;
        if (comparison === 'equals') return reaction.trigger.type === value;
        if (comparison === 'does-not-equal') return reaction.trigger.type !== value;
        return false;
      });
    },
  },
  'interaction-action': {
    read: (node) => {
      if (!('reactions' in node) || !node.reactions.length) return 'N/A';
      const withAction = node.reactions.find((reaction: any) => reaction.action);
      if (!withAction) return 'N/A';
      return actionValueOf(withAction.action);
    },
    test: (node, _ctx, value, comparison) => {
      if (!('reactions' in node)) return false;
      return node.reactions.some((reaction: any) => {
        if (!reaction.action) return false;
        const actual = actionValueOf(reaction.action);
        if (comparison === 'equals') return actual === value;
        if (comparison === 'does-not-equal') return actual !== value;
        return false;
      });
    },
  },
  'flow-starting-point': {
    read: (node, ctx) =>
      INTERACTIVE_TYPES.indexOf(node.type) !== -1 ? isFlowStartingPoint(node, ctx.page) : 'N/A',
    // v1 parity: only frames/components/instances are ever considered.
    test: (node, ctx, _value, comparison) => {
      if (INTERACTIVE_TYPES.indexOf(node.type) === -1) return false;
      return matchesFlag(isFlowStartingPoint(node, ctx.page), comparison, 'is-applied');
    },
  },
};

/**
 * The dropdown offers navigation types (NAVIGATE, SWAP…) and media actions
 * (PLAY, MUTE…) alongside plain action types, so the comparable value depends on
 * the action kind. Ported from v1's inline branching.
 */
function actionValueOf(action: any): string {
  if (action.type === 'NODE') return action.navigation;
  if (action.type === 'UPDATE_MEDIA_RUNTIME') return action.mediaAction;
  return action.type;
}

/** Keys whose `test`/`read` return promises. */
export const ASYNC_KEYS = new Set<PropertyKey>(
  (Object.keys(REGISTRY) as PropertyKey[]).filter((key) => REGISTRY[key].async === true),
);
