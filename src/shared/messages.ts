import type {
  ActionType,
  ElementRow,
  ExportOptions,
  ObjectScope,
  Query,
  ReadValue,
  RenameOptions,
  SelectionSpec,
} from './types';
import type { PropertyKey } from './properties';

/** UI → sandbox. */
export type UiMessage =
  /** Sent once when the iframe is ready; asks for stored scope + file name. */
  | { type: 'ui-ready' }
  /** Run (or re-run) a scan. Supersedes any scan already in flight. */
  | { type: 'scan'; requestId: number; query: Query }
  /** Apply an action to the current result set. */
  | {
      type: 'execute';
      requestId: number;
      query: Query;
      action: ActionType;
      selection: SelectionSpec;
      rename: RenameOptions;
      exportOptions: ExportOptions;
    }
  /** Read one property off the single selected node (the ⌖ button). */
  | { type: 'identify'; key: PropertyKey }
  /** Read every property off the single selected node ("Load all from selection"). */
  | { type: 'load-selection' }
  /** Row click: jump to the node on canvas. */
  | { type: 'reveal'; id: string }
  | { type: 'set-scope'; scope: ObjectScope }
  | { type: 'resize'; height: number }
  | { type: 'cancel' };

/** Sandbox → UI. */
export type PluginMessage =
  | { type: 'ready'; scope: ObjectScope | null; fileName: string }
  | {
      type: 'scan-progress';
      requestId: number;
      scanned: number;
      matched: number;
      pageIndex: number;
      pageCount: number;
    }
  /**
   * A slice of the result set. `append: false` means "replace what you have".
   * Results are streamed so the table fills in while a large document is still
   * being walked.
   */
  | {
      type: 'scan-results';
      requestId: number;
      elements: ElementRow[];
      append: boolean;
      done: boolean;
      matched: number;
    }
  | { type: 'scan-cancelled'; requestId: number }
  | { type: 'identify-result'; key: PropertyKey; value: ReadValue }
  | { type: 'selection-props'; props: Partial<Record<PropertyKey, ReadValue>> }
  | { type: 'action-progress'; requestId: number; processed: number; total: number; action: ActionType }
  | { type: 'action-done'; requestId: number; action: ActionType; count: number }
  /** Canvas changed underneath us (page switch / selection change) — re-run the current query. */
  | { type: 'request-rescan' }
  | { type: 'download'; url: string; name: string }
  | { type: 'error'; message: string };
