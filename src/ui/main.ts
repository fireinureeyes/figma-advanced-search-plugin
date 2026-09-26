import type { PluginMessage } from '../shared/messages';
import { DEFAULT_PROPERTY, type PropertyKey } from '../shared/properties';
import type { ActionType, ElementType, ObjectScope, Query } from '../shared/types';
import {
  LOAD_SELECTION_ORDER,
  shouldSkipForLoad,
  valuesForIdentify,
  valuesForProperty,
} from './apply-values';
import { debounce, onPluginMessage, post } from './bridge';
import {
  bindContainerInput,
  clearFilters,
  createFilterRow,
  applyToRow,
  filterRowCount,
  initFilterRows,
  readFilters,
} from './components/filter-row';
import {
  initResultsTable,
  refreshAfterAppend,
  renderRows,
  renderTable,
  resetScroll,
} from './components/results-table';
import {
  clearStatus,
  showActionProgress,
  showError,
  showScanProgress,
  showScanStarted,
  updateCounts,
} from './components/status';
import { exportCsv } from './csv';
import { dom } from './dom';
import { downloadUrl } from './download';
import {
  appendResults,
  isCurrentRequest,
  nextRequestId,
  replaceResults,
  selectionSpec,
  state,
} from './state';

const SCAN_DEBOUNCE_MS = 250;
const BASE_HEIGHT = 370;
const ROW_HEIGHT = 55;
const MAX_HEIGHT = 1100;

let identifyRow: HTMLElement | null = null;

// ── query plumbing ───────────────────────────────────────────────────────────

function currentQuery(): Query {
  return {
    scope: dom.objectScope.value as ObjectScope,
    elementType: dom.elementType.value as ElementType,
    filters: readFilters(),
  };
}

/**
 * Every scan carries a request id. The sandbox cancels whatever it was doing as
 * soon as a new one arrives, and results from superseded requests are dropped
 * here — that is what lets the user keep editing filters while a huge document
 * is still being walked.
 */
function scanNow(): void {
  const requestId = nextRequestId();
  state.scanning = true;
  state.scanDone = false;
  showScanStarted();
  updateCounts();
  post({ type: 'scan', requestId, query: currentQuery() });
}

const scanSoon = debounce(scanNow, SCAN_DEBOUNCE_MS);

function adjustWindowSize(): void {
  const height = Math.min(BASE_HEIGHT + filterRowCount() * ROW_HEIGHT, MAX_HEIGHT);
  post({ type: 'resize', height });
}

// ── wiring ───────────────────────────────────────────────────────────────────

initFilterRows({
  onChange: scanSoon,
  onLayoutChange: adjustWindowSize,
  onIdentify: (row: HTMLElement, key: PropertyKey) => {
    identifyRow = row;
    post({ type: 'identify', key });
  },
});

bindContainerInput();

initResultsTable({
  onReveal: (id: string) => post({ type: 'reveal', id }),
  onSelectionChanged: updateCounts,
});

dom.addFilter.onclick = () => {
  createFilterRow();
};

dom.elementType.onchange = scanSoon;

dom.objectScope.onchange = () => {
  post({ type: 'set-scope', scope: dom.objectScope.value as ObjectScope });
  syncSelectActionLabel();
  scanNow();
};

dom.refresh.onclick = scanNow;
dom.csv.onclick = exportCsv;
dom.loadSelection.onclick = () => post({ type: 'load-selection' });

dom.reset.onclick = () => {
  dom.objectScope.value = 'current-page';
  dom.elementType.value = 'ANY';
  clearFilters();
  dom.newName.value = '';
  dom.replaceText.value = '';
  dom.exportScale.value = 'default';
  dom.exportFormat.value = 'default';
  dom.exportSuffix.value = 'default';
  dom.actionRadios().forEach((radio) => {
    radio.checked = radio.value === 'select';
  });
  setAction('select');
  post({ type: 'set-scope', scope: 'current-page' });
  syncSelectActionLabel();
  adjustWindowSize();
  scanNow();
};

dom.actionRadios().forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) setAction(radio.value as ActionType);
  });
});

dom.newName.addEventListener('input', renderRows);
dom.replaceText.addEventListener('input', renderRows);

