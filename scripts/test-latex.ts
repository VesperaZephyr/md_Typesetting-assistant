/**
 * LaTeX 子集转换器的快速验证脚本：node_modules/.bin/tsx scripts/test-latex.ts
 */
import { latexToMarkdown } from '../src/core/latex';
import { md } from '../src/core/markdown';

const tex = String.raw`\documentclass{article}
\usepackage{amsmath, amssymb}
\newcommand{\R}{\mathbb{R}}
\title{傅里叶分析笔记}
\author{某人}
\begin{document}
\maketitle
\section{基本概念}
设 $f \in L^1(\R)$，其傅里叶变换定义为
\begin{equation}
\hat{f}(\xi) = \int_{\R} f(x) e^{-2\pi i x \xi} \, dx
\end{equation}
\subsection{收敛性}
若 $f$ 光滑，则反演公式成立：
\begin{align}
f(x) &= \int_{\R} \hat{f}(\xi) e^{2\pi i x \xi}\,d\xi \\
     &= \lim_{R\to\infty} \int_{-R}^{R}.
\end{align}
\begin{theorem}[Plancherel]
$\|\hat{f}\|_2 = \|f\|_2$ 对所有 $f \in L^1 \cap L^2$ 成立。
\end{theorem}
\begin{proof}
由密度论证与 \textbf{Fubini 定理}立得，详见\footnote{Stein \& Weiss, Chapter I.}。
\end{proof}
\begin{itemize}
\item 第一点：线性性
\item 第二点：平移对应调制
\end{itemize}
\begin{tabular}{|c|c|}
\hline
函数 & 变换 \\
\hline
$1$ & $\delta$ \\
\hline
$e^{2\pi i ax}$ & $\delta_a$ \\
\hline
\end{tabular}
% 这是注释，应当消失
\end{document}`;

const r = latexToMarkdown(tex);
console.log('=== 生成的 Markdown ===');
console.log(r.markdown);
console.log('\n=== 数学宏 ===');
console.log(r.preamble);
console.log('\n=== 公式段 ===');
r.segs.forEach((s, i) => console.log(`${i}: [${s.display ? '行间' : '行内'}] ${s.tex.slice(0, 60)}`));
console.log('\n=== 警告 ===');
r.warnings.forEach((w) => console.log('- ' + w));

console.log('\n=== Markdown 渲染后的 HTML 结构检查 ===');
const html = md.render(r.markdown);
const has = (s: string) => console.log((html.includes(s) ? '✓' : '✗') + ' ' + s);
has('<h1>');
has('<h2>基本概念</h2>');
has('<table>');
has('|');  // 表格若被段落化则说明分隔行坏了
has('<blockquote>');
has('<ul>');
has('<strong>Fubini');
// 表格分隔行必须完好（未被 --- → — 破坏）
console.log((/[|]\s*---\s*[|]/.test(r.markdown) ? '✓' : '✗') + ' 表格分隔行 | --- | 完好');
console.log((!r.markdown.includes('这是注释') ? '✓' : '✗') + ' 注释已删除');
console.log((r.markdown.includes('傅里叶分析笔记') ? '✓' : '✗') + ' 标题保留');
