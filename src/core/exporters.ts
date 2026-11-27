/**
 * 平台导出器：把「已渲染 DOM 片段」整理成公众号 / 知乎编辑器能接受的 HTML。
 *
 * 公众号：只认内联样式 → 主题样式已在前一步落到 style 上，这里负责
 *   去掉 class/id/data-*、包一层 root <section>、把代码高亮 class 转成颜色。
 * 知乎：编辑器自带样式，富文本粘贴时塞太多内联样式反而坏事 → 输出干净的语义 HTML。
 */
import type { Theme } from './themes';

/** 把 <pre> 里 highlight.js 的 span class 转成内联颜色。 */
export function inlineHljsColors(frag: DocumentFragment | HTMLElement, theme: Theme) {
  for (const pre of Array.from(frag.querySelectorAll('pre'))) {
    const code = pre.querySelector('code');
    if (!code) continue;
    for (const span of Array.from(code.querySelectorAll('span'))) {
      const cls = (span.getAttribute('class') || '').trim();
      const key = cls.split(/\s+/).find((c) => c.startsWith('hljs-'));
      if (!key) continue;
      const color = theme.hljs[key.slice('hljs-'.length)];
      span.removeAttribute('class');
      if (color) span.setAttribute('style', `color:${color};`);
    }
  }
}

/** 清理样式相关属性，保留文内链接指向的锚点。 */
export function stripClasses(
  frag: DocumentFragment | HTMLElement,
  keep: { keepClass?: (el: Element, cls: string) => boolean; keepSourceLines?: boolean } = {},
) {
  const anchors = new Set(Array.from(frag.querySelectorAll('a[href^="#"]'), (link) => link.getAttribute('href')!.slice(1)));
  for (const el of Array.from(frag.querySelectorAll('*'))) {
    const cls = el.getAttribute('class');
    if (cls && keep.keepClass?.(el, cls)) {
      // 保留指定的类，其余 class 属性一并清理
    } else {
      el.removeAttribute('class');
    }
    if (!anchors.has(el.id)) el.removeAttribute('id');
    for (const name of Array.from(el.attributes)) {
      if (name.name === 'data-proof-end' || name.name === 'data-enumerate-label' || name.name === 'data-enumerate-native') continue;
      if (keep.keepSourceLines && name.name === 'data-source-lines') continue;
      if (name.name.startsWith('data-') || name.name.startsWith('aria-')) el.removeAttribute(name.name);
    }
  }
}

/** Keep reference wording in WeChat clipboard HTML even when the editor strips fragment links. */
export function wechatClipboardHtml(html: string): string {
  if (!html.includes('href="#latex-ref-')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const link of template.content.querySelectorAll('a[href^="#latex-ref-"]')) {
    const label = document.createElement('strong');
    label.style.fontWeight = '600';
    label.append(...Array.from(link.childNodes));
    link.replaceWith(label);
  }
  return template.innerHTML;
}

/** 删除所有 style 属性（知乎富文本模式下用）。 */
export function stripStyles(frag: DocumentFragment | HTMLElement) {
  for (const el of Array.from(frag.querySelectorAll('*'))) {
    el.removeAttribute('style');
  }
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/* 知乎公式标记                                                        */
/* ------------------------------------------------------------------ */

export type ZhihuMathMode = 'eeimg' | 'dollar';

/** 知乎的公式标记区分行内（1）和行间（2）。 */
export function zhihuEquationImg(tex: string, display: boolean): string {
  const src = 'https://www.zhihu.com/equation?tex=' + encodeURIComponent(tex);
  return `<img src="${src}" alt="${escapeAttr(tex)}" eeimg="${display ? 2 : 1}">`;
}

export function normalizeZhihuTex(tex: string): string {
  return tex.replace(/\\(?:[a-zA-Z]+|[^a-zA-Z])/g, (command) =>
    command === '\\coloneqq' ? ':=' : command);
}

export function diagramFilename(id: string): string {
  return 'tikzcd-' + (Number(id) + 1) + '.png';
}

/** 知乎以换行分隔引用段落，段尾的空节点会被粘贴成额外空行。 */
export function normalizeZhihuQuotes(root: DocumentFragment): void {
  const trimEnd = (element: Element) => {
    while (element.lastChild && (element.lastChild.nodeName === 'BR'
      || (element.lastChild.nodeType === Node.TEXT_NODE && !element.lastChild.textContent?.trim()))) {
      element.lastChild.remove();
    }
  };
  for (const quote of root.querySelectorAll('blockquote')) {
    trimEnd(quote);
    while (quote.lastChild instanceof HTMLParagraphElement) {
      const paragraph = quote.lastChild;
      trimEnd(paragraph);
      if (paragraph.hasChildNodes() || paragraph.id) break;
      paragraph.remove();
      trimEnd(quote);
    }

    const paragraphs = Array.from(quote.children);
    if (paragraphs.length === 0 || paragraphs.some((p) => !p.matches('p:not([id])') || p.querySelector('img[eeimg="2"]'))
      || Array.from(quote.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) continue;
    const content = document.createDocumentFragment();
    for (const p of paragraphs) {
      if (content.hasChildNodes()) content.append(document.createElement('br'), document.createElement('br'));
      content.append(...Array.from(p.childNodes));
    }
    quote.replaceChildren(content);
  }
}

/** 为知乎剪贴板保留插图位置，下载的 HTML 则保留嵌入的 PNG。 */
export function zhihuClipboardHtml(html: string): string {
  if (!html.includes('data-zhihu-diagram=')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const diagram of template.content.querySelectorAll('section[data-zhihu-diagram]')) {
    const placeholder = document.createElement('p');
    placeholder.textContent = '【交换图 ' + diagramFilename(diagram.getAttribute('data-zhihu-diagram')!) + '】';
    diagram.replaceWith(placeholder);
  }
  return template.innerHTML;
}

export function zhihuEquationText(tex: string, display: boolean): string {
  return display ? `$$${tex}$$` : `$${tex}$`;
}
