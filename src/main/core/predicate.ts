import { isPropertyKey, type PropertyKey } from '../../shared/properties';
import type { ElementType, FilterCondition, Query } from '../../shared/types';
import type { NodeCtx } from '../utils/node';
import { REGISTRY } from './registry';

const BOOLEAN_OPS: ElementType[] = ['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE'];

export function matchesElementType(node: SceneNode, elementType: ElementType): boolean {
  if (elementType === 'ANY') return true;
  if (BOOLEAN_OPS.indexOf(elementType) !== -1) {
    return (
      node.type === 'BOOLEAN_OPERATION' &&
      (node as any).booleanOperation === elementType
    );
  }
  return node.type === elementType;
}

export interface Predicate {
  /** True when at least one condition needs an await (currently only `fills-remote`). */
  readonly isAsync: boolean;
  test(node: SceneNode, ctx: NodeCtx): boolean | Promise<boolean>;
}

interface CompiledCondition {
  key: PropertyKey | null;
  comparison: string;
  value: string;
  logic: 'AND' | 'OR';
}

/**
 * Conditions are folded strictly left to right with no operator precedence —
 * `A and B or C` is `(A and B) or C`. This is v1 behaviour and users' saved
 * mental models depend on it, so it is preserved exactly.
 *
 * The only change is short-circuiting: once the accumulator can no longer be
 * changed by the current operator, the condition is not evaluated. Conditions
 * are pure, so this is unobservable — but on a 200k-node document it saves a lot
 * of property reads.
 */
export function buildPredicate(query: Query): Predicate {
  const conditions: CompiledCondition[] = (query.filters || []).map(
    (filter: FilterCondition, index: number) => ({
      key: isPropertyKey(filter.key) ? filter.key : null,
      comparison: filter.comparison,
      value: filter.value == null ? '' : String(filter.value),
      logic: index === 0 ? 'AND' : filter.logic === 'OR' ? 'OR' : 'AND',
    }),
  );

  const elementType = query.elementType;
  const isAsync = conditions.some((c) => c.key !== null && REGISTRY[c.key].async === true);

  if (conditions.length === 0) {
    return {
      isAsync: false,
      test: (node) => matchesElementType(node, elementType),
    };
  }

  const evaluate = (
    node: SceneNode,
    ctx: NodeCtx,
    condition: CompiledCondition,
  ): boolean | Promise<boolean> => {
    if (condition.key === null) return false; // unknown key never matches (v1 default branch)
    return REGISTRY[condition.key].test(node, ctx, condition.value, condition.comparison);
  };

  if (!isAsync) {
    return {
      isAsync: false,
      test: (node, ctx) => {
        if (!matchesElementType(node, elementType)) return false;
        let acc = false;
        for (let i = 0; i < conditions.length; i++) {
          const condition = conditions[i];
          if (i > 0) {
            if (condition.logic === 'AND' && acc === false) continue;
            if (condition.logic === 'OR' && acc === true) continue;
          }
          const met = evaluate(node, ctx, condition) as boolean;
          acc = i === 0 ? met : condition.logic === 'AND' ? acc && met : acc || met;
        }
        return acc;
      },
    };
  }

  return {
    isAsync: true,
    test: async (node, ctx) => {
      if (!matchesElementType(node, elementType)) return false;
      let acc = false;
      for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        if (i > 0) {
          if (condition.logic === 'AND' && acc === false) continue;
          if (condition.logic === 'OR' && acc === true) continue;
        }
        const met = await evaluate(node, ctx, condition);
        acc = i === 0 ? met : condition.logic === 'AND' ? acc && met : acc || met;
      }
      return acc;
    },
  };
}

/** Stable key for cache lookups ("is this the same query as last time?"). */
export function queryKey(query: Query): string {
  const filters = (query.filters || [])
    .map((f) => [f.logic || '', f.key, f.comparison, f.value].join('\u0001'))
    .join('\u0002');
  return [query.scope, query.elementType, filters].join('\u0003');
}
