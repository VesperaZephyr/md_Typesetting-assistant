/**
 * 转换管线总调度：
 *   源文本 →（LaTeX 预处理）→ 数学提取 → Markdown 渲染 → 代码高亮内联
 *         → 主题样式落地 → 平台整理（公众号/知乎）→ 公式标记替换 → 导出 HTML
 */
import { md, renderMarkdownWithSourceLines } from './markdown';
import { layoutInlineMath, styleTheoremCards, highlightReferenceIssues, layoutProofEnds } from './articleLayout';
import { displayMathPlaceholders, extractMath, restoreMath, type MathSeg } from './mathExtract';
import { latexToMarkdown, expandZeroArgMacros, PROOF_END_MARKUP } from './latex';
import { renderTexToSvg, renderTexToPng, svgExToPx, svgToPng, MathRenderError } from './mathRender';
import { renderTikzDiagram } from './tikzRender';
import { applyThemeStyles, type Theme } from './themes';
import {
  escapeAttr, inlineHljsColors, stripClasses, stripStyles,
  zhihuEquationImg, zhihuEquationText, type ZhihuMathMode,
} from './exporters';

export type Platform = 'wechat' | 'zhihu';
export type InputFormat = 'markdown' | 'latex';
export type WechatMath = 'svg' | 'svg-px' | 'png';

export interface ConvertOptions {
  inputFormat: InputFormat;
  platform: Platform;
  theme: Theme;
  wechatMath: WechatMath;
  zhihuMath: ZhihuMathMode;
  /** 公众号：把外部链接转成文末「参考链接」（公众号正文不允许外链） */
  wechatLinkFootnotes?: boolean;
  /** 知乎：把正文里的 h1 降级为 h2（文章标题通常填在知乎标题栏） */
  zhihuDemoteH1?: boolean;
}

export interface ConvertResult {
  /** 最终粘贴用 HTML（随平台与公式模式变化） */
  exportHtml: string;
  /** 视觉预览 HTML：始终用当前主题 + SVG 公式，所见即所想 */
  previewHtml: string;
  /** 纯文本（知乎「粘贴 Markdown 文本」模式用，公式保留 $...$） */
  plainText: string;
  warnings: string[];
  stats: { chars: number; mathCount: number; diagramCount: number };
  diagramSvgs: Map<string, string>;
}

async function renderSegDiagram(seg: MathSeg, opts: ConvertOptions, preamble: string,
  warnings: string[], diagramCache: Map<string, string>, downloadable?: Map<string, string>): Promise<string> {
  try {
    if (seg.diagram === 'tikzpicture') throw new Error('普通 tikzpicture 暂不支持');
    const theme = document.createElement('span').style;
    if (opts.platform === 'wechat') theme.cssText = opts.theme.styles['root'] ?? '';
    const ink = theme.color || '#222222';
    const paper = theme.backgroundColor || '#ffffff';
    const key = JSON.stringify([ink, paper, seg.tex]);
    const svg = diagramCache.get(key) ?? renderTikzDiagram(seg.tex, preamble, ink, paper);
    diagramCache.set(key, svg);
    const diagramId = seg.placeholder.slice('@@MATH'.length, -2);
    downloadable?.set(diagramId, svg);
    let markup = svg;
    if (opts.platform === 'zhihu' || opts.wechatMath === 'png') {
      const png = await svgToPng(svg);
      markup = '<img alt="交换图" src="' + png.dataUrl + '" width="' + png.width + '" height="' + png.height
        + '" style="max-width:100%;height:auto;">';
    }
    const button = downloadable ? '<div><button type="button" data-save-diagram="' + diagramId
      + '">下载 PNG</button></div>' : '';
    return '<section style="text-align:center;margin:1.2em 0;overflow-x:auto;">' + markup + button + '</section>';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push('交换图未能渲染：' + message);
    return '<pre style="white-space:pre-wrap;"><code>' + escapeAttr(seg.raw) + '</code></pre>';
  }
}

