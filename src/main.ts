import './style.css';
import { convert, type InputFormat, type Platform, type WechatMath } from './core/pipeline';
import {
  BUILTIN_THEMES, DEFAULT_THEME_NAME, validateTheme,
  buildThemeFromVisualConfig, extractVisualConfig, applyThemeStyles,
  type Theme, type ThemeVisualConfig, type FontFamilyType, type H2StyleType,
  type BlockquoteStyleType, type TableStyleType, type StrongStyleType, type CodeThemeType,
} from './core/themes';
import { richCopy, textCopy } from './core/clipboard';
import { SAMPLE_DOC } from './sample';

/* ------------------------------------------------------------------ */
/* 状态                                                                */
/* ------------------------------------------------------------------ */

interface AppState {
  content: string;
  inputFormat: InputFormat;
  platform: Platform;
  wechatMath: WechatMath;
  zhihuMath: 'eeimg' | 'dollar';
  zhihuPaste: 'rich' | 'plain';
  themeName: string;
  customThemes: Record<string, Theme>;
  phoneWidth: boolean;
}

const LS_KEY = 'md2publish.v1';

function loadState(): AppState {
  const fallback: AppState = {
    content: SAMPLE_DOC,
    inputFormat: 'markdown',
    platform: 'wechat',
    wechatMath: 'svg',
    zhihuMath: 'eeimg',
    zhihuPaste: 'rich',
    themeName: DEFAULT_THEME_NAME,
    customThemes: {},
    phoneWidth: false,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...fallback, ...saved, content: saved.content ?? SAMPLE_DOC };
  } catch {
    return fallback;
  }
}

const state = loadState();

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...state, content: state.content }));
  } catch { /* 存储满了忽略 */ }
}

function allThemes(): Theme[] {
  return [...BUILTIN_THEMES, ...Object.values(state.customThemes)];
}

/** 主题编辑器里调节时，优先使用此临时主题（实时生效） */
let activeThemeOverride: Theme | null = null;

function currentTheme(): Theme {
  if (activeThemeOverride) return activeThemeOverride;
  return allThemes().find((t) => t.name === state.themeName) || BUILTIN_THEMES[0]!;
}

/* ------------------------------------------------------------------ */
/* UI 骨架                                                             */
/* ------------------------------------------------------------------ */

const app = document.getElementById('app')!;

