/**
 * LaTeX 子集 → Markdown 转换（尽力而为）。
 *
 * 覆盖数学类文章最常见的结构：章节、强调、列表、引用块、定理环境、
 * 表格、插图、脚注、\newcommand 数学宏收集。
 * 数学公式在进入本模块前已被提取为占位符，不会被文本改写碰到。
 * 识别不了的部分保留原文并给出警告。
 */
import { extractMath, type MathSeg } from './mathExtract';

export interface LatexResult {
  markdown: string;
  segs: MathSeg[];
  /** 收集到的 \newcommand / \DeclareMathOperator / \def，供 MathJax 渲染时使用 */
  preamble: string;
  /** 结构化宏定义（知乎模式展开用） */
  macros: MathMacro[];
  warnings: string[];
}

const THEOREM_ENVS: Record<string, string> = {
  theorem: '定理', lemma: '引理', proposition: '命题', corollary: '推论',
  definition: '定义', example: '例', remark: '注', note: '注记',
  conjecture: '猜想', fact: '事实', claim: '断言', axiom: '公理',
  assumption: '假设', question: '问题', problem: '习题', exercise: '习题',
  answer: '解答', solution: '解', proof: '证明',
};

const DROP_COMMANDS = [
  'documentclass', 'usepackage', 'maketitle', 'tableofcontents', 'pagestyle',
  'setlength', 'bibliographystyle', 'bibliography', 'pagenumbering',
  'thispagestyle', 'setcounter', 'addtocounter', 'numberwithin', 'theoremstyle',
  'graphicspath', 'hypersetup', 'titleformat', 'vspace', 'hspace', 'noindent',
  'indent', 'clearpage', 'newpage', 'centering', 'raggedright', 'raggedleft',
  'large', 'Large', 'huge', 'Huge', 'small', 'footnotesize', 'normalsize',
  'linespread', 'allowdisplaybreaks', 'printbibliography', 'addbibresource',
];

function warn(warnings: string[], key: string, message: string) {
  if (!warnings.some((w) => w.startsWith(key + ':'))) warnings.push(`${key}: ${message}`);
}

