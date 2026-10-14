# MD 排版助手 · 知乎 & 微信公众号

把 Markdown 或 LaTeX 转成能直接粘贴进 **知乎**、**微信公众号** 编辑器的 HTML。本项目针对 mdnice（墨滴）的三个痛点做了针对性设计：

| mdnice 的痛点 | 本工具的做法 |
| --- | --- |
| 为兼容 HTML 有时把正常 Markdown 搞乱 | 数学公式在 Markdown 解析**之前**整体提取保护，下划线、星号、反斜杠都不参与解析，不会乱码；`typographer` 关闭，不做自作聪明的标点替换；原生 HTML 可透传 |
| 公众号主题编辑器难用 | 主题就是一个 JSON：`选择器 → 内联 CSS`，右侧实时预览，支持任意 CSS 选择器、保存到浏览器本地、导入导出 JSON 文件 |
| 知乎公式适配旧编辑器 | 知乎公式模式**可切换**：`知乎公式图片`（eeimg，粘贴即显示，稳定）或 `$…$` 文本（新版编辑器自行渲染），平台规则再变也能马上换挡 |

## 快速开始

**零依赖使用**：直接双击打开 `dist/index.html`（所有库已内联，离线可用），也可把这一个文件拷到任何地方。

开发模式：

```bash
npm install
npm run dev      # 开发预览
npm run build    # 产出单文件 dist/index.html
npx tsx scripts/test-latex.ts   # LaTeX 转换器自测
```

## 使用流程

1. 左栏粘贴 Markdown（或 LaTeX，见下）
2. 顶栏选目标平台：
   - **公众号**：选主题（5 套内置 + 自定义）、公式格式（SVG 矢量推荐 / PNG 位图）→ 点「复制到公众号」→ 到公众号编辑器 Ctrl+V
   - **知乎**：选公式模式与粘贴方式（富文本 / Markdown 纯文本）→ 点「复制到知乎」→ 到知乎文章编辑器 Ctrl+V
3. 「HTML 源码」页签可查看/核对将要粘贴的内容

## 数学公式

- 语法：`$…$`（行内）、`$$…$$` / `\[…\]` / `equation|align|gather…` 环境（行间）；代码块中的 `$` 不会被误判
- **公众号**：公式由 MathJax 渲染成自包含 SVG（`fontCache:'none'`，不依赖共享字形库），粘贴后以矢量显示、缩放不糊。若目标环境对 SVG 不友好，切 PNG 位图模式（2 倍超采样）
- **知乎（eeimg 模式）**：公式编码为 `https://www.zhihu.com/equation?tex=…` 图片，粘贴即是知乎服务端渲染好的公式，历史最稳
- **知乎（$文本 模式）**：公式以 `$…$` 文本保留，供新版编辑器自行渲染；配合「Markdown 纯文本」粘贴方式可获得最接近原生 Markdown 的体验
- LaTeX 模式下 `\newcommand`/`\def` 定义的宏会传给 MathJax；知乎模式只做零参数宏的文本展开，带参数宏会警告提示

## 主题 JSON

```jsonc
{
  "name": "我的主题",
  "styles": {
    "root":   "font-size:15px;color:#3f3f3f;line-height:1.9;", // 公众号全文外层
    "p":      "margin:1.2em 0;",
    "h2":     "border-left:4px solid #4a90d9;padding-left:10px;",
    "blockquote": "border-left:4px solid #4a90d9;background:#f5f8fc;padding:10px 14px;",
    "pre":    "background:#282c34;border-radius:6px;padding:14px;",
    "pre code": "background:transparent;color:#abb2bf;",
    "code":   "background:#f0f2f5;color:#c7254e;"
    // 支持任意合法 CSS 选择器，值 = 内联 CSS；键的先后即覆盖顺序
  },
  "hljs": { "keyword": "#c678dd", "string": "#98c379", "comment": "#5c6370" } // 代码高亮配色
}
```

编辑 → 「临时预览」看效果 → 满意后「保存主题」（存浏览器 localStorage），可导出 JSON 与人分享、导入他人 JSON。

## LaTeX 子集支持范围

面向数学类文章：章节（`\section` 等）、`\title`、强调/加粗/下划线、`itemize/enumerate/description`（含嵌套）、`quote/abstract`、**定理类环境**（theorem/lemma/proposition/definition/proof… 自动中文命名与编号，proof 以 ∎ 收尾）、`tabular`（含 multicolumn 展开）、`figure + includegraphics + caption`、verbatim/lstlisting、`\footnote`（转括号注）、`\href`、`\cite`、`\label/\ref`（转为标签名文本）、数学宏。

不识别的命令/环境会**保留原文并列入警告**（状态栏 ⚠），不会静默吞掉内容。复杂宏包排版（TikZ、chem 等）不在范围内。

## 注意事项

- **图片**：公众号/知乎编辑器粘贴时会自动抓取外链图片转存到自家图床；本地路径图片（LaTeX 来的 `\includegraphics`）需先上传图床并替换
- **剪贴板**：需在 `http://` 或 `file://` 下用真实点击触发复制（浏览器安全策略）；Chrome/Edge 双通道（Clipboard API + execCommand 兜底）
- **公众号代码块**：内联高亮配色随主题走；公众号对 `<pre>` 支持良好
- **知乎富文本**：编辑器会套用自己的排版样式，主题对知乎不生效（这是知乎编辑器的行为，不是 bug）；想要带样式的阅读版面请发想法/专栏时用公众号模式的内容生成图片