function renderSegSvg(seg: MathSeg, preamble: string, unit: 'ex' | 'px' = 'ex'): string {
  try {
    let svg = renderTexToSvg(seg.tex, seg.display, preamble);
    if (unit === 'px') svg = svgExToPx(svg).svg;
    if (seg.display) {
      return `<section style="text-align:center;margin:1.2em 0;overflow-x:auto;">${svg}</section>`;
    }
    return svg;
  } catch (e) {
    if (e instanceof MathRenderError) throw e;
    throw new MathRenderError(seg.tex, e instanceof Error ? e.message : String(e));
  }
}

function renderSegPng(seg: MathSeg, preamble: string) {
  return (async () => {
    try {
      const png = await renderTexToPng(seg.tex, seg.display, preamble);
      const style = `vertical-align:${png.vAlign}px;width:${png.width}px;height:${png.height}px;max-width:100%;`;
      const img = `<img src="${png.dataUrl}" style="${style}" alt="公式">`;
      if (seg.display) {
        return `<section style="text-align:center;margin:1.2em 0;">${img}</section>`;
      }
      return img;
    } catch (e) {
      if (e instanceof MathRenderError) throw e;
      throw new MathRenderError(seg.tex, e instanceof Error ? e.message : String(e));
    }
  })();
}

function mathErrorFallback(seg: MathSeg, mode: 'wechat' | 'zhihu-text'): string {
  if (mode === 'zhihu-text') return zhihuEquationText(seg.tex, seg.display);
  return `<span style="color:#e05555;">[公式错误：${seg.tex.replace(/</g, '&lt;')}]</span>`;
}

/** 公众号：外部链接转文末「参考链接」；mp.weixin.qq.com 内部链接保持可点击。 */
function applyLinkFootnotes(root: DocumentFragment | HTMLElement, warnings: string[]): void {
  const anchors = Array.from(root.querySelectorAll('a[href]'));
  if (!anchors.length) return;
  const entries: Array<{ url: string; num: number }> = [];
  const seen = new Map<string, number>();
  for (const a of anchors) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#') || /^https?:\/\/mp\.weixin\.qq\.com\//i.test(href)) continue;
    let num = seen.get(href);
    if (!num) {
      num = entries.length + 1;
      seen.set(href, num);
      entries.push({ url: href, num });
    }
    const marker = document.createElement('span');
    marker.setAttribute('style', 'font-size:80%;color:#888888;');
    marker.textContent = `[${num}]`;
    a.replaceWith(...Array.from(a.childNodes), marker);
  }
  if (!entries.length) return;
  warnings.push(`已将 ${entries.length} 个外部链接转为文末参考链接（公众号正文不支持外链）。`);

  const sec = document.createElement('section');
  sec.setAttribute('style', 'margin-top:2.2em;padding-top:1em;border-top:1px solid #e5e7eb;font-size:13px;color:#666666;line-height:1.7;');
  const title = document.createElement('p');
  title.setAttribute('style', 'margin:0 0 0.5em;font-weight:bold;color:#333333;');
  title.textContent = '参考链接';
  sec.appendChild(title);
  for (const e of entries) {
    const p = document.createElement('p');
    p.setAttribute('style', 'margin:0.25em 0;word-break:break-all;');
    p.textContent = `[${e.num}] ${e.url}`;
    sec.appendChild(p);
  }
  root.appendChild(sec);
}

/** 知乎：正文 h1 降级为 h2（标题通常填在知乎单独的标题栏）。 */
function demoteH1ToH2(root: DocumentFragment | HTMLElement): void {
  for (const h1 of Array.from(root.querySelectorAll('h1'))) {
    const h2 = document.createElement('h2');
    for (const attr of Array.from(h1.attributes)) h2.setAttribute(attr.name, attr.value);
    h2.append(...Array.from(h1.childNodes));
    h1.replaceWith(h2);
  }
}

/** 提示本地相对路径图片（公众号/知乎无法读取） */
function warnLocalImages(html: string, warnings: string[]): void {
  const srcs = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m) => m[1]!);
  const local = [...new Set(srcs.filter((s) => !/^(https?:|data:|blob:)/i.test(s)))];
  if (local.length) {
    const sample = local.slice(0, 3).join('、');
    warnings.push(`检测到 ${local.length} 个本地路径图片（${sample}）：公众号/知乎无法读取，请先上传图床后替换。`);
  }
}

