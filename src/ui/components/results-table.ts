import { resolveName, todayIso } from '../../shared/rename';
import { dom, escapeHtml } from '../dom';
import { isSelected, selectedCount, setAllSelected, setSelected, state } from '../state';

/**
 * Only the rows inside the viewport exist in the DOM; the rest is two spacer
 * rows. v1 built one `<tr>` per match and attached two listeners to each, so a
 * 50k-match filter froze the iframe for tens of seconds and ate the memory —
 * here the DOM cost is constant no matter how large the result set is.
 *
 * ROW_HEIGHT must match the fixed height in styles.css.
 */
const ROW_HEIGHT = 34;
const OVERSCAN = 8;

export interface ResultsHost {
  onReveal(id: string): void;
  onSelectionChanged(): void;
}

let host: ResultsHost;
let scrollFrame = 0;

export function initResultsTable(resultsHost: ResultsHost): void {
  host = resultsHost;

  dom.resultsContainer.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      renderRows();
    });
  });

  dom.resultsList.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (!target.classList.contains('select-checkbox')) return;
    const id = target.dataset.id;
    if (!id) return;
    setSelected(id, target.checked);
    syncHeaderCheckbox();
    host.onSelectionChanged();
  });

  dom.resultsList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    const row = target.closest('tr');
    const id = row && (row as HTMLElement).dataset.id;
    if (id) host.onReveal(id);
  });

  dom.resultsHeader.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id !== 'selectAllCheckbox') return;
    setAllSelected(target.checked);
    renderRows();
    host.onSelectionChanged();
  });
}

function isRenaming(): boolean {
  return state.action === 'rename';
}

function columnCount(): number {
  return isRenaming() ? 5 : 4;
}

export function renderHeader(): void {
  const renaming = isRenaming();
  dom.resultsHeader.innerHTML = `
    <th><input type="checkbox" id="selectAllCheckbox"></th>
    <th>ID</th>
    <th>Layer Name</th>
    <th>Page</th>
    <th id="newNameHeader" style="display: ${renaming ? 'table-cell' : 'none'};">New Name</th>
  `;
  syncHeaderCheckbox();
}

export function syncHeaderCheckbox(): void {
  const checkbox = document.getElementById('selectAllCheckbox') as HTMLInputElement | null;
  if (!checkbox) return;
  const total = state.elements.length;
  const selected = selectedCount();
  checkbox.checked = total > 0 && selected === total;
  checkbox.indeterminate = selected > 0 && selected < total;
}

function spacer(height: number): string {
  return height > 0
    ? `<tr class="spacer" style="height:${height}px"><td colspan="${columnCount()}"></td></tr>`
    : '';
}

export function renderRows(): void {
  const container = dom.resultsContainer;
  const total = state.elements.length;
  const renaming = isRenaming();
  const template = dom.newName.value;
  const replaceText = dom.replaceText.value;
  const date = todayIso();

  const viewportRows = Math.ceil(container.clientHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const first = Math.max(0, Math.floor(container.scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(total, first + viewportRows);

  const parts: string[] = [spacer(first * ROW_HEIGHT)];

  for (let index = first; index < last; index++) {
    const element = state.elements[index];
    const checked = isSelected(element.id) ? ' checked' : '';
    const newName = renaming
      ? resolveName(
          template,
          replaceText,
          { index, name: element.name, pageName: element.pageName },
          date,
        )
      : '';

    parts.push(
      `<tr data-id="${escapeHtml(element.id)}">` +
        `<td><input type="checkbox" class="select-checkbox"${checked} data-id="${escapeHtml(element.id)}"></td>` +
        `<td>${index}</td>` +
        `<td title="${escapeHtml(element.name)}">${escapeHtml(element.name)}</td>` +
        `<td>${escapeHtml(element.pageName)}</td>` +
        `<td style="display:${renaming ? '' : 'none'}" title="${escapeHtml(newName)}">${escapeHtml(newName)}</td>` +
        `</tr>`,
    );
  }

  parts.push(spacer(Math.max(0, total - last) * ROW_HEIGHT));
  dom.resultsList.innerHTML = parts.join('');
  syncHeaderCheckbox();
}

export function renderTable(): void {
  renderHeader();
  renderRows();
}

/** New result set: jump back to the top before rendering. */
export function resetScroll(): void {
  dom.resultsContainer.scrollTop = 0;
}

/** Called while results stream in; keeps the scroll position stable. */
export function refreshAfterAppend(): void {
  renderRows();
}
