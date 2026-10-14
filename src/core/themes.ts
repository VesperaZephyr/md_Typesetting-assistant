/**
 * 主题系统：每个主题 = 「选择器 → 内联 CSS」映射 + 代码高亮配色。
 * 全部落到 style 属性上，公众号编辑器只认内联样式。
 *
 * 既支持专家模式直接编辑 JSON/CSS，
 * 也支持直觉模式（通过可视化的色彩、字号、行距、标题版式、首行缩进等参数一键生成）。
 */

export interface Theme {
  name: string;
  /** 选择器 → CSS 声明串。支持任意合法 CSS 选择器；root 用于公众号外层容器。 */
  styles: Record<string, string>;
  /** highlight.js token → 颜色（用于 pre 代码块） */
  hljs: Record<string, string>;
  builtin?: boolean;
  /** 如果由可视化配置生成，保存其配置快照便于二次可视化调节 */
  visualConfig?: ThemeVisualConfig;
}

export type FontFamilyType = 'sans' | 'serif' | 'mono';
export type H2StyleType = 'border-left' | 'border-bottom' | 'pill' | 'center' | 'dash';
export type BlockquoteStyleType = 'bar' | 'card' | 'double-border';
export type CodeThemeType = 'one-dark' | 'github-light';

export interface ThemeVisualConfig {
  primaryColor: string;
  textColor: string;
  fontFamily: FontFamilyType;
  fontSize: number;          // 14 | 15 | 16
  lineHeight: number;        // 1.6 | 1.8 | 2.0
  indent: boolean;           // 首行缩进 2 字符
  h2Style: H2StyleType;
  quoteStyle: BlockquoteStyleType;
  codeTheme: CodeThemeType;
}

export const DEFAULT_THEME_NAME = '默认 · 蓝色优雅';

export function oneDark(): Record<string, string> {
  return {
    comment: '#5c6370', keyword: '#c678dd', string: '#98c379', number: '#d19a66',
    title: '#61afef', function: '#61afef', 'built_in': '#e6c07b', type: '#e6c07b',
    attr: '#d19a66', variable: '#e06c75', literal: '#d19a66', meta: '#61afef',
    tag: '#e06c75', name: '#e06c75', symbol: '#61afef', params: '#abb2bf',
    property: '#abb2bf', operator: '#56b6c2', punctuation: '#abb2bf',
    'selector-tag': '#e06c75', 'selector-class': '#d19a66', 'selector-id': '#61afef',
    section: '#61afef', bullet: '#d19a66', quote: '#5c6370', addition: '#98c379',
    deletion: '#e06c75', regexp: '#98c379', subst: '#e06c75', doctag: '#c678dd',
    'template-variable': '#e06c75', 'variable.language_': '#e06c75',
  };
}

export function githubLight(): Record<string, string> {
  return {
    comment: '#6e7781', keyword: '#cf222e', string: '#0a3069', number: '#0550ae',
    title: '#8250df', function: '#8250df', 'built_in': '#953800', type: '#953800',
    attr: '#116329', variable: '#953800', literal: '#0550ae', meta: '#0550ae',
    tag: '#116329', name: '#116329', symbol: '#0550ae', params: '#24292f',
    property: '#0550ae', operator: '#cf222e', punctuation: '#24292f',
    'selector-tag': '#116329', 'selector-class': '#0550ae', 'selector-id': '#8250df',
    section: '#0550ae', bullet: '#0550ae', quote: '#6e7781', addition: '#116329',
    deletion: '#82071e', regexp: '#0a3069', subst: '#24292f', doctag: '#cf222e',
    'template-variable': '#953800', 'variable.language_': '#953800',
  };
}