/** 把骨架里的占位符替换成平台公式标记 */
async function substitute(
  skeletonHtml: string,
  segs: MathSeg[],
  opts: ConvertOptions,
  preamble: string,
  warnings: string[],
  diagramCache: Map<string, string>,
  downloadable?: Map<string, string>,
): Promise<string> {
  const cache = new Map<string, string>();
  const renderOne = async (seg: MathSeg): Promise<string> => {
    if (seg.diagram) return renderSegDiagram(seg, opts, preamble, warnings, diagramCache, downloadable);
    const mode = opts.platform === 'wechat' ? 'svg:' + opts.wechatMath : 'zhihu:' + opts.zhihuMath;
    const key = mode + '|' + (mode.startsWith('svg') ? preamble : '') + '|' + seg.tex + '|' + seg.display;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let markup: string;
    try {
      if (opts.platform === 'wechat') {
        markup = opts.wechatMath === 'svg'
          ? renderSegSvg(seg, preamble)
          : opts.wechatMath === 'svg-px'
            ? renderSegSvg(seg, preamble, 'px')
            : await renderSegPng(seg, preamble);
      } else if (opts.zhihuMath === 'eeimg') {
        markup = zhihuEquationImg(seg.tex, seg.display);
      } else {
        markup = zhihuEquationText(seg.tex, seg.display);
      }
    } catch (e) {
      const msg = e instanceof MathRenderError ? `${e.message}（${seg.tex.slice(0, 40)}…）` : String(e);
      warnings.push(`公式渲染失败: ${msg}`);
      markup = mathErrorFallback(seg, opts.platform === 'wechat' ? 'wechat' : 'zhihu-text');
    }
    cache.set(key, markup);
    return markup;
  };
  // 先异步预渲染所有占位符，再做同步替换（replace 回调不能是 async）
  const rendered = new Map<string, string>();
  for (let i = 0; i < segs.length; i++) {
    rendered.set('@@MATH' + i + '@@', await renderOne(segs[i]!));
  }

  // 行间公式独占段落时，把整个 <p> 一起替换为块级标记。
  // 否则会产出非法的 <p><section>…</section></p>，公众号解析时可能多出空行。
  const blockMath = opts.platform === 'wechat' || (opts.platform === 'zhihu' && opts.zhihuMath === 'eeimg');
  let html = skeletonHtml;
  if (blockMath || segs.some((seg) => seg.diagram)) {
    html = html.replace(/<p(?:\s[^>]*)?>\s*@@MATH(\d+)@@\s*<\/p>/g, (m0, idx: string) => {
      const seg = segs[Number(idx)];
      const markup = rendered.get('@@MATH' + idx + '@@');
      if (!seg?.display || !markup || (!blockMath && !seg.diagram)) return m0;
      const sourceLines = /^<p[^>]* (data-source-lines="\d+:\d+")/.exec(m0)?.[1];
      return sourceLines ? markup.replace(/^<section\b/, '<section ' + sourceLines) : markup;
    });
  }
  html = html.replace(/@@MATH(\d+)@@/g, (m0, idx) => rendered.get('@@MATH' + idx + '@@') ?? m0);
  return layoutProofEnds(html, opts.platform === 'wechat');
}

/**
 * 主入口。
 */
