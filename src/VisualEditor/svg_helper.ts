import { Rect2D } from "./geometry";

// author: ChatGPT
export function getBBoxInSvgCoords(el: SVGGraphicsElement, svg: SVGSVGElement): Rect2D {
  const b = el.getBBox();
  const m = el.getCTM()!;
  const toSvg = (x: number, y: number) => {
    const p = svg.createSVGPoint();
    p.x = x; p.y = y;
    return p.matrixTransform(m);
  };
  const pts = [
    toSvg(b.x, b.y),
    toSvg(b.x + b.width, b.y),
    toSvg(b.x, b.y + b.height),
    toSvg(b.x + b.width, b.y + b.height)
  ];
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  return {
    topLeft: {
      x: Math.min(...xs),
      y: Math.min(...ys),
    },
    size: {
      x: Math.max(...xs) - Math.min(...xs),
      y: Math.max(...ys) - Math.min(...ys),
    },
  };
}
