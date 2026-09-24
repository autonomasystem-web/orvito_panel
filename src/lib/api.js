import { supabase } from "./supabase.js";
import { normalizeDropbox } from "./format.js";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

// Error con mensaje humano para el toast (nunca stack traces al usuario)
export class ApiError extends Error {
  constructor(message, kind = "generic") {
    super(message);
    this.kind = kind;
  }
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

// Dispara el sync de avatares (toma asesores nuevos / primeras fotos sin esperar el cron de 3h).
// Fire-and-forget: no bloquea la UI y se auto-limita a 1 vez cada 5 min por navegador.
// Va por el gateway (que ya valida la sesión) en vez de llamar al webhook directo:
// así el webhook puede exigir llave de servicio sin que ésta llegue al navegador.
export function dispararSyncAvatares() {
  try {
    if (!GATEWAY_URL) return;
    const last = Number(localStorage.getItem("orvito_avatar_sync") || 0);
    if (Date.now() - last < 5 * 60 * 1000) return; // throttle 5 min
    localStorage.setItem("orvito_avatar_sync", String(Date.now()));
    call("sync_avatares").catch(() => {});
  } catch {
    /* silencioso: es una mejora opcional, nunca debe romper la carga */
  }
}

// Cliente central. 1 reintento SOLO en errores de red.
async function call(accion, data = {}, _retried = false) {
  if (!GATEWAY_URL) {
    throw new ApiError("Falta configurar la URL del servidor (VITE_GATEWAY_URL).", "config");
  }
  const token = await getToken();

  let res;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ accion, data }),
    });
  } catch (netErr) {
    if (!_retried) return call(accion, data, true); // 1 reintento en red
    throw new ApiError("No pudimos conectar con el servidor. Revisa tu conexión.", "network");
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError("Tu sesión expiró. Vuelve a iniciar sesión.", "auth");
  }
  if (res.status >= 500) {
    throw new ApiError("El servidor tuvo un problema. Intenta de nuevo en un momento.", "server");
  }

  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("El servidor respondió en un formato inesperado.", "parse");
  }

  if (!res.ok || body?.ok === false || body?.error) {
    throw new ApiError(body?.error || "No se pudo completar la acción.", "app");
  }
  return body;
}

