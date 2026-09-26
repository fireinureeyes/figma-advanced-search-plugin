import { normalizeHex, rgbToHex } from './color';

/** Ported verbatim from v1 `compareValues`. */
export function compareNumbers(
  nodeValue: number,
  value: number,
  comparison: string,
  tolerance = 0,
): boolean {
  switch (comparison) {
    case 'equals':
      return Math.abs(nodeValue - value) <= tolerance;
    case 'is-larger-than':
      return nodeValue > value;
    case 'is-smaller-than':
      return nodeValue < value;
    case 'does-not-equal':
      return Math.abs(nodeValue - value) > tolerance;
    default:
      return false;
  }
}

/** Ported verbatim from v1 `compareStrings`, plus regex support in one place. */
export function compareStrings(nodeValue: string, value: string, comparison: string): boolean {
  switch (comparison) {
    case 'equals':
      return nodeValue === value;
    case 'does-not-equal':
      return nodeValue !== value;
    case 'contains':
      return nodeValue.includes(value);
    case 'does-not-contain':
      return !nodeValue.includes(value);
    case 'fits-regex':
      try {
        return new RegExp(value).test(nodeValue);
      } catch {
        // Half-typed regex ("(", "[a-") — match nothing instead of throwing and
        // aborting the whole scan.
        return false;
      }
    default:
      return false;
  }
}

/** Guarded string comparison: non-string node values never match. */
export function compareMaybeString(nodeValue: unknown, value: string, comparison: string): boolean {
  return typeof nodeValue === 'string' ? compareStrings(nodeValue, value, comparison) : false;
}

/** Guarded numeric comparison: `undefined` / mixed values never match. */
export function compareMaybeNumber(
  nodeValue: unknown,
  value: string,
  comparison: string,
  tolerance = 0,
): boolean {
  if (typeof nodeValue !== 'number' || Number.isNaN(nodeValue)) return false;
  const target = parseFloat(value);
  if (Number.isNaN(target)) return false;
  return compareNumbers(nodeValue, target, comparison, tolerance);
}

/** `true` when a two-state comparison is in its positive state. */
export function matchesFlag(state: boolean, comparison: string, positive: string): boolean {
  return comparison === positive ? state : !state;
}

export function isGradient(paint: { type: string }): boolean {
  return (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  );
}

/** Ported from v1 `compareFills`; also used for `strokes-type`. */
export function comparePaintKind(
  paints: readonly any[],
  hexValue: string,
  comparison: string,
): boolean {
  switch (comparison) {
    case 'is-of-color':
      return paints.some((paint) => paint.type === 'SOLID' && rgbToHex(paint.color) === hexValue);
    case 'is-gradient':
      return paints.some(isGradient);
    case 'is-image':
      return paints.some((paint) => paint.type === 'IMAGE');
    case 'is-video':
      return paints.some((paint) => paint.type === 'VIDEO');
    default:
      return false;
  }
}

/** Ported from v1 `compareStrokes` (equals / does-not-equal against a hex). */
export function comparePaintColor(
  paints: readonly any[],
  hexValue: string,
  comparison: string,
): boolean {
  const hasColor = paints.some(
    (paint) => paint.type === 'SOLID' && rgbToHex(paint.color) === hexValue,
  );
  switch (comparison) {
    case 'equals':
      return hasColor;
    case 'does-not-equal':
      return !hasColor;
    default:
      return false;
  }
}

/** Ported from v1 `compareColors` (effect colours). */
export function compareRgbaToHex(
  color: { r: number; g: number; b: number },
  hexValue: string,
  comparison: string,
): boolean {
  const colorHex = rgbToHex(color);
  switch (comparison) {
    case 'equals':
      return colorHex === hexValue;
    case 'does-not-equal':
      return colorHex !== hexValue;
    default:
      return false;
  }
}

export { normalizeHex, rgbToHex };
