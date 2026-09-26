import type { PluginMessage } from '../../shared/messages';
import { PROPERTY_KEYS, type PropertyKey } from '../../shared/properties';
import type { ReadValue } from '../../shared/types';
import { REGISTRY } from '../core/registry';
import { contextFor, findPage } from '../utils/node';

type Post = (message: PluginMessage) => void;

/** Both ⌖ and "Load all from selection" need exactly one selected node. */
function requireSingleSelection(): SceneNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('No selection found', { timeout: 1000 });
    return null;
  }
  if (selection.length > 1) {
    figma.notify('Select 1 element only', { timeout: 1000 });
    return null;
  }
  return selection[0];
}

async function readProperty(
  key: PropertyKey,
  node: SceneNode,
  scope: string,
): Promise<ReadValue> {
  try {
    return await REGISTRY[key].read(node, contextFor(node, scope));
  } catch (error) {
    console.error('Could not read property', key, error);
    return 'N/A';
  }
}

export async function handleIdentify(key: PropertyKey, scope: string, post: Post): Promise<void> {
  const node = requireSingleSelection();
  if (!node) return;
  post({ type: 'identify-result', key, value: await readProperty(key, node, scope) });
}

/**
 * Reads every property in one pass and sends a single keyed object.
 *
 * v1 sent 45 hand-written `selectionXxx` fields; the UI then destructured them
 * one by one — and referenced one field (`selectionFillsRemote`) that was never
 * sent, which threw and silently truncated the generated filter list.
 */
export async function handleLoadSelection(scope: string, post: Post): Promise<void> {
  const node = requireSingleSelection();
  if (!node) return;

  const props: Partial<Record<PropertyKey, ReadValue>> = {};
  for (const key of PROPERTY_KEYS) {
    props[key] = await readProperty(key, node, scope);
  }
  post({ type: 'selection-props', props });
}

/** Row click: switch to the node's page, select it, zoom to it. */
export async function handleReveal(id: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.removed || !('parent' in node)) {
    figma.notify('That element no longer exists', { timeout: 1000 });
    return;
  }

  const page = findPage(node as BaseNode);
  if (page && page.id !== figma.currentPage.id) {
    await figma.setCurrentPageAsync(page);
  }

  const sceneNode = node as SceneNode;
  figma.currentPage.selection = [sceneNode];
  figma.viewport.scrollAndZoomIntoView([sceneNode]);
}
