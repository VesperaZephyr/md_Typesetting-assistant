export interface Enumeration {
  start: number;
  label?: string;
  ref?: string;
}

// Braces can protect square brackets and commas inside an enumitem label.
export const BRACKET_ARGUMENT = /\[(?:[^\]{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\]/;

function splitOptions(text: string): string[] {
  const options: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') i++;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      options.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...options, text.slice(start).trim()];
}

const SHORT_COUNTERS: Record<string, string> = { '1': 'arabic', a: 'alph', A: 'Alph', i: 'roman', I: 'Roman' };

export function readEnumeration(options = '', defaults: Partial<Enumeration> = {},
  warn?: (message: string) => void): Enumeration {
  const format = options.slice(1, -1).trim();
  const result: Enumeration = { start: 1, ...defaults };
  const shorthand = /^([（(]?)([1aAiI])([）).．:：]?)$/.exec(format);
  if (shorthand) {
    const counter = '\\' + SHORT_COUNTERS[shorthand[2]!] + '*';
    return { ...result, label: shorthand[1] + counter + shorthand[3], ref: counter };
  }
  for (const entry of splitOptions(format)) {
    if (!entry) continue;
    const match = /^(label|ref|start)\s*=\s*(.*)$/s.exec(entry);
    if (!match) {
      if (/^(?:resume\*?|series|label\*|ref\*|start\*|(?:label|ref|start)\b)/.test(entry)) {
        warn?.('暂不支持的编号选项：' + entry);
      }
      continue;
    }
    let value = match[2]!.trim();
    if (value.startsWith('{') && value.endsWith('}')) value = value.slice(1, -1);
    if (match[1] === 'start') {
      if (/^\d{1,8}$/.test(value) && Number(value) > 0) result.start = Number(value);
      else warn?.('无法解析起始编号：' + value);
    } else if (match[1] === 'label') result.label = value;
    else result.ref = value;
  }
  return result;
}

const ROMAN_DIGITS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'],
  [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
] as const;

function formatCounter(kind: string, value: number): string {
  if (/^alph$/i.test(kind) && value >= 1 && value <= 26) {
    return String.fromCharCode((kind === 'Alph' ? 64 : 96) + value);
  }
  if (/^roman$/i.test(kind) && value >= 1 && value <= 3999) {
    let text = '';
    for (const [number, symbol] of ROMAN_DIGITS) {
      const count = Math.floor(value / number);
      text += symbol.repeat(count);
      value %= number;
    }
    return kind === 'Roman' ? text : text.toLowerCase();
  }
  return String(value);
}

export function formatEnumeration(format: string, value: number, parents: number[] = []): string {
  const counters = [...parents, value];
  const names = ['enumi', 'enumii', 'enumiii', 'enumiv'];
  return format.replace(
    /\\(arabic|roman|Roman|alph|Alph)(?:\*|\{(\*|enumi{1,3}|enumiv)\})/g,
    (original, kind: string, name: string | undefined) => {
      const counter = !name || name === '*' ? value : counters[names.indexOf(name)];
      return counter === undefined ? original : formatCounter(kind, counter);
    },
  );
}