app.innerHTML = `
<header class="topbar">
  <div class="brand">MD 排版助手 <span class="brand-sub">知乎 & 公众号</span></div>
  <div class="controls">
    <label class="ctl">输入
      <select id="format">
        <option value="markdown">Markdown</option>
        <option value="latex">LaTeX（子集）</option>
      </select>
    </label>
    <div class="seg" id="platformSeg">
      <button data-platform="wechat" class="seg-btn">公众号</button>
      <button data-platform="zhihu" class="seg-btn">知乎</button>
    </div>
    <label class="ctl" id="themeCtl">主题
      <select id="theme"></select>
    </label>
    <button id="themeEditBtn" class="btn ghost primary-text" title="无需写 CSS，通过可视化表单自由调节排版与色彩">🎨 排版与主题</button>
    <label class="ctl" id="wechatMathCtl">公式
      <select id="wechatMath">
        <option value="svg">SVG 矢量（推荐）</option>
        <option value="png">PNG 位图</option>
      </select>
    </label>
    <label class="ctl" id="zhihuMathCtl">公式
      <select id="zhihuMath">
        <option value="eeimg">知乎公式图片（粘贴即显示）</option>
        <option value="dollar">$…$ 文本（知乎自行渲染）</option>
      </select>
    </label>
    <label class="ctl" id="zhihuPasteCtl">粘贴方式
      <select id="zhihuPaste">
        <option value="rich">富文本</option>
        <option value="plain">Markdown 纯文本</option>
      </select>
    </label>
    <button id="copyBtn" class="btn primary">复制到公众号</button>
    <div class="menu-wrap">
      <button id="moreBtn" class="btn ghost">更多 ▾</button>
      <div id="moreMenu" class="menu hidden">
        <button data-act="open">打开 .md / .tex 文件…</button>
        <button data-act="saveMd">保存 Markdown</button>
        <button data-act="downloadHtml">下载 HTML</button>
        <button data-act="loadSample">载入示例</button>
        <button data-act="clear" class="danger">清空</button>
      </div>
    </div>
  </div>
</header>

<main class="workspace">
  <section class="pane editor-pane">
    <div class="pane-head">
      <span>源文本</span>
      <span class="pane-head-hint" id="inputHint"></span>
    </div>
    <textarea id="editor" spellcheck="false" placeholder="在此粘贴 Markdown 或 LaTeX……"></textarea>
  </section>
  <section class="pane preview-pane">
    <div class="pane-head">
      <div class="tabs">
        <button class="tab active" data-tab="preview">预览</button>
        <button class="tab" data-tab="html">HTML 源码</button>
      </div>
      <label class="phone-toggle"><input type="checkbox" id="phoneWidth"> 手机宽度</label>
    </div>
    <div class="pane-body">
      <iframe id="preview" class="preview-frame" sandbox="allow-scripts"></iframe>
      <pre id="htmlView" class="html-view hidden"></pre>
    </div>
    <div class="statusbar">
      <span id="stats"></span>
      <button id="warnBtn" class="warn-btn hidden"></button>
      <button id="copyPlainBtn" class="plain-copy hidden">复制 Markdown 文本</button>
    </div>
  </section>
</main>

<!-- 主题抽屉：编辑主题时右侧预览始终可见 -->
<div id="themeModal" class="theme-drawer hidden">
  <div class="drawer-card">
    <div class="modal-head drawer-head">
      <div class="modal-tabs">
        <button class="modal-tab active" data-modaltab="visual">🎨 直观调节</button>
        <button class="modal-tab" data-modaltab="code">💻 专家代码 (JSON)</button>
      </div>
      <button class="modal-close" id="themeCloseBtn" title="关闭（未保存的修改将还原）">✕</button>
    </div>

    <!-- 直观调节面板 -->
    <div id="visualTabPanel" class="drawer-body theme-visual-panel">
      <div class="gallery-head">
        <div class="vgroup-title">主题库 <span class="vgroup-sub">点击卡片即刻预览</span></div>
        <button type="button" id="galleryToggle" class="link-btn">收起</button>
      </div>
      <div id="themeGallery" class="theme-gallery"></div>

      <div class="visual-controls">
          <!-- 主题主色调 -->
          <div class="vgroup">
            <div class="vgroup-title">主色调（自动作用于标题边条、强调字、链接、引用框）</div>
            <div class="color-palette" id="colorPalette">
              <button type="button" class="color-dot" data-color="#ef7060" style="background:#ef7060;" title="橙心暖橙"></button>
              <button type="button" class="color-dot" data-color="#35b378" style="background:#35b378;" title="绿意森林"></button>
              <button type="button" class="color-dot" data-color="#009688" style="background:#009688;" title="兰青雅墨"></button>
              <button type="button" class="color-dot" data-color="#773098" style="background:#773098;" title="姹紫高贵"></button>
              <button type="button" class="color-dot" data-color="#d84c37" style="background:#d84c37;" title="红绯朱红"></button>
              <button type="button" class="color-dot" data-color="#e29c45" style="background:#e29c45;" title="山吹金黄"></button>
              <button type="button" class="color-dot" data-color="#4a90d9" style="background:#4a90d9;" title="科技天蓝"></button>
              <button type="button" class="color-dot" data-color="#1a3c6e" style="background:#1a3c6e;" title="藏蓝学术"></button>
              <button type="button" class="color-dot" data-color="#40b8fa" style="background:#40b8fa;" title="全栈冰蓝"></button>
              <button type="button" class="color-dot" data-color="#2584b5" style="background:#2584b5;" title="雁栖湖蓝"></button>
              <button type="button" class="color-dot" data-color="#9c27b0" style="background:#9c27b0;" title="蔷薇雅紫"></button>
              <button type="button" class="color-dot" data-color="#52b788" style="background:#52b788;" title="嫩青初春"></button>
              <button type="button" class="color-dot" data-color="#e78e34" style="background:#e78e34;" title="柠檬暖黄"></button>
              <button type="button" class="color-dot" data-color="#212122" style="background:#212122;" title="极客暗黑"></button>
              <label class="custom-color-picker" title="自由选色">
                <input type="color" id="vPrimaryColor" value="#ef7060">
                <span id="vColorHex" class="color-hex-tag">#ef7060</span>
              </label>
            </div>
          </div>

          <!-- 正文排版 -->
          <div class="vgroup">
            <div class="vgroup-title">正文版式细节</div>
            <div class="form-grid">
              <label class="vlabel">字体系列
                <select id="vFontFamily">
                  <option value="sans">现代无衬线（黑体 / 现代优雅）</option>
                  <option value="serif">典雅衬线（宋体 / 严肃学术论文）</option>
                  <option value="mono">等宽代码风（极客笔记）</option>
                </select>
              </label>

              <label class="vlabel">正文字号
                <div class="btn-group" id="vFontSizeGroup">
                  <button type="button" class="opt-btn" data-val="14">14px 紧凑</button>
                  <button type="button" class="opt-btn active" data-val="15">15px 标准</button>
                  <button type="button" class="opt-btn" data-val="16">16px 舒适</button>
                  <button type="button" class="opt-btn" data-val="17">17px 大字</button>
                </div>
              </label>

              <label class="vlabel">行间距
                <div class="btn-group" id="vLineHeightGroup">
                  <button type="button" class="opt-btn" data-val="1.6">1.6 紧凑</button>
                  <button type="button" class="opt-btn active" data-val="1.8">1.8 适中</button>
                  <button type="button" class="opt-btn" data-val="2.0">2.0 舒缓</button>
                  <button type="button" class="opt-btn" data-val="2.2">2.2 宽松</button>
                </div>
              </label>

              <label class="vlabel">正文对齐与缩进
                <div class="switch-col">
                  <label class="switch-row">
                    <input type="checkbox" id="vJustify">
                    <span>两端对齐 (文本工整端正)</span>
                  </label>
                  <label class="switch-row">
                    <input type="checkbox" id="vIndent">
                    <span>首行缩进 2 字符 (适合传统散文/论文)</span>
                  </label>
                </div>
              </label>
            </div>
          </div>

          <!-- 标题与重点强调 -->
          <div class="vgroup">
            <div class="vgroup-title">二级标题 (H2) 样式</div>
            <div class="btn-group h2-styles" id="vH2Group">
              <button type="button" class="opt-btn active" data-val="solid-pill">■ 橙心实色徽章</button>
              <button type="button" class="opt-btn" data-val="border-left">▌ 左侧竖彩条</button>
              <button type="button" class="opt-btn" data-val="border-bottom">─ 底部强调线</button>
              <button type="button" class="opt-btn" data-val="pill">⬭ 胶囊圆角浅徽章</button>
              <button type="button" class="opt-btn" data-val="badge">▍ 宽彩块带底色</button>
              <button type="button" class="opt-btn" data-val="bracket">【 优雅方头括号 】</button>
              <button type="button" class="opt-btn" data-val="center">✦ 极简居中</button>
            </div>
          </div>

          <!-- 强调文字与表格风格 -->
          <div class="vgroup">
            <div class="vgroup-title">加粗强调 & 表格排版</div>
            <div class="form-grid">
              <label class="vlabel">加粗字 (Strong) 呈现
                <select id="vStrongStyle">
                  <option value="color">主题色高亮</option>
                  <option value="marker">荧光笔下划背景标记</option>
                  <option value="black">纯黑内敛加粗</option>
                </select>
              </label>
              <label class="vlabel">表格风格
                <select id="vTableStyle">
                  <option value="striped">交替斑马纹全网格 (易读)</option>
                  <option value="academic">学术经典三线表 (顶底粗线无竖线)</option>
                  <option value="bordered">简约全框方格</option>
                </select>
              </label>
            </div>
          </div>

          <!-- 引用块与代码 -->
          <div class="vgroup">
            <div class="vgroup-title">引用块 & 代码块配色</div>
            <div class="form-grid">
              <label class="vlabel">引用块风格
                <select id="vQuoteStyle">
                  <option value="bar">彩条浅底（经典好看）</option>
                  <option value="double-border">双线学术框</option>
                  <option value="card">浅灰微圆角卡片</option>
                  <option value="minimal">纯净极简灰边</option>
                </select>
              </label>
              <label class="vlabel">代码块配色
                <select id="vCodeTheme">
                  <option value="one-dark">One Dark (深色科技专业)</option>
                  <option value="github-light">GitHub Light (清爽浅白)</option>
                  <option value="dracula">Dracula (暗夜吸血鬼高对比)</option>
                  <option value="monokai">Monokai (复古暖调暗黑)</option>
                  <option value="solarized-light">Solarized Light (米黄护眼底)</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

    <!-- 专家代码 (JSON) 面板 -->
    <div id="codeTabPanel" class="drawer-body theme-edit-body hidden">
      <div class="theme-edit-left">
        <div class="field-row">
          <label class="ctl">选择主题
            <select id="themeEditBase"></select>
          </label>
          <button id="themeLoadBtn" class="btn ghost">载入</button>
        </div>
        <textarea id="themeJson" spellcheck="false"></textarea>
      </div>
      <div class="theme-edit-right">
        <div class="theme-edit-hint">
          <strong>专家模式</strong>：支持任意 CSS 选择器（p / h2 / blockquote / pre / th / img…），值是内联 CSS。
          「root」是公众号全文外层容器。在直观模式调节时，本 JSON 会自动同步更新。
        </div>
        <div class="field-col">
          <label class="ctl">保存为 <input id="themeSaveName" type="text" placeholder="我的主题"></label>
          <div class="btn-row">
            <button id="themePreviewApplyBtn" class="btn ghost">临时预览</button>
            <button id="themeSaveBtn" class="btn primary">保存主题</button>
            <button id="themeExportBtn" class="btn ghost">导出 JSON</button>
            <button id="themeImportBtn" class="btn ghost">导入 JSON</button>
            <button id="themeDeleteBtn" class="btn danger ghost">删除当前</button>
          </div>
        </div>
      </div>
    </div>

    <div id="drawerFooter" class="drawer-footer">
      <div class="footer-row">
        <input id="vThemeSaveName" type="text" placeholder="给新主题起个名字，如：我的暖橙">
        <button id="vThemeResetBtn" class="btn ghost">还原修改</button>
        <button id="vThemeSaveBtn" class="btn primary">💾 保存并应用</button>
      </div>
      <div class="footer-hint" id="themeDirtyHint">未保存的修改在关闭抽屉时会自动还原</div>
    </div>
  </div>
</div>

<div id="warnModal" class="modal hidden">
  <div class="modal-card">
    <div class="modal-head"><span>警告与提示</span><button class="modal-close" id="warnCloseBtn">✕</button></div>
    <div class="modal-body"><ul id="warnList" class="warn-list"></ul></div>
  </div>
</div>

<input type="file" id="fileInput" accept=".md,.markdown,.txt,.tex" class="hidden">
`;

