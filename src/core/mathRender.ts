/**
 * LaTeX → SVG / PNG 渲染（公众号用）。
 *
 * 用 MathJax v3 的 fontCache:'none'，让每个 <svg> 自包含全部字形路径，
 * 不依赖共享 <defs> —— 这是粘贴进公众号编辑器后公式不散架的关键。
 */
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { browserAdaptor } from 'mathjax-full/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

let texJax: InstanceType<typeof TeX> | null = null;
let svgJax: InstanceType<typeof SVG> | null = null;
let mjDoc: ReturnType<typeof mathjax.document> | null = null;

function initMathJax() {
  if (mjDoc) return;
  const adaptor = browserAdaptor();
  RegisterHTMLHandler(adaptor);
  texJax = new TeX({ packages: AllPackages });
  svgJax = new SVG({ fontCache: 'none' });
  mjDoc = mathjax.document('', { InputJax: texJax, OutputJax: svgJax });
}

export class MathRenderError extends Error {
  constructor(public tex: string, message: string) {
    super(message);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** 渲染单个公式为自包含 <svg> 字符串（MathJax 原生 ex 单位）。 */
export function renderTexToSvg(tex: string, display: boolean, mathPreamble = ''): string {
  initMathJax();
  const source = mathPreamble ? mathPreamble + '\n' + tex : tex;
  let node: HTMLElement | null = null;
  try {
    node = mjDoc!.convert(source, { display }) as HTMLElement | null;
  } catch (e) {
    throw new MathRenderError(tex, e instanceof Error ? e.message : String(e));
  }
  if (!node) throw new MathRenderError(tex, 'MathJax 未返回结果');
  const svg = node.querySelector('svg');
  if (!svg) {
    const errEl = node.querySelector('[data-mjx-error]');
    throw new MathRenderError(tex, errEl?.getAttribute('data-mjx-error') || '未知公式错误');
  }
  const out = svg.cloneNode(true) as SVGSVGElement;
  out.setAttribute('xmlns', SVG_NS);
  out.setAttribute('xmlns:xlink', XLINK_NS);
  // MathJax 内部的 data-* 冗余属性全部去掉，减小体积
  for (const el of Array.from(out.querySelectorAll('[data-c],[data-mjx-error]'))) {
    el.removeAttribute('data-c');
    el.removeAttribute('data-mjx-error');
  }
  return new XMLSerializer().serializeToString(out);
}

const EX_PX = 8; // MathJax 默认度量：1ex = 0.5em，16px 字号下 1ex = 8px

/** 把 ex 单位换成 px（数字 × EX_PX），用于 PNG 光栅化与兼容性兜底。 */
export function svgExToPx(svg: string): { svg: string; width: number; height: number; vAlign: number } {
  const num = (s: string | null) => {
    if (!s) return 0;
    const m = /(-?[\d.]+)ex/.exec(s);
    return m ? parseFloat(m[1]!) * EX_PX : parseFloat(s) || 0;
  };
  const div = document.createElement('div');
  div.innerHTML = svg;
  const el = div.querySelector('svg')!;
  const width = num(el.getAttribute('width'));
  const height = num(el.getAttribute('height'));
    const vAlign = num(el.style.verticalAlign || (el.getAttribute('style')?.match(/vertical-align:\s*(-?[\d.]+)ex/)?.[1] ?? null));
  el.setAttribute('width', String(width));
  el.setAttribute('height', String(height));
  el.setAttribute('style', `vertical-align:${vAlign}px`);
  return { svg: el.outerHTML, width, height, vAlign };
}

/** SVG → PNG base64（2 倍超采样，保证清晰度）。 */
export async function svgToPng(svg: string, scale = 2): Promise<{ dataUrl: string; width: number; height: number; vAlign: number }> {
  const { svg: pxSvg, width, height, vAlign } = svgExToPx(svg);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pxSvg);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG 光栅化失败'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height, vAlign };
}
