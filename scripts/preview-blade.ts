/**
 * 生成锋刃主题预览页：node node_modules/tsx/dist/cli.mjs scripts/preview-blade.ts
 * 把内置主题渲染成并列手机预览，输出 preview/blade.html
 */
import fs from 'node:fs';
import { md } from '../src/core/markdown';
import { BUILTIN_THEMES } from '../src/core/themes';

const SAMPLE = "# 把复杂留给系统，把锋利留给文字\n\n好的排版不喧哗，它只是让每一行字**站得更稳**。这是一套为长文准备的冷感排版：黑白打底，电光蓝只出现在该出现的地方。\n\n它克制，但不无聊。像[《纽约客》](https://example.com)的版面一样，行距 `1.85`，字号 `15px`，中文两端对齐——读三千字也不会累。\n\n## 结构先于装饰\n\n### 为什么是黑白\n\n黑白不是没有颜色，而是**把颜色留给重点**。标题是实心黑块，表格是黑头三线，代码块压到接近纯黑，剩下的交给留白。\n\n- 标题：黑底 + 电光蓝左边条，一眼定位章节\n- 强调：淡蓝底纹，不打断阅读节奏\n- 引用：浅灰蓝底，左侧一条硬边\n\n### 一条线就够了\n\n> 排版是思想的衣服。衣服合身，人才会被看见。\n\n这条引用只用了 **4px** 的蓝线和一点底色，没有阴影，也没有圆角堆叠。克制，反而更贵。\n\n## 让代码也有秩序\n\n行内代码长这样：`const blade = sharp(typography)`。代码块则是深色硬边，顶部压一条电光蓝：\n\n```typescript\ntype Layout = {\n  ink: '#0B0D12';\n  accent: '#1F35FF';\n  rhythm: 1.85;\n};\n\nconst sharp = (text: string) =>\n  measure(text) > 0.6\n    ? brutalist(text)\n    : editorial(text);\n```\n\n## 数据要站得直\n\n| 维度 | 冷感电光 | 说明 |\n| --- | --- | --- |\n| 主色 | #1F35FF | 电光蓝，只做强调 |\n| 正文 | #2B303B | 比纯黑柔和 |\n| 行距 | 1.85 | 长文舒适区 |\n| 分隔 | 1px 细线 | 不用阴影 |\n\n#### 一个更小的标题\n\n四级标题用一条细线收尾，和上面的实心标题拉开层级，但仍然是同一套语言。\n\n---\n\n如果一段文字读起来有金属感，那大概就是它了。\n";

const names = ['锋刃 · 冷感电光', '锋刃 · 暗夜电光'];
const themes = names.map((n) => {
  const t = BUILTIN_THEMES.find((x) => x.name === n);
  if (!t) throw new Error('主题不存在：' + n);
  return t;
});

const article = md.render(SAMPLE);

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>锋刃 · 微信公众号主题预览</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0B0C10;
    color: #E8EBF2;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 54px 28px 64px; }
  .eyebrow { font-size: 12px; letter-spacing: 3px; color: #6C86FF; text-transform: uppercase; }
  h1.brand { margin: 10px 0 12px; font-size: 38px; line-height: 1.1; letter-spacing: 4px; font-weight: 800; }
  h1.brand span { color: #6C86FF; }
  .intro { max-width: 620px; margin: 0; color: #9AA1B2; font-size: 14px; line-height: 1.9; }
  .meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  .chip { font-size: 12px; color: #AEB6C8; border: 1px solid #262A35; border-radius: 999px; padding: 4px 11px; }
  .chip i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
  .phones { display: flex; gap: 40px; justify-content: center; align-items: flex-start; margin-top: 46px; }
  .phone { width: 390px; }
  .phone-head { display: flex; align-items: baseline; gap: 10px; margin: 0 0 12px 4px; }
  .phone-head b { font-size: 15px; letter-spacing: 1px; }
  .phone-head span { font-size: 11px; color: #7C8395; letter-spacing: 2px; }
  .frame { background: #15171E; border: 1px solid #23262F; border-radius: 26px; padding: 8px; box-shadow: 0 28px 60px rgba(0,0,0,.45); }
  .screen { border-radius: 19px; overflow: hidden; background: #fff; }
  .caption { margin: 12px 4px 0; font-size: 12px; line-height: 1.7; color: #7C8395; }
  .screen .article-root { padding: 0; }
  @media (max-width: 880px) { .phones { flex-direction: column; align-items: center; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">WeChat Theme / Blade Series</div>
  <h1 class="brand">锋刃 <span>BLADE</span></h1>
  <p class="intro">编辑部式的冷感排版：黑白承重，电光蓝点睛。标题做成实心标签，代码与表格压成硬边，剩下全部交给行距和留白。同一套语言，两副面孔。</p>
  <div class="meta">
    <span class="chip"><i style="background:#1F35FF"></i>电光蓝 #1F35FF</span>
    <span class="chip"><i style="background:#0B0D12"></i>墨黑 #0B0D12</span>
    <span class="chip"><i style="background:#F5F7FD"></i>雾蓝 #F5F7FD</span>
    <span class="chip">正文 15px / 行距 1.85</span>
  </div>

  <div class="phones">
    <div class="phone">
      <div class="phone-head"><b>01 冷感电光</b><span>LIGHT</span></div>
      <div class="frame"><div class="screen"><section id="screen-light" class="article-root">${article}</section></div></div>
      <p class="caption">适合技术长文、产品发布、深度报道。白底黑字，蓝色只做结构标记。</p>
    </div>
    <div class="phone">
      <div class="phone-head"><b>02 暗夜电光</b><span>DARK</span></div>
      <div class="frame"><div class="screen" style="background:#0A0C11"><section id="screen-dark" class="article-root">${article}</section></div></div>
      <p class="caption">适合夜间阅读、设计评论、专栏。蓝底反白标题，黑底蓝字代码。</p>
    </div>
  </div>
</div>

<script>
const THEMES = ${JSON.stringify(themes.map((t) => ({ name: t.name, styles: t.styles, hljs: t.hljs })))};

function applyTheme(root, theme) {
  root.setAttribute('style', theme.styles.root || '');
  for (const sel of Object.keys(theme.styles)) {
    if (sel === 'root') continue;
    const css = theme.styles[sel];
    if (!css || !css.trim()) continue;
    for (const el of root.querySelectorAll(sel)) {
      const prev = el.getAttribute('style') || '';
      el.setAttribute('style', (prev ? prev + ';' : '') + css);
    }
  }
  for (const span of root.querySelectorAll('pre code span')) {
    const key = (span.getAttribute('class') || '').split(/\s+/).find((c) => c.indexOf('hljs-') === 0);
    if (!key) continue;
    const color = theme.hljs[key.slice(5)];
    span.removeAttribute('class');
    if (color) span.setAttribute('style', 'color:' + color + ';');
  }
}

applyTheme(document.getElementById('screen-light'), THEMES[0]);
applyTheme(document.getElementById('screen-dark'), THEMES[1]);
</script>
</body>
</html>
`;

fs.mkdirSync('preview', { recursive: true });
fs.writeFileSync('preview/blade.html', page, 'utf8');
console.log('written preview/blade.html', page.length, 'bytes');
