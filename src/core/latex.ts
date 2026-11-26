/**
 * LaTeX 子集 → Markdown 转换（尽力而为）。
 *
 * 覆盖数学类文章最常见的结构：章节、强调、列表、引用块、定理环境、
 * 表格、插图、脚注、\newcommand 数学宏收集。
 * 数学公式在进入本模块前已被提取为占位符，不会被文本改写碰到。
 * 识别不了的部分保留原文并给出警告。
 */
import { extractMath, type MathSeg } from './mathExtract';
import { escapeAttr } from './exporters';

export const PROOF_END_MARKUP = '<span data-proof-end="">∎</span>';

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

function theoremKind(env: string, title: string): string {
  const name = env.replace(/\*$/, '').split('-').pop()!;
  if (Object.prototype.hasOwnProperty.call(THEOREM_ENVS, name)) return name;
  return Object.keys(THEOREM_ENVS).find((key) => title === THEOREM_ENVS[key] || title.toLowerCase() === key)
    ?? 'theorem';
}

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

  /* 1. 保护代码块，去掉 LaTeX 注释后再提取数学公式。 */
  const codeBlocks: string[] = [];
  const source = verbatimToFences(src).replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, (block) => {
    return '@@LATEXCODE' + (codeBlocks.push(block) - 1) + '@@';
  })
    .split('\n')
    .map((line) => line.replace(/^((?:\\.|[^\\%])*)%.*$/, '$1'))
    .join('\n');
  const { text: skeleton, segs } = extractMath(source);
  let s = skeleton;

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
  const theorems = new Map<string, Theorem>();
  s = collectTheorems(s, theorems);
  const equationWithin = /\\numberwithin\s*\{equation\}\s*\{(chapter|section|subsection)\}/.exec(s)?.[1];
  s = s.replace(/\\numberwithin\s*\{equation\}\s*\{(?:chapter|section|subsection)\}/g, '');

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
  s = resolveReferences(s, segs, theorems, equationWithin, warnings);
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
  /* 6. 环境转换 */
  s = convertBlocks(s, theorems, segs, warnings);
  s = convertColorBoxes(s, warnings);
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
  const unknownEnvs = [...new Set([...s.matchAll(/\\begin\{([^{}]+)\}/g)].map((m) => m[1]))];
  if (unknownEnvs.length) warn(warnings, '未识别环境', '保留原文：' + unknownEnvs.join('、'));
  const leftover = s.match(/\\[A-Za-z]+/g);
  if (leftover) {
    const unknown = [...new Set(leftover.map((c) => c.slice(1)))].filter(
      (c) => !['begin', 'end', 'item'].includes(c)
    );
    if (unknown.length) warn(warnings, '未识别命令', `保留原文：${unknown.map((c) => '\\' + c).join(' ')}，请手动检查`);
  }

  s = s.replace(/@@LATEXCODE(\d+)@@/g, (match, index: string, offset: number) => {
    const before = s.slice(s.lastIndexOf('\n', offset - 1) + 1, offset);
    const prefix = /^((?:[ \t]*>[ \t]?)*[ \t]*)(?:(?:[-+*]|\d+\.)[ \t]+)?$/.exec(before);
    const indent = prefix ? prefix[1]! + ' '.repeat(before.length - prefix[1]!.length) : '';
    return codeBlocks[Number(index)]?.replace(/\n/g, '\n' + indent) ?? match;
  });
  return { markdown: s, segs, preamble: collected.macros.map((m) => m.def).join('\n'), macros: collected.macros, warnings };
}

