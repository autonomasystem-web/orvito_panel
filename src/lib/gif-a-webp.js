/**
 * Convertir un GIF en un sticker animado de WhatsApp.
 *
 * WhatsApp NO tiene mensajes de tipo GIF: su API solo acepta JPEG/PNG como imagen,
 * MP4 como video y WebP como sticker. Un GIF tal cual es rechazado. Lo que la gente
 * llama "mandar un gif" por WhatsApp es, en realidad, un sticker animado: un WebP
 * animado de 512x512 que no pase de 500 KB.
 *
 * Aquí se hace esa conversión en el propio navegador, sin librerías:
 *   1. `ImageDecoder` (WebCodecs) saca los fotogramas del GIF con su duración.
 *   2. Cada fotograma se dibuja centrado en un lienzo de 512x512 y el navegador lo
 *      codifica como WebP — eso sí sabe hacerlo de forma nativa.
 *   3. Esos WebP sueltos se ensamblan en un contenedor WebP animado (VP8X + ANIM +
 *      un ANMF por fotograma). Es armado binario, no codificación: los fotogramas ya
 *      vienen comprimidos por el navegador.
 *   4. Si el resultado pasa de 500 KB se reintenta con menos calidad y menos
 *      fotogramas, hasta que entre.
 */

const LADO = 512;
const LIMITE_KB = 500;

/* ---------- utilidades del contenedor RIFF ---------- */

function chunk(fourcc, payload) {
  const impar = payload.length % 2;
  const out = new Uint8Array(8 + payload.length + impar);
  for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out; // el byte de relleno queda en 0
}

function u24(v) {
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
}

/** Devuelve los trozos de imagen (ALPH / VP8 / VP8L) de un WebP estático. */
function trozosDeFotograma(buf) {
  const b = new Uint8Array(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (txt(0, 4) !== "RIFF" || txt(8, 4) !== "WEBP") return null;
  // simple: el cuerpo es directamente VP8 o VP8L
  const fmt = txt(12, 4);
  if (fmt === "VP8 " || fmt === "VP8L") return b.slice(12);
  // extendido: hay que recoger ALPH (si viene) y el trozo de imagen
  if (fmt !== "VP8X") return null;
  let p = 12;
  const partes = [];
  while (p + 8 <= b.length) {
    const cc = txt(p, 4);
    const len = dv.getUint32(p + 4, true);
    const fin = p + 8 + len + (len % 2);
    if (cc === "ALPH" || cc === "VP8 " || cc === "VP8L") partes.push(b.slice(p, p + 8 + len + (len % 2)));
    p = fin;
  }
  if (!partes.length) return null;
  const total = partes.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const x of partes) { out.set(x, o); o += x.length; }
  return out;
}

/** Junta los fotogramas ya codificados en un WebP animado. */
function ensamblar(fotogramas, ancho, alto) {
  // VP8X: animación (0x02) + alfa (0x10)
  const vp8x = new Uint8Array([0x12, 0, 0, 0, ...u24(ancho - 1), ...u24(alto - 1)]);
  // ANIM: fondo transparente + bucle infinito
  const anim = new Uint8Array([0, 0, 0, 0, 0, 0]);
  const trozos = [chunk("VP8X", vp8x), chunk("ANIM", anim)];
  for (const f of fotogramas) {
    const cab = new Uint8Array([
      ...u24(0), ...u24(0),                 // posición
      ...u24(ancho - 1), ...u24(alto - 1),  // tamaño
      ...u24(Math.max(10, f.ms)),           // duración
      0x00,                                 // mezcla normal, sin descartar
    ]);
    const cuerpo = new Uint8Array(cab.length + f.datos.length);
    cuerpo.set(cab, 0);
    cuerpo.set(f.datos, cab.length);
    trozos.push(chunk("ANMF", cuerpo));
  }
  const cuerpoTotal = trozos.reduce((s, x) => s + x.length, 0) + 4; // +4 por 'WEBP'
  const out = new Uint8Array(8 + cuerpoTotal);
  const dv = new DataView(out.buffer);
  out.set([82, 73, 70, 70], 0);          // RIFF
  dv.setUint32(4, cuerpoTotal, true);
  out.set([87, 69, 66, 80], 8);          // WEBP
  let o = 12;
  for (const t of trozos) { out.set(t, o); o += t.length; }
  return out;
}

