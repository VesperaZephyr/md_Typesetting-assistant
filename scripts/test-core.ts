/**
 * 核心回归测试：node_modules/.bin/tsx scripts/test-core.ts
 */
import { extractMath } from '../src/core/mathExtract';
import { latexToMarkdown } from '../src/core/latex';
import { md, renderMarkdownWithSourceLines } from '../src/core/markdown';
import { sourceLocation } from '../src/core/sourceLocation';
import { findText, formatSelection, insertFootnote, replaceAllText } from '../src/core/editorTools';
import { parseTikzDiagram } from '../src/core/tikzcd';
import { normalizeZhihuTex, zhihuEquationImg, zhihuEquationText } from '../src/core/exporters';
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

console.log('\n[知乎公式]');
{
  const tex = normalizeZhihuTex(String.raw`x\coloneqq\frac{a}{b}`);
  check('知乎行内与行间公式使用不同的原生标记，且 URL 与替代文本同源',
    tex === String.raw`x:=\frac{a}{b}`
    && zhihuEquationImg(tex, false).includes('eeimg="1"')
    && zhihuEquationImg(tex, true).includes('eeimg="2"')
    && zhihuEquationImg(tex, true).includes('tex=' + encodeURIComponent(tex))
    && zhihuEquationImg(tex, true).includes('alt="' + tex + '"'));
  const aligned = String.raw`\begin{aligned}x&\coloneqq1\\\coloneqqSymbol&=2\end{aligned}`;
  check('仅替换完整命令，保留多行对齐与 Markdown 行间定界符',
    zhihuEquationText(normalizeZhihuTex(aligned), true)
    === String.raw`$$\begin{aligned}x&:=1\\\coloneqqSymbol&=2\end{aligned}$$`);
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
  const aligned = String.raw`\begin{aligned}
a &= b+c \\
  &= d
\end{aligned}`;
  const source = '前文\n\\[' + aligned + '\\]\n后文';
  const escaped = '\\\\[' + aligned + '\\\\]';
  const mdResult = extractMath(source);
  check('正常和双反斜线方括号都完整提取 aligned',
    mdResult.segs[0]?.tex === aligned && extractMath(escaped).segs[0]?.tex === aligned);
  check('aligned 单独成块，紧邻正文时不进入段落内部',
    /<p[^>]*>前文<\/p>\s*<p[^>]*>@@MATH0@@<\/p>\s*<p[^>]*>后文<\/p>/.test(
      renderMarkdownWithSourceLines(mdResult.text, mdResult.segs)));
  const latexResult = latexToMarkdown(source + '\n\\begin{equation}' + aligned + '\\end{equation}');
  check('不向 aligned 插入 tag，只有外层 equation 编号',
    latexResult.segs[0]?.tex === aligned && latexResult.segs[1]?.tex.endsWith('\\tag{1}\n\\end{equation}'),
    latexResult.segs.map((segment) => segment.tex).join('\n'));
  const unnumbered = latexToMarkdown(String.raw`\[\begin{gathered}x \\ y\end{gathered}\]
\[\begin{pmatrix}1&0\\0&1\end{pmatrix}\]`);
  check('gathered 和矩阵子环境也不占公式编号',
    unnumbered.segs.length === 2 && unnumbered.segs.every((segment) => !segment.tex.includes('\\tag')));
}
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

{
  const source = String.raw`\begin{enumerate}
\item \colorbox{yellow}{高亮 \textbf{内容}}
\begin{itemize}
\item 内层第一项
\begin{enumerate}
\item 内层细项
\end{enumerate}
\item \fcolorbox{blue}{blue!10}{第二项}
\end{itemize}
\item 外层末项
\end{enumerate}

\begin{tcolorbox}[
  colback=blue!10, colframe=blue, title={带列表的色盒}
]
\begin{itemize}
\item 色盒第一项
\item 色盒第二项
\end{itemize}
\end{tcolorbox}`;
  const r = latexToMarkdown(source);
  const html = md.render(r.markdown);
  check('有序、无序列表混排并保留行内色盒',
    /<ol>\s*<li>[\s\S]*?<span style="background-color:#ffff00[^"]*">高亮 <strong>内容<\/strong><\/span>[\s\S]*?<ul>[\s\S]*?<ol>[\s\S]*?内层细项[\s\S]*?<\/ol>[\s\S]*?第二项<\/span>[\s\S]*?<\/ul>[\s\S]*?外层末项/.test(html), html);
  check('块级色盒包住完整列表',
    /<div style="[^"]*background-color:rgb\(230,230,255\)[^"]*">[\s\S]*?<strong>带列表的色盒<\/strong>[\s\S]*?<ul>[\s\S]*?色盒第二项[\s\S]*?<\/ul>[\s\S]*?<\/div>/.test(html), html);
}

