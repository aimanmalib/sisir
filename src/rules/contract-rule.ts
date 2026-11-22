import { fileBindings, isNode, walk, type Node } from './ast.js';
import type { Rule, RuleContext } from './types.js';

/** What a rule sees for one contract: its functions with bodies and the file-level bindings. */
export interface ContractScope {
  contract: Node;
  /** Functions and modifiers that have a body, in source order. */
  functions: Node[];
  file: ReadonlyMap<string, Node>;
  report: RuleContext['report'];
}

/** Builds a rule that inspects one contract at a time, for checks that follow calls between its functions. */
export function contractRule(id: string, inspect: (scope: ContractScope) => void): Rule {
  return {
    id,
    create(context) {
      let file = new Map<string, Node>();
      return {
        SourceUnit(node) {
          file = fileBindings(node as Node);
        },
        ContractDefinition(node) {
          const contract = node as Node;
          const functions = (contract.subNodes as Node[]).filter(
            (n) => (n.type === 'FunctionDefinition' || n.type === 'ModifierDefinition') && isNode(n.body),
          );
          inspect({ contract, functions, file, report: context.report });
        },
      };
    },
  };
}

/** The function in this contract that a call names directly, as in helper(a, b), matched by argument count. */
export function localCallee(call: Node, scope: ContractScope): Node | undefined {
  if (call.type !== 'FunctionCall') return undefined;
  const callee = call.expression as Node;
  if (callee.type !== 'Identifier') return undefined;
  const count = (call.arguments as Node[]).length;
  return scope.functions.find(
    (fn) => fn.type === 'FunctionDefinition' && fn.name === callee.name && (fn.parameters as Node[]).length === count,
  );
}

/** Functions that satisfy direct, or that call (directly or through other functions here) one that does. */
export function reaching(scope: ContractScope, direct: (fn: Node) => boolean): Set<Node> {
  const out = new Set(scope.functions.filter(direct));
  let grew = true;
  while (grew) {
    grew = false;
    for (const fn of scope.functions) {
      if (out.has(fn)) continue;
      let hit = false;
      walk(fn.body as Node, (node) => {
        const target = localCallee(node, scope);
        if (target && out.has(target)) hit = true;
      });
      if (hit) {
        out.add(fn);
        grew = true;
      }
    }
  }
  return out;
}

/** Names of the contract's state variables. */
export function stateNames(contract: Node): Set<string> {
  const out = new Set<string>();
  for (const n of contract.subNodes as Node[]) {
    if (n.type === 'StateVariableDeclaration') for (const v of n.variables as Node[]) out.add(v.name as string);
  }
  return out;
}

/** The variable an lvalue writes: nonce, nonces[user] and s.nonce all write their base name. */
export function baseName(expr: Node | undefined): string | undefined {
  if (!expr) return undefined;
  if (expr.type === 'Identifier') return expr.name as string;
  if (expr.type === 'IndexAccess') return baseName(expr.base as Node);
  if (expr.type === 'MemberAccess') return baseName(expr.expression as Node);
  return undefined;
}
