export interface SourceLocation {
  line: number;
  progress: number;
  probes: string[];
}

function plainSourceLine(text: string): string {
  return text
    .replace(/\\(?:begin|end|label|ref|eqref|autoref|cref|Cref|pageref)\*?\s*\{[^{}]*\}/g, ' ')
    .replace(/\$[^$\n]+\$|\\\([^\n]*?\\\)/g, ' ')
    .replace(/\\[a-z]+[*]?/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

export function sourceSyncMap(source: string, latex: boolean) {
  const lines = source.split('\n');
  const probes: [number, string][] = [];
  if (latex) {
    const step = Math.max(1, Math.ceil(lines.length / 4000));
    for (let i = 0; i < lines.length; i += step) {
      const plain = plainSourceLine(lines[i]!);
      if (plain.length >= 4) probes.push([i, plain.slice(0, 24)]);
    }
  }
  return { count: lines.length, probes };
}

/** Provide nearby text for formats whose conversion changes the number or order of source lines. */
export function sourceLocation(source: string, offset: number, selectionEnd = offset): SourceLocation {
  const before = source.slice(0, offset);
  const line = (before.match(/\n/g) ?? []).length;
  const lines = source.split('\n');
  const selected = source.slice(offset, Math.min(selectionEnd, offset + 300));
  const probes = new Set<string>();
  function add(text: string) {
    const plain = plainSourceLine(text);
    if (plain.length >= 4) {
      probes.add(plain.slice(0, 28));
      if (plain.length > 28) probes.add(plain.slice(-20));
    }
  }
  if (selected) add(selected);
  for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
    const nearby = lines[line + delta];
    if (nearby) add(nearby);
  }
  return { line, progress: offset / Math.max(1, source.length), probes: [...probes] };
}
