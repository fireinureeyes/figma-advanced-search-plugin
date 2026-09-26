import type { PluginMessage, UiMessage } from '../shared/messages';
import type { ObjectScope } from '../shared/types';
import { consumePluginSelectionFlag } from './core/actions/basic';
import { cancelActive, invalidateCache, runScan, startJob } from './core/scan';
import { handleExecute } from './handlers/execute';
import { handleIdentify, handleLoadSelection, handleReveal } from './handlers/inspect';
import { CancelledError } from './utils/async';

const UI_WIDTH = 1100;
const UI_MIN_HEIGHT = 370;
const UI_MAX_HEIGHT = 1100;
const SCOPE_STORAGE_KEY = 'scope';

figma.showUI(__html__, { width: UI_WIDTH, height: UI_MIN_HEIGHT });

/** Mirrors the scope dropdown; only used to decide which canvas events matter. */
let currentScope: ObjectScope = 'current-page';

function post(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

// ── canvas events ────────────────────────────────────────────────────────────

figma.on('close', () => {
  cancelActive();
  figma.clientStorage.setAsync(SCOPE_STORAGE_KEY, currentScope);
});

figma.on('selectionchange', () => {
  if (currentScope !== 'current-selection') return;
  // Ignore the selection we just made ourselves via the Select/Duplicate action.
  if (consumePluginSelectionFlag()) return;
  invalidateCache();
  post({ type: 'request-rescan' });
});

figma.on('currentpagechange', () => {
  if (currentScope !== 'current-page' && currentScope !== 'current-selection') return;
  invalidateCache();
  post({ type: 'request-rescan' });
});

// ── router ───────────────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UiMessage) => {
  try {
    switch (msg.type) {
      case 'ui-ready': {
        const storedScope = (await figma.clientStorage.getAsync(SCOPE_STORAGE_KEY)) as
          | ObjectScope
          | undefined;
        if (storedScope) currentScope = storedScope;
        post({ type: 'ready', scope: storedScope || null, fileName: figma.root.name });
        return;
      }

      case 'set-scope': {
        currentScope = msg.scope;
        invalidateCache();
        figma.clientStorage.setAsync(SCOPE_STORAGE_KEY, msg.scope);
        return;
      }

      case 'scan': {
        currentScope = msg.query.scope;
        if (msg.query.scope === 'current-selection' && figma.currentPage.selection.length === 0) {
          figma.notify('No selection found', { timeout: 500 });
        }
        const job = startJob();
        await runScan(msg.query, msg.requestId, job, post);
        return;
      }

      case 'execute': {
        currentScope = msg.query.scope;
        const job = startJob();
        await handleExecute(msg, job, post);
        return;
      }

      case 'identify':
        await handleIdentify(msg.key, currentScope, post);
        return;

      case 'load-selection':
        await handleLoadSelection(currentScope, post);
        return;

      case 'reveal':
        await handleReveal(msg.id);
        return;

      case 'cancel':
        cancelActive();
        return;

      case 'resize':
        figma.ui.resize(
          UI_WIDTH,
          Math.max(UI_MIN_HEIGHT, Math.min(msg.height, UI_MAX_HEIGHT)),
        );
        return;
    }
  } catch (error) {
    // A superseded scan is the normal path when the user keeps typing — not an error.
    if (error instanceof CancelledError) return;
    console.error(error);
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
