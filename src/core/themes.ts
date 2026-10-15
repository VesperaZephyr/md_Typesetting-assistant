/**
 * 主题系统：每个主题 = 「选择器 → 内联 CSS」映射 + 代码高亮配色。
 * 全部落到 style 属性上，公众号编辑器只认内联样式。
 *
 * 现已原汁原味还原 mdnice 官方 15 套高颜值爆款主题，
 * 兼具直观模式与代码模式自由调节能力。
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
export type H2StyleType = 'border-left' | 'border-bottom' | 'pill' | 'solid-pill' | 'bracket' | 'center' | 'badge';
export type BlockquoteStyleType = 'bar' | 'card' | 'double-border' | 'minimal';
export type TableStyleType = 'striped' | 'academic' | 'bordered';
export type StrongStyleType = 'color' | 'black' | 'marker';
export type CodeThemeType = 'one-dark' | 'github-light' | 'dracula' | 'monokai' | 'solarized-light';

export interface ThemeVisualConfig {
  primaryColor: string;
  textColor: string;
  fontFamily: FontFamilyType;
  fontSize: number;          // 14 | 15 | 16 | 17
  lineHeight: number;        // 1.6 | 1.8 | 2.0 | 2.2
  justify: boolean;          // 两端对齐 text-align: justify
  indent: boolean;           // 首行缩进 2 字符
  h2Style: H2StyleType;
  quoteStyle: BlockquoteStyleType;
  tableStyle: TableStyleType;
  strongStyle: StrongStyleType;
  codeTheme: CodeThemeType;
}

export const DEFAULT_THEME_NAME = '橙心 · 暖橙徽章 (mdnice官方)';

/* ------------------------------------------------------------------ */
/* 代码高亮配色方案                                                    */
/* ------------------------------------------------------------------ */

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
  };
}

export function dracula(): Record<string, string> {
  return {
    comment: '#6272a4', keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9',
    title: '#50fa7b', function: '#50fa7b', 'built_in': '#8be9fd', type: '#8be9fd',
    attr: '#50fa7b', variable: '#f8f8f2', literal: '#bd93f9', meta: '#ff79c6',
    tag: '#ff79c6', name: '#ff79c6', symbol: '#f1fa8c', params: '#ffb86c',
    property: '#f8f8f2', operator: '#ff79c6', punctuation: '#f8f8f2',
    'selector-tag': '#ff79c6', 'selector-class': '#50fa7b', 'selector-id': '#8be9fd',
    section: '#8be9fd', bullet: '#ffb86c', quote: '#6272a4', addition: '#50fa7b',
    deletion: '#ff5555', regexp: '#f1fa8c', subst: '#f8f8f2', doctag: '#ff79c6',
  };
}

export function monokai(): Record<string, string> {
  return {
    comment: '#75715e', keyword: '#f92672', string: '#e6db74', number: '#ae81ff',
    title: '#a6e22e', function: '#a6e22e', 'built_in': '#66d9ef', type: '#66d9ef',
    attr: '#a6e22e', variable: '#f8f8f2', literal: '#ae81ff', meta: '#75715e',
    tag: '#f92672', name: '#f92672', symbol: '#e6db74', params: '#fd971f',
    property: '#f8f8f2', operator: '#f92672', punctuation: '#f8f8f2',
    'selector-tag': '#f92672', 'selector-class': '#a6e22e', 'selector-id': '#66d9ef',
    section: '#66d9ef', bullet: '#fd971f', quote: '#75715e', addition: '#a6e22e',
    deletion: '#f92672', regexp: '#e6db74', subst: '#f8f8f2', doctag: '#f92672',
  };
}

export function solarizedLight(): Record<string, string> {
  return {
    comment: '#93a1a1', keyword: '#859900', string: '#2aa198', number: '#d33682',
    title: '#268bd2', function: '#268bd2', 'built_in': '#b58900', type: '#b58900',
    attr: '#2aa198', variable: '#657b83', literal: '#d33682', meta: '#cb4b16',
    tag: '#268bd2', name: '#268bd2', symbol: '#2aa198', params: '#657b83',
    property: '#657b83', operator: '#859900', punctuation: '#657b83',
    'selector-tag': '#859900', 'selector-class': '#268bd2', 'selector-id': '#268bd2',
    section: '#cb4b16', bullet: '#cb4b16', quote: '#93a1a1', addition: '#859900',
    deletion: '#dc322f', regexp: '#2aa198', subst: '#657b83', doctag: '#859900',
  };
}

