import { COMPARATOR_SETS, comparisonNeedsValue } from '../../shared/comparators';
import {
  DEFAULT_PROPERTY,
  PROPERTIES,
  VISIBLE_PROPERTY_GROUPS,
  isPropertyKey,
  type PropertyKey,
} from '../../shared/properties';
import type { FilterCondition, FilterLogic } from '../../shared/types';
import { OPTION_SETS, optionsHtml } from '../data/options';
import { dom, escapeHtml } from '../dom';

export interface FilterRowHost {
  /** A condition changed — re-run the (debounced) scan. */
  onChange(): void;
  /** Rows were added or removed — resize the plugin window. */
  onLayoutChange(): void;
  onIdentify(row: HTMLElement, key: PropertyKey): void;
}

const NUMBER_LIMIT = 1000000;

let host: FilterRowHost;

export function initFilterRows(rowHost: FilterRowHost): void {
  host = rowHost;
}

const conditionOptionsHtml = VISIBLE_PROPERTY_GROUPS.map(
  (group) => `
    <optgroup label="${group.group}">
      ${group.keys.map((key) => `<option value="${key}">${PROPERTIES[key].label}</option>`).join('')}
    </optgroup>`,
).join('');

function comparatorsFor(key: PropertyKey) {
  return COMPARATOR_SETS[PROPERTIES[key].comparators];
}

export function rowKey(row: HTMLElement): PropertyKey {
  const select = row.querySelector<HTMLSelectElement>('.filterCondition');
  const value = select ? select.value : DEFAULT_PROPERTY;
  return isPropertyKey(value) ? value : DEFAULT_PROPERTY;
}

function comparisonOf(row: HTMLElement): string {
  const select = row.querySelector<HTMLSelectElement>('.filterComparison');
  return select ? select.value : '';
}

/** Rebuilds the comparison dropdown for the row's current property. */
function syncComparisons(row: HTMLElement, preferred?: string): void {
  const select = row.querySelector<HTMLSelectElement>('.filterComparison');
  if (!select) return;
  const options = comparatorsFor(rowKey(row));
  select.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  const wanted = preferred && options.some((option) => option.value === preferred) ? preferred : options[0].value;
  select.value = wanted;
}

/**
 * Creates or reuses the value field.
 *
 * v1 recreated this element on every change (an `if (true)` had disabled its own
 * type check), which wiped whatever the user had typed. Here the element is only
 * replaced when the required kind actually differs, and the previous value is
 * carried across when it still makes sense.
 */
function syncValueField(row: HTMLElement): void {
  const key = rowKey(row);
  const meta = PROPERTIES[key];
  const comparison = comparisonOf(row);
  let field = row.querySelector<HTMLInputElement | HTMLSelectElement>('.filterValue');
  if (!field) return;

  const needsValue = meta.input !== 'none' && comparisonNeedsValue(comparison);
  const wantsSelect = meta.input === 'select';
  const wantsNumber = meta.input === 'number';

  const isSelect = field.tagName === 'SELECT';
  const currentType = isSelect ? 'select' : (field as HTMLInputElement).type;
  const wantedType = wantsSelect ? 'select' : wantsNumber ? 'number' : 'text';

  if (currentType !== wantedType) {
    const previous = field.value;
    let replacement: HTMLInputElement | HTMLSelectElement;

    if (wantsSelect) {
      const select = document.createElement('select');
      select.innerHTML = optionsHtml(OPTION_SETS[meta.options || 'blendMode']);
      replacement = select;
    } else {
      const input = document.createElement('input');
      input.type = wantedType;
      input.placeholder = 'value';
      if (wantsNumber) {
        input.step = 'any';
        input.min = String(-NUMBER_LIMIT);
        input.max = String(NUMBER_LIMIT);
      }
      // Keep whatever was typed when moving between text and number fields.
      if (previous && (wantedType === 'text' || !Number.isNaN(parseFloat(previous)))) {
        input.value = previous;
      }
      replacement = input;
    }

    replacement.className = 'filterValue';
    field.replaceWith(replacement);
    field = replacement;
  } else if (wantsSelect) {
    const wanted = optionsHtml(OPTION_SETS[meta.options || 'blendMode']);
    if (field.innerHTML !== wanted) {
      const previous = field.value;
      field.innerHTML = wanted;
      field.value = previous;
    }
  }

  field.style.display = needsValue ? 'inline-block' : 'none';
}

