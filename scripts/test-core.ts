/**
 * 核心回归测试：node_modules/.bin/tsx scripts/test-core.ts
 */
import { extractMath } from '../src/core/mathExtract';
import { latexToMarkdown } from '../src/core/latex';
import { buildThemeFromVisualConfig, validateTheme, BUILTIN_THEMES } from '../src/core/themes';

let failed = 0;
let passed = 0;

function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.error('  ✗ ' + name + (extra ? ' — ' + extra : ''));
  }
}

console.log('\n[mathExtract]');
{
  const src = 'Text\n\\begin{align*}\na &= b \\\\\nc &= d\n\\end{align*}\nEnd';
  const r = extractMath(src);
  check('align* 识别为行间公式', r.segs.length === 1 && r.segs[0]!.display && r.segs[0]!.tex.startsWith('\\begin{align*}'));
  check('align* 生成占位符', r.text.includes('@@MATH0@@'));

  const g = extractMath('\\begin{gather*}\nx = 1 \\\\\ny = 2\n\\end{gather*}');
  check('gather* 识别', g.segs.length === 1 && g.segs[0]!.tex.startsWith('\\begin{gather*}'));

  const d = extractMath('公式 $e^{i\\pi}+1=0$ 与 $\\frac{a}{b}$。');
  check('行内公式提取', d.segs.length === 2 && d.segs.every((s) => !s.display));

  const money = extractMath('价格 $5 和 $10，公式 $x+1$。');
  check('货币 $ 不误判', money.segs.length === 1 && money.segs[0]!.tex === 'x+1');

  const code = extractMath('`$x$` 和\n```\n$y$\n```\n');
  check('行内代码/围栏中的 $ 不提取', code.segs.length === 0);
}

console.log('\n[LaTeX → Markdown]');
{
  const tex = String.raw`\documentclass{article}
\newcommand{\R}{\mathbb{R}}
\title{测试}
\begin{document}
\section{方法}
\begin{table}[h]
\caption{实验数据}
\centering
\begin{tabular}{cc}
\hline
A & B \\
\hline
1 & 2 \\
\hline
\end{tabular}
\end{table}
\begin{keywords}
傅里叶变换, 调和分析
\end{keywords}
\section{结论}
设 $x \in \R$。
\end{document}`;
  const r = latexToMarkdown(tex);
  check('title 保留', r.markdown.startsWith('# 测试'));
  check('table 环境 caption 转粗体', r.markdown.includes('**实验数据**'));
  check('tabular 转 markdown 表格', r.markdown.includes('| A | B |'));
  check('keywords 环境', r.markdown.includes('**关键词：** 傅里叶变换, 调和分析'));
  check('table 环境不残留', !r.markdown.includes('\\begin{table}'));
  check('数学宏收集', r.preamble.includes('\\newcommand{\\R}{\\mathbb{R}}'));
  check('section 转标题', r.markdown.includes('## 方法') && r.markdown.includes('## 结论'));
}

console.log('\n[主题系统]');
{
  const t = buildThemeFromVisualConfig('测试主题', {
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
  });
  check('实色徽章 H2', t.styles.h2!.includes('#ef7060') && t.styles.h2!.includes('border-radius:4px'));
  check('两端对齐', t.styles.root!.includes('justify'));
  check('主题可校验', validateTheme(t) === null);
  check('内置主题数量 >= 20', BUILTIN_THEMES.length >= 20, String(BUILTIN_THEMES.length));
  check('内置主题含暗色分类', BUILTIN_THEMES.some((x) => x.category === 'dark'));
  check('内置主题含 mdnice 分类', BUILTIN_THEMES.some((x) => x.category === 'mdnice'));
}

console.log(`\n结果：${passed} 通过，${failed} 失败\n`);
if (failed > 0) process.exitCode = 1;
