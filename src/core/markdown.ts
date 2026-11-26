import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import type { MathSeg } from './mathExtract';

/** 独立的 markdown-it 实例：开启 html 透传，关闭会「自作聪明」的排版替换。 */
export const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: false,
  highlight(str, lang) {
    if (lang) {
      const language = hljs.getLanguage(lang) ? lang : undefined;
      if (language) {
        try {
          return `<pre><code class="hljs language-${language}">${hljs.highlight(str, { language }).value}</code></pre>\n`;
        } catch { /* fallthrough */ }
      }
      // 无法识别的语言：保留 language 标记，交给平台处理
      return `<pre><code class="language-${lang}">${md.utils.escapeHtml(str)}</code></pre>\n`;
    }
    return `<pre><code>${md.utils.escapeHtml(str)}</code></pre>\n`;
  },
});

/** 阻止 markdown-it 自动把裸链接包成 <a> 时加多余属性，保持输出干净。 */
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]!;
  const href = token.attrGet('href');
  token.attrSet('href', href || '');
  return self.renderToken(tokens, idx, options);
};

/** Map rendered Markdown blocks back to source lines, including formulas spanning multiple lines. */
export function renderMarkdownWithSourceLines(skeleton: string, segs: MathSeg[]): string {
  const lines = [0];
  for (const line of skeleton.split('\n')) {
    let originalLines = 1;
    for (const match of line.matchAll(/@@MATH(\d+)@@/g)) {
      const raw = segs[Number(match[1])]?.raw;
      if (raw) originalLines += raw.split('\n').length - 1;
    }
    lines.push(lines[lines.length - 1]! + originalLines);
  }
  const env = {};
  const tokens = md.parse(skeleton, env);
  for (const token of tokens) {
    if (token.map && token.nesting === 1 && /^(p|li|h[1-6]|blockquote|table)$/.test(token.tag)) {
      const [start, end] = token.map;
      if (lines[start] !== undefined && lines[end] !== undefined) {
        token.attrSet('data-source-lines', lines[start] + ':' + lines[end]);
      }
    }
  }
  return md.renderer.render(tokens, md.options, env);
}
