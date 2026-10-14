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

/** 删除所有 class / id / data-* 属性（公众号会整个剥掉，留着只是垃圾）。 */
export function stripClasses(
  frag: DocumentFragment | HTMLElement,
  keep: { keepClass?: (el: Element, cls: string) => boolean } = {},
) {
  for (const el of Array.from(frag.querySelectorAll('*'))) {
    const cls = el.getAttribute('class');
    if (cls && keep.keepClass?.(el, cls)) {
      // 保留指定的类，其余 class 属性一并清理
    } else {
      el.removeAttribute('class');
    }
    el.removeAttribute('id');
    for (const name of Array.from(el.attributes)) {
      if (name.name.startsWith('data-') || name.name.startsWith('aria-')) el.removeAttribute(name.name);
    }
  }
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

/** 知乎公式服务：tex URL 编码后作为图片请求，粘贴进编辑器即是渲染好的公式。 */
export function zhihuEquationImg(tex: string, display: boolean): string {
  const src = 'https://www.zhihu.com/equation?tex=' + encodeURIComponent(tex);
  const cls = display ? ' class="content_image"' : '';
  return `<img src="${src}" alt="${escapeAttr(tex)}" eeimg="1"${cls}>`;
}

export function zhihuEquationText(tex: string, display: boolean): string {
  return display ? `$$${tex}$$` : `$${tex}$`;
}
