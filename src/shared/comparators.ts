/**
 * The comparison dropdown is fully derived from these sets.
 * Adding a comparator to a property is a one-word change in `properties.ts`.
 */

export type ComparatorSet =
  | 'numeric'
  | 'text'
  | 'equality'
  | 'paint'
  | 'applied'
  | 'visible'
  | 'remote'
  | 'yesno';

export interface ComparatorOption {
  value: string;
  label: string;
}

export const COMPARATOR_SETS: Record<ComparatorSet, ComparatorOption[]> = {
  numeric: [
    { value: 'equals', label: 'equals' },
    { value: 'is-larger-than', label: 'is larger than' },
    { value: 'is-smaller-than', label: 'is smaller than' },
    { value: 'does-not-equal', label: 'does not equal' },
  ],
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'does-not-contain', label: 'does not contain' },
    { value: 'equals', label: 'equals' },
    { value: 'does-not-equal', label: 'does not equal' },
    { value: 'fits-regex', label: 'fits regex' },
  ],
  equality: [
    { value: 'equals', label: 'equals' },
    { value: 'does-not-equal', label: 'does not equal' },
  ],
  paint: [
    { value: 'is-of-color', label: 'is of color' },
    { value: 'is-gradient', label: 'is gradient' },
    { value: 'is-image', label: 'is image' },
    { value: 'is-video', label: 'is video' },
  ],
  applied: [
    { value: 'is-applied', label: 'is applied' },
    { value: 'is-not-applied', label: 'is not applied' },
  ],
  visible: [
    { value: 'is-visible', label: 'is visible' },
    { value: 'is-not-visible', label: 'is hidden' },
  ],
  remote: [
    { value: 'is-remote', label: 'is remote' },
    { value: 'is-not-remote', label: 'is not remote' },
  ],
  yesno: [
    { value: 'yes', label: 'yes' },
    { value: 'no', label: 'no' },
  ],
};

/**
 * Comparisons that are self-contained ("is visible", "is gradient", …).
 * The value field is hidden for these — this single rule replaces the four
 * hand-maintained condition lists the old UI used to decide field visibility.
 */
const SELF_CONTAINED = new Set([
  'is-gradient',
  'is-image',
  'is-video',
  'is-visible',
  'is-not-visible',
  'is-remote',
  'is-not-remote',
  'is-applied',
  'is-not-applied',
  'yes',
  'no',
]);

export function comparisonNeedsValue(comparison: string): boolean {
  return !SELF_CONTAINED.has(comparison);
}