{
  const source = String.raw`\newtheorem{definition-theorem}{定义—定理}[section]
\newtheorem{definition-proposition}[definition-theorem]{定义—命题}
\numberwithin{equation}{section}
\section{方法}\label{sec:method}
见 \ref{sec:method}、\autoref{theorem:forward}、\cref{prop:shared,fig:sample} 和 \eqref{eq:later}。
\begin{definition-theorem}[基本性质]\label{theorem:forward}
\begin{itemize}
\item 第一项
\end{itemize}
\end{definition-theorem}
\begin{definition-proposition}\label{prop:shared} 命题内容。\end{definition-proposition}
\begin{align}
x &= 1 \label{eq:first} \\
y &= 2 \notag \\
z &= x+y \label{eq:later}
\end{align}
\begin{figure}
\includegraphics{sample.png}
\caption{示意图}\label{fig:sample}
\end{figure}
\begin{definition-theorem*} 非编号说明。\end{definition-theorem*}`;
  const r = latexToMarkdown(source);
  const html = md.render(r.markdown);
  check('前向引用、多个标签与公式编号可定位',
    [...html.matchAll(/href="#([^"]+)"/g)].every((m) => html.includes('id="' + m[1] + '"'))
      && />定义—定理 1\.1<\/a>/.test(html) && />定义—命题 1\.2<\/a>/.test(html)
      && />图 1<\/a>/.test(html) && />\(1\.2\)<\/a>/.test(html), html);
  check('定理中保留列表，支持未声明的组合环境',
    /<blockquote data-latex-theorem="theorem">[\s\S]*?<ul>[\s\S]*?第一项/.test(html)
      && html.includes('data-latex-theorem="proposition"') && html.includes('定义–定理'), html);
  const math = r.segs[0]!;
  check('编号公式行生成对应标签，跳过 notag',
    math.tex.includes('\\tag{1.1}') && math.tex.includes('\\tag{1.2}')
      && !math.tex.includes('\\label') && !math.tex.includes('\\tag{1.3}'), math.tex);
  check('解析失败的引用显示问号与标签警告',
    latexToMarkdown(String.raw`\ref{missing}`).warnings.some((message) => message.includes('missing')));
}

{
  const result = latexToMarkdown('\\section{标题}\\label{duplicate}\n\\section{另一个标题}\\label{duplicate}\n见 \\ref{duplicate} 和 \\ref{missing}。');
  check('重复和缺失的引用分别标记，重复引用不跳到错误目标',
    result.markdown.includes('data-latex-ref-issue="duplicate"')
      && result.markdown.includes('data-latex-ref-issue="missing"')
      && !result.markdown.includes('href=')
      && result.warnings.some((warning) => warning.includes('重复标签')));
  const markdown = '第一段\n\n$$\nx^2\n$$\n\n目标段';
  const math = extractMath(markdown);
  const html = renderMarkdownWithSourceLines(math.text, math.segs);
  check('Markdown 多行公式及后续段落映射到原文行',
    html.includes('data-source-lines="2:5"') && html.includes('data-source-lines="6:7">目标段'), html);
  const latex = '\\begin{definition}\n中文句子 $x$ 引用 \\ref{thm:sample}。\n\\end{definition}';
  const location = sourceLocation(latex, latex.indexOf('中文'));
  check('LaTeX 定位文本跳过公式与引用标记',
    location.line === 1 && location.probes[0] === '中文句子引用');
}

