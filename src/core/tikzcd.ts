export interface CellPosition { row: number; column: number }
export interface DiagramLabel {
  tex: string;
  side: 'normal' | 'swap' | 'left' | 'right' | 'above' | 'below';
  position: number;
  centered: boolean;
}
export interface DiagramArrow {
  from: CellPosition;
  to: CellPosition;
  labels: DiagramLabel[];
  bend: number;
  shift: number;
  line: 'solid' | 'dash' | 'dot' | 'double' | 'invisible';
  head: 'arrow' | 'double' | 'none';
  tail: 'none' | 'hook' | 'hook reversed' | 'bar' | 'arrow' | 'fork';
}
export interface TikzDiagram {
  cells: string[][];
  arrows: DiagramArrow[];
  rowGap: number;
  columnGap: number;
}

function splitTopLevel(text: string, separators: string[]): string[] {
  const parts: string[] = [];
  const options = separators.includes(',');
  const environments: string[] = [];
  let braces = 0;
  let brackets = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if (!options && !braces && text[index] === '\\') {
      const boundary = /^\\(begin|end)\{([^{}]+)\}/.exec(text.slice(index));
      if (boundary) {
        if (boundary[1] === 'begin') environments.push(boundary[2]!);
        else if (environments.pop() !== boundary[2]) throw new Error('节点内的环境没有配对');
        index += boundary[0].length - 1;
        continue;
      }
      const arrow = /^\\(?:arrow|ar)(?![A-Za-z])/.exec(text.slice(index));
      if (arrow && !environments.length) {
        const args = argument(text, index + arrow[0].length, '[');
        if (args) {
          index = args.end - 1;
          continue;
        }
      }
    }
    if (!braces && !brackets && !quoted && !environments.length) {
      const separator = separators.find((value) => text.startsWith(value, index));
      if (separator) {
        parts.push(text.slice(start, index));
        start = index + separator.length;
        index = start - 1;
        continue;
      }
    }
    const character = text[index];
    if (character === '\\') index++;
    else if (character === '{') braces++;
    else if (character === '}') braces--;
    else if (character === '"' && !braces && options) quoted = !quoted;
    else if (options && !braces && !quoted) {
      if (character === '[') brackets++;
      else if (character === ']') brackets--;
    }
  }
  if (braces || brackets || quoted || environments.length) throw new Error('括号、环境或标签引号没有配对');
  parts.push(text.slice(start));
  return parts;
}

function argument(text: string, start: number, opening: '[' | '{'): { value: string; end: number } | undefined {
  while (/\s/.test(text[start] ?? '')) start++;
  if (text[start] !== opening) return undefined;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quoted = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (character === '\\') { index++; continue; }
    if (character === '{') braceDepth++;
    else if (character === '}') braceDepth--;
    else if (opening === '[' && !braceDepth) {
      if (character === '"') quoted = !quoted;
      else if (!quoted && character === '[') bracketDepth++;
      else if (!quoted && character === ']') bracketDepth--;
    }
    if (braceDepth === 0 && bracketDepth === 0 && !quoted) {
      return { value: text.slice(start + 1, index), end: index + 1 };
    }
  }
  throw new Error('未闭合的 ' + opening + ' 参数');
}

function dimension(value: string): number {
  const match = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(pt|px|mm|cm|in|em|ex)?$/.exec(value.trim());
  if (!match) throw new Error('暂不支持的尺寸：' + value);
  const units: Record<string, number> = { pt: 1.33, px: 1, mm: 3.78, cm: 37.8, in: 96, em: 16, ex: 8 };
  const result = Number(match[1]) * units[match[2] ?? 'pt']!;
  if (Math.abs(result) > 640) throw new Error('交换图间距过大：' + value);
  return result;
}

function position(value: string): CellPosition {
  const match = /^([1-9]\d*)-([1-9]\d*)$/.exec(value);
  if (!match) throw new Error('暂不支持的节点坐标：' + value);
  return { row: Number(match[1]) - 1, column: Number(match[2]) - 1 };
}