/** 辅助：十六进制颜色添加透明度转 rgba */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16);
    const g = parseInt(clean[1]! + clean[1]!, 16);
    const b = parseInt(clean[2]! + clean[2]!, 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

/**
 * 根据可视化参数一键构建完整主题
 */
export function buildThemeFromVisualConfig(name: string, config: ThemeVisualConfig): Theme {
  const p = config.primaryColor;
  const tc = config.textColor;
  const pLight = hexToRgba(p, 0.08);
  const pBorder = hexToRgba(p, 0.25);

  let fontCss = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  if (config.fontFamily === 'serif') {
    fontCss = 'Georgia, "Nimbus Roman No9 L", "Songti SC", SimSun, "Times New Roman", serif';
  } else if (config.fontFamily === 'mono') {
    fontCss = 'Consolas, "JetBrains Mono", Menlo, "Courier New", monospace';
  }

  // H2 样式构造
  let h2Css = `margin:1.8em 0 1em;font-size:${config.fontSize + 4}px;font-weight:bold;color:${tc};`;
  if (config.h2Style === 'border-left') {
    h2Css += `border-left:4px solid ${p};padding-left:10px;`;
  } else if (config.h2Style === 'border-bottom') {
    h2Css += `border-bottom:2px solid ${p};padding-bottom:6px;`;
  } else if (config.h2Style === 'pill') {
    h2Css += `background:${pLight};color:${p};padding:6px 14px;border-radius:20px;display:inline-block;`;
  } else if (config.h2Style === 'center') {
    h2Css += `text-align:center;letter-spacing:1px;`;
  } else if (config.h2Style === 'dash') {
    h2Css += `text-align:center;`;
  }

  // 引用块样式构造
  let bqCss = `margin:1.4em 0;padding:12px 16px;color:#555;`;
  if (config.quoteStyle === 'bar') {
    bqCss += `border-left:4px solid ${p};background:${pLight};border-radius:0 6px 6px 0;`;
  } else if (config.quoteStyle === 'card') {
    bqCss += `background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;`;
  } else if (config.quoteStyle === 'double-border') {
    bqCss += `border-left:3px double ${p};background:${pLight};`;
  }

  const isDarkCode = config.codeTheme === 'one-dark';

  const styles: Record<string, string> = {
    root: `font-size:${config.fontSize}px;color:${tc};line-height:${config.lineHeight};font-family:${fontCss};word-break:break-word;letter-spacing:0.4px;`,
    p: `margin:1.2em 0;line-height:${config.lineHeight};${config.indent ? 'text-indent:2em;' : ''}`,
    h1: `margin:1.8em 0 1em;font-size:${config.fontSize + 7}px;font-weight:bold;text-align:center;color:${tc};letter-spacing:0.5px;`,
    h2: h2Css,
    h3: `margin:1.4em 0 0.8em;font-size:${config.fontSize + 2}px;font-weight:bold;color:${p};`,
    h4: `margin:1.2em 0 0.6em;font-size:${config.fontSize}px;font-weight:bold;color:${tc};`,
    h5: `margin:1em 0 0.5em;font-size:${config.fontSize}px;font-weight:bold;color:#555;`,
    h6: `margin:1em 0 0.5em;font-size:${config.fontSize - 1}px;color:#777;`,
    strong: `color:${p};font-weight:bold;`,
    em: `font-style:italic;`,
    del: `text-decoration:line-through;color:#999;`,
    a: `color:${p};text-decoration:none;border-bottom:1px solid ${p};`,
    ul: `margin:1em 0;padding-left:1.5em;`,
    ol: `margin:1em 0;padding-left:1.7em;`,
    li: `margin:0.4em 0;line-height:${config.lineHeight};`,
    blockquote: bqCss,
    'blockquote p': `margin:0.4em 0;color:#555;${config.indent ? 'text-indent:0;' : ''}`,
    code: `background:${pLight};color:${p};padding:2px 6px;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:88%;`,
    pre: isDarkCode
      ? `background:#282c34;border-radius:6px;padding:14px 16px;overflow-x:auto;margin:1.4em 0;line-height:1.6;`
      : `background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:14px 16px;overflow-x:auto;margin:1.4em 0;line-height:1.6;`,
    'pre code': isDarkCode
      ? `background:transparent;color:#abb2bf;padding:0;border-radius:0;font-size:13px;font-family:Menlo,Consolas,monospace;`
      : `background:transparent;color:#24292f;padding:0;border-radius:0;font-size:13px;font-family:Menlo,Consolas,monospace;`,
    table: `border-collapse:collapse;width:100%;margin:1.2em 0;font-size:${config.fontSize - 1}px;`,
    th: `border:1px solid #dfe2e5;background:${pLight};padding:8px 12px;text-align:left;font-weight:bold;color:${tc};`,
    td: `border:1px solid #dfe2e5;padding:8px 12px;`,
    img: `max-width:100%;border-radius:6px;margin:0 auto;display:block;`,
    hr: `border:none;border-top:1px dashed ${pBorder};margin:2em 0;`,
    figcaption: `text-align:center;color:#888;font-size:12.5px;margin-top:0.5em;`,
    sup: `font-size:75%;`,
  };

  return {
    name,
    styles,
    hljs: isDarkCode ? oneDark() : githubLight(),
    visualConfig: config,
  };
}

/** 从主题反推或智能提取 VisualConfig，如果找不到则用缺省值 */
export function extractVisualConfig(theme: Theme): ThemeVisualConfig {
  if (theme.visualConfig) {
    return { ...theme.visualConfig };
  }
  const root = theme.styles['root'] || '';
  const h2 = theme.styles['h2'] || '';
  const strong = theme.styles['strong'] || '';
  const bq = theme.styles['blockquote'] || '';
  const p = theme.styles['p'] || '';

  // 提取主题色（优先 strong color，次之 a color，再次之 h2 border-left）
  const colorM = /color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.exec(strong)
    || /border-left:[^;]*?(#[0-9a-fA-F]{3,8})/.exec(h2)
    || /border-bottom:[^;]*?(#[0-9a-fA-F]{3,8})/.exec(h2);
  const primaryColor = colorM ? colorM[1]! : '#4a90d9';

  const textM = /color:\s*(#[0-9a-fA-F]{3,8})/.exec(root);
  const textColor = textM ? textM[1]! : '#3f3f3f';

  let fontFamily: FontFamilyType = 'sans';
  if (/serif|Songti|SimSun|Times/i.test(root)) fontFamily = 'serif';
  else if (/mono|Consolas|Courier/i.test(root)) fontFamily = 'mono';

  const sizeM = /font-size:\s*(\d+)px/.exec(root);
  const fontSize = sizeM ? parseInt(sizeM[1]!, 10) : 15;

  const lhM = /line-height:\s*([\d.]+)/.exec(root);
  const lineHeight = lhM ? parseFloat(lhM[1]!) : 1.9;

  const indent = /text-indent:\s*2em/.test(p);

  let h2Style: H2StyleType = 'border-left';
  if (/border-bottom/.test(h2)) h2Style = 'border-bottom';
  else if (/border-radius:\s*20px|border-radius:\s*1[5-9]px/.test(h2)) h2Style = 'pill';
  else if (/text-align:\s*center/.test(h2)) h2Style = 'center';

  let quoteStyle: BlockquoteStyleType = 'bar';
  if (/border-left:[^;]*double/.test(bq)) quoteStyle = 'double-border';
  else if (!/border-left/.test(bq) && /border:/.test(bq)) quoteStyle = 'card';

  const isLightCode = theme.styles['pre']?.includes('#f6f8fa');
  const codeTheme: CodeThemeType = isLightCode ? 'github-light' : 'one-dark';

  return {
    primaryColor: primaryColor.startsWith('#') ? primaryColor : '#4a90d9',
    textColor: textColor.startsWith('#') ? textColor : '#3f3f3f',
    fontFamily,
    fontSize: [14, 15, 16].includes(fontSize) ? fontSize : 15,
    lineHeight: lineHeight >= 1.95 ? 2.0 : (lineHeight <= 1.7 ? 1.6 : 1.8),
    indent,
    h2Style,
    quoteStyle,
    codeTheme,
  };
}

export const BUILTIN_THEMES: Theme[] = [
  buildThemeFromVisualConfig(DEFAULT_THEME_NAME, {
    primaryColor: '#4a90d9',
    textColor: '#3f3f3f',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('学术蓝 · 衬线', {
    primaryColor: '#1a3c6e',
    textColor: '#2c3e50',
    fontFamily: 'serif',
    fontSize: 15,
    lineHeight: 2.0,
    indent: true,
    h2Style: 'border-bottom',
    quoteStyle: 'double-border',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('极简黑白', {
    primaryColor: '#111111',
    textColor: '#222222',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'center',
    quoteStyle: 'card',
    codeTheme: 'github-light',
  }),
  buildThemeFromVisualConfig('中国红 · 典雅', {
    primaryColor: '#c0392b',
    textColor: '#2c2c2c',
    fontFamily: 'serif',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'border-bottom',
    quoteStyle: 'bar',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('暖橙杂志', {
    primaryColor: '#d35400',
    textColor: '#3d342d',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('青竹绿意', {
    primaryColor: '#2d6a4f',
    textColor: '#344038',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'pill',
    quoteStyle: 'bar',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('紫罗兰 · 知性', {
    primaryColor: '#7b2cbf',
    textColor: '#383344',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    codeTheme: 'one-dark',
  }),
  buildThemeFromVisualConfig('科技青 · 胶囊', {
    primaryColor: '#0077b6',
    textColor: '#2b2d42',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    indent: false,
    h2Style: 'pill',
    quoteStyle: 'card',
    codeTheme: 'one-dark',
  }),
].map((t) => ({ ...t, builtin: true }));

/** 把主题样式套到 DOM 片段上：逐选择器 querySelectorAll，后应用的选择器覆盖先应用的。 */
export function applyThemeStyles(frag: DocumentFragment | HTMLElement, theme: Theme): string[] {
  const warnings: string[] = [];
  for (const [selector, css] of Object.entries(theme.styles)) {
    if (selector === 'root') continue;
    if (!css.trim()) continue;
    let nodes: NodeListOf<Element>;
    try {
      nodes = frag.querySelectorAll(selector);
    } catch {
      warnings.push(`主题选择器无效：${selector}`);
      continue;
    }
    for (const el of Array.from(nodes)) {
      const prev = el.getAttribute('style') || '';
      el.setAttribute('style', (prev ? prev + ';' : '') + css);
    }
  }
  return warnings;
}

/** 校验主题 JSON 是否可用，返回错误信息或 null。 */
export function validateTheme(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return '主题必须是 JSON 对象';
  const t = json as Partial<Theme>;
  if (typeof t.name !== 'string' || !t.name.trim()) return '缺少 name 字段';
  if (typeof t.styles !== 'object' || t.styles === null) return '缺少 styles 字段';
  for (const [k, v] of Object.entries(t.styles)) {
    if (typeof v !== 'string') return `styles["${k}"] 应为字符串`;
  }
  if (t.hljs !== undefined && (typeof t.hljs !== 'object' || t.hljs === null)) return 'hljs 应为对象';
  return null;
}
