import './style.css';
import { convert, type InputFormat, type Platform, type WechatMath } from './core/pipeline';
import {
  BUILTIN_THEMES, DEFAULT_THEME_NAME, validateTheme,
  buildThemeFromVisualConfig, extractVisualConfig,
  type Theme, type ThemeVisualConfig, type FontFamilyType, type H2StyleType,
  type BlockquoteStyleType, type CodeThemeType,
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
      <iframe id="preview" class="preview-frame" sandbox=""></iframe>
      <pre id="htmlView" class="html-view hidden"></pre>
    </div>
    <div class="statusbar">
      <span id="stats"></span>
      <button id="warnBtn" class="warn-btn hidden"></button>
      <button id="copyPlainBtn" class="plain-copy hidden">复制 Markdown 文本</button>
    </div>
  </section>
</main>

<!-- 排版与主题弹窗（双模式：直觉模式 + 专家代码） -->
<div id="themeModal" class="modal hidden">
  <div class="modal-card wide theme-modal-card">
    <div class="modal-head">
      <div class="modal-tabs">
        <button class="modal-tab active" data-modaltab="visual">🎨 直观调节（推荐）</button>
        <button class="modal-tab" data-modaltab="code">💻 专家代码 (JSON/CSS)</button>
      </div>
      <button class="modal-close" id="themeCloseBtn">✕</button>
    </div>

    <!-- 直观调节面板 -->
    <div id="visualTabPanel" class="modal-body theme-visual-panel">
      <div class="visual-grid">

        <!-- 左侧：控件组 -->
        <div class="visual-controls">
          <!-- 预设基准 -->
          <div class="vgroup">
            <div class="vgroup-title">基准预设（快速换装）</div>
            <div class="field-row">
              <select id="vBasePreset" class="full-select"></select>
            </div>
          </div>

          <!-- 主题主色调 -->
          <div class="vgroup">
            <div class="vgroup-title">主色调（自动作用于标题边条、强调字、链接、引用框）</div>
            <div class="color-palette" id="colorPalette">
              <button type="button" class="color-dot" data-color="#4a90d9" style="background:#4a90d9;" title="科技蓝"></button>
              <button type="button" class="color-dot" data-color="#c0392b" style="background:#c0392b;" title="中国红"></button>
              <button type="button" class="color-dot" data-color="#2d6a4f" style="background:#2d6a4f;" title="青竹绿"></button>
              <button type="button" class="color-dot" data-color="#d35400" style="background:#d35400;" title="暖阳橙"></button>
              <button type="button" class="color-dot" data-color="#7b2cbf" style="background:#7b2cbf;" title="紫罗兰"></button>
              <button type="button" class="color-dot" data-color="#0077b6" style="background:#0077b6;" title="海青蓝"></button>
              <button type="button" class="color-dot" data-color="#2c3e50" style="background:#2c3e50;" title="藏青灰"></button>
              <button type="button" class="color-dot" data-color="#111111" style="background:#111111;" title="极简黑"></button>
              <label class="custom-color-picker" title="自由选色">
                <input type="color" id="vPrimaryColor" value="#4a90d9">
                <span id="vColorHex" class="color-hex-tag">#4a90d9</span>
              </label>
            </div>
          </div>

          <!-- 正文排版 -->
          <div class="vgroup">
            <div class="vgroup-title">正文版式</div>
            <div class="form-grid">
              <label class="vlabel">字体系列
                <select id="vFontFamily">
                  <option value="sans">现代无衬线（黑体 / 优雅现代）</option>
                  <option value="serif">典雅衬线（宋体 / 学术论文）</option>
                  <option value="mono">等宽代码风</option>
                </select>
              </label>

              <label class="vlabel">正文字号
                <div class="btn-group" id="vFontSizeGroup">
                  <button type="button" class="opt-btn" data-val="14">14px 紧凑</button>
                  <button type="button" class="opt-btn active" data-val="15">15px 标准</button>
                  <button type="button" class="opt-btn" data-val="16">16px 舒适</button>
                </div>
              </label>

              <label class="vlabel">行间距
                <div class="btn-group" id="vLineHeightGroup">
                  <button type="button" class="opt-btn" data-val="1.6">1.6 紧凑</button>
                  <button type="button" class="opt-btn active" data-val="1.8">1.8 适中</button>
                  <button type="button" class="opt-btn" data-val="2.0">2.0 舒缓</button>
                </div>
              </label>

              <label class="vlabel">中文段落缩进
                <label class="switch-row">
                  <input type="checkbox" id="vIndent">
                  <span>首行缩进 2 字符（适合传统文章/论文）</span>
                </label>
              </label>
            </div>
          </div>

          <!-- 标题与组件 -->
          <div class="vgroup">
            <div class="vgroup-title">二级标题 (H2) 样式</div>
            <div class="btn-group h2-styles" id="vH2Group">
              <button type="button" class="opt-btn active" data-val="border-left">▌ 左侧竖彩条</button>
              <button type="button" class="opt-btn" data-val="border-bottom">─ 底部强调线</button>
              <button type="button" class="opt-btn" data-val="pill">⬭ 胶囊圆角徽章</button>
              <button type="button" class="opt-btn" data-val="center">✦ 极简居中</button>
            </div>
          </div>

          <!-- 引用块与代码 -->
          <div class="vgroup">
            <div class="vgroup-title">引用块 & 代码块</div>
            <div class="form-grid">
              <label class="vlabel">引用块风格
                <select id="vQuoteStyle">
                  <option value="bar">彩条浅底（经典好看）</option>
                  <option value="double-border">双线学术框</option>
                  <option value="card">浅灰卡片微圆角</option>
                </select>
              </label>
              <label class="vlabel">代码块配色
                <select id="vCodeTheme">
                  <option value="one-dark">深色 (One Dark，沉浸专业)</option>
                  <option value="github-light">浅色 (GitHub Light，清爽干净)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <!-- 右侧：说明与保存操作 -->
        <div class="visual-sidebar">
          <div class="v-tip">
            💡 <strong>即时生效</strong>：在此调整任何一项，底层的排版预览会<strong>毫秒级实时刷新</strong>，所见即所得。满意后可保存为新主题。
          </div>
          <div class="field-col" style="margin-top:16px;">
            <label class="ctl" style="flex-direction:column;align-items:flex-start;gap:6px;">
              <span>保存主题名称</span>
              <input id="vThemeSaveName" type="text" placeholder="例如：我的优雅绿" style="width:100%;">
            </label>
            <div class="btn-row" style="margin-top:8px;">
              <button id="vThemeSaveBtn" class="btn primary" style="width:100%;">💾 保存为自定义主题</button>
            </div>
            <div class="btn-row" style="margin-top:8px;">
              <button id="vThemeResetBtn" class="btn ghost" style="width:100%;">重置为预设</button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 专家代码 (JSON) 面板 -->
    <div id="codeTabPanel" class="modal-body theme-edit-body hidden">
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
let activeTab: 'preview' | 'html' = 'preview';

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
    // 预览
    preview.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:18px;background:#fff;}
      svg{max-width:100%;}
    </style></head><body>${result.previewHtml}</body></html>`;
    htmlView.textContent = state.platform === 'zhihu' && state.zhihuPaste === 'plain'
      ? result.plainText
      : result.exportHtml;
    // 状态栏
    statsEl.textContent = `${result.stats.chars} 字 · ${result.stats.mathCount} 个公式`;
    if (result.warnings.length) {
      warnBtn.textContent = `⚠ ${result.warnings.length} 条警告`;
      warnBtn.classList.remove('hidden');
    } else {
      warnBtn.classList.add('hidden');
    }
    copyPlainBtn.classList.toggle('hidden', !(state.platform === 'zhihu' && state.zhihuPaste === 'plain'));
    inputHint.textContent = state.inputFormat === 'latex'
      ? 'LaTeX 子集：公式用 $…$ 或 equation/align 环境'
      : 'Markdown';
  } finally {
    converting = false;
    if (pendingConvert) { pendingConvert = false; runConvert(); }
  }
}

function scheduleConvert() {
  window.clearTimeout(convertTimer);
  convertTimer = window.setTimeout(runConvert, 300);
}

/* ------------------------------------------------------------------ */
/* 控件同步                                                            */
/* ------------------------------------------------------------------ */

function refreshThemeOptions() {
  themeSel.innerHTML = '';
  for (const t of allThemes()) {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.builtin ? t.name : t.name + '（自定义）';
    themeSel.appendChild(opt);
  }
  themeSel.value = state.themeName in state.customThemes || BUILTIN_THEMES.some((t) => t.name === state.themeName)
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
  if (act === 'clear') { editor.value = ''; state.content = ''; saveState(); runConvert(); }
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
  for (const w of lastResult?.warnings || []) {
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
const themeJson = $<HTMLTextAreaElement>('#themeJson');
const themeBaseSel = $<HTMLSelectElement>('#themeEditBase');
const vBasePreset = $<HTMLSelectElement>('#vBasePreset');

// 可视化临时状态
let curVisualConfig: ThemeVisualConfig = extractVisualConfig(currentTheme());

// 弹窗 Tab 切换
for (const tabBtn of app.querySelectorAll<HTMLButtonElement>('.modal-tab')) {
  tabBtn.addEventListener('click', () => {
    const tabName = tabBtn.dataset.modaltab;
    for (const b of app.querySelectorAll('.modal-tab')) b.classList.toggle('active', b === tabBtn);
    visualTabPanel.classList.toggle('hidden', tabName !== 'visual');
    codeTabPanel.classList.toggle('hidden', tabName !== 'code');
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

  $<HTMLInputElement>('#vIndent').checked = cfg.indent;

  for (const b of app.querySelectorAll<HTMLButtonElement>('#vH2Group .opt-btn')) {
    b.classList.toggle('active', b.dataset.val === cfg.h2Style);
  }

  $<HTMLSelectElement>('#vQuoteStyle').value = cfg.quoteStyle;
  $<HTMLSelectElement>('#vCodeTheme').value = cfg.codeTheme;
}

/** 用户在可视化界面改动任意一项时调用：更新 override 并即刻重绘 */
function applyVisualChange() {
  const theme = buildThemeFromVisualConfig('临时自定义', curVisualConfig);
  activeThemeOverride = theme;
  themeJson.value = JSON.stringify(theme, null, 2);
  runConvert();
}

function openThemeModal() {
  // 填充基准下拉框
  vBasePreset.innerHTML = '';
  themeBaseSel.innerHTML = '';
  for (const t of allThemes()) {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.builtin ? t.name : t.name + '（自定义）';
    vBasePreset.appendChild(opt.cloneNode(true));
    themeBaseSel.appendChild(opt);
  }
  vBasePreset.value = state.themeName;
  themeBaseSel.value = state.themeName;

  curVisualConfig = extractVisualConfig(currentTheme());
  syncVisualUIFromConfig(curVisualConfig);
  themeJson.value = JSON.stringify(currentTheme(), null, 2);
  themeModal.classList.remove('hidden');
}

$('#themeEditBtn').addEventListener('click', openThemeModal);
$('#themeCloseBtn').addEventListener('click', () => themeModal.classList.add('hidden'));

// 切换基准主题
vBasePreset.addEventListener('change', () => {
  const t = allThemes().find((x) => x.name === vBasePreset.value);
  if (!t) return;
  curVisualConfig = extractVisualConfig(t);
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
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

// 首行缩进
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

// 引用块与代码
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
  runConvert();
  flash($('#vThemeSaveBtn'), '已保存并启用 ✓');
  nameInput.value = '';
});

// 重置为预设
$('#vThemeResetBtn').addEventListener('click', () => {
  const t = BUILTIN_THEMES[0]!;
  curVisualConfig = extractVisualConfig(t);
  syncVisualUIFromConfig(curVisualConfig);
  applyVisualChange();
  flash($('#vThemeResetBtn'), '已重置为默认 ✓');
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
    runConvert();
    flash($('#themeSaveBtn'), '已保存并启用 ✓');
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
