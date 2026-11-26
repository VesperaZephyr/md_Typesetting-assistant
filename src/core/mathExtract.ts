/**
 * 从源文本中提取数学公式，替换为不会被 Markdown 引擎触碰的占位符。
 *
 * 这是避免「正常 markdown 出现乱码」的核心：公式里的下划线、星号、反斜杠
 * 都不参与 Markdown 解析，渲染完成后再把占位符替换回目标平台的公式标记。
 *
 * 支持语法：
 *   $$...$$        行间公式（可跨行）
 *   $...$          行内公式（不跨行，$ 内侧不能紧邻空白）
 *   \(...\)  \[..\] 行内 / 行间公式
 *   \begin{equation|align|gather|multline|eqnarray|alignat|flalign|displaymath}...\end{...}
 * 代码块与行内代码中的 $、\( 一律不提取。
 */

export interface MathSeg {
  /** 占位符，如 @@MATH0@@ */
  placeholder: string;
  tex: string;
  display: boolean;
  /** 原始定界符，用于纯文本还原 */
  raw: string;
  diagram?: 'tikzcd' | 'tikzpicture';
}

const MATH_ENVS = ['equation', 'align', 'gather', 'multline', 'eqnarray', 'alignat', 'flalign', 'displaymath', 'tikzcd', 'tikzpicture'];

const MATH_ENV_RE = new RegExp(
  '^\\\\begin\\{((?:' + MATH_ENVS.join('|') + ')\\*?)\\}'
);

function envEndTag(env: string): string {
  return '\\end{' + env + '}';
}

export function extractMath(src: string): { text: string; segs: MathSeg[] } {
  const segs: MathSeg[] = [];
  let out = '';
  let i = 0;
  const n = src.length;

  const addSeg = (tex: string, display: boolean, raw: string) => {
    const placeholder = `@@MATH${segs.length}@@`;
    const diagram = /^\\begin\{(tikzcd|tikzpicture)\}/.exec(tex)?.[1] as MathSeg['diagram'];
    segs.push({ placeholder, tex, display: display || Boolean(diagram), raw, diagram });
    out += placeholder;
  };

  while (i < n) {
    const ch = src[i]!;

    // ---- 围栏代码块：整块原样保留 -------------------------------------
    const open = (i === 0 || src[i - 1] === '\n') && /[ `~]/.test(ch)
      ? /^ {0,3}(`{3,}|~{3,})[^\n]*\n?/.exec(src.slice(i))
      : null;
    if (open) {
      const fence = open[1]!;
      const closeRe = new RegExp('^ {0,3}' + fence + fence[0] + '*[\\t \\r]*$');
      let j = i + open[0].length;
      let end = -1;
      while (j <= n) {
        const lineEnd = src.indexOf('\n', j);
        const line = src.slice(j, lineEnd < 0 ? n : lineEnd);
        if (closeRe.test(line)) { end = lineEnd < 0 ? n : lineEnd + 1; break; }
        if (lineEnd < 0) break;
        j = lineEnd + 1;
      }
      if (end > 0) {
        out += src.slice(i, end);
        i = end;
        continue;
      }
      out += src.slice(i);
      break;
    }

    // ---- 行内代码：整段原样保留 ---------------------------------------
    if (ch === '`') {
      let run = 0;
      let k = i;
      while (src[k] === '`') { run++; k++; }
      const closer = '`'.repeat(run);
      const close = src.indexOf(closer, k);
      if (close > 0) {
        out += src.slice(i, close + run);
        i = close + run;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    // ---- $$...$$ 行间公式 ---------------------------------------------
    if (ch === '$' && src[i + 1] === '$') {
      const end = src.indexOf('$$', i + 2);
      if (end > 0 && end > i + 2) {
        addSeg(src.slice(i + 2, end).trim(), true, src.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // ---- $...$ 行内公式 ------------------------------------------------
    if (ch === '$' && src[i + 1] !== '$') {
      const next = src[i + 1];
      if (next && !/\s/.test(next)) {
        let j = i + 1;
        let found = -1;
        while (j < n) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '\n') break;
          if (src[j] === '$') { found = j; break; }
          j++;
        }
        if (found > i + 1 && !/\s/.test(src[found - 1]!)) {
          addSeg(src.slice(i + 1, found), false, src.slice(i, found + 1));
          i = found + 1;
          continue;
        }
      }
      out += ch;
      i++;
      continue;
    }

    // ---- \(...\) 与 \[...\] -------------------------------------------
    const displayOpen = ch === '\\' ? /^\\{1,2}\[/.exec(src.slice(i, i + 3))?.[0] : undefined;
    if (displayOpen) {
      const slashCount = displayOpen.length - 1;
      const close = '\\'.repeat(slashCount) + ']';
      const start = i + displayOpen.length;
      let end = src.indexOf(close, start);
      while (end >= 0 && src[end - 1] === '\\') end = src.indexOf(close, end + close.length);
      if (end > 0) {
        addSeg(src.slice(start, end).trim(), true, src.slice(i, end + close.length));
        i = end + close.length;
        continue;
      }
      if (slashCount > 1) {
        out += displayOpen;
        i = start;
        continue;
      }
    }
    if (ch === '\\' && src.startsWith('\\(', i)) {
      const end = src.indexOf('\\)', i + 2);
      if (end > 0) {
        addSeg(src.slice(i + 2, end).trim(), false, src.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // ---- \begin{align} 等数学环境 --------------------------------------
    if (ch === '\\' && src[i + 1] === 'b' && src.startsWith('\\begin{', i)) {
      const m = MATH_ENV_RE.exec(src.slice(i));
      if (m) {
        const env = m[1]!;
        const endTok = envEndTag(env);
        const end = src.indexOf(endTok, i + m[0].length);
        if (end > 0) {
          const stop = end + endTok.length;
          addSeg(src.slice(i, stop).trim(), true, src.slice(i, stop));
          i = stop;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return { text: out, segs };
}

export function displayMathPlaceholders(segs: MathSeg[]): Set<string> {
  return new Set(segs.filter((segment) => segment.display).map((segment) => segment.placeholder));
}

/** 把占位符替换回文本（纯文本还原用） */
export function restoreMath(text: string, segs: MathSeg[], render: (seg: MathSeg) => string): string {
  return text.replace(/@@MATH(\d+)@@/g, (m0, idx) => {
    const seg = segs[Number(idx)];
    return seg ? render(seg) : m0;
  });
}