/* ------------------------------------------------------------------ */
/* 元素引用                                                            */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => app.querySelector(sel) as T;
const editor = $<HTMLTextAreaElement>('#editor');
const preview = $<HTMLIFrameElement>('#preview');
const htmlView = $<HTMLElement>('#htmlView');
const themeSel = $<HTMLSelectElement>('#theme');
const copyBtn = $<HTMLButtonElement>('#copyBtn');
const statsEl = $<HTMLElement>('#stats');
const warnBtn = $<HTMLButtonElement>('#warnBtn');
const copyPlainBtn = $<HTMLButtonElement>('#copyPlainBtn');
const fileInput = $<HTMLInputElement>('#fileInput');
const inputHint = $<HTMLElement>('#inputHint');

let lastResult: Awaited<ReturnType<typeof convert>> | null = null;
let lastError: string | null = null;
let activeTab: 'preview' | 'html' = 'preview';

/* ------------------------------------------------------------------ */
/* 核心：平滑双向同步滚动（postMessage，预览保持沙箱隔离）              */
/* ------------------------------------------------------------------ */

let lastEditorRatio = 0;
let previewScrollLockUntil = 0;
let editorScrollRaf = 0;

/** 注入预览 iframe 的滚动代理：沙箱内回传/接收滚动比例 */
const PREVIEW_SCROLL_SCRIPT = `<script>
(function () {
  var lock = false;
  function scroller() { return document.scrollingElement || document.documentElement || document.body; }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'md2-scroll-to') return;
    var el = scroller();
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    lock = true;
    var ratio = Math.max(0, Math.min(1, Number(d.ratio) || 0));
    el.scrollTop = ratio * max;
    setTimeout(function () { lock = false; }, 80);
  });
  document.addEventListener('scroll', function () {
    if (lock) return;
    var el = scroller();
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    parent.postMessage({ type: 'md2-scroll', ratio: el.scrollTop / max }, '*');
  }, { passive: true });
})();
</script>`;