function labelOption(label: DiagramLabel, option: string): boolean {
  if (/^(above|below|left|right)$/.test(option)) {
    // TikZ left/right labels are relative to the page, swap is relative to the arrow.
    label.side = option as DiagramLabel['side'];
  } else if (option === 'swap' || option === 's') label.side = 'swap';
  else if (option === 'description') label.centered = true;
  else if (option === 'near start') label.position = 0.25;
  else if (option === 'near end') label.position = 0.75;
  else if (option === 'very near start') label.position = 0.125;
  else if (option === 'very near end') label.position = 0.875;
  else if (option === 'midway') label.position = 0.5;
  else if (/^pos\s*=/.test(option)) {
    const value = Number(option.split('=')[1]);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('无效的标签位置：' + option);
    label.position = value;
  } else return false;
  return true;
}

function parseArrow(options: string, cell: CellPosition, legacyDirection?: string, legacyLabel?: string): DiagramArrow {
  const arrow: DiagramArrow = { from: cell, to: cell, labels: [], bend: 0, shift: 0,
    line: 'solid', head: 'arrow', tail: 'none' };
  let direction = legacyDirection;
  let destination: CellPosition | undefined;
  if (legacyLabel) arrow.labels.push({ tex: legacyLabel, position: 0.5, side: 'normal', centered: false });
  const sharedLabel: DiagramLabel = { tex: '', position: 0.5, side: 'normal', centered: false };
  const labelSettings: string[] = [];
  for (const field of splitTopLevel(options, [',']).map((part) => part.trim()).filter(Boolean)) {
    const quote = /^"((?:\\.|[^"\\])*)"(')?\s*(?:\{([\s\S]*)\})?$/.exec(field);
    if (quote) {
      const label: DiagramLabel = { tex: quote[1]!, position: 0.5, side: quote[2] ? 'swap' : 'normal', centered: false };
      for (const option of splitTopLevel(quote[3] ?? '', [',']).map((part) => part.trim()).filter(Boolean)) {
        if (!labelOption(label, option)) throw new Error('暂不支持的标签选项：' + option);
      }
      arrow.labels.push(label);
      continue;
    }
    const [key, rawValue] = field.split(/\s*=\s*/, 2);
    const value = rawValue?.trim();
    if (/^[rlud]+$/.test(field) && !direction) direction = field;
    else if (key === 'from' && value) arrow.from = position(value);
    else if (key === 'to' && value) destination = position(value);
    else if (key === 'bend left' || key === 'bend right') {
      const angle = value === undefined ? 30 : Number(value);
      if (!Number.isFinite(angle) || angle < 0 || angle > 75) throw new Error('无效的弯曲角度：' + field);
      arrow.bend = angle * (key === 'bend left' ? 1 : -1);
    } else if (key === 'shift left' || key === 'shift right') {
      const amount = value === undefined ? 5 : (/[a-z]/i.test(value) ? dimension(value) : Number(value) * 5);
      if (!Number.isFinite(amount) || Math.abs(amount) > 80) throw new Error('无效的平移：' + field);
      arrow.shift = amount * (key === 'shift left' ? 1 : -1);
    } else if (['dashed', 'dashrightarrow'].includes(field)) arrow.line = 'dash';
    else if (field === 'dotted') arrow.line = 'dot';
    else if (['Rightarrow', 'Leftrightarrow', 'equal'].includes(field)) {
      arrow.line = 'double';
      if (field === 'equal') arrow.head = 'none';
      if (field === 'Leftrightarrow') arrow.tail = 'arrow';
    } else if (field === 'phantom') { arrow.line = 'invisible'; arrow.head = 'none'; }
    else if (['two heads', 'twoheadrightarrow'].includes(field)) arrow.head = 'double';
    else if (['no head', '-'].includes(field)) arrow.head = 'none';
    else if (['hook', 'hookrightarrow'].includes(field)) arrow.tail = 'hook';
    else if (field === "hook'") arrow.tail = 'hook reversed';
    else if (['mapsto', '|->'].includes(field)) arrow.tail = 'bar';
    else if (['tail', 'rightarrowtail'].includes(field)) arrow.tail = 'fork';
    else if (['leftrightarrow', '<->'].includes(field)) arrow.tail = 'arrow';
    else if (['rightarrow', '->', 'solid'].includes(field)) continue;
    else if (labelOption(sharedLabel, field)) labelSettings.push(field);
    else throw new Error('暂不支持的箭头选项：' + field);
  }
  for (const label of arrow.labels) for (const option of labelSettings) labelOption(label, option);
  if (destination && direction) throw new Error('箭头同时指定了方向和目标坐标');
  if (destination) arrow.to = destination;
  else if (direction && /^[rlud]+$/.test(direction)) {
    arrow.to = { row: arrow.from.row, column: arrow.from.column };
    for (const step of direction) {
      if (step === 'r') arrow.to.column++;
      else if (step === 'l') arrow.to.column--;
      else if (step === 'd') arrow.to.row++;
      else arrow.to.row--;
    }
  } else if (direction) arrow.to = position(direction);
  else throw new Error('箭头缺少方向或目标坐标');
  return arrow;
}