{
  const proofText = '这里是用于检查长证明导出行为的正文。'.repeat(24);
  const source = String.raw`\begin{theorem}
定理卡片。
\end{theorem}
\begin{proof}[直接证明]
` + proofText + String.raw`

\begin{enumerate}
\item 第一步。
\item 第二步。
\end{enumerate}

\[x=1\]
\qed
\end{proof}`;
  const result = latexToMarkdown(source);
  const html = md.render(result.markdown);
  check('超过 300 字的证明作为正文导出，定理仍为卡片',
    /<\/blockquote>\s*<p><strong>证明<\/strong>（直接证明）<\/p>/.test(html)
      && html.includes('<p>' + proofText + '</p>') && (html.match(/<blockquote/g) || []).length === 1, html);
  check('普通证明保留列表、公式和单个证毕符号',
    html.includes('<ol>') && result.segs[0]?.tex === 'x=1' && (html.match(/∎/g) || []).length === 1, html);
  const displayProof = latexToMarkdown(String.raw`\begin{proof}
\[x=1\qedhere\]\qed
\end{proof}`);
  check('从行间公式取出 qedhere 并保留单个证毕符号',
    displayProof.segs[0]?.tex === 'x=1' && (displayProof.markdown.match(/∎/g) || []).length === 1
      && /@@MATH0@@\s*\n\n\s*<span data-proof-end/.test(displayProof.markdown), displayProof.markdown);
}

{
  const source = String.raw`\setlist[enumerate,2]{label=(\roman*)}
\begin{enumerate}[label={[\arabic*]}, start=3, ref=\arabic*]
\item\label{item:first} 第三项。
\begin{enumerate}
\item\label{item:sub} 罗马编号。
\end{enumerate}
\item[补充] 自定义标签。
\item 第四项。
\end{enumerate}
见 \ref{item:first} 和 \ref{item:sub}。
\begin{enumerate}[(I)]
\item 大写罗马编号。
\end{enumerate}`;
  const r = latexToMarkdown(source);
  check('列表保留方括号、罗马数字、起始号和逐项标签',
    ['[3]', '(i)', '补充', '[4]', '(I)'].every((label) => r.markdown.includes('data-enumerate-label="' + label + '"')),
    r.markdown);
  check('列表 ref 设置和嵌套条目引用与编号一致',
    /href="#latex-ref-1">3<\/a>/.test(r.markdown) && /href="#latex-ref-2">\(i\)<\/a>/.test(r.markdown),
    r.markdown);
  const alternate = latexToMarkdown(String.raw`\renewcommand{\labelenumi}{(\alph{enumi})}
\begin{enumerate}
\item 首项。
\item[$\star$] 特殊项。
\item 次项。
\end{enumerate}`);
  check('支持旧版 labelenumi 和数学文本标签，手填标签不占自动编号',
    ['(a)', '★', '(b)'].every((label) => alternate.markdown.includes('data-enumerate-label="' + label + '"'))
      && !alternate.preamble.includes('labelenumi'), alternate.markdown);
}

