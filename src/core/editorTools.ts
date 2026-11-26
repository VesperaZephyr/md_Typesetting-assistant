import type { InputFormat } from './pipeline';

export type TextFormat = 'bold' | 'italic' | 'underline' | 'strike' | 'quote';
export interface TextEdit {
  start: number;
  end: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const INLINE_WRAPPERS: Record<InputFormat, Record<Exclude<TextFormat, 'quote'>, [string, string]>> = {
  markdown: { bold: ['**', '**'], italic: ['*', '*'], underline: ['<u>', '</u>'], strike: ['~~', '~~'] },
  latex: { bold: ['\\textbf{', '}'], italic: ['\\emph{', '}'], underline: ['\\underline{', '}'], strike: ['\\sout{', '}'] },
};

export function formatSelection(source: string, start: number, end: number, kind: TextFormat, input: InputFormat): TextEdit {
  if (kind === 'quote') {
    const lineStart = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = source.indexOf('\n', end > start && source[end - 1] === '\n' ? end - 1 : end);
    start = lineStart;
    end = lineEnd === -1 ? source.length : lineEnd;
    const selected = source.slice(start, end);
    let text: string;
    if (input === 'latex') {
      text = '\\begin{quote}\n' + selected + '\n\\end{quote}';
      const bodyStart = start + '\\begin{quote}\n'.length;
      return { start, end, text, selectionStart: bodyStart, selectionEnd: bodyStart + selected.length };
    }
    const lines = selected.split('\n');
    const remove = lines.every((line) => /^> ?/.test(line));
    text = lines.map((line) => remove ? line.replace(/^> ?/, '') : '> ' + line).join('\n');
    return { start, end, text, selectionStart: start === end && !remove ? start + 2 : start, selectionEnd: start + text.length };
  }
  const [open, close] = INLINE_WRAPPERS[input][kind];
  const selected = source.slice(start, end);
  if (selected && source.slice(Math.max(0, start - open.length), start) === open && source.startsWith(close, end)) {
    return { start: start - open.length, end: end + close.length, text: selected,
      selectionStart: start - open.length, selectionEnd: end - open.length };
  }
  const selectionStart = start + open.length;
  return { start, end, text: open + selected + close, selectionStart, selectionEnd: selectionStart + selected.length };
}

export function insertFootnote(source: string, end: number, note: string, input: InputFormat): TextEdit {
  if (input === 'latex') {
    const text = '\\footnote{' + note.trim().replace(/[{}%]/g, (character) => '\\' + character) + '}';
    return { start: end, end, text, selectionStart: end + text.length, selectionEnd: end + text.length };
  }
  let id = 1;
  const used = new Set([...source.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1])));
  while (used.has(id)) id++;
  const reference = '[^' + id + ']';
  const following = source.slice(end);
  const text = reference + following + (source.endsWith('\n\n') ? '' : source.endsWith('\n') ? '\n' : '\n\n')
    + reference + ': ' + note.trim().replace(/\n/g, '\n    ') + '\n';
  return { start: end, end: source.length, text, selectionStart: end + reference.length, selectionEnd: end + reference.length };
}

export interface TextMatch { start: number; end: number }

function searchPattern(query: string, matchCase: boolean) {
  return new RegExp(query.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
}

export function findText(source: string, query: string, matchCase: boolean): TextMatch[] {
  if (!query) return [];
  return Array.from(source.matchAll(searchPattern(query, matchCase)), (match) => ({
    start: match.index, end: match.index + match[0].length,
  }));
}

export function replaceAllText(source: string, query: string, replacement: string, matchCase: boolean): string {
  return query ? source.replace(searchPattern(query, matchCase), () => replacement) : source;
}