// 左侧编辑器滚动 -> 同步右侧预览
editor.addEventListener('scroll', () => {
  if (Date.now() < previewScrollLockUntil) return;
  if (editorScrollRaf) return;
  editorScrollRaf = requestAnimationFrame(() => {
    editorScrollRaf = 0;
    const max = editor.scrollHeight - editor.clientHeight;
    if (max <= 0) return;
    lastEditorRatio = editor.scrollTop / max;
    preview.contentWindow?.postMessage({ type: 'md2-scroll-to', ratio: lastEditorRatio }, '*');
  });
}, { passive: true });

// 右侧预览滚动 -> 同步左侧编辑器
window.addEventListener('message', (ev) => {
  if (ev.source !== preview.contentWindow) return;
  const d = ev.data as { type?: string; ratio?: number } | null;
  if (!d || d.type !== 'md2-scroll' || typeof d.ratio !== 'number') return;
  previewScrollLockUntil = Date.now() + 120;
  const max = editor.scrollHeight - editor.clientHeight;
  if (max > 0) editor.scrollTop = d.ratio * max;
});

preview.addEventListener('load', () => {
  preview.contentWindow?.postMessage({ type: 'md2-scroll-to', ratio: lastEditorRatio }, '*');
});

/* ------------------------------------------------------------------ */
/* 转换与渲染                                                          */
/* ------------------------------------------------------------------ */

let convertTimer: number | undefined;
let converting = false;
let pendingConvert = false;