export function parseTikzDiagram(source: string): TikzDiagram {
  const text = source.split(/\r?\n/).map((line) => line.replace(/^((?:\\.|[^\\%])*)%.*$/, '$1')).join('\n').trim();
  const opening = /^\\begin\s*\{tikzcd\}/.exec(text);
  const closing = /\\end\s*\{tikzcd\}$/.exec(text);
  if (!opening || !closing) throw new Error('仅支持完整的 tikzcd 环境');
  const options = argument(text, opening[0].length, '[');
  const diagram: TikzDiagram = { cells: [], arrows: [], rowGap: 44, columnGap: 62 };
  const separators = ['&'];
  for (const field of splitTopLevel(options?.value ?? '', [',']).map((part) => part.trim()).filter(Boolean)) {
    const [key, value] = field.split(/\s*=\s*/, 2);
    if (key === 'ampersand replacement' && value === '\\&') separators.push('\\&');
    else if ((key === 'row sep' || key === 'column sep') && value) {
      const gaps: Record<string, number> = { tiny: 16, small: 28, normal: 44, large: 72, huge: 104 };
      const gap = Object.prototype.hasOwnProperty.call(gaps, value) ? gaps[value]! : dimension(value);
      if (gap < 4) throw new Error('交换图间距过小：' + value);
      if (key === 'row sep') diagram.rowGap = gap;
      else diagram.columnGap = gap;
    } else throw new Error('暂不支持的交换图选项：' + field);
  }
  const rows = splitTopLevel(text.slice(options?.end ?? opening[0].length, closing.index), ['\\\\']);
  if (rows.length > 1 && !rows[rows.length - 1]?.trim()) rows.pop();
  for (const [row, line] of rows.entries()) {
    const cells = splitTopLevel(line, separators);
    diagram.cells.push(cells.map((cell, column) => {
      const tokens = /\\(?:arrow|ar)(?![A-Za-z])/g;
      let body = '';
      let cursor = 0;
      for (let match = tokens.exec(cell); match; match = tokens.exec(cell)) {
        body += cell.slice(cursor, match.index);
        const args = argument(cell, tokens.lastIndex, '[');
        const direction = argument(cell, args?.end ?? tokens.lastIndex, '{');
        const label = direction && argument(cell, direction.end, '{');
        diagram.arrows.push(parseArrow(args?.value ?? '', { row, column }, direction?.value, label?.value));
        cursor = label?.end ?? direction?.end ?? args?.end ?? tokens.lastIndex;
        tokens.lastIndex = cursor;
      }
      return (body + cell.slice(cursor)).trim().replace(/^\$([\s\S]*)\$$/, '$1');
    }));
  }
  const columns = Math.max(0, ...diagram.cells.map((row) => row.length));
  if (rows.length > 30 || columns > 30 || diagram.arrows.length > 250) throw new Error('交换图超过可预览的行列或箭头数量');
  if (!diagram.cells.some((row) => row.some(Boolean))) throw new Error('交换图没有可显示的节点');
  for (const { from, to } of diagram.arrows) {
    if ([from, to].some((point) => point.row < 0 || point.column < 0 || point.row >= rows.length || point.column >= columns)) {
      throw new Error('箭头端点超出矩阵：' + (from.row + 1) + '-' + (from.column + 1) + ' → ' + (to.row + 1) + '-' + (to.column + 1));
    }
    if (from.row === to.row && from.column === to.column) throw new Error('暂不支持连接同一节点的环形箭头');
  }
  return diagram;
}
