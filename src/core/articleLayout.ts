import type { MathSeg } from './mathExtract';

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CLOSING_PUNCTUATION = /^[，。、；：！？）］】》〉」』”’％…,.!?:;]{1,3}/;

/** Keep CJK spacing and punctuation outside the formula SVG/PNG so they inherit the article font. */
export function layoutInlineMath(root: DocumentFragment, segs: MathSeg[]) {
  if (!segs.length) return;
  for (const paragraph of root.querySelectorAll<HTMLElement>('p')) {
    if (!CJK.test(paragraph.textContent ?? '')) continue;
    if (!paragraph.style.lineBreak) paragraph.style.lineBreak = 'strict';
    if (!paragraph.style.getPropertyValue('text-wrap')) paragraph.style.setProperty('text-wrap', 'pretty');
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.includes('@@MATH') && !text.parentElement?.closest('pre,code,script,style,textarea')) textNodes.push(text);
  }

  for (const node of textNodes) {
    const text = node.data;
    let cursor = 0;
    const output = document.createDocumentFragment();
    for (const match of text.matchAll(/@@MATH(\d+)@@/g)) {
      if (segs[Number(match[1])]?.display !== false) continue;
      const start = match.index;
      const end = start + match[0].length;
      const left = start > 0 ? text.slice(Math.max(0, start - 2), start) : node.previousSibling?.textContent ?? '';
      const right = end < text.length ? text.slice(end) : node.nextSibling?.textContent ?? '';
      const punctuation = CLOSING_PUNCTUATION.exec(text.slice(end))?.[0] ?? '';
      const leftGap = CJK.test(Array.from(left.slice(-2)).pop() ?? '');
      const rightGap = CJK.test(String.fromCodePoint(right.codePointAt(0) ?? 0));
      if (!leftGap && !rightGap && !punctuation) continue;

      const formula = document.createElement('span');
      if (leftGap) formula.style.marginLeft = '0.18em';
      if (rightGap) formula.style.marginRight = '0.18em';
      if (punctuation) formula.style.whiteSpace = 'nowrap';
      formula.textContent = match[0] + punctuation;
      output.append(text.slice(cursor, start), formula);
      cursor = end + punctuation.length;
    }
    if (cursor) {
      output.append(text.slice(cursor));
      node.replaceWith(output);
    }
  }
}

const CARD_COLORS = new Map([
  ['definition', '#0e8070'], ['axiom', '#0e8070'],
  ['theorem', '#3f67c5'], ['lemma', '#157e9a'],
  ['proposition', '#aa641b'], ['corollary', '#b84768'],
  ['example', '#9b572d'], ['question', '#7653a7'],
  ['remark', '#667085'], ['note', '#667085'],
]);

export function styleTheoremCards(root: DocumentFragment) {
  for (const card of root.querySelectorAll<HTMLElement>('blockquote[data-latex-theorem]')) {
    const kind = card.dataset.latexTheorem ?? '';
    const color = CARD_COLORS.get(kind) ?? '#3f67c5';
    card.style.padding = '0.85em 1em';
    card.style.border = '1px solid ' + color + '66';
    card.style.borderLeftWidth = '4px';
    card.style.borderRadius = '8px';
    card.style.backgroundColor = color + '12';
    const heading = card.querySelector<HTMLElement>(':scope > p:first-child > strong:first-child');
    if (heading) {
      heading.style.color = '#fff';
      heading.style.backgroundColor = color;
      heading.style.borderRadius = '4px';
      heading.style.padding = '0.12em 0.45em';
    }
  }
}

export function highlightReferenceIssues(root: DocumentFragment) {
  for (const ref of root.querySelectorAll<HTMLElement>('[data-latex-ref-issue]')) {
    const duplicate = ref.dataset.latexRefIssue === 'duplicate';
    ref.style.backgroundColor = duplicate ? '#fff0cf' : '#ffe7ea';
    ref.style.color = duplicate ? '#754600' : '#9f253b';
    ref.style.borderBottom = '1px dashed currentColor';
    ref.style.borderRadius = '3px';
    ref.style.padding = '0 0.2em';
  }
}
