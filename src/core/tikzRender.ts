import { escapeAttr } from './exporters';
import { renderTexToSvg, svgExToPx } from './mathRender';
import { parseTikzDiagram, type DiagramArrow, type DiagramLabel } from './tikzcd';

interface Point { x: number; y: number }
interface Size { width: number; height: number }
interface Glyph extends Size { svg: SVGSVGElement }

const origin: Point = { x: 0, y: 0 };
const add = (a: Point, b: Point, factor = 1): Point => ({ x: a.x + b.x * factor, y: a.y + b.y * factor });
const difference = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const normal = (v: Point): Point => ({ x: v.y, y: -v.x });
const format = (v: number) => String(Number(v.toFixed(2)));
const coordinates = (p: Point) => format(p.x) + ' ' + format(p.y);

function unit(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function sizes(values: number[], gap: number): number[] {
  let offset = 0;
  return values.map((size) => {
    const center = offset + size / 2;
    offset += size + gap;
    return center;
  });
}

function clearance(size: Size, direction: Point): number {
  return Math.min(
    (size.width / 2 + 5) / Math.max(Math.abs(direction.x), 1e-9),
    (size.height / 2 + 5) / Math.max(Math.abs(direction.y), 1e-9),
  );
}

function labelSide(label: DiagramLabel, direction: Point): Point {
  switch (label.side) {
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'above': return { x: 0, y: -1 };
    case 'below': return { x: 0, y: 1 };
    case 'swap': return add(origin, normal(direction), -1);
    default: return normal(direction);
  }
}

function chevron(point: Point, direction: Point, length = 7, width = 3.5): string {
  const behind = add(point, direction, -length);
  const side = normal(direction);
  return 'M' + coordinates(add(behind, side, width)) + 'L' + coordinates(point)
    + 'L' + coordinates(add(behind, side, -width));
}

function tailPath(arrow: DiagramArrow, point: Point, direction: Point): string {
  const side = normal(direction);
  switch (arrow.tail) {
    case 'bar': return 'M' + coordinates(add(point, side, 5)) + 'L' + coordinates(add(point, side, -5));
    case 'arrow': return chevron(point, add(origin, direction, -1));
    case 'fork': return chevron(add(point, direction, 5), direction, 5, 4);
    case 'hook':
    case 'hook reversed': {
      const shift = arrow.tail === 'hook' ? 1 : -1;
      return 'M' + coordinates(add(add(point, direction, 1), side, shift * 6))
        + 'C' + [add(add(point, direction, -8), side, shift * 7),
          add(point, direction, -8), point].map(coordinates).join(' ');
    }
    default: return '';
  }
}

/** Allocate grid space using the rendered sizes of the TeX nodes and labels. */
export function renderTikzDiagram(source: string, preamble: string, ink: string, paper: string): string {
  const diagram = parseTikzDiagram(source);
  const glyphs = new Map<string, Glyph>();
  function glyph(tex: string, scale = 1): Glyph {
    const key = scale + ':' + tex;
    const cached = glyphs.get(key);
    if (cached) return cached;
    const rendered = svgExToPx(renderTexToSvg(tex, false, preamble));
    const template = document.createElement('template');
    template.innerHTML = rendered.svg;
    const svg = template.content.firstElementChild as SVGSVGElement;
    if (svg.querySelector('[data-mml-node="merror"]')) throw new Error('无法排版节点或标签：' + tex.slice(0, 60));
    svg.removeAttribute('style');
    // Formula links are unnecessary inside diagrams copied to other editors.
    for (const link of svg.querySelectorAll('a')) link.replaceWith(...Array.from(link.childNodes));
    const result = { svg, width: rendered.width * scale, height: rendered.height * scale };
    glyphs.set(key, result);
    return result;
  }

  const cells = diagram.cells.map((row) => row.map((tex) => tex ? glyph(tex) : null));
  const widthByColumn = Array.from({ length: Math.max(...cells.map((row) => row.length)) },
    (_, index) => Math.max(12, ...cells.map((row) => row[index]?.width ?? 0)));
  const heightByRow = cells.map((row) => Math.max(12, ...row.map((cell) => cell?.height ?? 0)));
  let columnGap = diagram.columnGap;
  let rowGap = diagram.rowGap;
  for (const arrow of diagram.arrows) for (const label of arrow.labels) {
    if (!label.tex) continue;
    const size = glyph(label.tex, 0.84);
    if (arrow.from.row === arrow.to.row) columnGap = Math.max(columnGap, size.width + 20);
    if (arrow.from.column === arrow.to.column) rowGap = Math.max(rowGap, size.height + 20);
  }
  const columns = sizes(widthByColumn, columnGap);
  const rows = sizes(heightByRow, rowGap);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const paths: string[] = [];
  const nodes: string[] = [];
  const labels: string[] = [];

  function include(point: Point, width = 0, height = 0) {
    minX = Math.min(minX, point.x - width / 2);
    minY = Math.min(minY, point.y - height / 2);
    maxX = Math.max(maxX, point.x + width / 2);
    maxY = Math.max(maxY, point.y + height / 2);
  }

  function place(token: Glyph, point: Point): string {
    include(point, token.width, token.height);
    const svg = token.svg.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('width', format(token.width));
    svg.setAttribute('height', format(token.height));
    svg.setAttribute('x', format(point.x - token.width / 2));
    svg.setAttribute('y', format(point.y - token.height / 2));
    return svg.outerHTML;
  }

  for (const [row, values] of cells.entries()) for (const [column, cell] of values.entries()) {
    if (cell) nodes.push(place(cell, { x: columns[column]!, y: rows[row]! }));
  }
  for (const arrow of diagram.arrows) {
    const from = { x: columns[arrow.from.column]!, y: rows[arrow.from.row]! };
    const to = { x: columns[arrow.to.column]!, y: rows[arrow.to.row]! };
    const differenceVector = difference(to, from);
    const direction = unit(differenceVector);
    const side = normal(direction);
    const shiftedFrom = add(from, side, arrow.shift);
    const shiftedTo = add(to, side, arrow.shift);
    const bend = Math.hypot(differenceVector.x, differenceVector.y) * Math.tan(arrow.bend * Math.PI / 180) * 0.5;
    const control = add(add(shiftedFrom, differenceVector, 0.5), side, bend);
    const startDirection = unit(difference(control, shiftedFrom));
    const endDirection = unit(difference(shiftedTo, control));
    const start = add(shiftedFrom, startDirection, clearance(cells[arrow.from.row]?.[arrow.from.column] ?? { width: 0, height: 0 }, startDirection));
    const end = add(shiftedTo, endDirection, -clearance(cells[arrow.to.row]?.[arrow.to.column] ?? { width: 0, height: 0 }, endDirection));
    include(start, 16, 16);
    include(end, 16, 16);
    include(control, 6, 6);

    if (arrow.line !== 'invisible') {
      const drawPath = (offset: number) => 'M' + coordinates(add(start, side, offset))
        + 'Q' + coordinates(add(control, side, offset)) + ' ' + coordinates(add(end, side, offset));
      const dash = arrow.line === 'dash' ? ' stroke-dasharray="5 3"' : arrow.line === 'dot' ? ' stroke-dasharray="1 3"' : '';
      paths.push('<path d="' + (arrow.line === 'double' ? drawPath(-1.65) + drawPath(1.65) : drawPath(0)) + '"' + dash + '/>');
      if (arrow.head !== 'none') {
        const length = arrow.line === 'double' ? 9 : 7;
        const width = arrow.line === 'double' ? 5 : 3.5;
        paths.push('<path d="' + chevron(end, endDirection, length, width) + '"/>');
        if (arrow.head === 'double') paths.push('<path d="' + chevron(add(end, endDirection, -4), endDirection) + '"/>');
      }
      const tail = tailPath(arrow, start, startDirection);
      if (tail) paths.push('<path d="' + tail + '"/>');
    }

    for (const label of arrow.labels) {
      if (!label.tex) continue;
      const token = glyph(label.tex, 0.84);
      const t = label.position;
      const onCurve = add(add(add(origin, start, (1 - t) ** 2), control, 2 * t * (1 - t)), end, t ** 2);
      if (label.centered) {
        if (arrow.line !== 'invisible') {
          labels.push('<rect x="' + format(onCurve.x - token.width / 2 - 2) + '" y="'
            + format(onCurve.y - token.height / 2 - 2) + '" width="' + format(token.width + 4)
            + '" height="' + format(token.height + 4) + '" fill="' + escapeAttr(paper) + '"/>');
        }
        labels.push(place(token, onCurve));
        continue;
      }
      const tangent = unit(add(add(origin, difference(control, start), 1 - t), difference(end, control), t));
      const offset = labelSide(label, tangent);
      const gap = Math.abs(offset.x) * token.width / 2 + Math.abs(offset.y) * token.height / 2 + 5;
      labels.push(place(token, add(onCurve, offset, gap)));
    }
  }
  const width = Math.ceil(maxX - minX + 12);
  const height = Math.ceil(maxY - minY + 12);
  if (width > 2800 || height > 2800 || width * height > 1_800_000) throw new Error('交换图尺寸过大');
  return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="交换图" color="' + escapeAttr(ink)
    + '" width="' + width + '" height="' + height + '" viewBox="' + format(minX - 6) + ' ' + format(minY - 6)
    + ' ' + width + ' ' + height + '"><g fill="none" stroke="currentColor" stroke-width="1.4" '
    + 'stroke-linecap="round" stroke-linejoin="round">' + paths.join('') + '</g>'
    + nodes.join('') + labels.join('') + '</svg>';
}
