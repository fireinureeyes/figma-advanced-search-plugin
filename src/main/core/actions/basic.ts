import { resolveName, todayIso } from '../../../shared/rename';
import type { RenameOptions } from '../../../shared/types';
import { Job, Slice } from '../../utils/async';
import { getPageId, getPageName } from '../../utils/node';

/**
 * `elements` is the *full* match list and `isChosen` says which rows were ticked.
 * Both are needed because rename numbering ({id}, {alphabet}) is indexed against
 * the full list — same as v1, and same as the preview column in the UI.
 */
export interface ActionInput {
  elements: SceneNode[];
  isChosen: (node: SceneNode) => boolean;
  job: Job;
  onProgress?: (processed: number, total: number) => void;
}

/** Set by the select action so the plugin's own selection change is not treated as a user edit. */
let selectionChangedByPlugin = false;

export function consumePluginSelectionFlag(): boolean {
  const value = selectionChangedByPlugin;
  selectionChangedByPlugin = false;
  return value;
}

export function selectNodes(input: ActionInput, _scope: string): number {
  // Figma throws if the selection contains nodes from another page, so the
  // current-page filter is applied for every scope, not just "whole document".
  const target = input.elements.filter(
    (node) => input.isChosen(node) && !node.removed && getPageId(node) === figma.currentPage.id,
  );
  selectionChangedByPlugin = true;
  figma.currentPage.selection = target;
  return target.length;
}

export async function deleteNodes(input: ActionInput): Promise<number> {
  const slice = new Slice(input.job);
  let removed = 0;
  for (const node of input.elements) {
    if (input.isChosen(node) && !node.removed) {
      node.remove();
      removed++;
    }
    await slice.tick();
    if (input.onProgress) input.onProgress(removed, input.elements.length);
  }
  return removed;
}

export async function renameNodes(input: ActionInput, options: RenameOptions): Promise<number> {
  const slice = new Slice(input.job);
  const date = todayIso();
  let renamed = 0;

  for (let index = 0; index < input.elements.length; index++) {
    const node = input.elements[index];
    if (input.isChosen(node) && !node.removed) {
      node.name = resolveName(
        options.newName,
        options.replaceText,
        { index, name: node.name, pageName: getPageName(node) },
        date,
      );
      renamed++;
    }
    await slice.tick();
    if (input.onProgress) input.onProgress(renamed, input.elements.length);
  }
  return renamed;
}

export async function duplicateNodes(input: ActionInput): Promise<number> {
  const slice = new Slice(input.job);
  const duplicates: SceneNode[] = [];

  for (const node of input.elements) {
    if (input.isChosen(node) && !node.removed) {
      const clone = node.clone();
      figma.currentPage.appendChild(clone);
      duplicates.push(clone);
    }
    await slice.tick();
    if (input.onProgress) input.onProgress(duplicates.length, input.elements.length);
  }

  if (duplicates.length > 0) {
    selectionChangedByPlugin = true;
    figma.currentPage.selection = duplicates;
    figma.viewport.scrollAndZoomIntoView(duplicates);
  }
  return duplicates.length;
}