dom.execute.onclick = () => {
  const requestId = nextRequestId();
  state.executing = true;
  post({
    type: 'execute',
    requestId,
    query: currentQuery(),
    action: state.action,
    selection: selectionSpec(),
    rename: { newName: dom.newName.value, replaceText: dom.replaceText.value },
    exportOptions: {
      scale: dom.exportScale.value,
      format: dom.exportFormat.value,
      suffix: dom.exportSuffix.value,
    },
  });
  showActionProgress(labelFor(state.action), 0, state.elements.length);
  updateCounts();
};

function labelFor(action: ActionType): string {
  switch (action) {
    case 'delete':
      return 'Deleting';
    case 'rename':
      return 'Renaming';
    case 'duplicate':
      return 'Duplicating';
    case 'export':
      return 'Exporting';
    default:
      return 'Selecting';
  }
}

function setAction(action: ActionType): void {
  state.action = action;
  const isRename = action === 'rename';
  const isExport = action === 'export';
  dom.newName.style.display = isRename ? 'inline-block' : 'none';
  dom.replaceText.style.display = isRename ? 'inline-block' : 'none';
  dom.exportOptions.style.display = isExport ? 'inline-block' : 'none';
  renderTable();
  updateCounts();
}

function syncSelectActionLabel(): void {
  const label = dom.selectActionLabel();
  if (!label) return;
  label.textContent =
    dom.objectScope.value === 'all-pages' ? ' Select (on this page)' : ' Select';
}

// ── inbound messages ─────────────────────────────────────────────────────────

onPluginMessage((message: PluginMessage) => {
  switch (message.type) {
    case 'ready': {
      state.fileName = message.fileName;
      if (message.scope) dom.objectScope.value = message.scope;
      syncSelectActionLabel();
      scanNow();
      return;
    }

    case 'scan-progress': {
      if (!isCurrentRequest(message.requestId)) return;
      showScanProgress(message);
      return;
    }

    case 'scan-results': {
      if (!isCurrentRequest(message.requestId)) return;
      if (message.append) {
        appendResults(message.elements);
        refreshAfterAppend();
      } else {
        replaceResults(message.elements);
        resetScroll();
        renderTable();
      }
      if (message.done) {
        state.scanning = false;
        state.scanDone = true;
        clearStatus();
      }
      updateCounts();
      return;
    }

    case 'scan-cancelled':
      // A newer scan is already running; its progress will replace the status.
      return;

    case 'identify-result': {
      if (!identifyRow) return;
      const update = valuesForIdentify(message.key, message.value);
      if (!update.skip) applyToRow(identifyRow, update);
      identifyRow = null;
      scanSoon();
      return;
    }

    case 'selection-props': {
      buildFiltersFromSelection(message.props);
      return;
    }

    case 'action-progress': {
      if (!isCurrentRequest(message.requestId)) return;
      showActionProgress(labelFor(message.action), message.processed, message.total);
      return;
    }

    case 'action-done': {
      if (!isCurrentRequest(message.requestId)) return;
      state.executing = false;
      clearStatus();
      updateCounts();
      return;
    }

    case 'request-rescan':
      scanSoon();
      return;

    case 'download':
      downloadUrl(message.url, message.name);
      return;

    case 'error':
      state.scanning = false;
      state.executing = false;
      showError(message.message);
      updateCounts();
      return;
  }
});

/**
 * "Load all from selection" — one row per readable property.
 * Rows are created silently and a single scan runs at the end; v1 fired a full
 * document scan for each of the ~45 rows it created.
 */
function buildFiltersFromSelection(props: Record<string, any>): void {
  clearFilters();

  for (const key of LOAD_SELECTION_ORDER) {
    const value = props[key];
    if (value === undefined) continue;
    if (shouldSkipForLoad(key, value)) continue;
    const row = valuesForProperty(key, value);
    if (row.skip) continue;
    createFilterRow(
      { key, comparison: row.comparison, value: row.value === undefined ? '' : row.value },
      true,
    );
  }

  if (filterRowCount() === 0) createFilterRow({ key: DEFAULT_PROPERTY, value: '' }, true);

  adjustWindowSize();
  scanNow();
}

// ── boot ─────────────────────────────────────────────────────────────────────

setAction('select');
renderTable();
updateCounts();
adjustWindowSize();
post({ type: 'ui-ready' });