/** 找到与 openIdx 处 '{' 匹配的 '}' 下标（跳过 \{ \}）。 */
function matchBrace(s: string, openIdx: number): number {
  if (s[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 取位置 i 起的 {...} 参数，返回 [内容, 结束下标]；无则 null。 */
function readArg(s: string, i: number): [string, number] | null {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  if (s[i] !== '{') return null;
  const close = matchBrace(s, i);
  if (close < 0) return null;
  return [s.slice(i + 1, close), close + 1];
}

/** 反复替换 \cmd{...}；某个匹配处不是 { 参数时跳过而不是停止（避免 \text 卡住 \textbf 类前缀）。 */
function replaceCmd(src: string, cmd: string, fn: (inner: string) => string): string {
  const token = '\\' + cmd;
  let out = src;
  let from = 0;
  let guard = 0;
  while (guard++ < 2000) {
    const idx = out.indexOf(token, from);
    if (idx < 0) break;
    const after = out[idx + token.length];
    // \textbf 不能匹配 \textbfish：后面必须是 { 或空白
    if (after && /[A-Za-z]/.test(after)) { from = idx + token.length; continue; }
    const arg = readArg(out, idx + token.length);
    if (!arg) { from = idx + token.length; continue; }
    out = out.slice(0, idx) + fn(arg[0]) + out.slice(arg[1]);
    from = idx;
  }
  return out;
}

/** 把 \begin{verbatim}/lstlisting 转成 markdown 围栏（须在数学提取之前调用）。 */
function verbatimToFences(src: string): string {
  return src.replace(
    /\\begin\{(verbatim|lstlisting)\*?\}(\[[^\]]*\])?[ \t]*\n?([\s\S]*?)\\end\{\1\*?\}/g,
    (_m, env: string, opts: string | undefined, body: string) => {
      let lang = '';
      if (env === 'lstlisting' && opts) {
        const lm = /(?:^|[,\s])language\s*=\s*([A-Za-z0-9+#-]+)/.exec(opts);
        if (lm) lang = lm[1]!;
      }
      return '\n```' + lang + '\n' + body.replace(/\n$/, '') + '\n```\n';
    }
  );
}

export interface MathMacro {
  /** 形如 \R */
  name: string;
  numArgs: number;
  body: string;
  /** 完整定义文本，传给 MathJax 用 */
  def: string;
}

/** 收集 \newcommand / \DeclareMathOperator / \def 为数学宏，返回清理后的文本。 */
function collectMacros(s: string): { text: string; macros: MathMacro[] } {
  const macros: MathMacro[] = [];
  let out = s;
  let guard = 0;
  while (guard++ < 500) {
    const m = /\\(newcommand|renewcommand|DeclareMathOperator)\*?/.exec(out);
    if (!m) break;
    let i = m.index + m[0].length;
    // 名称：{\foo} 或 \foo
    let name = '';
    if (out[i] === '{') {
      const close = matchBrace(out, i);
      if (close < 0) break;
      name = out.slice(i + 1, close).trim();
      i = close + 1;
    } else if (out[i] === '\\') {
      const nm = /^\\[A-Za-z@]+/.exec(out.slice(i));
      if (!nm) break;
      name = nm[0];
      i += nm[0].length;
    } else break;
    // 可选参数 [n][default]
    const opts: string[] = [];
    while (out[i] === '[') {
      const close = out.indexOf(']', i);
      if (close < 0) break;
      opts.push(out.slice(i + 1, close));
      i = close + 1;
    }
    const arg = readArg(out, i);
    if (!arg) break;
    const numArgs = opts.length && /^\d+$/.test(opts[0]!.trim()) ? parseInt(opts[0]!, 10) : 0;
    const def = m[0].replace(/\*$/, '') + (name.startsWith('{') ? name : '{' + name + '}') + opts.map((o) => '[' + o + ']').join('') + '{' + arg[0] + '}';
    macros.push({ name, numArgs, body: arg[0], def });
    out = out.slice(0, m.index) + out.slice(arg[1]);
  }
  // \def\foo#1{...}
  let guard2 = 0;
  while (guard2++ < 200) {
    const m = /\\def\s*(\\[A-Za-z@]+)/.exec(out);
    if (!m) break;
    let i = m.index + m[0].length;
    let params = '';
    while (i < out.length && out[i] !== '{') { params += out[i]; i++; }
    const arg = readArg(out, i);
    if (!arg) break;
    const numArgs = (params.match(/#/g) || []).length;
    macros.push({ name: m[1]!, numArgs, body: arg[0], def: '\\def' + m[1] + params + '{' + arg[0] + '}' });
    out = out.slice(0, m.index) + out.slice(arg[1]);
  }
  return { text: out, macros };
}

/**
 * 知乎公式（图片 / $…$ 文本）走的是知乎自己的渲染，不认识 \newcommand。
 * 零参数宏做文本展开；带参数宏无法安全展开，返回名字让调用方警告。
 */
export function expandZeroArgMacros(tex: string, macros: MathMacro[]): { tex: string; usedArgMacros: string[] } {
  if (!macros.length) return { tex, usedArgMacros: [] };
  let out = tex;
  const zero = macros.filter((m) => m.numArgs === 0);
  const withArgs = macros.filter((m) => m.numArgs > 0).map((m) => m.name);
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const m of zero) {
      const re = new RegExp(m.name.replace(/\\/, '\\\\') + '(?![A-Za-z])', 'g');
      if (re.test(out)) {
        out = out.replace(new RegExp(m.name.replace(/\\/, '\\\\') + '(?![A-Za-z])', 'g'), m.body);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const usedArg = withArgs.filter((n) => new RegExp(n.replace(/\\/, '\\\\') + '(?![A-Za-z])').test(out));
  return { tex: out, usedArgMacros: usedArg };
}

export function latexToMarkdown(src: string): LatexResult {
  const warnings: string[] = [];

  /* 1. verbatim → 围栏；再提取数学与公式 */
  const { text: skeleton0, segs } = extractMath(verbatimToFences(src));

  /* 2. 去注释（\% 除外） */
  let s = skeleton0
    .split('\n')
    .map((line) => line.replace(/(^|[^\\])%.*$/, '$1'))
    .join('\n');

  /* 3. 数学宏收集（宏通常在导言区，必须在 document 截取之前做） */
  const collected = collectMacros(s);
  s = collected.text;

  /* 4. 标题、作者（同样在导言区） */
  let title = '';
  const titleM = /\\title\s*\{/.exec(s);
  if (titleM) {
    const brace = s.indexOf('{', titleM.index);
    const close = matchBrace(s, brace);
    if (close > 0) {
      title = s.slice(brace + 1, close).trim();
      s = s.slice(0, titleM.index) + s.slice(close + 1);
    }
  }
  for (const c of ['author', 'date']) {
    s = replaceCmd(s, c, () => '');
  }
  if (/\\newtheorem/.test(s)) {
    warn(warnings, '定理环境', '\\newtheorem 定义已忽略，编号按出现顺序自动生成');
    s = s.replace(/\\newtheorem\s*\*?\s*(\[[^\]]*\])?\s*\{[^{}]*\}\s*\{[^{}]*\}(\[[^\]]*\])?(\[[^\]]*\])?/g, '');
  }

  /* 5. document 环境截取：丢弃 documentclass/usepackage 等剩余导言区 */
  const docBegin = s.indexOf('\\begin{document}');
  if (docBegin >= 0) {
    const docEnd = s.indexOf('\\end{document}');
    s = s.slice(docBegin + '\\begin{document}'.length, docEnd > 0 ? docEnd : undefined);
  }

  for (const cmd of DROP_COMMANDS) {
    const re = new RegExp('\\\\' + cmd + '\\s*(\\[[^\\]]*\\])?\\s*(\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})?[ \\t]*\\n?', 'g');
    if (re.test(s)) {
      warn(warnings, '导言区', `已忽略 \\${cmd} 等导言区命令`);
      s = s.replace(new RegExp('\\\\' + cmd + '\\s*(\\[[^\\]]*\\])?\\s*(\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})?[ \\t]*\\n?', 'g'), '');
    }
  }

  /* 5. 文本命令改写（注意顺序：长命令在前，\text 兜底在后） */
  s = replaceCmd(s, 'href', (x) => x); // 先做无害替换以防残留，真正双参处理在下面
  s = processHref(s);
  s = replaceCmd(s, 'url', (x) => x);
  s = replaceCmd(s, 'textbf', (x) => `**${x.trim()}**`);
  s = replaceCmd(s, 'textit', (x) => `*${x.trim()}*`);
  s = replaceCmd(s, 'texttt', (x) => '`' + x.trim() + '`');
  s = replaceCmd(s, 'textsc', (x) => x);
  s = replaceCmd(s, 'textrm', (x) => x);
  s = replaceCmd(s, 'textsf', (x) => x);
  s = replaceCmd(s, 'textnormal', (x) => x);
  s = replaceCmd(s, 'underline', (x) => `<u>${x}</u>`);
  s = replaceCmd(s, 'emph', (x) => `*${x.trim()}*`);
  s = replaceCmd(s, 'textsuperscript', (x) => `<sup>${x}</sup>`);
  s = replaceCmd(s, 'footnote', (x) => `（${x.trim()}）`);
  s = replaceCmd(s, 'cite', (x) => `[${x.trim()}]`);
  s = replaceCmd(s, 'mbox', (x) => x);
  s = replaceCmd(s, 'text', (x) => x);
  for (const c of ['eqref', 'autoref', 'cref', 'Cref', 'pageref', 'ref']) {
    s = replaceCmd(s, c, (x) => x.trim());
  }
  if (/\\(?:eq)?ref\s*\{/.test(src)) warn(warnings, '交叉引用', '\\ref/\\eqref 已替换为标签名文本，请手动核对编号');
  s = replaceCmd(s, 'label', () => '');

  /* 6. 环境转换 */
  s = convertTheoremEnvs(s, warnings);
  s = convertLists(s, warnings);
  s = convertTableEnvs(s);
  s = convertTables(s, warnings);
  s = convertFigures(s, warnings);
  s = convertSimpleEnv(s, 'quote', (body) => quoteLines(body));
  s = convertSimpleEnv(s, 'quotation', (body) => quoteLines(body));
  s = convertSimpleEnv(s, 'abstract', (body) => '> **摘要**\n' + quoteLines(body));
  s = convertSimpleEnv(s, 'keywords', (body) => '**关键词：** ' + body.replace(/\s+/g, ' ').trim());
  s = convertSimpleEnv(s, 'keyword', (body) => '**关键词：** ' + body.replace(/\s+/g, ' ').trim());
  s = convertSimpleEnv(s, 'center', (body) => body.trim());

  /* 7. 章节标题 */
  s = replaceCmdLine(s, 'part', (x) => '# ' + x.trim());
  s = replaceCmdLine(s, 'chapter', (x) => '## ' + x.trim());
  s = replaceCmdLine(s, 'section', (x) => '## ' + x.trim());
  s = replaceCmdLine(s, 'subsection', (x) => '### ' + x.trim());
  s = replaceCmdLine(s, 'subsubsection', (x) => '#### ' + x.trim());
  s = replaceCmdLine(s, 'paragraph', (x) => '##### ' + x.trim());
  s = replaceCmdLine(s, 'subparagraph', (x) => '###### ' + x.trim());

  /* 8. 残留转义与符号（表格行以 | 开头，破折号替换会毁掉表格分隔线，需跳过） */
  s = s
    .replace(/\\nicefrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\\{/g, '{').replace(/\\\}/g, '}')
    .replace(/\\&/g, '&').replace(/\\%/g, '%').replace(/\\\$/g, '$')
    .replace(/\\#/g, '#').replace(/\\_/g, '_')
    .replace(/\\\\\s*(?:\[[^\]]*\])?/g, '\n')
    .replace(/``([^`]*)''/g, '“$1”')
    .replace(/~/g, ' ')
    .replace(/\\ /g, ' ');
  s = s
    .split('\n')
    .map((line) => (line.startsWith('|') ? line : line.replace(/---/g, '—').replace(/--/g, '–')))
    .join('\n');

  /* 9. 空白规范化 */
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (title) s = '# ' + title.replace(/[\\{}]/g, '') + '\n\n' + s;

  /* 10. 未知命令提示 */
  const leftover = s.match(/\\[A-Za-z]+/g);
  if (leftover) {
    const unknown = [...new Set(leftover.map((c) => c.slice(1)))].filter(
      (c) => !['begin', 'end', 'item'].includes(c)
    );
    if (unknown.length) warn(warnings, '未识别命令', `保留原文：${unknown.map((c) => '\\' + c).join(' ')}，请手动检查`);
  }

  return { markdown: s, segs, preamble: collected.macros.map((m) => m.def).join('\n'), macros: collected.macros, warnings };
}

function quoteLines(body: string): string {
  return body.split('\n').map((l) => l.trim() ? '> ' + l.trim() : '>').join('\n');
}

/** \href{url}{text} 双参数处理 */
function processHref(s: string): string {
  let guard = 0;
  while (guard++ < 500) {
    const idx = s.indexOf('\\href');
    if (idx < 0) break;
    const a = readArg(s, idx + 5);
    if (!a) break;
    const b = readArg(s, a[1]);
    if (!b) break;
    s = s.slice(0, idx) + `[${b[0]}](${a[0]})` + s.slice(b[1]);
  }
  return s;
}

/** 标题类命令：允许 \section*{} */
function replaceCmdLine(src: string, cmd: string, fn: (inner: string) => string): string {
  const re = new RegExp('\\\\' + cmd + '\\s*\\*?\\s*\\{');
  let out = src;
  let guard = 0;
  while (guard++ < 500) {
    const m = re.exec(out);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = matchBrace(out, open);
    if (close < 0) break;
    out = out.slice(0, m.index) + fn(out.slice(open + 1, close)) + out.slice(close + 1);
  }
  return out;
}

/** 定理类环境 → 引用块，按类型自动编号；proof 不编号、以 ∎ 收尾。 */
function convertTheoremEnvs(s: string, warnings: string[]): string {
  const counters: Record<string, number> = {};
  for (const env of Object.keys(THEOREM_ENVS)) {
    const label = THEOREM_ENVS[env]!;
    let guard = 0;
    while (guard++ < 500) {
      const openRe = new RegExp('\\\\begin\\{' + env + '\\}(\\[[^\\]]*\\])?');
      const m = openRe.exec(s);
      if (!m) break;
      const closeTok = '\\end{' + env + '}';
      const close = s.indexOf(closeTok, m.index + m[0].length);
      if (close < 0) break;
      const body = s.slice(m.index + m[0].length, close).trim();
      const name = m[1] ? m[1].slice(1, -1).trim() : '';
      const isProof = env === 'proof';
      let head: string;
      if (isProof) {
        head = `**${label}.**`;
      } else {
        counters[env] = (counters[env] || 0) + 1;
        head = `**${label} ${counters[env]}**` + (name ? `（${name}）` : '') + '.';
      }
      const lines = body.split('\n').map((l) => l.trim());
      lines.unshift(head);
      if (isProof) lines.push('∎');
      const quoted = lines.map((l) => l ? '> ' + l : '>').join('\n');
      // 前后补空行：否则相邻定理/证明的引用块会黏成一个
      s = s.slice(0, m.index) + '\n\n' + quoted + '\n\n' + s.slice(close + closeTok.length);
    }
  }
  if (Object.keys(counters).length) {
    warn(warnings, '定理环境', '定理类环境编号按出现顺序自动生成，请核对');
  }
  s = s.replace(/\\qedhere|\\qedsymbol|\\qed\b/g, '∎');
  return s;
}

interface ListTok { kind: string; begin: boolean; idx: number; len: number }

/** itemize / enumerate / description → markdown 列表（栈式配对，由内向外转换）。 */
function convertLists(s: string, warnings: string[]): string {
  let guard = 0;
  while (guard++ < 500) {
    const tokens: ListTok[] = [];
    const re = /\\(begin|end)\{(itemize|enumerate|description)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      tokens.push({ kind: m[2]!, begin: m[1] === 'begin', idx: m.index, len: m[0].length });
    }
    if (!tokens.length) break;
    // 栈式配对，遇到第一对完整的（即最内层）就转换
    const stack: ListTok[] = [];
    let done = false;
    for (const t of tokens) {
      if (t.begin) stack.push(t);
      else {
        const top = stack.pop();
        if (!top) break;
        const depth = stack.length; // 祖先层数
        const inner = s.slice(top.idx + top.len, t.idx);
        const rendered = renderList(inner, top.kind, depth, warnings);
        s = s.slice(0, top.idx) + rendered + s.slice(t.idx + t.len);
        done = true;
        break;
      }
    }
    if (!done) break; // 环境不配对，放弃
  }
  return s;
}

function renderList(content: string, kind: string, depth: number, warnings: string[]): string {
  const n = content.length;
  const starts: number[] = [];
  let envDepth = 0;
  for (let i = 0; i < n; i++) {
    if (content.startsWith('\\begin{', i)) { envDepth++; i += 6; }
    else if (content.startsWith('\\end{', i)) { envDepth--; i += 5; }
    else if (envDepth === 0 && content.startsWith('\\item', i)) {
      const after = content[i + 5];
      if (after === undefined || /[\s{\[]/.test(after)) { starts.push(i); i += 4; }
    }
  }
  if (!starts.length) return content.trim();
  const items: string[] = [];
  let counter = 0;
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k]! + 5;
    const to = k + 1 < starts.length ? starts[k + 1]! : n;
    let item = content.slice(from, to).trim();
    let label = '';
    if (item.startsWith('[')) {
      const close = item.indexOf(']');
      if (close > 0) {
        label = item.slice(1, close).trim();
        item = item.slice(close + 1).trim();
      }
    }
    counter++;
    let prefix: string;
    if (kind === 'itemize') prefix = '- ';
    else if (kind === 'enumerate') {
      prefix = counter + '. ';
      if (label) warn(warnings, '列表', `enumerate 的自定义编号 ${label} 已忽略`);
    } else prefix = '- **' + label + '**' + (label ? ' ' : '');
    // item 内部换行的行按列表缩进对齐
    const pad = '  '.repeat(depth + 1);
    item = item.split('\n').map((l, idx2) => (idx2 === 0 ? '' : pad) + l.trimEnd()).join('\n');
    items.push('  '.repeat(depth) + prefix + item);
  }
  return items.join('\n');
}

/** table 浮动环境：取出 caption 作粗体表题，去掉居中/字号等命令，保留内部 tabular。 */
function convertTableEnvs(s: string): string {
  const re = /\\begin\{(table\*?)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g;
  return s.replace(re, (_m, _env: string, _opt: string | undefined, body: string) => {
    let out = body
      .replace(/\\caption\*?(\[[^\]]*\])?\{([^{}]*)\}/g, (_c, _o, cap: string) => `\n\n**${cap.trim()}**\n\n`)
      .replace(/\\(?:centering|small|footnotesize|scriptsize|normalsize|vspace\s*\{[^{}]*\}|hspace\s*\{[^{}]*\})/g, '');
    out = out.replace(/\n{3,}/g, '\n\n');
    return out;
  });
}

/** tabular / tabularx / longtable → markdown 表格 */
function convertTables(s: string, warnings: string[]): string {
  const re = /\\begin\{(tabular\*?|tabularx|longtable)\}(\[[^\]]*\])?(\{[^{}]*\})?([\s\S]*?)\\end\{\1\}/g;
  return s.replace(re, (_m, _env: string, _opt: string | undefined, _width: string | undefined, body: string) => {
    let b = body
      .replace(/\\(?:toprule|midrule|bottomrule|hline)\s*(\[[^\]]*\])?/g, '')
      .replace(/\\cmidrule(\([lr]{1,2}\))?(\{[^}]*\})?/g, '')
      .replace(/\\endhead|\\endfirsthead|\\caption\*?(\[[^\]]*\])?\{[^{}]*\}/g, '');
    b = b.replace(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^{}]*)\}/g, (_m2, _num: string, c: string) => c);
    // 注意：split 的分隔正则必须用非捕获组，否则可选参数的捕获组会给数组塞 undefined
    const rows = b.split(/\\\\\s*(?:\[[^\]]*\])?/).map((r) => r.trim()).filter(Boolean);
    const parsed = rows.map((row) => row.split('&').map((c) => c.trim()));
    if (!parsed.length) return '';
    if (parsed.length < 2) warn(warnings, '表格', '表格行数不足，可能需要手动补全表头分隔');
    const header = parsed[0]!;
    const sep = header.map(() => '---');
    const rest = parsed.slice(1);
    return '\n' + [header, sep, ...rest].map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
  });
}

/** figure → 图片（caption 作粗体行 + alt）。 */
function convertFigures(s: string, warnings: string[]): string {
  const re = /\\begin\{figure\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\*?\}/g;
  return s.replace(re, (_m, _opt: string | undefined, body: string) => {
    const img = /\\includegraphics(\[[^\]]*\])?\{([^{}]*)\}/.exec(body);
    const cap = /\\caption(\[[^\]]*\])?\{([^{}]*)\}/.exec(body);
    const path = img ? img[2]!.trim() : '';
    const alt = cap ? cap[2]!.trim() : '';
    if (!img) {
      warn(warnings, '插图', 'figure 环境中没有 \\includegraphics，已跳过');
      return '';
    }
    return (alt ? `**${alt}**\n\n` : '') + `![](${path})`;
  });
}

/** 无参数包裹类环境的通用转换 */
function convertSimpleEnv(s: string, env: string, fn: (body: string) => string): string {
  const re = new RegExp('\\\\begin\\{' + env + '\\}([\\s\\S]*?)\\\\end\\{' + env + '\\}', 'g');
  return s.replace(re, (_m, body: string) => '\n' + fn(body.trim()) + '\n');
}