/* ---------- conversión ---------- */

async function fotogramasDelGif(file) {
  if (typeof window.ImageDecoder !== "function") {
    throw new Error("Tu navegador no puede leer GIFs aquí. Usa Chrome o Edge actualizado.");
  }
  const dec = new window.ImageDecoder({ data: await file.arrayBuffer(), type: "image/gif" });
  // Las dos esperas hacen falta: `completed` es que llegaron los datos y
  // `tracks.ready` que ya se leyo la pista. Sin la segunda, frameCount vale 1 y el
  // GIF sale congelado en su primer fotograma.
  await dec.tracks.ready;
  await dec.completed;
  const total = dec.tracks.selectedTrack?.frameCount || 1;
  const salida = [];
  for (let i = 0; i < total; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    // la duración viene en microsegundos; si falta, 100 ms es lo típico de un GIF
    salida.push({ bitmap: image, ms: Math.round((image.duration || 100000) / 1000) });
  }
  return salida;
}

async function codificar(fotogramas, calidad, salto) {
  const lienzo = new OffscreenCanvas(LADO, LADO);
  const ctx = lienzo.getContext("2d", { alpha: true });
  const listos = [];
  for (let i = 0; i < fotogramas.length; i += salto) {
    const f = fotogramas[i];
    ctx.clearRect(0, 0, LADO, LADO);
    // se mantiene la proporción: el GIF se encaja dentro del cuadro, sin deformarlo
    const esc = Math.min(LADO / f.bitmap.displayWidth, LADO / f.bitmap.displayHeight);
    const w = Math.round(f.bitmap.displayWidth * esc);
    const h = Math.round(f.bitmap.displayHeight * esc);
    ctx.drawImage(f.bitmap, Math.round((LADO - w) / 2), Math.round((LADO - h) / 2), w, h);
    const blob = await lienzo.convertToBlob({ type: "image/webp", quality: calidad });
    const datos = trozosDeFotograma(await blob.arrayBuffer());
    if (!datos) throw new Error("El navegador no pudo codificar el GIF como WebP.");
    // al saltar fotogramas, el que queda dura lo que duraban los saltados
    let ms = 0;
    for (let k = i; k < Math.min(i + salto, fotogramas.length); k++) ms += fotogramas[k].ms;
    listos.push({ datos, ms: ms || 100 });
  }
  return ensamblar(listos, LADO, LADO);
}

/**
 * GIF -> WebP animado de 512x512 y <=500 KB.
 * Devuelve { blob, kb, fotogramas, calidad } o lanza un error con el motivo.
 */
export async function gifAWebpAnimado(file) {
  const fotogramas = await fotogramasDelGif(file);
  if (!fotogramas.length) throw new Error("Ese GIF no tiene fotogramas legibles.");

  // Se va apretando solo hasta que entre en el limite: primero calidad, luego
  // fotogramas. Un sticker animado de WhatsApp no pasa de 500 KB.
  const intentos = [
    { calidad: 0.8, salto: 1 },
    { calidad: 0.6, salto: 1 },
    { calidad: 0.5, salto: 2 },
    { calidad: 0.4, salto: 2 },
    { calidad: 0.35, salto: 3 },
    { calidad: 0.3, salto: 4 },
  ];
  let ultimo = null;
  for (const { calidad, salto } of intentos) {
    const bytes = await codificar(fotogramas, calidad, salto);
    const kb = Math.round(bytes.length / 1024);
    ultimo = { bytes, kb, calidad, salto };
    if (kb <= LIMITE_KB) break;
  }
  for (const f of fotogramas) f.bitmap.close?.();

  if (!ultimo || ultimo.kb > LIMITE_KB) {
    throw new Error(
      `Ese GIF no baja de ${ultimo ? ultimo.kb : "?"} KB y el máximo es ${LIMITE_KB} KB. ` +
      "Prueba con uno más corto o con menos movimiento."
    );
  }
  return {
    blob: new Blob([ultimo.bytes], { type: "image/webp" }),
    kb: ultimo.kb,
    fotogramas: Math.ceil(fotogramas.length / ultimo.salto),
    calidad: ultimo.calidad,
  };
}
