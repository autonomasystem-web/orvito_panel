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

/* ----------------- Conversaciones (proxy Chatwoot vía gateway) ----------------- */
export async function listarConversaciones({ status = "all", page = 1 } = {}) {
  const r = await call("listar_conversaciones", { status, page });
  return {
    conversaciones: Array.isArray(r.conversaciones) ? r.conversaciones : [],
    pagina: Number(r.pagina) || page,
    hayMas: Boolean(r.hay_mas),
  };
}
export async function verConversacion(id) {
  const r = await call("ver_conversacion", { id });
  return {
    conversacion: r.conversacion || null,
    mensajes: Array.isArray(r.mensajes) ? r.mensajes : [],
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
  return Array.isArray(r.documentos) ? r.documentos : [];
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
    config: r.config || { materiales_activos: 0, promos_vigentes: 0 },
    parcial: Boolean(r.parcial),
  };
}
