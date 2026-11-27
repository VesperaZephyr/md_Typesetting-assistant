/** Measure the source editor with the same wrapping and line height as the textarea. */
export function createEditorScroll(editor: HTMLTextAreaElement, readSource: () => string) {
  let source = '';
  let width = -1;
  let starts = [0];
  let mirror: HTMLDivElement | undefined;
  let text: Text;
  let range: Range;
  let tops = new Map<number, number>();

  function update() {
    const content = readSource();
    const size = editor.clientWidth;
    if (mirror && content === source && size === width) return;
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.setAttribute('aria-hidden', 'true');
      text = document.createTextNode('');
      mirror.append(text);
      document.body.append(mirror);
      range = document.createRange();
    }
    const css = getComputedStyle(editor);
    Object.assign(mirror.style, {
      position: 'fixed', top: '0', left: '-10000px', visibility: 'hidden', pointerEvents: 'none',
      width: size + 'px', boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      font: css.font, lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, tabSize: css.tabSize,
      padding: css.padding, border: '0', margin: '0', overflow: 'hidden',
    });
    if (content !== source || !text.data) {
      starts = [0];
      for (const match of content.matchAll(/\n/g)) starts.push(match.index + 1);
      source = content;
      text.data = source + '\u200b';
    }
    width = size;
    tops = new Map();
  }

  function lineTop(line: number): number {
    const cached = tops.get(line);
    if (cached !== undefined) return cached;
    const start = starts[line];
    if (start === undefined) {
      return mirror!.scrollHeight - parseFloat(getComputedStyle(editor).paddingBottom || '0');
    }
    range.setStart(text, start);
    range.setEnd(text, start + 1);
    const top = range.getBoundingClientRect().top - mirror!.getBoundingClientRect().top;
    if (line === 0) { tops.set(0, top); return top; }
    tops.set(line, top);
    return top;
  }

  function logicalTop(line: number) {
    return lineTop(line) - lineTop(0);
  }

  function lastAtOrBefore(value: number, measure: (line: number) => number) {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (measure(middle) <= value) low = middle;
      else high = middle;
    }
    return low;
  }

  return {
    lineAtTop(top: number): number {
      update();
      const line = lastAtOrBefore(top, logicalTop);
      const start = logicalTop(line);
      const height = Math.max(1, logicalTop(line + 1) - start);
      return line + Math.max(0, Math.min(0.999, (top - start) / height));
    },
    topAtLine(line: number): number {
      update();
      const whole = Math.min(starts.length - 1, Math.max(0, Math.floor(line)));
      const start = logicalTop(whole);
      return start + Math.max(0, Math.min(1, line - whole)) * (logicalTop(whole + 1) - start);
    },
    topAtOffset(offset: number): number {
      update();
      const start = Math.max(0, Math.min(source.length, offset));
      range.setStart(text, start);
      range.setEnd(text, start + 1);
      return range.getBoundingClientRect().top - mirror!.getBoundingClientRect().top - lineTop(0);
    },
  };
}
