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
  return call("crear_brochure", payload);
}
export async function editarBrochure(data) {
  const payload = { ...data };
  if (payload.url) payload.url = normalizeDropbox(payload.url).url;
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
