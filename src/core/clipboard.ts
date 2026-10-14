/**
 * 富文本复制：优先 Clipboard API 写入 text/html + text/plain 双份数据，
 * 失败（旧浏览器 / file:// 限制）时回退到 contenteditable + execCommand。
 */
export async function richCopy(html: string, plain: string): Promise<'api' | 'fallback' | 'fail'> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return 'api';
    } catch { /* 落到 fallback */ }
  }
  try {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.innerHTML = html;
    div.style.position = 'fixed';
    div.style.left = '-99999px';
    div.style.top = '0';
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    div.remove();
    return ok ? 'fallback' : 'fail';
  } catch {
    return 'fail';
  }
}

/** 复制纯文本 */
export async function textCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-99999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
