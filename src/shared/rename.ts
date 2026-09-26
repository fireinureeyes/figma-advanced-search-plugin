/**
 * Rename templating. Used by BOTH the UI preview column and the sandbox rename
 * action — in v1 these were two copies that had to be kept in sync by hand.
 *
 * Supported variables: {id} {name} {page} {date} {alphabet}
 * Note: `.replace(string, …)` replaces the FIRST occurrence only. That is v1
 * behaviour and is preserved deliberately; switch to a global regex here if you
 * ever want `{id}-{id}` to expand twice.
 */

export interface RenameContext {
  index: number;
  name: string;
  pageName: string;
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function applyTemplate(template: string, ctx: RenameContext, date = todayIso()): string {
  const alphabet = String.fromCharCode(97 + (ctx.index % 26));
  return template
    .replace('{id}', String(ctx.index + 1))
    .replace('{name}', ctx.name)
    .replace('{page}', ctx.pageName)
    .replace('{date}', date)
    .replace('{alphabet}', alphabet);
}

/**
 * Full resolution of the new name for one element.
 * With `replaceText` set, the template output is substituted into the original
 * name wherever the (regex) `replaceText` matches; otherwise it replaces the
 * name outright.
 *
 * An invalid regex leaves the name untouched instead of throwing — in v1 a stray
 * `(` while typing threw inside the render loop and blanked the results table.
 */
export function resolveName(
  template: string,
  replaceText: string,
  ctx: RenameContext,
  date = todayIso(),
): string {
  const resolved = applyTemplate(template || '{name}', ctx, date);
  if (!replaceText) return resolved;
  try {
    return ctx.name.replace(new RegExp(replaceText, 'g'), resolved);
  } catch {
    return ctx.name;
  }
}
