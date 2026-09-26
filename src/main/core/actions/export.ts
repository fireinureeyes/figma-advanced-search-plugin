import JSZip from 'jszip';
import type { PluginMessage } from '../../../shared/messages';
import type { ExportOptions } from '../../../shared/types';
import { Slice } from '../../utils/async';
import type { ActionInput } from './basic';

const DEFAULT_SETTINGS: ExportSettings[] = [
  { format: 'PNG', constraint: { type: 'SCALE', value: 2 }, suffix: '' } as ExportSettings,
];

/**
 * v1 built this twice — once in the single-node branch and once in the zip
 * branch — and the two copies had to be edited in lockstep.
 */
function resolveSettings(node: SceneNode, options: ExportOptions): ExportSettings[] {
  const existing = (node as any).exportSettings as ExportSettings[] | undefined;
  let settings: any[] =
    existing && existing.length ? existing.map((setting) => ({ ...setting })) : DEFAULT_SETTINGS.map((s) => ({ ...s }));

  if (options.format !== 'default') {
    settings = settings.map((setting) => ({ ...setting, format: options.format }));
  }
  if (options.scale !== 'default') {
    settings = settings.map((setting) => ({
      ...setting,
      constraint: { type: 'SCALE', value: parseInt(options.scale, 10) },
    }));
  }
  if (options.suffix !== 'default') {
    settings = settings.map((setting) => ({ ...setting, suffix: options.suffix }));
  }
  return settings as ExportSettings[];
}

function fileNameFor(node: SceneNode, setting: any): string {
  return `${node.name}${setting.suffix || ''}.${String(setting.format).toLowerCase()}`;
}

export async function exportNodes(
  input: ActionInput,
  options: ExportOptions,
  post: (message: PluginMessage) => void,
): Promise<number> {
  const slice = new Slice(input.job);
  const targets = input.elements.filter((node) => input.isChosen(node) && !node.removed);

  if (targets.length === 0) return 0;

  // A single node downloads directly; several are zipped (v1 behaviour).
  if (targets.length === 1) {
    const node = targets[0];
    let count = 0;
    for (const setting of resolveSettings(node, options)) {
      try {
        const bytes = await node.exportAsync(setting as ExportSettingsImage);
        const base64 = figma.base64Encode(bytes);
        post({
          type: 'download',
          url: `data:image/${String((setting as any).format).toLowerCase()};base64,${base64}`,
          name: fileNameFor(node, setting),
        });
        count++;
      } catch (error) {
        console.error('Export failed for node:', node.name, error);
      }
      await slice.yield();
    }
    return count;
  }

  const zip = new JSZip();
  let exported = 0;

  for (const node of targets) {
    try {
      for (const setting of resolveSettings(node, options)) {
        const bytes = await node.exportAsync(setting as ExportSettingsImage);
        zip.file(fileNameFor(node, setting), bytes);
      }
      exported++;
    } catch (error) {
      console.error('Export failed for node:', node.name, error);
    }
    if (input.onProgress) input.onProgress(exported, targets.length);
    await slice.yield();
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  post({ type: 'download', url: `data:application/zip;base64,${base64}`, name: 'export.zip' });
  return exported;
}
