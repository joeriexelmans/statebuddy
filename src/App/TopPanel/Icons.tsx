
export function RountangleIcon(props: { kind: string; }) {
  return <svg width={20} height={20}>
    <rect rx={7} ry={7}
      x={1} y={1}
      width={18} height={18}
      className={`rountangle ${props.kind}`}
      style={{ ...(props.kind === "or" ? { strokeDasharray: '3 2' } : {}), strokeWidth: 1.2 }} />
  </svg>;
}

export function PseudoStateIcon(props: {}) {
  const w = 20, h = 20;
  return <svg width={w} height={h}>
    <polygon
      points={`
        ${w / 2} ${1},
        ${w - 1} ${h / 2},
        ${w / 2} ${h - 1},
        ${1}   ${h / 2},
      `} fill="white" stroke="black" strokeWidth={1.2} />
  </svg>;
}

export function HistoryIcon(props: { kind: "shallow" | "deep"; }) {
  const w = 20, h = 20;
  const text = props.kind === "shallow" ? "H" : "H*";
  return <svg width={w} height={h}><circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 1} fill="white" stroke="black" /><text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={400}>{text}</text></svg>;
}