function quoteLines(body: string): string {
  return body.split('\n').map((l) => l.trim() ? '> ' + l.trimEnd() : '>').join('\n');
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
  const re = new RegExp('\\\\' + cmd + '\\s*\\*?\\s*(?:\\[[^\\]]*\\]\\s*)?\\{');
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

interface Theorem { title: string; counter?: string; within?: string }

function collectTheorems(s: string, theorems: Map<string, Theorem>): string {
  const command = /\\newtheorem(\*)?\s*\{([\w@:-]+)\}\s*(?:\[([\w@:-]+)\])?\s*(?=\{)/g;
  let cursor = 0;
  let out = '';
  let match: RegExpExecArray | null;
  while ((match = command.exec(s))) {
    const title = readArg(s, command.lastIndex);
    if (!title) continue;
    const within = /^[ \t]*\[([\w@:-]+)\]/.exec(s.slice(title[1]));
    const env = match[2]!;
    theorems.set(env, { title: title[0], counter: match[1] ? undefined : match[3] ?? env, within: within?.[1] });
    out += s.slice(cursor, match.index);
    cursor = title[1] + (within?.[0].length ?? 0);
    command.lastIndex = cursor;
  }
  return out + s.slice(cursor);
}

function theoremFor(env: string, theorems: Map<string, Theorem>): Theorem | undefined {
  const declared = theorems.get(env);
  if (declared) return declared;
  const name = env.replace(/\*$/, '');
  const parts = name.split('-');
  if (!parts.every((part) => Object.prototype.hasOwnProperty.call(THEOREM_ENVS, part))) return undefined;
  return { title: parts.map((part) => THEOREM_ENVS[part]).join('–'),
    counter: name === 'proof' || env.endsWith('*') ? undefined : name };
}

interface ReferenceTarget { title: string; number: string }
interface Reference extends ReferenceTarget { id: string }

const HEADINGS = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
const HEADING_NAMES = ['部分', '章', '节', '小节', '小节', '段', '子段'];

function resolveReferences(
  s: string, segs: MathSeg[], theorems: Map<string, Theorem>, equationWithin: string | undefined,
  warnings: string[],
): string {
  const refs = new Map<string, Reference>();
  const unresolved = new Set<string>();
  const labelsSeen = new Set<string>();
  const duplicates = new Set<string>();
  const counters = new Map<string, number>();
  const headings = new Map<string, ReferenceTarget>();
  const scopes: { env: string; target?: ReferenceTarget; capturesLabel: boolean; item?: number }[] = [];
  let heading: ReferenceTarget | undefined;

  function nextNumber(counter: string, within?: string) {
    const prefix = within ? headings.get(within)?.number : undefined;
    const key = counter + ':' + (prefix ?? '');
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return prefix ? prefix + '.' + n : String(n);
  }

  function anchor(label: string, target?: ReferenceTarget): string {
    const key = label.trim();
    if (labelsSeen.has(key)) {
      duplicates.add(key);
      return '';
    }
    labelsSeen.add(key);
    if (!target) {
      unresolved.add(key);
      return '';
    }
    const id = 'latex-ref-' + (refs.size + 1);
    refs.set(key, { ...target, id });
    return '<span id="' + id + '"></span>';
  }

  const tokens = /\\(begin|end)\{([\w@*:-]+)\}(\[[^\]]*\])?|\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph|caption|item)(\*)?(?![A-Za-z*])|@@MATH(\d+)@@|\\label\s*\{([^{}]*)\}/g;
  s = s.replace(tokens, (match, boundary: string, env: string, name: string, cmd: string,
    star: string, math: string, label: string) => {
    if (boundary === 'begin') {
      const theorem = theoremFor(env, theorems);
      const float = /^(figure|table)\*?$/.test(env);
      let target: ReferenceTarget | undefined;
      if (theorem) {
        const counter = theorem.counter;
        const within = counter && counter !== env ? theorems.get(counter)?.within : theorem.within;
        const number = counter ? nextNumber(counter, within) : '';
        target = { title: theorem.title, number };
        scopes.push({ env, target, capturesLabel: true });
        const subtitle = name ? '（' + name.slice(1, -1).trim() + '）' : '';
        return match + '\n\n**' + theorem.title + (number ? ' ' + number : '') + '**' + subtitle + '\n\n';
      }
      const list = /^(itemize|enumerate|description)$/.test(env);
      scopes.push({ env, capturesLabel: float || list, item: list ? 0 : undefined });
      return match;
    }
    if (boundary === 'end') {
      if (scopes[scopes.length - 1]?.env === env) scopes.pop();
      return match;
    }
    if (math !== undefined) {
      const segment = segs[Number(math)]!;
      if (!segment) return match;
      if (segment.diagram) return match;
      const anchors = numberMath(segment, () => nextNumber('equation', equationWithin),
        (label, number) => anchor(label, number ? { title: '式', number } : undefined));
      return anchors ? '\n\n' + anchors + '\n\n' + match + '\n\n' : match;
    }
    if (cmd === 'caption') {
      const frame = [...scopes].reverse().find((scope) => /^(figure|table)\*?$/.test(scope.env));
      if (frame && !star) {
        const kind = frame.env.replace(/\*$/, '');
        frame.target = { title: kind === 'figure' ? '图' : '表', number: nextNumber(kind) };
      }
      return match;
    }
    if (cmd === 'item') {
      const list = [...scopes].reverse().find((scope) => scope.item !== undefined);
      if (list?.env === 'enumerate') {
        list.item = (list.item ?? 0) + 1;
        const parents = scopes.slice(0, scopes.indexOf(list)).filter((scope) => scope.env === 'enumerate');
        if (parents.length === 0) list.target = { title: '条目', number: String(list.item) };
      }
      return match;
    }
    if (label !== undefined) {
      const frame = [...scopes].reverse().find((scope) => scope.capturesLabel);
      return anchor(label, frame ? frame.target : heading);
    }
    const level = HEADINGS.indexOf(cmd);
    if (level >= 0) {
      for (const child of HEADINGS.slice(level)) headings.delete(child);
      const parent = HEADINGS.slice(0, level).reverse().find((section) => headings.has(section));
      heading = star ? undefined : { title: HEADING_NAMES[level]!, number: nextNumber(cmd, parent) };
      if (heading) headings.set(cmd, heading);
    }
    return match;
  });

  return finishReferences(s, segs, refs, unresolved, duplicates, warnings);
}