function clampNumber(field: HTMLInputElement): void {
  const value = parseFloat(field.value);
  if (Number.isNaN(value)) return;
  if (value > NUMBER_LIMIT) field.value = String(NUMBER_LIMIT);
  if (value < -NUMBER_LIMIT) field.value = String(-NUMBER_LIMIT);
}

export interface RowSeed {
  key?: PropertyKey;
  comparison?: string;
  value?: string;
  logic?: FilterLogic;
}

export function createFilterRow(seed: RowSeed = {}, silent = false): HTMLElement {
  const container = dom.filterContainer;
  const isFirst = container.children.length === 0;

  const previous = container.lastElementChild as HTMLElement | null;
  const key = seed.key || (previous ? rowKey(previous) : DEFAULT_PROPERTY);
  const carriedComparison = seed.comparison || (previous ? comparisonOf(previous) : undefined);
  const carriedValue =
    seed.value !== undefined
      ? seed.value
      : previous
        ? (previous.querySelector<HTMLInputElement>('.filterValue')?.value ?? '')
        : '';

  const row = document.createElement('div');
  row.classList.add('filterRow');
  row.innerHTML = `
    ${
      isFirst
        ? '<p>such that the</p>'
        : `<label>
             <select class="filterLogic">
               <option value="AND">and</option>
               <option value="OR">or</option>
             </select>
           </label>`
    }
    <label>
      <select class="filterCondition">${conditionOptionsHtml}</select>
    </label>
    <label>
      <select class="filterComparison"></select>
    </label>
    <label>
      <input type="text" class="filterValue" placeholder="value" value="${escapeHtml(carriedValue)}" />
    </label>
    <div class="buttons">
      <button class="identify" title="Read this property from the selected element">⌖</button>
      <button class="removeFilter" title="Remove condition">–</button>
    </div>
  `;

  const conditionSelect = row.querySelector<HTMLSelectElement>('.filterCondition')!;
  conditionSelect.value = key;
  if (seed.logic) {
    const logicSelect = row.querySelector<HTMLSelectElement>('.filterLogic');
    if (logicSelect) logicSelect.value = seed.logic;
  }

  syncComparisons(row, carriedComparison);
  syncValueField(row);
  if (seed.value !== undefined) {
    const field = row.querySelector<HTMLInputElement>('.filterValue');
    if (field) field.value = seed.value;
  }

  conditionSelect.addEventListener('change', () => {
    syncComparisons(row);
    syncValueField(row);
    host.onChange();
  });

  row.querySelector<HTMLSelectElement>('.filterComparison')!.addEventListener('change', () => {
    syncValueField(row);
    host.onChange();
  });

  row.querySelector<HTMLButtonElement>('.identify')!.onclick = () => {
    host.onIdentify(row, rowKey(row));
  };

  row.querySelector<HTMLButtonElement>('.removeFilter')!.onclick = () => {
    row.remove();
    host.onChange();
    host.onLayoutChange();
  };

  container.appendChild(row);
  if (!silent) {
    host.onChange();
    host.onLayoutChange();
  }
  return row;
}

/** Applies a property/comparison/value triple to an existing row (identify, load-from-selection). */
export function applyToRow(
  row: HTMLElement,
  update: { key?: PropertyKey; comparison?: string; value?: string },
): void {
  if (update.key) {
    const select = row.querySelector<HTMLSelectElement>('.filterCondition');
    if (select) select.value = update.key;
    syncComparisons(row, update.comparison);
  } else if (update.comparison) {
    syncComparisons(row, update.comparison);
  }

  syncValueField(row);

  if (update.value !== undefined) {
    const field = row.querySelector<HTMLInputElement>('.filterValue');
    if (field) field.value = update.value;
  }
}

export function readFilters(): FilterCondition[] {
  return Array.from(dom.filterContainer.querySelectorAll<HTMLElement>('.filterRow')).map(
    (row, index) => ({
      logic: index === 0 ? null : ((row.querySelector<HTMLSelectElement>('.filterLogic')?.value as FilterLogic) || 'AND'),
      key: rowKey(row),
      comparison: comparisonOf(row),
      value: row.querySelector<HTMLInputElement>('.filterValue')?.value ?? '',
    }),
  );
}

export function clearFilters(): void {
  dom.filterContainer.innerHTML = '';
}

export function filterRowCount(): number {
  return dom.filterContainer.querySelectorAll('.filterRow').length;
}

/** Typing inside a row: clamp numbers, then let the host re-scan (debounced). */
export function bindContainerInput(): void {
  dom.filterContainer.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target && target.classList.contains('filterValue') && target.type === 'number') {
      clampNumber(target);
    }
    host.onChange();
  });
}
