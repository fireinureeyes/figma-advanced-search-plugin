import { resolveName, todayIso } from '../shared/rename';
import { dom } from './dom';
import { isSelected, state } from './state';
import { downloadText } from './download';

function csvCell(value: string): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Built from state rather than by scraping the table — the table is virtualised
 * now, so only ~40 rows exist in the DOM at any time.
 *
 * Column layout matches v1: the last column is the file name (it replaced the
 * "New Name" header there). The rename preview is appended as its own column
 * when the rename action is active, so nothing is lost.
 */
export function exportCsv(): void {
  const renaming = state.action === 'rename';
  const template = dom.newName.value;
  const replaceText = dom.replaceText.value;
  const date = todayIso();

  const headers = ['ID', 'Layer Name', 'Page'];
  if (renaming) headers.push('New Name');
  headers.push('File');

  const rows: string[] = [headers.join(',')];

  state.elements.forEach((element, index) => {
    if (!isSelected(element.id)) return;
    const cells = [String(index), element.name, element.pageName];
    if (renaming) {
      cells.push(
        resolveName(template, replaceText, { index, name: element.name, pageName: element.pageName }, date),
      );
    }
    cells.push(state.fileName);
    rows.push(cells.map(csvCell).join(','));
  });

  downloadText('results.csv', rows.join('\n'), 'text/csv;charset=utf-8;');
}
