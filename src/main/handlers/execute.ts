import type { PluginMessage, UiMessage } from '../../shared/messages';
import { Throttle } from '../utils/async';
import type { Job } from '../utils/async';
import {
  deleteNodes,
  duplicateNodes,
  renameNodes,
  selectNodes,
  type ActionInput,
} from '../core/actions/basic';
import { exportNodes } from '../core/actions/export';
import { selectionFilter } from '../core/actions/selection';
import { invalidateCache, resolveMatches } from '../core/scan';

type Post = (message: PluginMessage) => void;
type ExecuteMessage = Extract<UiMessage, { type: 'execute' }>;

export async function handleExecute(msg: ExecuteMessage, job: Job, post: Post): Promise<void> {
  const elements = await resolveMatches(msg.query, msg.requestId, job, post);
  job.throwIfCancelled();

  const progress = new Throttle(150);
  const input: ActionInput = {
    elements,
    isChosen: selectionFilter(msg.selection),
    job,
    onProgress: (processed, total) => {
      if (!progress.ready()) return;
      post({ type: 'action-progress', requestId: msg.requestId, processed, total, action: msg.action });
    },
  };

  let count = 0;

  switch (msg.action) {
    case 'select':
      count = selectNodes(input, msg.query.scope);
      break;
    case 'delete':
      count = await deleteNodes(input);
      invalidateCache();
      break;
    case 'rename':
      count = await renameNodes(input, msg.rename);
      invalidateCache();
      break;
    case 'duplicate':
      count = await duplicateNodes(input);
      invalidateCache();
      break;
    case 'export':
      count = await exportNodes(input, msg.exportOptions, post);
      break;
  }

  post({ type: 'action-done', requestId: msg.requestId, action: msg.action, count });

  // Delete and rename change what the results list should show.
  if (msg.action === 'delete' || msg.action === 'rename') {
    post({ type: 'request-rescan' });
  }
}