async function runConvert() {
  if (converting) { pendingConvert = true; return; }
  converting = true;
  try {
    const result = await convert(state.content, {
      inputFormat: state.inputFormat,
      platform: state.platform,
      theme: currentTheme(),
      wechatMath: state.wechatMath,
      zhihuMath: state.zhihuMath,
    });
    lastResult = result;
    lastError = null;

    // 预览（保持沙箱隔离；滚动由注入脚本与父页面通过 postMessage 联动）
    preview.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${PREVIEW_SCROLL_SCRIPT}<style>
      body{margin:0;padding:18px;background:#fff;}
      svg{max-width:100%;}
    </style></head><body>${result.previewHtml}</body></html>`;

    htmlView.textContent = state.platform === 'zhihu' && state.zhihuPaste === 'plain'
      ? result.plainText
      : result.exportHtml;

    // 状态栏
    statsEl.textContent = `${result.stats.chars} 字 · ${result.stats.mathCount} 个公式`;
    statsEl.classList.remove('status-error');
    if (result.warnings.length) {
      warnBtn.textContent = `⚠ ${result.warnings.length} 条警告`;
      warnBtn.classList.remove('hidden');
    } else {
      warnBtn.classList.add('hidden');
    }
    copyPlainBtn.classList.toggle('hidden', !(state.platform === 'zhihu' && state.zhihuPaste === 'plain'));
    inputHint.textContent = state.inputFormat === 'latex'
      ? 'LaTeX 子集：公式用 $…$ 或 equation/align/gather 环境'
      : 'Markdown';
  } catch (e) {
    console.error(e);
    lastError = e instanceof Error ? e.message : String(e);
    statsEl.textContent = '转换失败：' + lastError;
    statsEl.classList.add('status-error');
    warnBtn.textContent = '⚠ 转换出错';
    warnBtn.classList.remove('hidden');
  } finally {
    converting = false;
    if (pendingConvert) { pendingConvert = false; runConvert(); }
  }
}

function scheduleConvert() {
  window.clearTimeout(convertTimer);
  convertTimer = window.setTimeout(runConvert, 280);
}

/* ------------------------------------------------------------------ */
/* 控件同步                                                            */
/* ------------------------------------------------------------------ */

function refreshThemeOptions() {
  fillThemeSelect(themeSel);
  themeSel.value = allThemes().some((t) => t.name === state.themeName)
    ? state.themeName
    : DEFAULT_THEME_NAME;
}

function syncControls() {
  $<HTMLSelectElement>('#format').value = state.inputFormat;
  for (const btn of app.querySelectorAll<HTMLButtonElement>('#platformSeg .seg-btn')) {
    btn.classList.toggle('active', btn.dataset.platform === state.platform);
  }
  refreshThemeOptions();
  $<HTMLSelectElement>('#wechatMath').value = state.wechatMath;
  $<HTMLSelectElement>('#zhihuMath').value = state.zhihuMath;
  $<HTMLSelectElement>('#zhihuPaste').value = state.zhihuPaste;
  const isWechat = state.platform === 'wechat';
  $('#themeCtl').style.display = isWechat ? '' : 'none';
  $('#themeEditBtn').style.display = isWechat ? '' : 'none';
  $('#wechatMathCtl').style.display = isWechat ? '' : 'none';
  $('#zhihuMathCtl').style.display = isWechat ? 'none' : '';
  $('#zhihuPasteCtl').style.display = isWechat ? 'none' : '';
  copyBtn.textContent = isWechat ? '复制到公众号' : '复制到知乎';
  $<HTMLInputElement>('#phoneWidth').checked = state.phoneWidth;
  document.body.classList.toggle('phone-width', state.phoneWidth);
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                            */
/* ------------------------------------------------------------------ */

editor.addEventListener('input', () => {
  state.content = editor.value;
  saveState();
  scheduleConvert();
});

$<HTMLSelectElement>('#format').addEventListener('change', (e) => {
  state.inputFormat = (e.target as HTMLSelectElement).value as InputFormat;
  saveState();
  runConvert();
});

$('#platformSeg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg-btn');
  if (!btn?.dataset.platform) return;
  state.platform = btn.dataset.platform as Platform;
  saveState();
  syncControls();
  runConvert();
});

themeSel.addEventListener('change', () => {
  state.themeName = themeSel.value;
  activeThemeOverride = null;
  saveState();
  runConvert();
});

$<HTMLSelectElement>('#wechatMath').addEventListener('change', (e) => {
  state.wechatMath = (e.target as HTMLSelectElement).value as WechatMath;
  saveState();
  runConvert();
});

$<HTMLSelectElement>('#zhihuMath').addEventListener('change', (e) => {
  state.zhihuMath = (e.target as HTMLSelectElement).value as 'eeimg' | 'dollar';
  saveState();
  runConvert();
});

$<HTMLSelectElement>('#zhihuPaste').addEventListener('change', (e) => {
  state.zhihuPaste = (e.target as HTMLSelectElement).value as 'rich' | 'plain';
  saveState();
  runConvert();
});

$<HTMLInputElement>('#phoneWidth').addEventListener('change', (e) => {
  state.phoneWidth = (e.target as HTMLInputElement).checked;
  saveState();
  syncControls();
});

copyBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  const plain = state.platform === 'zhihu' && state.zhihuPaste === 'plain';
  const html = plain ? '' : lastResult.exportHtml;
  const text = plain ? lastResult.plainText : lastResult.exportHtml.replace(/<[^>]+>/g, '');
  const how = plain ? (await textCopy(lastResult.plainText) ? 'api' : 'fail') : await richCopy(html, text);
  if (how === 'fail') {
    flash(copyBtn, '复制失败 ✕');
  } else {
    flash(copyBtn, plain ? '已复制，去知乎粘贴 ✓' : '已复制，去目标编辑器粘贴 ✓');
  }
});

copyPlainBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  const ok = await textCopy(lastResult.plainText);
  flash(copyPlainBtn, ok ? '已复制 ✓' : '复制失败 ✕');
});

function flash(btn: HTMLElement, msg: string) {
  const old = btn.textContent;
  btn.textContent = msg;
  btn.classList.add('flashed');
  window.setTimeout(() => {
    btn.textContent = old;
    btn.classList.remove('flashed');
  }, 1800);
}

/* 预览 / 源码 tabs */
for (const tab of app.querySelectorAll<HTMLButtonElement>('.tab')) {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab as 'preview' | 'html';
    for (const t of app.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
    preview.classList.toggle('hidden', activeTab !== 'preview');
    htmlView.classList.toggle('hidden', activeTab !== 'html');
  });
}

/* 更多菜单 */
const moreMenu = $('#moreMenu');
$('#moreBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  moreMenu.classList.toggle('hidden');
});
document.addEventListener('click', () => moreMenu.classList.add('hidden'));
moreMenu.addEventListener('click', async (e) => {
  const act = (e.target as HTMLElement).dataset.act;
  moreMenu.classList.add('hidden');
  if (act === 'open') fileInput.click();
  if (act === 'saveMd') download(state.content, 'article.md', 'text/markdown');
  if (act === 'downloadHtml' && lastResult) {
    download(lastResult.exportHtml, 'article.html', 'text/html');
  }
  if (act === 'loadSample') { editor.value = SAMPLE_DOC; state.content = SAMPLE_DOC; saveState(); runConvert(); }
  if (act === 'clear') {
    if (!window.confirm('确定要清空当前内容吗？此操作不可撤销。')) return;
    editor.value = '';
    state.content = '';
    saveState();
    runConvert();
  }
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const text = await file.text();
  editor.value = text;
  state.content = text;
  if (file.name.endsWith('.tex')) {
    state.inputFormat = 'latex';
    syncControls();
  }
  saveState();
  runConvert();
  fileInput.value = '';
});

function download(content: string, name: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* 警告弹窗 */
warnBtn.addEventListener('click', () => {
  const list = $('#warnList');
  list.innerHTML = '';
  const items = [
    ...(lastError ? ['转换失败：' + lastError] : []),
    ...(lastResult?.warnings || []),
  ];
  for (const w of items) {
    const li = document.createElement('li');
    li.textContent = w;
    list.appendChild(li);
  }
  $('#warnModal').classList.remove('hidden');
});
$('#warnCloseBtn').addEventListener('click', () => $('#warnModal').classList.add('hidden'));

/* ------------------------------------------------------------------ */
/* 主题编辑器：可视化直观模式 + 专家代码模式                           */
/* ------------------------------------------------------------------ */

const themeModal = $('#themeModal');
const visualTabPanel = $('#visualTabPanel');
const codeTabPanel = $('#codeTabPanel');
const drawerFooter = $('#drawerFooter');
const themeJson = $<HTMLTextAreaElement>('#themeJson');
const themeBaseSel = $<HTMLSelectElement>('#themeEditBase');
const galleryBox = $('#themeGallery');
const dirtyHint = $('#themeDirtyHint');

// 可视化临时状态
let curVisualConfig: ThemeVisualConfig = extractVisualConfig(currentTheme());
let themeOriginalName = state.themeName;
let drawerSelectedName = state.themeName;
let themeDirty = false;

/** 按「mdnice 官方 / 学术经典 / 我的自定义」分组填充主题下拉框 */
function fillThemeSelect(sel: HTMLSelectElement) {
  sel.innerHTML = '';
  const groups: Array<[string, Theme[]]> = [
    ['mdnice 官方爆款', BUILTIN_THEMES.filter((t) => t.category === 'mdnice')],
    ['学术 · 极简 · 经典', BUILTIN_THEMES.filter((t) => t.category !== 'mdnice')],
    ['我的自定义主题', Object.values(state.customThemes)],
  ];
  for (const [label, items] of groups) {
    if (!items.length) continue;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const t of items) {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

// 抽屉 Tab 切换
for (const tabBtn of app.querySelectorAll<HTMLButtonElement>('.modal-tab')) {
  tabBtn.addEventListener('click', () => {
    const tabName = tabBtn.dataset.modaltab;
    for (const b of app.querySelectorAll('.modal-tab')) b.classList.toggle('active', b === tabBtn);
    visualTabPanel.classList.toggle('hidden', tabName !== 'visual');
    codeTabPanel.classList.toggle('hidden', tabName !== 'code');
    drawerFooter.classList.toggle('hidden', tabName === 'code');
    if (tabName === 'code') {
      themeJson.value = JSON.stringify(currentTheme(), null, 2);
    }
  });
}

function syncVisualUIFromConfig(cfg: ThemeVisualConfig) {
  curVisualConfig = { ...cfg };
  $<HTMLInputElement>('#vPrimaryColor').value = cfg.primaryColor;
  $('#vColorHex').textContent = cfg.primaryColor;

  // 调色盘激活高亮
  for (const dot of app.querySelectorAll<HTMLButtonElement>('.color-dot')) {
    dot.classList.toggle('active', dot.dataset.color?.toLowerCase() === cfg.primaryColor.toLowerCase());
  }

  $<HTMLSelectElement>('#vFontFamily').value = cfg.fontFamily;

  for (const b of app.querySelectorAll<HTMLButtonElement>('#vFontSizeGroup .opt-btn')) {
    b.classList.toggle('active', parseInt(b.dataset.val!, 10) === cfg.fontSize);
  }

  for (const b of app.querySelectorAll<HTMLButtonElement>('#vLineHeightGroup .opt-btn')) {
    b.classList.toggle('active', parseFloat(b.dataset.val!) === cfg.lineHeight);
  }

  $<HTMLInputElement>('#vJustify').checked = cfg.justify;
  $<HTMLInputElement>('#vIndent').checked = cfg.indent;

  for (const b of app.querySelectorAll<HTMLButtonElement>('#vH2Group .opt-btn')) {
    b.classList.toggle('active', b.dataset.val === cfg.h2Style);
  }

  $<HTMLSelectElement>('#vStrongStyle').value = cfg.strongStyle;
  $<HTMLSelectElement>('#vTableStyle').value = cfg.tableStyle;
  $<HTMLSelectElement>('#vQuoteStyle').value = cfg.quoteStyle;
  $<HTMLSelectElement>('#vCodeTheme').value = cfg.codeTheme;
}

function markDirty(dirty: boolean) {
  themeDirty = dirty;
  dirtyHint.textContent = dirty
    ? '● 有未保存的修改，关闭抽屉将自动还原'
    : '未保存的修改在关闭抽屉时会自动还原';
  dirtyHint.classList.toggle('dirty', dirty);
}

function updateGalleryActive() {
  for (const card of galleryBox.querySelectorAll<HTMLElement>('.gallery-card')) {
    card.classList.toggle('active', card.dataset.theme === drawerSelectedName);
  }
}

const GALLERY_SAMPLE = `<h2>标题排版</h2><p>正文示例，<strong>重点强调</strong>与<a>链接</a>。</p><blockquote><p>引用一句名言。</p></blockquote><pre><code>const x = 1;</code></pre><table><thead><tr><th>列</th><th>值</th></tr></thead><tbody><tr><td>甲</td><td>1</td></tr></tbody></table>`;

function buildGallery() {
  galleryBox.innerHTML = '';
  for (const t of allThemes()) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.dataset.theme = t.name;
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';
    const inner = document.createElement('div');
    inner.className = 'gallery-thumb-inner';
    inner.setAttribute('style', t.styles['root'] || '');
    const tpl = document.createElement('template');
    tpl.innerHTML = GALLERY_SAMPLE;
    applyThemeStyles(tpl.content, t);
    inner.append(...Array.from(tpl.content.childNodes));
    thumb.appendChild(inner);
    const name = document.createElement('div');
    name.className = 'gallery-name';
    name.textContent = t.name;
    card.append(thumb, name);
    galleryBox.appendChild(card);
  }
  updateGalleryActive();
}

/** 用户在可视化界面改动任意一项时调用：更新 override 并即刻重绘 */
function applyVisualChange() {
  const theme = buildThemeFromVisualConfig('临时自定义', curVisualConfig);
  activeThemeOverride = theme;
  themeJson.value = JSON.stringify(theme, null, 2);
  markDirty(true);
  updateGalleryActive();
  runConvert();
}

function openThemeModal() {
  themeOriginalName = state.themeName;
  drawerSelectedName = state.themeName;
  curVisualConfig = extractVisualConfig(currentTheme());
  syncVisualUIFromConfig(curVisualConfig);
  fillThemeSelect(themeBaseSel);
  themeBaseSel.value = state.themeName;
  themeJson.value = JSON.stringify(currentTheme(), null, 2);
  buildGallery();
  markDirty(false);
  themeModal.classList.remove('hidden');
}

/** 关闭抽屉：丢弃未保存的临时主题，恢复已保存主题 */
function closeThemeDrawer() {
  if (themeModal.classList.contains('hidden')) return;
  themeModal.classList.add('hidden');
  if (activeThemeOverride) {
    activeThemeOverride = null;
    runConvert();
  }
}

$('#themeEditBtn').addEventListener('click', openThemeModal);
$('#themeCloseBtn').addEventListener('click', closeThemeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeThemeDrawer();
});

// 主题画廊：点击卡片即时套用
galleryBox.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.gallery-card');
  const name = card?.dataset.theme;
  if (!name) return;
  const t = allThemes().find((x) => x.name === name);
  if (!t) return;
  drawerSelectedName = name;
  curVisualConfig = extractVisualConfig(t);
  syncVisualUIFromConfig(curVisualConfig);
  markDirty(true);
  updateGalleryActive();
  applyVisualChange();
});

// 画廊收起 / 展开
$('#galleryToggle').addEventListener('click', () => {
  const collapsed = galleryBox.classList.toggle('collapsed');
  $('#galleryToggle').textContent = collapsed ? '展开' : '收起';
});

// 调色盘点击
$('#colorPalette').addEventListener('click', (e) => {
  const dot = (e.target as HTMLElement).closest<HTMLButtonElement>('.color-dot');
  if (!dot?.dataset.color) return;
  curVisualConfig.primaryColor = dot.dataset.color;
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
});

// 自定义颜色拾色器
$<HTMLInputElement>('#vPrimaryColor').addEventListener('input', (e) => {
  curVisualConfig.primaryColor = (e.target as HTMLInputElement).value;
  $('#vColorHex').textContent = curVisualConfig.primaryColor;
  for (const dot of app.querySelectorAll<HTMLButtonElement>('.color-dot')) dot.classList.remove('active');
  applyVisualChange();
});

// 字体选择
$<HTMLSelectElement>('#vFontFamily').addEventListener('change', (e) => {
  curVisualConfig.fontFamily = (e.target as HTMLSelectElement).value as FontFamilyType;
  applyVisualChange();
});

// 字号按钮组
$('#vFontSizeGroup').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.opt-btn');
  if (!btn?.dataset.val) return;
  curVisualConfig.fontSize = parseInt(btn.dataset.val, 10);
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
});

// 行间距按钮组
$('#vLineHeightGroup').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.opt-btn');
  if (!btn?.dataset.val) return;
  curVisualConfig.lineHeight = parseFloat(btn.dataset.val);
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
});

// 两端对齐与首行缩进
$<HTMLInputElement>('#vJustify').addEventListener('change', (e) => {
  curVisualConfig.justify = (e.target as HTMLInputElement).checked;
  applyVisualChange();
});
$<HTMLInputElement>('#vIndent').addEventListener('change', (e) => {
  curVisualConfig.indent = (e.target as HTMLInputElement).checked;
  applyVisualChange();
});

// H2 样式
$('#vH2Group').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.opt-btn');
  if (!btn?.dataset.val) return;
  curVisualConfig.h2Style = btn.dataset.val as H2StyleType;
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
});

// 强调字、表格、引用块与代码
$<HTMLSelectElement>('#vStrongStyle').addEventListener('change', (e) => {
  curVisualConfig.strongStyle = (e.target as HTMLSelectElement).value as StrongStyleType;
  applyVisualChange();
});
$<HTMLSelectElement>('#vTableStyle').addEventListener('change', (e) => {
  curVisualConfig.tableStyle = (e.target as HTMLSelectElement).value as TableStyleType;
  applyVisualChange();
});
$<HTMLSelectElement>('#vQuoteStyle').addEventListener('change', (e) => {
  curVisualConfig.quoteStyle = (e.target as HTMLSelectElement).value as BlockquoteStyleType;
  applyVisualChange();
});
$<HTMLSelectElement>('#vCodeTheme').addEventListener('change', (e) => {
  curVisualConfig.codeTheme = (e.target as HTMLSelectElement).value as CodeThemeType;
  applyVisualChange();
});

// 可视化面板保存为主题
$('#vThemeSaveBtn').addEventListener('click', () => {
  const nameInput = $<HTMLInputElement>('#vThemeSaveName');
  const name = nameInput.value.trim() || '我的主题 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const theme = buildThemeFromVisualConfig(name, curVisualConfig);
  state.customThemes[name] = theme;
  state.themeName = name;
  activeThemeOverride = null;
  saveState();
  syncControls();
  markDirty(false);
  themeModal.classList.add('hidden');
  runConvert();
  flash($('#themeEditBtn'), '已保存并应用 ✓');
  nameInput.value = '';
});

// 还原到打开抽屉时的主题（丢弃未保存修改）
$('#vThemeResetBtn').addEventListener('click', () => {
  const t = allThemes().find((x) => x.name === themeOriginalName) || BUILTIN_THEMES[0]!;
  drawerSelectedName = t.name;
  curVisualConfig = extractVisualConfig(t);
  syncVisualUIFromConfig(curVisualConfig);
  activeThemeOverride = null;
  markDirty(false);
  updateGalleryActive();
  runConvert();
  flash($('#vThemeResetBtn'), '已还原 ✓');
});

/* ------------------------------------------------------------------ */
/* 专家代码模式 (JSON) 事件                                            */
/* ------------------------------------------------------------------ */

$('#themeLoadBtn').addEventListener('click', () => {
  const t = allThemes().find((x) => x.name === themeBaseSel.value);
  if (t) themeJson.value = JSON.stringify(t, null, 2);
});

$('#themePreviewApplyBtn').addEventListener('click', () => {
  try {
    const json = JSON.parse(themeJson.value) as Theme;
    const err = validateTheme(json);
    if (err) { flash($('#themePreviewApplyBtn'), 'JSON 有误：' + err); return; }
    activeThemeOverride = json;
    markDirty(true);
    runConvert();
    flash($('#themePreviewApplyBtn'), '已临时预览 ✓');
  } catch {
    flash($('#themePreviewApplyBtn'), 'JSON 解析失败');
  }
});

$('#themeSaveBtn').addEventListener('click', () => {
  try {
    const json = JSON.parse(themeJson.value) as Theme;
    const err = validateTheme(json);
    if (err) { flash($('#themeSaveBtn'), 'JSON 有误：' + err); return; }
    const nameInput = $<HTMLInputElement>('#themeSaveName');
    const name = nameInput.value.trim() || json.name || '我的主题';
    const theme: Theme = { name, styles: json.styles, hljs: json.hljs || {} };
    state.customThemes[name] = theme;
    state.themeName = name;
    activeThemeOverride = null;
    saveState();
    syncControls();
    themeModal.classList.add('hidden');
    runConvert();
    flash($('#themeEditBtn'), '已保存并应用 ✓');
    nameInput.value = '';
  } catch {
    flash($('#themeSaveBtn'), 'JSON 解析失败');
  }
});

$('#themeExportBtn').addEventListener('click', () => {
  download(themeJson.value, 'theme.json', 'application/json');
});
$('#themeImportBtn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt) as Theme;
      const err = validateTheme(obj);
      if (err) { alert('导入失败：' + err); return; }
      state.customThemes[obj.name] = obj;
      state.themeName = obj.name;
      activeThemeOverride = null;
      saveState();
      syncControls();
      runConvert();
      openThemeModal();
      alert(`已成功导入主题「${obj.name}」并应用！`);
    } catch {
      alert('导入失败：不是合法的 JSON 文件');
    }
  };
  input.click();
});

$('#themeDeleteBtn').addEventListener('click', () => {
  const name = state.themeName;
  if (BUILTIN_THEMES.some((t) => t.name === name)) {
    flash($('#themeDeleteBtn'), '内置主题不能删除');
    return;
  }
  if (state.customThemes[name]) {
    delete state.customThemes[name];
    state.themeName = DEFAULT_THEME_NAME;
    activeThemeOverride = null;
    saveState();
    syncControls();
    runConvert();
    flash($('#themeDeleteBtn'), '已删除 ✓');
  }
});

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

editor.value = state.content;
syncControls();
runConvert();
