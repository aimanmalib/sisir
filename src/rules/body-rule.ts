import { bodyBindings, fileBindings, isBodyOwner, parents, type Node } from './ast.js';
import type { Rule, RuleContext } from './types.js';

/** What a rule sees for one function or modifier body. */
export interface BodyScope {
  body: Node;
  bindings: ReadonlyMap<string, Node>;
  parentOf: ReadonlyMap<Node, Node>;
  report: RuleContext['report'];
}

/** Builds a rule that inspects each function and modifier body with resolved bindings and parent links. */
export function bodyRule(id: string, inspect: (scope: BodyScope) => void): Rule {
  return {
    id,
    create(context) {
      let file = new Map<string, Node>();
      const onBody = (owner: Node): void => {
        if (!isBodyOwner(owner)) return;
        const body = owner.body as Node;
        inspect({ body, bindings: bodyBindings(body, file), parentOf: parents(body), report: context.report });
      };
      return {
        SourceUnit(node) {
          file = fileBindings(node as Node);
        },
        FunctionDefinition: (node) => onBody(node as Node),
        ModifierDefinition: (node) => onBody(node as Node),
      };
    },
  };
}