function numberMath(segment: MathSeg, next: () => string, anchor: (label: string, number?: string) => string): string {
  const env = /^\\begin\{([\w*]+)\}([\s\S]*)\\end\{\1\}$/.exec(segment.tex);
  const kind = env?.[1] ?? '';
  // AMS sub-environments such as aligned and gathered cannot carry an equation tag.
  const numbered = /^(equation|align|gather|multline|eqnarray|alignat|flalign)$/.test(kind);
  let anchors = '';
  function numberRow(row: string) {
    const tag = /\\tag\*?\s*\{([^{}]*)\}/.exec(row)?.[1];
    const number = tag ?? (numbered && row.trim() && !/\\(?:nonumber|notag)\b/.test(row) ? next() : undefined);
    const cleaned = row.replace(/\\label\s*\{([^{}]*)\}/g, (_m, label: string) => {
      anchors += anchor(label, number);
      return '';
    });
    return number && tag === undefined ? cleaned.trimEnd() + '\\tag{' + number + '}\n' : cleaned;
  }
  if (!env) segment.tex = numberRow(segment.tex);
  else if (/^(align|gather|alignat|flalign|eqnarray)\*?$/.test(kind)) {
    let depth = 0;
    let start = 0;
    let body = '';
    const input = env[2]!;
    for (const token of input.matchAll(/\\begin\{[^{}]*\}|\\end\{[^{}]*\}|\\\\(?:\*?(?:\[[^\]]*\])?)|\\[{}]|[{}]/g)) {
      if (token[0] === '{' || token[0].startsWith('\\begin')) depth++;
      else if (token[0] === '}' || token[0].startsWith('\\end')) depth--;
      else if (depth === 0 && token[0].startsWith('\\\\')) {
        body += numberRow(input.slice(start, token.index)) + token[0];
        start = token.index + token[0].length;
      }
    }
    segment.tex = '\\begin{' + kind + '}' + body + numberRow(input.slice(start)) + '\\end{' + kind + '}';
  } else {
    segment.tex = '\\begin{' + kind + '}' + numberRow(env[2]!) + '\\end{' + kind + '}';
  }
  return anchors;
}

function finishReferences(s: string, segs: MathSeg[], refs: Map<string, Reference>,
  unresolved: Set<string>, duplicates: Set<string>, warnings: string[]): string {
  function render(text: string, links: boolean) {
    return text.replace(/\\(eqref|autoref|cref|Cref|pageref|ref)(\*)?\s*\{([^{}]*)\}/g,
      (_m, command: string, star: string, labels: string) => labels.split(',').map((label) => {
        const key = label.trim();
        const duplicate = duplicates.has(key);
        const ref = command === 'pageref' || duplicate ? undefined : refs.get(key);
        if (!ref) {
          if (!duplicate) unresolved.add(key);
          const details = (duplicate ? '重复标签：' : '无法解析引用：') + key;
          return links ? '<span data-latex-ref-issue="' + (duplicate ? 'duplicate' : 'missing')
            + '" title="' + escapeAttr(details) + '">??</span>' : '??';
        }
        const value = command === 'eqref' ? '(' + ref.number + ')'
          : command === 'ref' ? ref.number || ref.title : ref.title + (ref.number ? ' ' + ref.number : '');
        if (!links) return value;
        const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return star ? escaped : '<a href="#' + ref.id + '">' + escaped + '</a>';
      }).join('、'));
  }
  for (const seg of segs) seg.tex = render(seg.tex, false);
  const result = render(s, true);
  if (unresolved.size) warn(warnings, '交叉引用', '请核对标签：' + [...unresolved].join('、'));
  if (duplicates.size) warn(warnings, '重复标签', [...duplicates].join('、'));
  return result;
}