console.log('\n[TikZ-CD]');
{
  const source = String.raw`\begin{tikzcd}[column sep=1.5cm,ampersand replacement=\&]
{A_{1}} \arrow[r, "f", hook] \arrow[rd, "{h_1,h_2}"', dashed] \& B \\
C \& D \arrow[from=2-2,to=1-2, "p", two heads] \arrow[l, bend left=25, "q"{description}] \\
\end{tikzcd}`;
  const diagram = parseTikzDiagram(source);
  check('保留矩阵列、箭头起止、折向和标签侧别',
    JSON.stringify(diagram.cells) === JSON.stringify([['{A_{1}}', 'B'], ['C', 'D']])
      && diagram.arrows[0]?.from.column === 0 && diagram.arrows[0]?.to.column === 1
      && diagram.arrows[1]?.to.row === 1 && diagram.arrows[1]?.to.column === 1
      && diagram.arrows[1]?.labels[0]?.side === 'swap'
      && diagram.arrows[2]?.from.row === 1 && diagram.arrows[2]?.to.row === 0
      && diagram.arrows[2]?.to.column === 1);
  check('识别钩尾、双头、虚线、弯箭和居中标签',
    diagram.arrows[0]?.tail === 'hook' && diagram.arrows[1]?.line === 'dash'
      && diagram.arrows[2]?.head === 'double' && diagram.arrows[3]?.bend === 25
      && diagram.arrows[3]?.labels[0]?.centered === true);
  const markdown = '图前一段\n' + source + '\n图后一段';
  const segments = extractMath(markdown);
  const html = renderMarkdownWithSourceLines(segments.text, segments.segs);
  check('连续的 Markdown 正文和交换图分为三个块，保留源码行号',
    /<p[^>]*>图前一段<\/p>\s*<p data-source-lines="1:5">@@MATH0@@<\/p>\s*<p[^>]*>图后一段<\/p>/.test(html), html);
  const latex = latexToMarkdown('\\[' + source + '\\]');
  check('LaTeX 公式定界符内整张提取，原样保护 TikZ 命令',
    latex.segs[0]?.diagram === 'tikzcd' && latex.segs[0]?.tex === source && !latex.segs[0]?.tex.includes('\\tag'));
  const code = extractMath('```latex\n' + source + '\n```');
  check('代码围栏内的交换图保持源码',
    code.segs.length === 0 && extractMath('  ~~~latex\n' + source + '\n  ~~~').segs.length === 0);
  const problem = (diagramSource: string) => {
    try { parseTikzDiagram(diagramSource); return ''; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
  };
  check('未知选项和越界箭头显式报错',
    problem(source.replace('hook', 'loop')).includes('loop')
      && problem(source.replace('arrow[r,', 'arrow[rr,')).includes('超出矩阵'));
}

console.log('\n[编辑工具]');
{
  const source = '选择这里\n第二行';
  check('同一选区可按 Markdown 或 LaTeX 规则加粗',
    formatSelection(source, 0, 2, 'bold', 'markdown').text === '**选择**'
      && formatSelection(source, 0, 2, 'bold', 'latex').text === '\\textbf{选择}');
  check('选区引用按整行处理，LaTeX 删除线进入排版',
    formatSelection(source, 1, source.length, 'quote', 'markdown').text === '> 选择这里\n> 第二行'
      && md.render(latexToMarkdown('\\sout{去掉}').markdown).includes('<s>去掉</s>'));
  const note = insertFootnote('正文[^1]\n\n[^1]: 第一条', 2, '第二条\n续行', 'markdown');
  const noteSource = '正文'.slice(0, note.start) + note.text;
  const html = md.render(noteSource);
  check('Markdown 脚注分配独立编号，文末保留跨行内容',
    note.text.startsWith('[^2]') && html.includes('href="#latex-ref-footnote-1"') && html.includes('第二条\n续行'));
  const latex = md.render(latexToMarkdown(String.raw`句子\footnote{见 \textbf{论文}。}。`).markdown);
  check('LaTeX 脚注保留文末来源和原有内联格式',
    latex.includes('href="#latex-ref-footnote-1"') && latex.includes('见 <strong>论文</strong>。'));
  check('脚注语法在行内代码中保持原文',
    md.render('`[^1]`\n\n[^1]: 请忽略。').includes('<code>[^1]</code>')
      && !md.render('`[^1]`\n\n[^1]: 请忽略。').includes('latex-ref-footnote'));
  check('查找按字面匹配并可区分大小写，替换文本不展开 $',
    findText('A. a. A!', 'a.', false).length === 2
      && findText('A. a. A!', 'a.', true).length === 1
      && replaceAllText('x+x', '+', '$&', false) === 'x$&x');
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
  check('保留 15 套 mdnice 与 4 套奇幻主题', BUILTIN_THEMES.length === 19
    && BUILTIN_THEMES.filter((theme) => theme.category === 'mdnice').length === 15
    && BUILTIN_THEMES.filter((theme) => theme.category === 'fantasy').length === 4);
  check('奇幻主题保留各自的正文和手写标题样式', BUILTIN_THEMES.filter((theme) => theme.category === 'fantasy').every(
    (theme) => validateTheme(theme) === null && theme.styles.root?.includes('line-height:1.9')
      && theme.styles.h3?.includes('position:relative')));
}

console.log(`\n结果：${passed} 通过，${failed} 失败\n`);
if (failed > 0) process.exitCode = 1;
