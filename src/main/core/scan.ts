import type { PluginMessage } from '../../shared/messages';
import type { ElementRow, Query } from '../../shared/types';
import { CancelledError, Job, Throttle } from '../utils/async';
import { clearStyleCache } from '../utils/node';
import { pageCountForScope, traverse } from './collect';
import { buildPredicate, queryKey } from './predicate';

/** Matches are flushed to the UI in batches of this size … */
const BATCH_SIZE = 400;
/** … or at least this often, whichever comes first. */
const BATCH_MS = 200;
const PROGRESS_MS = 120;

export interface ScanResult {
  matched: SceneNode[];
  scanned: number;
}

let activeJob: Job | null = null;

/** Cancels whatever is running and returns a fresh job. */
export function startJob(): Job {
  if (activeJob) activeJob.cancel();
  activeJob = new Job();
  clearStyleCache();
  return activeJob;
}

export function cancelActive(): void {
  if (activeJob) activeJob.cancel();
  activeJob = null;
}

export function isActive(job: Job): boolean {
  return activeJob === job && !job.isCancelled;
}

/**
 * Last completed scan, kept so that pressing Execute right after a scan does not
 * re-walk the document. Nodes that were deleted in between are filtered out at
 * use time via `node.removed`.
 */
let cache: { key: string; nodes: SceneNode[] } | null = null;

export function cachedMatches(query: Query): SceneNode[] | null {
  if (!cache || cache.key !== queryKey(query)) return null;
  return cache.nodes.filter((node) => !node.removed);
}

export function invalidateCache(): void {
  cache = null;
}

function toRow(node: SceneNode, pageName: string): ElementRow {
  return { id: node.id, name: node.name, pageName };
}

/**
 * Walks the scope, streams matches to the UI as they are found, and resolves
 * with the full match list.
 *
 * `post` is injected so this module stays testable without the figma global.
 */
export async function runScan(
  query: Query,
  requestId: number,
  job: Job,
  post: (message: PluginMessage) => void,
): Promise<ScanResult> {
  const predicate = buildPredicate(query);
  const matched: SceneNode[] = [];

  let pending: ElementRow[] = [];
  let firstFlush = true;
  let scannedTotal = 0;
  const knownPageCount = pageCountForScope(query.scope);

  const batchClock = new Throttle(BATCH_MS);
  const progressClock = new Throttle(PROGRESS_MS);

  const flush = (done: boolean) => {
    if (pending.length === 0 && !done && !firstFlush) return;
    post({
      type: 'scan-results',
      requestId,
      elements: pending,
      append: !firstFlush,
      done,
      matched: matched.length,
    });
    firstFlush = false;
    pending = [];
  };

  try {
    scannedTotal = await traverse(
      query.scope,
      job,
      async (node, ctx) => {
        const verdict = predicate.isAsync
          ? await (predicate.test(node, ctx) as Promise<boolean>)
          : (predicate.test(node, ctx) as boolean);
        if (!verdict) return;
        matched.push(node);
        pending.push(toRow(node, ctx.pageName));
        if (pending.length >= BATCH_SIZE) flush(false);
      },
      (stats) => {
        if (pending.length > 0 && batchClock.ready()) flush(false);
        if (progressClock.ready()) {
          post({
            type: 'scan-progress',
            requestId,
            scanned: stats.scanned,
            matched: matched.length,
            pageIndex: stats.pageIndex,
            pageCount: stats.pageCount || knownPageCount,
          });
        }
      },
    );

    flush(true);
    cache = { key: queryKey(query), nodes: matched.slice() };
    return { matched, scanned: scannedTotal };
  } catch (error) {
    if (error instanceof CancelledError) {
      post({ type: 'scan-cancelled', requestId });
    }
    throw error;
  }
}

/**
 * Match list for an action. Reuses the cached scan when the query is unchanged
 * (the common case: the user just looked at the results and hit Execute), and
 * falls back to a full walk otherwise.
 */
export async function resolveMatches(
  query: Query,
  requestId: number,
  job: Job,
  post: (message: PluginMessage) => void,
): Promise<SceneNode[]> {
  const cached = cachedMatches(query);
  if (cached) return cached;
  const result = await runScan(query, requestId, job, post);
  return result.matched;
}