function finishProof(body: string, segs: MathSeg[]): string {
  let explicit = false;
  const proof = body.trim().replace(/(?:\\hfill\s*)?\\qed(?:here|symbol)?\b/g, () => {
    explicit = true;
    return PROOF_END_MARKUP;
  }).replace(/@@MATH(\d+)@@/g, (placeholder, index: string, offset: number, text: string) => {
    const seg = segs[Number(index)];
    if (!seg || seg.diagram) return placeholder;
    const followedByEnd = text.slice(offset + placeholder.length).trimStart().startsWith(PROOF_END_MARKUP);
    if (!/\\qedhere\b/.test(seg.tex)) return seg.display && followedByEnd ? placeholder + '\n\n' : placeholder;
    seg.tex = seg.tex.replace(/\\qedhere\b/g, '');
    explicit = true;
    if (followedByEnd) return seg.display ? placeholder + '\n\n' : placeholder;
    return seg.display ? placeholder + '\n\n' + PROOF_END_MARKUP + '\n\n' : placeholder + ' ' + PROOF_END_MARKUP;
  });
  return explicit ? proof : proof + '\n\n' + PROOF_END_MARKUP;
}

function convertBlocks(s: string, theorems: Map<string, Theorem>, segs: MathSeg[], warnings: string[]): string {
  while (true) {
    const stack: { env: string; start: number; end: number; options: string }[] = [];
    let converted = false;
    for (const token of s.matchAll(/\\(begin|end)\{([\w@*:-]+)\}(\[[^\]]*\])?/g)) {
      const env = token[2]!;
      if (token[1] === 'begin') {
        stack.push({ env, start: token.index, end: token.index + token[0].length, options: token[3] ?? '' });
        continue;
      }
      const open = stack[stack.length - 1];
      if (open?.env !== env) continue;
      stack.pop();
      let body = s.slice(open.end, token.index);
      const theorem = theoremFor(env, theorems);
      if (/^(itemize|enumerate|description)$/.test(env)) body = renderList(body, env, warnings);
      else if (theorem) {
        const kind = theoremKind(env, theorem.title);
        if (kind === 'proof') {
          body = finishProof(body, segs);
        } else {
          body = '<blockquote data-latex-theorem="' + kind + '">\n\n' + body.trim() + '\n\n</blockquote>';
        }
      } else if (env === 'tcolorbox') body = renderTcolorbox(body, open.options, warnings);
      else continue;
      s = s.slice(0, open.start) + '\n\n' + body + '\n\n' + s.slice(token.index + token[0].length - (token[3]?.length ?? 0));
      converted = true;
      break;
    }
    if (!converted) return s.replace(/\\qed(?:here|symbol)?\b/g, '∎');
  }
}

function renderList(content: string, kind: string, warnings: string[]): string {
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
    } else prefix = '- ';
    if (label && kind !== 'enumerate') item = '**' + label + '** ' + item;
    const pad = ' '.repeat(prefix.length);
    if (/^(?:[-+*] |\d+\. |<div\b)/.test(item)) item = '\n' + item;
    item = item.split('\n').map((l, idx2) => (idx2 === 0 ? '' : pad) + l.trimEnd()).join('\n');
    items.push(prefix + item);
  }
  return items.join('\n');
}

const TEX_COLORS = new Map(Object.entries({
  black: '000000', white: 'ffffff', red: 'ff0000', green: '00ff00', blue: '0000ff',
  yellow: 'ffff00', cyan: '00ffff', magenta: 'ff00ff', gray: '808080',
  darkgray: '404040', lightgray: 'bfbfbf', brown: 'bf8040', lime: 'bfff00',
  olive: '808000', orange: 'ff8000', pink: 'ffbfbf', purple: 'bf0040',
  teal: '008080', violet: '800080',
}));

