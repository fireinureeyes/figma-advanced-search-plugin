import type { ActionType, ElementRow, SelectionSpec } from '../shared/types';

/**
 * Selection is stored as a mode plus exceptions rather than a set of ticked ids.
 * A 200k-row result set therefore costs one boolean, and "tick all" / "untick
 * all" are O(1) instead of O(n) DOM writes.
 */
export interface UiState {
  elements: ElementRow[];
  selectionMode: 'all' | 'none';
  exceptions: Set<string>;
  scanning: boolean;
  scanDone: boolean;
  executing: boolean;
  requestId: number;
  fileName: string;
  action: ActionType;
}

export const state: UiState = {
  elements: [],
  selectionMode: 'all',
  exceptions: new Set<string>(),
  scanning: false,
  scanDone: true,
  executing: false,
  requestId: 0,
  fileName: '',
  action: 'select',
};

export function isSelected(id: string): boolean {
  return state.selectionMode === 'all' ? !state.exceptions.has(id) : state.exceptions.has(id);
}

export function selectedCount(): number {
  return state.selectionMode === 'all'
    ? Math.max(0, state.elements.length - state.exceptions.size)
    : state.exceptions.size;
}

export function setSelected(id: string, selected: boolean): void {
  const isException = state.selectionMode === 'all' ? !selected : selected;
  if (isException) state.exceptions.add(id);
  else state.exceptions.delete(id);
}

export function setAllSelected(selected: boolean): void {
  state.selectionMode = selected ? 'all' : 'none';
  state.exceptions.clear();
}

/** Fresh results start fully ticked, matching v1. */
export function replaceResults(elements: ElementRow[]): void {
  state.elements = elements;
  setAllSelected(true);
}

export function appendResults(elements: ElementRow[]): void {
  for (const element of elements) state.elements.push(element);
}

export function selectionSpec(): SelectionSpec {
  const exceptions = Array.from(state.exceptions);
  return state.selectionMode === 'all'
    ? { mode: 'all', except: exceptions }
    : { mode: 'only', only: exceptions };
}

export function nextRequestId(): number {
  state.requestId += 1;
  return state.requestId;
}

export function isCurrentRequest(requestId: number): boolean {
  return requestId === state.requestId;
}
