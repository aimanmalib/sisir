/** Token kinds the source sheet colours. Everything else is plain text. */
export type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'type' | 'number' | 'address';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set(
  (
    'pragma solidity import contract interface library abstract is function modifier event error struct enum mapping ' +
    'returns return if else for while do break continue emit revert require assert new delete using constant immutable ' +
    'public private internal external pure view payable virtual override memory storage calldata indexed unchecked ' +
    'constructor receive fallback try catch true false this'
  ).split(' '),
);
const TYPE = /^(?:address|bool|string|bytes\d{0,2}|u?int\d{0,3}|u?fixed[\dx]*)$/;
// One pass of alternatives, longest constructs first. Group order matches the kinds below.
const LEXER = /(\/\/.*$)|(\/\*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(0x[0-9a-fA-F]{40}\b)|(\b(?:0x[0-9a-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e\d+)?)\b)|([A-Za-z_$][\w$]*)/g;

function push(out: Token[], kind: TokenKind, text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ kind, text });
}

/** Splits a source into lines of tokens. Block comments may span lines. */
export function highlight(source: string): Token[][] {
  const lines: Token[][] = [];
  let inBlock = false;
  const raw = source.split(/\r?\n/);
  // A final newline ends the last line; it does not start a new one.
  if (raw.length > 1 && raw[raw.length - 1] === '') raw.pop();
  for (const line of raw) {
    const out: Token[] = [];
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        const stop = end === -1 ? line.length : end + 2;
        push(out, 'comment', line.slice(i, stop));
        i = stop;
        inBlock = end === -1;
        continue;
      }
      LEXER.lastIndex = i;
      const m = LEXER.exec(line);
      if (!m) {
        push(out, 'plain', line.slice(i));
        break;
      }
      push(out, 'plain', line.slice(i, m.index));
      const [text, comment, blockStart, str, address, num, word] = m;
      if (comment) push(out, 'comment', text);
      else if (blockStart) {
        inBlock = true;
        i = m.index;
        continue;
      } else if (str) push(out, 'string', text);
      else if (address) push(out, 'address', text);
      else if (num) push(out, 'number', text);
      else if (word) push(out, KEYWORDS.has(word) ? 'keyword' : TYPE.test(word) ? 'type' : 'plain', text);
      i = m.index + text.length;
    }
    lines.push(out);
  }
  return lines;
}
