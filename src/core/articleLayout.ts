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

function lastProofBlock(block: Element | null): Element | null {
  while (block && /^(OL|UL|LI|BLOCKQUOTE|DIV)$/.test(block.tagName)) {
    const child = block.lastElementChild;
    if (!child) break;
    if (block.tagName === 'LI' && (!/^(P|OL|UL|SECTION|DIV|BLOCKQUOTE)$/.test(child.tagName)
      || child.nextSibling?.textContent?.trim())) break;
    block = child;
  }
  return block;
}

function keepProofEndTogether(marker: HTMLElement) {
  const group = document.createElement('span');
  group.style.whiteSpace = 'nowrap';
  let previous = marker.previousSibling;
  while (previous && (previous.nodeType === Node.TEXT_NODE && !previous.textContent?.trim()
    || previous instanceof HTMLBRElement)) {
    const sibling = previous.previousSibling;
    previous.parentNode?.removeChild(previous);
    previous = sibling;
  }
  marker.before(group);
  if (previous instanceof Text) {
    previous.data = previous.data.trimEnd();
    const tail = /(?:\p{Script=Han}{1,3}|[\p{L}\p{N}]{1,16}|[^\s])\p{P}{0,4}$/u.exec(previous.data);
    if (tail) group.append(previous.splitText(tail.index));
  } else if (previous instanceof Element && /^(SPAN|EM|STRONG|S|U|CODE|A|IMG|SVG)$/i.test(previous.tagName)
    && ((previous.textContent?.length ?? 0) <= 32 || previous.matches('svg,img'))) {
    group.append(previous);
  }
  group.append('\u2060\u00a0', marker);
}

function placeSymbolBesideDisplay(graphic: Element, marker: HTMLElement) {
  const table = document.createElement('table');
  table.setAttribute('role', 'presentation');
  table.style.cssText = 'width:100%;margin:0;border:0;border-collapse:collapse;table-layout:fixed;';
  const row = table.insertRow();
  const left = row.insertCell();
  const center = row.insertCell();
  const right = row.insertCell();
  left.style.cssText = 'width:1.5em;border:0;padding:0;';
  center.style.cssText = 'border:0;padding:0;text-align:center;';
  right.style.cssText = 'width:1.5em;border:0;padding:0;text-align:right;vertical-align:bottom;';
  right.setAttribute('align', 'right');
  right.setAttribute('valign', 'bottom');
  graphic.replaceWith(table);
  center.append(graphic);
  right.append(marker);
}

/** Keep an inline symbol attached to the last text or give a display formula a shared row. */
export function layoutProofEnds(html: string, besideDisplay: boolean): string {
  if (!html.includes('data-proof-end')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const marker of template.content.querySelectorAll<HTMLElement>('span[data-proof-end]')) {
    marker.removeAttribute('data-proof-end');
    const paragraph = marker.parentElement;
    const separate = paragraph?.tagName === 'P' && Array.from(paragraph.childNodes).every(
      (node) => node === marker || (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()));
    if (!separate) {
      keepProofEndTogether(marker);
      continue;
    }
    const previous = lastProofBlock(paragraph.previousElementSibling) as HTMLElement | null;
    if (previous && /^(P|LI)$/.test(previous.tagName)) {
      previous.append(marker);
      paragraph.remove();
      keepProofEndTogether(marker);
    } else if (besideDisplay && previous?.tagName === 'SECTION') {
      const graphic = previous.querySelector(':scope > svg, :scope > img');
      if (graphic) {
        placeSymbolBesideDisplay(graphic, marker);
        paragraph.remove();
      } else {
        paragraph.style.textAlign = 'right';
      }
    } else if (besideDisplay) {
      paragraph.style.textAlign = 'right';
    }
  }
  return template.innerHTML;
}

/** The HTML on the clipboard carries visible labels independently of editor CSS or list counters. */
export function layoutEnumerations(html: string, browserPreview: boolean): string {
  if (!html.includes('data-enumerate-label')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  const lists = Array.from(template.content.querySelectorAll<HTMLOListElement>('ol')).reverse();
  for (const list of lists) {
    const items = Array.from(list.querySelectorAll<HTMLLIElement>(':scope > li'));
    const labels = items.map((item) => item.querySelector<HTMLElement>(
      ':scope > span[data-enumerate-label], :scope > p:first-child > span[data-enumerate-label]'));
    if (!labels.length || labels.some((label) => !label)) continue;
    const first = Number(labels[0]?.dataset.enumerateNative);
    const explicit = labels.some((label) => !label?.dataset.enumerateNative) || (!browserPreview && first !== 1);
    if (!explicit) {
      if (first !== 1) list.start = first;
      for (const label of labels) label?.remove();
      continue;
    }
    for (const label of labels) {
      const value = label!.dataset.enumerateLabel ?? '';
      label!.removeAttribute('data-enumerate-label');
      label!.removeAttribute('data-enumerate-native');
      if (value) {
        label!.textContent = value;
        label!.style.whiteSpace = 'nowrap';
        label!.after(' ');
      } else label!.remove();
    }
    if (browserPreview) {
      list.style.listStyleType = 'none';
      continue;
    }
    const section = document.createElement('section');
    section.setAttribute('role', 'list');
    section.style.cssText = list.style.cssText;
    for (const item of items) {
      const row = document.createElement('section');
      row.setAttribute('role', 'listitem');
      row.style.cssText = item.style.cssText;
      row.append(...Array.from(item.childNodes));
      section.append(row);
    }
    list.replaceWith(section);
  }
  for (const marker of template.content.querySelectorAll<HTMLElement>('[data-enumerate-label]')) {
    // If additional authored HTML prevents list recognition, keep the label as plain text.
    marker.replaceWith(marker.dataset.enumerateLabel ?? '');
  }
  return template.innerHTML;
}