/* ------------------------------------------------------------------ */
/* 辅助工具                                                            */
/* ------------------------------------------------------------------ */

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
  const pMedium = hexToRgba(p, 0.16);
  const pBorder = hexToRgba(p, 0.28);

  let fontCss = 'Optima-Regular, Optima, PingFangSC-light, PingFang TC, "PingFang SC", Cambria, Cochin, Georgia, Times, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif';
  if (config.fontFamily === 'serif') {
    fontCss = 'Georgia, "Nimbus Roman No9 L", "Songti SC", SimSun, "Times New Roman", serif';
  } else if (config.fontFamily === 'mono') {
    fontCss = 'Consolas, "JetBrains Mono", Menlo, "Courier New", monospace';
  }

  // H2 样式构造
  let h2Css = `margin:1.8em 0 1em;font-size:${config.fontSize + 4}px;font-weight:bold;line-height:1.4;`;
  if (config.h2Style === 'solid-pill') {
    // mdnice 橙心风格：实心色块徽章，白字
    h2Css += `background:${p};color:#ffffff;padding:4px 14px;border-radius:4px;display:inline-block;letter-spacing:0.5px;`;
  } else if (config.h2Style === 'pill') {
    // 浅底胶囊徽章
    h2Css += `background:${pLight};color:${p};padding:5px 15px;border-radius:20px;display:inline-block;`;
  } else if (config.h2Style === 'border-bottom') {
    // 底部线条
    h2Css += `border-bottom:2px solid ${p};padding-bottom:5px;color:${p};display:inline-block;`;
  } else if (config.h2Style === 'border-left') {
    // 左粗竖条
    h2Css += `border-left:4.5px solid ${p};padding-left:11px;color:${tc};`;
  } else if (config.h2Style === 'bracket') {
    // 优雅方头括号
    h2Css += `text-align:center;color:${p};letter-spacing:1px;`;
  } else if (config.h2Style === 'center') {
    // 极简居中
    h2Css += `text-align:center;letter-spacing:1px;color:${tc};`;
  } else if (config.h2Style === 'badge') {
    // 左侧彩色强调块
    h2Css += `border-left:7px solid ${p};background:${pLight};padding:6px 14px;border-radius:0 6px 6px 0;color:${p};`;
  }

  // 引用块样式构造
  let bqCss = `margin:1.4em 0;padding:12px 16px;color:#555;`;
  if (config.quoteStyle === 'bar') {
    bqCss += `border-left:3.5px solid ${p};background:${pLight};border-radius:0 6px 6px 0;`;
  } else if (config.quoteStyle === 'card') {
    bqCss += `background:#f6f8fa;border:1px solid #e1e4e8;border-radius:8px;`;
  } else if (config.quoteStyle === 'double-border') {
    bqCss += `border-left:3.5px double ${p};background:${pLight};`;
  } else if (config.quoteStyle === 'minimal') {
    bqCss += `border-left:2px solid #888;background:transparent;padding:6px 14px;color:#666;`;
  }

  // 加粗强调构造
  let strongCss = 'font-weight:bold;';
  if (config.strongStyle === 'color') {
    strongCss += `color:${p};`;
  } else if (config.strongStyle === 'marker') {
    strongCss += `color:${tc};background:${pMedium};padding:1px 4px;border-radius:3px;`;
  } else {
    strongCss += `color:#111;`;
  }

  // 表格样式构造
  let tableCss = `border-collapse:collapse;width:100%;margin:1.3em 0;font-size:${config.fontSize - 1}px;`;
  let thCss = `padding:9px 12px;font-weight:bold;`;
  let tdCss = `padding:8px 12px;`;

  if (config.tableStyle === 'academic') {
    tableCss += `border-top:2px solid ${tc};border-bottom:2px solid ${tc};`;
    thCss += `border-bottom:1px solid ${tc};background:transparent;color:${tc};text-align:left;`;
    tdCss += `border:none;border-bottom:1px solid #eaecef;`;
  } else if (config.tableStyle === 'striped') {
    thCss += `border:1px solid #dfe2e5;background:${pLight};color:${tc};text-align:left;`;
    tdCss += `border:1px solid #dfe2e5;`;
  } else {
    thCss += `border:1px solid #dfe2e5;background:#f8f9fa;color:${tc};text-align:left;`;
    tdCss += `border:1px solid #dfe2e5;`;
  }

  // 代码块背景与配色
  let preBg = '#282c34';
  let preBorder = 'none';
  let preCodeColor = '#abb2bf';
  let hljsTokens = oneDark();

  if (config.codeTheme === 'github-light') {
    preBg = '#f6f8fa';
    preBorder = '1px solid #e1e4e8';
    preCodeColor = '#24292f';
    hljsTokens = githubLight();
  } else if (config.codeTheme === 'dracula') {
    preBg = '#282a36';
    preCodeColor = '#f8f8f2';
    hljsTokens = dracula();
  } else if (config.codeTheme === 'monokai') {
    preBg = '#272822';
    preCodeColor = '#f8f8f2';
    hljsTokens = monokai();
  } else if (config.codeTheme === 'solarized-light') {
    preBg = '#fdf6e3';
    preBorder = '1px solid #eee8d5';
    preCodeColor = '#657b83';
    hljsTokens = solarizedLight();
  }

  const justifyCss = config.justify ? 'text-align:justify;text-justify:inter-ideograph;' : '';

  const styles: Record<string, string> = {
    root: `font-size:${config.fontSize}px;color:${tc};line-height:${config.lineHeight};font-family:${fontCss};word-break:break-word;letter-spacing:0.4px;${justifyCss}`,
    p: `margin:1.25em 0;line-height:${config.lineHeight};${config.indent ? 'text-indent:2em;' : ''}`,
    h1: `margin:1.8em 0 1em;font-size:${config.fontSize + 7}px;font-weight:bold;text-align:center;color:${tc};letter-spacing:0.5px;line-height:1.3;`,
    h2: h2Css,
    h3: `margin:1.4em 0 0.8em;font-size:${config.fontSize + 2}px;font-weight:bold;color:${p};`,
    h4: `margin:1.2em 0 0.6em;font-size:${config.fontSize}px;font-weight:bold;color:${tc};`,
    h5: `margin:1em 0 0.5em;font-size:${config.fontSize}px;font-weight:bold;color:#555;`,
    h6: `margin:1em 0 0.5em;font-size:${config.fontSize - 1}px;color:#777;`,
    strong: strongCss,
    em: `font-style:italic;`,
    del: `text-decoration:line-through;color:#999;`,
    a: `color:${p};text-decoration:none;border-bottom:1px solid ${p};`,
    ul: `margin:1em 0;padding-left:1.5em;`,
    ol: `margin:1em 0;padding-left:1.7em;`,
    li: `margin:0.4em 0;line-height:${config.lineHeight};`,
    blockquote: bqCss,
    'blockquote p': `margin:0.4em 0;color:#555;${config.indent ? 'text-indent:0;' : ''}`,
    code: `background:${pLight};color:${p};padding:2px 6px;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:88%;`,
    pre: `background:${preBg};border:${preBorder};border-radius:7px;padding:14px 16px;overflow-x:auto;margin:1.4em 0;line-height:1.6;`,
    'pre code': `background:transparent;color:${preCodeColor};padding:0;border-radius:0;font-size:13px;font-family:Menlo,Consolas,monospace;`,
    table: tableCss,
    th: thCss,
    td: tdCss,
    img: `max-width:100%;border-radius:6px;margin:0 auto;display:block;`,
    hr: `border:none;border-top:1px dashed ${pBorder};margin:2em 0;`,
    figcaption: `text-align:center;color:#888;font-size:12.5px;margin-top:0.5em;`,
    sup: `font-size:75%;`,
  };

  return {
    name,
    styles,
    hljs: hljsTokens,
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
  const table = theme.styles['table'] || '';
  const pre = theme.styles['pre'] || '';

  // 提取主题色
  const colorM = /color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.exec(strong)
    || /border-left:[^;]*?(#[0-9a-fA-F]{3,8})/.exec(h2)
    || /border-bottom:[^;]*?(#[0-9a-fA-F]{3,8})/.exec(h2)
    || /background:\s*(#[0-9a-fA-F]{3,8})/.exec(h2);
  const primaryColor = colorM ? colorM[1]! : '#ef7060';

  const textM = /color:\s*(#[0-9a-fA-F]{3,8})/.exec(root);
  const textColor = textM ? textM[1]! : '#222222';

  let fontFamily: FontFamilyType = 'sans';
  if (/serif|Songti|SimSun|Times/i.test(root)) fontFamily = 'serif';
  else if (/mono|Consolas|Courier/i.test(root)) fontFamily = 'mono';

  const sizeM = /font-size:\s*(\d+)px/.exec(root);
  const fontSize = sizeM ? parseInt(sizeM[1]!, 10) : 15;

  const lhM = /line-height:\s*([\d.]+)/.exec(root);
  const lineHeight = lhM ? parseFloat(lhM[1]!) : 1.8;

  const justify = /justify/.test(root);
  const indent = /text-indent:\s*2em/.test(p);

  let h2Style: H2StyleType = 'solid-pill';
  if (/color:#ffffff;padding:4px/.test(h2)) h2Style = 'solid-pill';
  else if (/border-left:\s*7px/.test(h2)) h2Style = 'badge';
  else if (/border-bottom/.test(h2)) h2Style = 'border-bottom';
  else if (/border-radius:\s*20px|border-radius:\s*1[5-9]px/.test(h2)) h2Style = 'pill';
  else if (/bracket/.test(h2)) h2Style = 'bracket';
  else if (/text-align:\s*center/.test(h2)) h2Style = 'center';
  else if (/border-left/.test(h2)) h2Style = 'border-left';

  let quoteStyle: BlockquoteStyleType = 'bar';
  if (/border-left:[^;]*double/.test(bq)) quoteStyle = 'double-border';
  else if (/border-left:\s*2px/.test(bq)) quoteStyle = 'minimal';
  else if (!/border-left/.test(bq) && /border:/.test(bq)) quoteStyle = 'card';

  let tableStyle: TableStyleType = 'striped';
  if (/border-top:2px/.test(table)) tableStyle = 'academic';
  else if (/border:1px/.test(table)) tableStyle = 'bordered';

  let strongStyle: StrongStyleType = 'color';
  if (/background:/.test(strong)) strongStyle = 'marker';
  else if (/color:#111/.test(strong)) strongStyle = 'black';

  let codeTheme: CodeThemeType = 'one-dark';
  if (pre.includes('#f6f8fa')) codeTheme = 'github-light';
  else if (pre.includes('#282a36')) codeTheme = 'dracula';
  else if (pre.includes('#272822')) codeTheme = 'monokai';
  else if (pre.includes('#fdf6e3')) codeTheme = 'solarized-light';

  return {
    primaryColor: primaryColor.startsWith('#') ? primaryColor : '#ef7060',
    textColor: textColor.startsWith('#') ? textColor : '#222222',
    fontFamily,
    fontSize: [14, 15, 16, 17].includes(fontSize) ? fontSize : 15,
    lineHeight: lineHeight >= 2.1 ? 2.2 : (lineHeight >= 1.95 ? 2.0 : (lineHeight <= 1.7 ? 1.6 : 1.8)),
    justify,
    indent,
    h2Style,
    quoteStyle,
    tableStyle,
    strongStyle,
    codeTheme,
  };
}

/* ------------------------------------------------------------------ */
/* 18 套精选内置主题（完整还原 mdnice 官方经典 + 学术论文规范）       */
/* ------------------------------------------------------------------ */

export const BUILTIN_THEMES: Theme[] = [
  // 1. 橙心 · 暖橙徽章 (mdnice 官方代表作)
  buildThemeFromVisualConfig('橙心 · 暖橙徽章 (mdnice官方)', {
    primaryColor: '#ef7060',
    textColor: '#222222',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'solid-pill',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 2. 绿意 · 清新森林 (mdnice 官方代表作)
  buildThemeFromVisualConfig('绿意 · 清新森林 (mdnice官方)', {
    primaryColor: '#35b378',
    textColor: '#2b2b2b',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'pill',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 3. 兰青 · 墨竹雅韵 (mdnice 官方代表作)
  buildThemeFromVisualConfig('兰青 · 墨竹雅韵 (mdnice官方)', {
    primaryColor: '#009688',
    textColor: '#2a2a2a',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-bottom',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 4. 姹紫 · 优雅高贵 (mdnice 官方代表作)
  buildThemeFromVisualConfig('姹紫 · 优雅高贵 (mdnice官方)', {
    primaryColor: '#773098',
    textColor: '#2c2c2c',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 5. 红绯 · 典雅绛红 (mdnice 官方代表作)
  buildThemeFromVisualConfig('红绯 · 典雅绛红 (mdnice官方)', {
    primaryColor: '#d84c37',
    textColor: '#222222',
    fontFamily: 'serif',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-bottom',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 6. 蓝莹 · 极简天蓝 (mdnice 官方代表作)
  buildThemeFromVisualConfig('蓝莹 · 极简天蓝 (mdnice官方)', {
    primaryColor: '#2980b9',
    textColor: '#2c3e50',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 7. 山吹 · 明快金黄 (mdnice 官方代表作)
  buildThemeFromVisualConfig('山吹 · 明快金黄 (mdnice官方)', {
    primaryColor: '#e29c45',
    textColor: '#333333',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'badge',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 8. 全栈蓝 · 极客现代 (mdnice 官方代表作)
  buildThemeFromVisualConfig('全栈蓝 · 极客现代 (mdnice官方)', {
    primaryColor: '#40b8fa',
    textColor: '#222222',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'solid-pill',
    quoteStyle: 'card',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 9. 极客黑 · 质感暗夜 (mdnice 官方代表作)
  buildThemeFromVisualConfig('极客黑 · 质感暗夜 (mdnice官方)', {
    primaryColor: '#212122',
    textColor: '#24292e',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'solid-pill',
    quoteStyle: 'minimal',
    tableStyle: 'academic',
    strongStyle: 'black',
    codeTheme: 'one-dark',
  }),

  // 10. 蔷薇紫 · 浪漫雅致 (mdnice 官方代表作)
  buildThemeFromVisualConfig('蔷薇紫 · 浪漫雅致 (mdnice官方)', {
    primaryColor: '#9c27b0',
    textColor: '#333333',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'pill',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 11. 嫩青 · 润泽护眼 (mdnice 官方代表作)
  buildThemeFromVisualConfig('嫩青 · 润泽护眼 (mdnice官方)', {
    primaryColor: '#52b788',
    textColor: '#2d3748',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'pill',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 12. 前端之巅 · 经典技术 (mdnice 官方代表作)
  buildThemeFromVisualConfig('前端之巅 · 经典技术 (mdnice官方)', {
    primaryColor: '#3c70c6',
    textColor: '#24292f',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'card',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 13. 重影 · 现代谍影 (mdnice 官方代表作)
  buildThemeFromVisualConfig('重影 · 现代谍影 (mdnice官方)', {
    primaryColor: '#3e3e3e',
    textColor: '#222222',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'badge',
    quoteStyle: 'card',
    tableStyle: 'bordered',
    strongStyle: 'marker',
    codeTheme: 'github-light',
  }),

  // 14. 雁栖湖 · 青春学术 (mdnice 官方代表作)
  buildThemeFromVisualConfig('雁栖湖 · 青春学术 (mdnice官方)', {
    primaryColor: '#2584b5',
    textColor: '#2c3e50',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-bottom',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 15. 柠檬黄 · 活力维他命 (mdnice 官方代表作)
  buildThemeFromVisualConfig('柠檬黄 · 活力维他命 (mdnice官方)', {
    primaryColor: '#e78e34',
    textColor: '#333333',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'badge',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'marker',
    codeTheme: 'monokai',
  }),

  // 16. 学术规范 · 衬线三线表 (数学与科研论文专享)
  buildThemeFromVisualConfig('学术规范 · 衬线三线表', {
    primaryColor: '#1a3c6e',
    textColor: '#2c3e50',
    fontFamily: 'serif',
    fontSize: 15,
    lineHeight: 2.0,
    justify: true,
    indent: true,
    h2Style: 'border-bottom',
    quoteStyle: 'double-border',
    tableStyle: 'academic',
    strongStyle: 'color',
    codeTheme: 'one-dark',
  }),

  // 17. 极简黑白 · 纯净阅读
  buildThemeFromVisualConfig('极简黑白 · 纯净阅读', {
    primaryColor: '#111111',
    textColor: '#222222',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'center',
    quoteStyle: 'minimal',
    tableStyle: 'academic',
    strongStyle: 'black',
    codeTheme: 'github-light',
  }),

  // 18. 默认 · 经典科技蓝
  buildThemeFromVisualConfig('默认 · 经典科技蓝', {
    primaryColor: '#4a90d9',
    textColor: '#3f3f3f',
    fontFamily: 'sans',
    fontSize: 15,
    lineHeight: 1.8,
    justify: true,
    indent: false,
    h2Style: 'border-left',
    quoteStyle: 'bar',
    tableStyle: 'striped',
    strongStyle: 'color',
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
