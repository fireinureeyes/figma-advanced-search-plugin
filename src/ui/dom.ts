function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

/**
 * One place where the UI touches `getElementById`. v1 relied on implicit
 * `window.<id>` globals in some places and explicit lookups in others, which is
 * why a few handlers silently referenced the wrong scope.
 */
export const dom = {
  get elementType() {
    return byId<HTMLSelectElement>('elementType');
  },
  get objectScope() {
    return byId<HTMLSelectElement>('objectScope');
  },
  get filterContainer() {
    return byId<HTMLDivElement>('filterContainer');
  },
  get addFilter() {
    return byId<HTMLButtonElement>('addFilter');
  },
  get loadingMessage() {
    return byId<HTMLDivElement>('loadingMessage');
  },
  get tipMessage() {
    return byId<HTMLDivElement>('tipMessage');
  },
  get elementCount() {
    return byId<HTMLParagraphElement>('elementCount');
  },
  get execute() {
    return byId<HTMLButtonElement>('execute');
  },
  get newName() {
    return byId<HTMLInputElement>('newName');
  },
  get replaceText() {
    return byId<HTMLInputElement>('replaceText');
  },
  get exportOptions() {
    return byId<HTMLDivElement>('exportOptions');
  },
  get exportScale() {
    return byId<HTMLSelectElement>('exportScale');
  },
  get exportFormat() {
    return byId<HTMLSelectElement>('exportFormat');
  },
  get exportSuffix() {
    return byId<HTMLInputElement>('exportSuffix');
  },
  get resultsContainer() {
    return byId<HTMLDivElement>('resultsContainer');
  },
  get resultsHeader() {
    return byId<HTMLTableRowElement>('resultsTableHeader');
  },
  get resultsList() {
    return byId<HTMLTableSectionElement>('resultsList');
  },
  get reset() {
    return byId<HTMLButtonElement>('reset');
  },
  get refresh() {
    return byId<HTMLButtonElement>('refresh');
  },
  get csv() {
    return byId<HTMLButtonElement>('csv');
  },
  get loadSelection() {
    return byId<HTMLButtonElement>('loadSelection');
  },
  actionRadios(): NodeListOf<HTMLInputElement> {
    return document.querySelectorAll<HTMLInputElement>('input[name="action"]');
  },
  checkedAction(): string {
    const checked = document.querySelector<HTMLInputElement>('input[name="action"]:checked');
    return checked ? checked.value : 'select';
  },
  selectActionLabel(): ChildNode | null {
    const radio = document.querySelector<HTMLInputElement>('input[name="action"][value="select"]');
    return radio ? radio.nextSibling : null;
  },
};

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
