/** Uppercase RRGGBB, no leading `#`. */
export function rgbToHex(color: { r: number; g: number; b: number }): string {
  return (
    Math.round(color.r * 255)
      .toString(16)
      .padStart(2, '0') +
    Math.round(color.g * 255)
      .toString(16)
      .padStart(2, '0') +
    Math.round(color.b * 255)
      .toString(16)
      .padStart(2, '0')
  ).toUpperCase();
}

/** Accepts `#ff0000` or `FF0000`; returns `FF0000`. */
export function normalizeHex(value: string): string {
  const trimmed = (value || '').trim();
  return (trimmed.startsWith('#') ? trimmed.slice(1) : trimmed).toUpperCase();
}
