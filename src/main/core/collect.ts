import type { ObjectScope } from '../../shared/types';
import { Job, Slice } from '../utils/async';
import { getNestedLevel, type NodeCtx } from '../utils/node';

/**
 * Depth-first, pre-order traversal — the same order `findAll()` returns, so the
 * results list (and therefore `{id}` in rename templates) is unchanged.
 *
 * Unlike `findAll()` this is:
 *   • incremental — it yields to the event loop every slice, so UI messages that
 *     arrive mid-walk (a keystroke in a filter, a scope change) are delivered and
 *     can cancel the job;
 *   • allocation-light — nodes are handed to a callback instead of accumulating
 *     one giant array per page;
 *   • context-aware — page name and nesting depth fall out of the walk, so no
 *     property test ever has to climb `node.parent` again.
 */

export interface VisitStats {
  scanned: number;
  pageIndex: number;
  pageCount: number;
}

export type Visitor = (node: SceneNode, ctx: NodeCtx) => void | Promise<void>;

interface Root {
  pageName: string;
  pageId: string;
  page: PageNode | null;
  nodes: readonly SceneNode[];
  baseDepth: number;
}

async function rootsForScope(scope: ObjectScope, job: Job, slice: Slice): Promise<Root[]> {
  if (scope === 'current-selection') {
    const selection = figma.currentPage.selection;
    return selection.map((node: SceneNode) => ({
      pageName: figma.currentPage.name,
      pageId: figma.currentPage.id,
      page: figma.currentPage,
      nodes: [node],
      baseDepth: getNestedLevel(node),
    }));
  }

  if (scope === 'all-pages') {
    const pages = figma.root.children.filter((child: BaseNode) => child.type === 'PAGE') as PageNode[];
    const roots: Root[] = [];
    for (const page of pages) {
      job.throwIfCancelled();
      // Load pages one at a time rather than `loadAllPagesAsync()` up front: the
      // first page's results reach the UI while the rest are still loading, and a
      // cancelled scan never pays for pages it will not read.
      await page.loadAsync();
      await slice.yield();
      roots.push({
        pageName: page.name,
        pageId: page.id,
        page,
        nodes: page.children,
        baseDepth: 0,
      });
    }
    return roots;
  }

  return [
    {
      pageName: figma.currentPage.name,
      pageId: figma.currentPage.id,
      page: figma.currentPage,
      nodes: figma.currentPage.children,
      baseDepth: 0,
    },
  ];
}

function distinctPageCount(roots: Root[]): number {
  const ids: string[] = [];
  for (const root of roots) if (ids.indexOf(root.pageId) === -1) ids.push(root.pageId);
  return ids.length || 1;
}

/** Number of pages in scope — known before the walk so progress can be shown. */
export function pageCountForScope(scope: ObjectScope): number {
  if (scope === 'all-pages') {
    return figma.root.children.filter((child: BaseNode) => child.type === 'PAGE').length;
  }
  return 1;
}

export async function traverse(
  scope: ObjectScope,
  job: Job,
  visit: Visitor,
  onSlice?: (stats: VisitStats) => void,
): Promise<number> {
  const slice = new Slice(job);
  const roots = await rootsForScope(scope, job, slice);
  const pageIds: string[] = [];
  const pageCount = distinctPageCount(roots);
  let scanned = 0;

  const stack: { node: SceneNode; depth: number }[] = [];

  for (const root of roots) {
    job.throwIfCancelled();
    if (pageIds.indexOf(root.pageId) === -1) pageIds.push(root.pageId);
    const pageIndex = pageIds.length;

    stack.length = 0;
    for (let i = root.nodes.length - 1; i >= 0; i--) {
      stack.push({ node: root.nodes[i], depth: root.baseDepth });
    }

    // One context object per root, mutated as we descend. Visitors must read it
    // synchronously and never retain it.
    const ctx: NodeCtx = {
      pageName: root.pageName,
      pageId: root.pageId,
      page: root.page,
      depth: root.baseDepth,
      scope,
    };

    while (stack.length > 0) {
      const entry = stack.pop() as { node: SceneNode; depth: number };
      const node = entry.node;

      ctx.depth = entry.depth;
      const result = visit(node, ctx);
      if (result) await result;
      scanned++;

      const children = (node as any).children as SceneNode[] | undefined;
      if (children) {
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push({ node: children[i], depth: entry.depth + 1 });
        }
      }

      const yielded = await slice.tick();
      if (yielded && onSlice) onSlice({ scanned, pageIndex, pageCount });
    }
  }

  return scanned;
}
