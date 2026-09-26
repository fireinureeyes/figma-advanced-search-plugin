import { dom } from '../dom';
import { selectedCount, state } from '../state';

const TIP_THRESHOLD = 5000;
const TIP_TEXT =
  'Tip: Too many elements on one page? Improve the performance by limiting the scope to your current selection.';

function progressBar(done: number, total: number): string {
  if (!total || total <= 0) return '';
  const percent = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const filled = Math.round((percent / 100) * 10);
  return ` (${percent}%) ` + '█'.repeat(filled) + '▒'.repeat(10 - filled);
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function showStatus(text: string): void {
  dom.loadingMessage.style.display = text ? 'block' : 'none';
  dom.loadingMessage.textContent = text;
}

export function showTip(show: boolean): void {
  dom.tipMessage.style.display = show ? 'block' : 'none';
  dom.tipMessage.textContent = show ? TIP_TEXT : '';
}

export function clearStatus(): void {
  showStatus('');
  showTip(false);
}

export function showScanStarted(): void {
  showStatus('Scanning…');
}

export function showScanProgress(progress: {
  scanned: number;
  matched: number;
  pageIndex: number;
  pageCount: number;
}): void {
  const base = `Scanning — ${formatNumber(progress.scanned)} nodes checked, ${formatNumber(
    progress.matched,
  )} matches`;
  const text =
    progress.pageCount > 1
      ? `Page ${progress.pageIndex} of ${progress.pageCount}${progressBar(
          progress.pageIndex,
          progress.pageCount,
        )} — ${base}`
      : base;
  showStatus(text);
  showTip(progress.scanned > TIP_THRESHOLD && dom.objectScope.value !== 'current-selection');
}

export function showActionProgress(action: string, processed: number, total: number): void {
  showStatus(`${action}: ${formatNumber(processed)} of ${formatNumber(total)}${progressBar(processed, total)}`);
}

export function showError(message: string): void {
  showStatus(`Something went wrong: ${message}`);
}

/** Count line + Execute availability. */
export function updateCounts(): void {
  const total = state.elements.length;
  const selected = selectedCount();
  const noun = total === 1 ? 'element' : 'elements';
  const suffix = state.scanning ? ' — still scanning…' : '';
  dom.elementCount.textContent = `${formatNumber(total)} ${noun} found (${formatNumber(
    selected,
  )} chosen for processing)${suffix}`;
  // Executing against a half-finished result set would silently skip matches,
  // and a second Execute while one is running would act on the same nodes twice.
  dom.execute.disabled = state.scanning || state.executing || selected === 0;
}