function boxColor(spec: string, model = ''): string | undefined {
  const value = spec.trim();
  if ((model === 'HTML' || value.startsWith('#')) && /^#?[a-f\d]{6}$/i.test(value)) {
    return '#' + value.replace(/^#/, '');
  }
  if (model === 'rgb' || model === 'RGB') {
    const max = model === 'rgb' ? 1 : 255;
    const channels = value.split(',').map(Number);
    if (channels.length === 3 && channels.every((n) => n >= 0 && n <= max)) {
      return 'rgb(' + channels.map((n) => Math.round(n * 255 / max)).join(',') + ')';
    }
    return undefined;
  }
  if (model) return undefined;
  const hex = TEX_COLORS.get(value);
  if (hex) return '#' + hex;
  const mix = /^([A-Za-z]+)!(\d{1,3})(?:!([A-Za-z]+))?$/.exec(value);
  if (!mix) return undefined;
  const a = TEX_COLORS.get(mix[1]!);
  const b = TEX_COLORS.get(mix[3] ?? 'white');
  const weight = Number(mix[2]) / 100;
  if (!a || !b || weight > 1) return undefined;
  const channels = [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * weight
    + parseInt(b.slice(i, i + 2), 16) * (1 - weight)));
  return 'rgb(' + channels.join(',') + ')';
}

function renderTcolorbox(body: string, options: string, warnings: string[]): string {
  const opts = options.slice(1, -1);
  const option = (name: string) => new RegExp('(?:^|,)\\s*' + name + '\\s*=\\s*(?:\\{([^{}]*)\\}|([^,]*))')
    .exec(opts)?.slice(1).find((part) => part !== undefined)?.trim();
  const background = option('colback');
  const frame = option('colframe');
  const title = option('title');
  const bg = background ? boxColor(background) : '#f5f5f5';
  const border = frame ? boxColor(frame) : '#888888';
  if (!bg || !border) warn(warnings, '色盒', '部分颜色未识别，已使用默认颜色');
  return '<div style="padding:0.6em 0.8em;background-color:' + (bg ?? '#f5f5f5')
    + ';border:1px solid ' + (border ?? '#888888') + '">\n\n'
    + (title ? '**' + title + '**\n\n' : '') + body.trim() + '\n\n</div>';
}

function convertColorBoxes(s: string, warnings: string[]): string {
  const command = /\\(f?colorbox)(?![A-Za-z])\s*(?:\[([A-Za-z]+)\]\s*)?/g;
  let match: RegExpExecArray | null;
  while ((match = command.exec(s))) {
    const first = readArg(s, command.lastIndex);
    if (!first) continue;
    const framed = match[1] === 'fcolorbox';
    const background = framed ? readArg(s, first[1]) : first;
    if (!background) continue;
    const content = readArg(s, background[1]);
    if (!content) continue;
    const bg = boxColor(background[0], match[2]);
    const border = framed ? boxColor(first[0], match[2]) : undefined;
    if (!bg || (framed && !border)) warn(warnings, '色盒', '部分颜色未识别，已使用默认颜色');
    const style = 'background-color:' + (bg ?? '#fff4c2') + (framed ? ';border:1px solid ' + (border ?? '#888888') : '');
    const body = content[0].trim();
    const isBlock = /\n\s*\n|\n\s*(?:[-+*] |\d+\. )|^(?:[-+*] |\d+\. )/.test(body);
    const indent = /^[ \t]*/.exec(s.slice(s.lastIndexOf('\n', match.index - 1) + 1, match.index))?.[0] ?? '';
    const replacement = isBlock
      ? '\n\n' + indent + '<div style="' + style + ';padding:0.5em">\n\n'
        + indent + body + '\n\n' + indent + '</div>\n\n' + indent
      : '<span style="' + style + ';padding:0.1em 0.25em">' + body.replace(/\n[ \t]*/g, ' ') + '</span>';
    s = s.slice(0, match.index) + replacement + s.slice(content[1]);
    command.lastIndex = match.index;
  }
  return s;
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
    const anchors = body.match(/<span id="latex-ref-\d+"><\/span>/g)?.join('') ?? '';
    return '\n\n' + (anchors ? anchors + '\n\n' : '') + (alt ? `**${alt}**\n\n` : '') + `![](${path})\n\n`;
  });
}

/** 无参数包裹类环境的通用转换 */
function convertSimpleEnv(s: string, env: string, fn: (body: string) => string): string {
  const re = new RegExp('\\\\begin\\{' + env + '\\}([\\s\\S]*?)\\\\end\\{' + env + '\\}', 'g');
  return s.replace(re, (_m, body: string) => '\n' + fn(body.trim()) + '\n');
}
