import { useMemo } from "react";

// Renderiza el formato de WhatsApp tal como lo ve el asesor en el teléfono:
//   *texto*  -> negrita        _texto_  -> cursiva
//   ~texto~  -> tachado        `texto`  -> monoespacio
// Los marcadores deben pegar al texto (no *espacio) y estar en frontera de palabra
// (así una URL con guiones bajos como archivo_final no se vuelve cursiva).
const RULES = [
  { re: /(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/, tag: "strong" },
  { re: /(?<![\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])/, tag: "em" },
  { re: /(?<![\w~])~(?=\S)([^~\n]+?)(?<=\S)~(?![\w~])/, tag: "s" },
  { re: /(?<![\w`])`(?=\S)([^`\n]+?)(?<=\S)`(?![\w`])/, tag: "code", cls: "rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em]" },
];

function toNodes(text) {
  let k = 0;
  const walk = (t) => {
    let best = null;
    for (const r of RULES) {
      const m = r.re.exec(t);
      if (m && (!best || m.index < best.m.index)) best = { r, m };
    }
    if (!best) return t ? [t] : [];
    const { r, m } = best;
    const Tag = r.tag;
    const node = (
      <Tag key={"r" + k++} className={r.cls}>
        {walk(m[1])}
      </Tag>
    );
    const before = m.index ? [t.slice(0, m.index)] : [];
    const after = walk(t.slice(m.index + m[0].length));
    return [...before, node, ...after];
  };
  return walk(String(text ?? ""));
}

// Quita los marcadores sin formatear (para vistas previas cortas en la lista).
export function stripFormato(text) {
  return String(text ?? "").replace(
    /(?<![\w*_~`])([*_~`])(?=\S)(.+?)(?<=\S)\1(?![\w*_~`])/g,
    "$2"
  );
}

export default function RichText({ text, className }) {
  const nodes = useMemo(() => toNodes(text), [text]);
  return <p className={className}>{nodes}</p>;
}