/* ----------------- Brochures / Materiales ----------------- */
export async function listarBrochures() {
  const r = await call("listar_brochures", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearBrochure(data) {
  const payload = { ...data };
  if (payload.url) payload.url = normalizeDropbox(payload.url).url; // guarda ya normalizada
  if (payload.url_en) payload.url_en = normalizeDropbox(payload.url_en).url;
  return call("crear_brochure", payload);
}
export async function editarBrochure(data) {
  const payload = { ...data };
  if (payload.url) payload.url = normalizeDropbox(payload.url).url;
  if (payload.url_en) payload.url_en = normalizeDropbox(payload.url_en).url;
  return call("editar_brochure", payload);
}
export async function eliminarBrochure(Id) {
  return call("eliminar_brochure", { Id });
}

/* ----------------- Promociones ----------------- */
export async function listarPromociones() {
  const r = await call("listar_promociones", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearPromocion(data) {
  return call("crear_promocion", data);
}
export async function editarPromocion(data) {
  return call("editar_promocion", data);
}
export async function eliminarPromocion(Id) {
  return call("eliminar_promocion", { Id });
}

// Lista de proyectos para el multiselect de promociones (de los brochures activos).
export function proyectosDesdeBrochures(brochures) {
  return [...new Set((brochures || []).map((b) => b.proyecto).filter(Boolean))];
}

/* ----------------- Lotes (inventario) ----------------- */
export async function listarLotes() {
  const r = await call("listar_lotes", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearLote(data) {
  return call("crear_lote", data);
}
export async function editarLote(data) {
  return call("editar_lote", data);
}
export async function eliminarLote(Id) {
  return call("eliminar_lote", { Id });
}

/* ----------------- Blogs (tendencias) ----------------- */
export async function listarBlogs() {
  const r = await call("listar_blogs", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearBlog(data) {
  return call("crear_blog", data);
}
export async function editarBlog(data) {
  return call("editar_blog", data);
}
export async function eliminarBlog(Id) {
  return call("eliminar_blog", { Id });
}

/* ----------------- Entregas (fechas de entrega por proyecto) ----------------- */
export async function listarEntregas() {
  const r = await call("listar_entregas", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearEntrega(data) {
  return call("crear_entrega", data);
}
export async function editarEntrega(data) {
  return call("editar_entrega", data);
}
export async function eliminarEntrega(Id) {
  return call("eliminar_entrega", { Id });
}

/* ----------------- Temas / Alcance de Orvito (solo admin) ----------------- */
// Temas que Orvito reconoce y busca en el RAG. Editar aquí actualiza el alcance
// del agente en vivo (se inyecta al system prompt). Escritura protegida en el gateway.
export async function listarTemas() {
  const r = await call("listar_temas", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearTema(data) {
  return call("crear_tema", data);
}
export async function editarTema(data) {
  return call("editar_tema", data);
}
export async function eliminarTema(Id) {
  return call("eliminar_tema", { Id });
}

/* ----------------- Stickers de Orvito (solo admin) ----------------- */
// Los stickers que Orvito puede mandar por WhatsApp. Lo que se da de alta aquí es lo
// único que el agente ve: la lista viaja a su prompt, así que no puede inventarse un
// marcador que no exista. El archivo se manda en base64 y el gateway lo valida y lo
// guarda en el bucket propio (antes vivían en Dropbox, escritos dentro del workflow).
export async function listarStickers() {
  const r = await call("listar_stickers", {});
  return Array.isArray(r.list) ? r.list : [];
}
export async function crearSticker(data) {
  return call("crear_sticker", data);
}
export async function editarSticker(data) {
  return call("editar_sticker", data);
}
export async function eliminarSticker(Id) {
  return call("eliminar_sticker", { Id });
}

/**
 * Comprueba el archivo ANTES de subirlo, para poder decir qué está mal sin esperar al
 * servidor. WhatsApp solo manda como sticker un WebP de 512x512 de hasta 100 KB
 * (fijo) o 500 KB (animado); cualquier otra cosa se envía... o no se envía, y el
 * asesor nunca ve nada. El gateway repite esta revisión: esto es comodidad, no la
 * defensa.
 */
export async function revisarSticker(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const txt = (i, n) => String.fromCharCode(...buf.slice(i, i + n));
  if (buf.length < 16 || txt(0, 4) !== "RIFF" || txt(8, 12 - 8) !== "WEBP") {
    return { ok: false, error: "El archivo no es .webp. WhatsApp solo acepta stickers en WebP (un PNG o JPG no sirve)." };
  }
  const animado = txt(0, Math.min(buf.length, 8192)).includes("ANMF");
  const kb = Math.round(file.size / 1024);
  const limite = animado ? 500 : 100;
  const dim = await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
  if (dim.w !== 512 || dim.h !== 512) {
    return { ok: false, error: `Mide ${dim.w}x${dim.h} px y debe medir exactamente 512x512.` };
  }
  if (kb > limite) {
    return { ok: false, error: `Pesa ${kb} KB y el máximo para un sticker ${animado ? "animado" : "fijo"} es ${limite} KB.` };
  }
  const b64 = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || "").split(",")[1] || "");
    fr.readAsDataURL(file);
  });
  return { ok: true, animado, kb, ancho: dim.w, alto: dim.h, archivo_b64: b64 };
}

/* ----------------- Conversaciones (proxy Chatwoot vía gateway) ----------------- */
// `porPagina` chico = la lista aparece rápido. El gateway sólo baja de Chatwoot las
// páginas que hagan falta para llenar esa página y sólo resuelve en el CRM a esa
// gente; antes bajaba las ~17 páginas y resolvía 500 personas antes de pintar nada.
export async function listarConversaciones({ status = "all", page = 1, porPagina } = {}) {
  const data = { status, page };
  if (porPagina) data.por_pagina = porPagina;
  const r = await call("listar_conversaciones", data);
  return {
    conversaciones: Array.isArray(r.conversaciones) ? r.conversaciones : [],
    pagina: Number(r.pagina) || page,
    hayMas: Boolean(r.hay_mas),
  };
}
// Conteo total de usuarios (total/internos/externos) calculado por el gateway
// en UNA sola llamada (rápido) en vez de recorrer todas las páginas desde el navegador.
export async function conteoConversaciones(status = "all") {
  const r = await call("conteo_conversaciones", { status });
  return {
    total: Number(r.total) || 0,
    internos: Number(r.internos) || 0,
    externos: Number(r.externos) || 0,
  };
}
// `soloRecientes` trae solo la última página (20 mensajes) en vez de paginar todo el
// historial. Es lo que usa el auto-refresco del chat: bajar cientos de mensajes cada
// 10 s hacía que el hilo se actualizara DESPUÉS que la lista. Devuelve `parcial: true`
// para que quien llame sepa que debe fusionar, no reemplazar.
export async function verConversacion(id, { soloRecientes = false } = {}) {
  const r = await call("ver_conversacion", { id, solo_recientes: soloRecientes });
  return {
    conversacion: r.conversacion || null,
    mensajes: Array.isArray(r.mensajes) ? r.mensajes : [],
    parcial: r.parcial === true,
  };
}
// Fuerza una consulta EN VIVO al CRM para este contacto (1 llamada) y actualiza su caché.
// Útil cuando alguien acaba de verificar su número y quieres verlo al instante.
export async function refrescarCrm(telefono, contacto) {
  return call("refrescar_crm", { telefono, contacto });
}

// ¿Orvito está trabajando AHORA para este asesor, y en qué? Sale de los marcadores que
// cada herramienta escribe al empezar (n8n no expone el avance de una ejecución en curso).
// Nunca lanza: si falla, se comporta como "no está haciendo nada" y el chat sigue igual.
export async function actividadOrvito(telefono) {
  try {
    const r = await call("actividad_orvito", { telefono });
    if (!r || r.activo !== true) return { activo: false };
    return { activo: true, herramienta: r.herramienta || "Consultando", haceS: Number(r.hace_s) || 0 };
  } catch {
    return { activo: false };
  }
}

// Qué hizo Orvito para producir un mensaje: qué herramientas consultó, en qué orden,
// cuánto tardó cada una y cómo acabó. Sale de la ejecución de n8n (que ya lo guarda
// todo), saneado en el gateway: nunca trae ids, correos ni teléfonos.
// Si la traza no está disponible (p.ej. la API key de n8n caducó) devuelve
// { sinTraza: true }: el chat sigue funcionando igual, sólo no se puede desplegar.
export async function trazaConversacion(telefono, cuando) {
  let r;
  try {
    r = await call("traza_conversacion", { telefono, cuando });
  } catch (e) {
    // `call` convierte en excepción cualquier respuesta con ok:false o error. Aquí eso
    // tapaba el motivo real y siempre se veía el mismo mensaje genérico: se rescata.
    return { sinTraza: true, motivo: e?.message || "No pudimos leer el proceso de este mensaje." };
  }
  if (!r || r.sin_traza === true || !Array.isArray(r.pasos)) {
    return { sinTraza: true, motivo: (r && (r.motivo || r.error)) || "No encontramos el proceso de este mensaje." };
  }
  return {
    sinTraza: false,
    ejecucion: r.ejecucion || "",
    duracion: Number(r.duracion_s) || 0,
    herramientas: Number(r.herramientas) || 0,
    pasos: Array.isArray(r.pasos) ? r.pasos : [],
  };
}

/* ----------------- Estado de Orvito (encendido / mantenimiento) ----------------- */
export async function obtenerConfig() {
  const r = await call("obtener_config", {});
  return {
    agenteActivo: Boolean(r.agente_activo),
    mensajeMantenimiento: r.mensaje_mantenimiento || "",
  };
}
export async function setAgenteActivo(activo) {
  return call("set_agente_activo", { activo });
}

/* ----------------- Alertas / Guardian (fallos de Orvito) ----------------- */
export async function listarAlertas() {
  const r = await call("listar_alertas", {});
  return Array.isArray(r.alertas) ? r.alertas : [];
}
export async function resolverAlertas(ids) {
  // sin ids = descarta todas las no resueltas
  return call("resolver_alertas", ids && ids.length ? { ids } : {});
}
export async function cambiarEstadoConversacion(id, status) {
  return call("cambiar_estado_conversacion", { id, status });
}
export async function marcarLeidaConversacion(id) {
  return call("marcar_leida_conversacion", { id });
}

/* ----------------- Resúmenes IA ----------------- */
export async function listarResumenes({ fecha, categoria, page = 1 } = {}) {
  const data = { page };
  if (fecha) data.fecha = fecha;
  if (categoria) data.categoria = categoria;
  const r = await call("listar_resumenes", data);
  return {
    resumenes: Array.isArray(r.resumenes) ? r.resumenes : [],
    pagina: Number(r.pagina) || page,
    hayMas: Boolean(r.hay_mas),
  };
}
export async function resumirAhora(conversationId) {
  return call("resumir_ahora", { conversation_id: conversationId });
}

/* ----------------- Base de conocimiento (documentos RAG) ----------------- */
export async function listarDocumentos() {
  const r = await call("listar_documentos", {});
  return {
    documentos: Array.isArray(r.documentos) ? r.documentos : [],
    carpetas_orden: Array.isArray(r.carpetas_orden) ? r.carpetas_orden : [],
  };
}
/* Carpetas de la base de conocimiento (carpeta = categoría del documento). */
export async function crearCarpeta(nombre) {
  return call("crear_carpeta", { nombre });
}
export async function renombrarCarpeta(actual, nuevo) {
  return call("renombrar_carpeta", { actual, nuevo });
}
export async function moverDocumento(nombre_doc, categoria) {
  return call("mover_documento", { nombre_doc, categoria });
}
export async function eliminarCarpeta(nombre, mover_a) {
  return call("eliminar_carpeta", { nombre, mover_a: mover_a || "" });
}
export async function guardarOrdenCarpetas(orden) {
  return call("guardar_orden_carpetas", { orden });
}
export async function verDocumento(nombre) {
  const r = await call("ver_documento", { nombre });
  return {
    nombre_doc: r.nombre_doc || nombre,
    titulo: r.titulo || nombre,
    categoria: r.categoria || "",
    contenido_md: r.contenido_md || "",
    total_chunks: Number(r.total_chunks) || 0,
  };
}
export async function guardarDocumento(nombre, contenido) {
  return call("guardar_documento", { nombre, contenido });
}
export async function eliminarDocumento(nombre) {
  return call("eliminar_documento", { nombre });
}

/* ----------------- Dashboard (métricas agregadas) ----------------- */
export async function dashboardMetricas(rango = "7d") {
  const r = await call("dashboard_metricas", { rango });
  return {
    periodo: r.periodo || { desde: "", hasta: "", rango },
    kpis: r.kpis || {},
    serie_diaria: Array.isArray(r.serie_diaria) ? r.serie_diaria : [],
    proyectos_top: Array.isArray(r.proyectos_top) ? r.proyectos_top : [],
    categorias: Array.isArray(r.categorias) ? r.categorias : [],
    horas_pico: Array.isArray(r.horas_pico) ? r.horas_pico : [],
    gaps: Array.isArray(r.gaps) ? r.gaps : [],
    esfuerzos: Array.isArray(r.esfuerzos) ? r.esfuerzos : [],
    config: r.config || { materiales_activos: 0, promos_vigentes: 0 },
    parcial: Boolean(r.parcial),
  };
}

/* ----------------- Adopción por esfuerzo (E1–E5, editable — admin) ----------------- */
export async function listarEsfuerzos() {
  const r = await call("listar_esfuerzos", {});
  return Array.isArray(r.esfuerzos) ? r.esfuerzos : [];
}
export async function guardarEsfuerzos(items) {
  const r = await call("guardar_esfuerzos", { items });
  return Array.isArray(r.esfuerzos) ? r.esfuerzos : [];
}
