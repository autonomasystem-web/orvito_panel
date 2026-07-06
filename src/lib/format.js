// Utilidades puras (fechas, Dropbox, estado de promociones)

// --- Dropbox: descarga directa ---
// Convierte enlaces de Dropbox a descarga directa (raw=1). El agente los envía tal cual.
export function normalizeDropbox(url) {
  if (!url) return { url, changed: false };
  let out = url.trim();
  let changed = false;
  if (/[?&]dl=0/.test(out)) {
    out = out.replace(/([?&])dl=0/, "$1raw=1");
    changed = true;
  } else if (/dropbox\.com/.test(out) && !/[?&](raw=1|dl=1)/.test(out)) {
    // sin dl ni raw -> sugerir raw=1 para descarga directa
    out = out + (out.includes("?") ? "&" : "?") + "raw=1";
    changed = true;
  }
  return { url: out, changed };
}

export function isHttps(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// --- Fechas ---
export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MESES[m - 1]} ${y}`;
}
export function fmtRango(ini, fin) {
  if (!ini && !fin) return "Sin fechas";
  if (ini && fin) return `${fmtFecha(ini)} → ${fmtFecha(fin)}`;
  if (ini) return `Desde ${fmtFecha(ini)}`;
  return `Hasta ${fmtFecha(fin)}`;
}

// --- Estado de promoción (calculado en cliente) ---
// Inactiva | Programada | Vigente | Expirada
export function estadoPromo(p, hoy = todayISO()) {
  if (!truthy(p.activo)) return "Inactiva";
  const ini = p.vigencia_inicio ? String(p.vigencia_inicio).slice(0, 10) : null;
  const fin = p.vigencia_fin ? String(p.vigencia_fin).slice(0, 10) : null;
  if (ini && hoy < ini) return "Programada";
  if (fin && hoy > fin) return "Expirada";
  return "Vigente";
}

export function truthy(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

// Precio con miles y moneda (para inventario de lotes)
export function fmtPrecio(precio, moneda = "MXN") {
  const n = Number(precio);
  if (Number.isNaN(n) || precio === "" || precio == null) return "";
  const s = n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  return `$${s} ${moneda || "MXN"}`;
}
export function fmtM2(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !v) return "";
  return `${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} m²`;
}

// --- Tiempo para el chat (epoch en SEGUNDOS desde Chatwoot) ---
function toDate(epochSec) {
  const n = Number(epochSec);
  if (!n) return null;
  return new Date(n * 1000);
}
export function fmtRelativo(epochSec) {
  const d = toDate(epochSec);
  if (!d) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ayer";
  const days = Math.floor(s / 86400);
  if (days < 7) return `hace ${days} días`;
  return fmtFecha(d.toISOString());
}
const TZ = "America/Merida"; // zona de ORVE (los timestamps se agrupan en horario local, no UTC)

export function fmtHora(epochSec) {
  const d = toDate(epochSec);
  if (!d) return "";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
export function diaKey(epochSec) {
  const d = toDate(epochSec);
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD en horario de Mérida
}
export function fmtHoraISO(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function fmtDiaSeparador(epochSec) {
  const d = toDate(epochSec);
  if (!d) return "";
  const k = (x) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const kd = k(d);
  if (kd === k(new Date())) return "Hoy";
  if (kd === k(new Date(Date.now() - 86400000))) return "Ayer";
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}