export async function convert(source: string, opts: ConvertOptions): Promise<ConvertResult> {
  const warnings: string[] = [];
  let skeleton = source;
  let segs: MathSeg[] = [];
  let preamble = '';
  let mathMacros: ReturnType<typeof latexToMarkdown>['macros'] = [];

  if (opts.inputFormat === 'latex') {
    const r = latexToMarkdown(source);
    skeleton = r.markdown;
    segs = r.segs;
    preamble = r.preamble;
    mathMacros = r.macros;
    warnings.push(...r.warnings);
  } else {
    const r = extractMath(source);
    skeleton = r.text;
    segs = r.segs;
  }

  const baseHtml = opts.inputFormat === 'markdown' ? renderMarkdownWithSourceLines(skeleton, segs)
    : md.render(skeleton, { displayMathPlaceholders: displayMathPlaceholders(segs) });
  const diagramCount = segs.filter((seg) => seg.diagram).length;
  const diagramCache = new Map<string, string>();
  const diagramSvgs = new Map<string, string>();
  warnLocalImages(baseHtml, warnings);

  /* ---- 视觉预览：主题 + SVG 公式，与平台无关 ---- */
  const previewTpl = document.createElement('template');
  previewTpl.innerHTML = baseHtml;
  inlineHljsColors(previewTpl.content, opts.theme);
  const themeWarnings = applyThemeStyles(previewTpl.content, opts.theme);
  warnings.push(...themeWarnings);
  layoutInlineMath(previewTpl.content, segs);
  styleTheoremCards(previewTpl.content);
  highlightReferenceIssues(previewTpl.content);
  stripClasses(previewTpl.content, { keepSourceLines: true });
  if (opts.platform === 'wechat' && opts.wechatLinkFootnotes) {
    applyLinkFootnotes(previewTpl.content, warnings);
  }
  const previewWrap = document.createElement('section');
  previewWrap.setAttribute('style', opts.theme.styles['root'] || '');
  previewWrap.append(...Array.from(previewTpl.content.childNodes));
  const previewSkeletonHtml = previewWrap.outerHTML;
  let previewHtml: string;
  try {
    previewHtml = await substitute(previewSkeletonHtml, segs, { ...opts, platform: 'wechat', wechatMath: 'svg' }, preamble, warnings, diagramCache, diagramSvgs);
  } catch {
    previewHtml = previewSkeletonHtml;
  }

  /* ---- 导出 HTML：随平台变化 ---- */
  let exportHtml: string;
  if (opts.platform === 'wechat') {
    const tpl = document.createElement('template');
    tpl.innerHTML = baseHtml;
    inlineHljsColors(tpl.content, opts.theme);
    applyThemeStyles(tpl.content, opts.theme);
    layoutInlineMath(tpl.content, segs);
    styleTheoremCards(tpl.content);
    stripClasses(tpl.content);
    if (opts.wechatLinkFootnotes) {
      applyLinkFootnotes(tpl.content, warnings);
    }
    const wrap = document.createElement('section');
    wrap.setAttribute('style', opts.theme.styles['root'] || '');
    wrap.append(...Array.from(tpl.content.childNodes));
    exportHtml = await substitute(wrap.outerHTML, segs, opts, preamble, warnings, diagramCache);
  } else {
    const tpl = document.createElement('template');
    tpl.innerHTML = baseHtml;
    // 知乎自带排版，只保留语义结构与公式标记
    stripStyles(tpl.content);
    stripClasses(tpl.content, {
      keepClass: (el, cls) => cls === 'content_image' && el.tagName === 'IMG',
    });
    if (opts.zhihuDemoteH1) demoteH1ToH2(tpl.content);
    // 知乎公式不经过 MathJax，宏需要文本展开
    const expandedSegs = segs.map((seg) => {
      if (!mathMacros.length || seg.diagram) return seg;
      const { tex, usedArgMacros } = expandZeroArgMacros(seg.tex, mathMacros);
      if (usedArgMacros.length) {
        warnings.push(`宏 ${[...new Set(usedArgMacros)].join(' ')} 带参数，知乎公式模式不支持，请手动展开`);
      }
      return { ...seg, tex };
    });
    exportHtml = await substitute(tpl.innerHTML, expandedSegs, opts, preamble, warnings, diagramCache);
    if (segs.some((seg) => seg.diagram === 'tikzcd')) {
      warnings.push('知乎富文本中的 TikZ-CD 图使用嵌入 PNG。若粘贴时图片被过滤，请在目标编辑器上传交换图图片。');
    }
  }

  /* ---- 纯文本（知乎 Markdown 直贴模式） ---- */
  const plainText = restoreMath(skeleton.split(PROOF_END_MARKUP).join('∎'), segs, (seg) =>
    seg.diagram ? seg.raw : seg.display ? '$$' + seg.tex + '$$' : '$' + seg.tex + '$'
  );

  return {
    exportHtml,
    previewHtml,
    plainText,
    warnings: [...new Set(warnings)],
    stats: { chars: source.length, mathCount: segs.length - diagramCount, diagramCount },
    diagramSvgs,
  };
}
