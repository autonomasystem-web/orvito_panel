import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  cx,
  useToast,
} from "../components/ui.jsx";
import { Chat, Sparkles, Refresh } from "../components/Icons.jsx";
import RichText, { stripFormato } from "../components/RichText.jsx";
import mascotaOrvito from "../assets/orvito-mascota.webp";
import { LOGO_COLOR } from "../assets/brand.js";
import {
  listarConversaciones,
  conteoConversaciones,
  verConversacion,
  cambiarEstadoConversacion,
  marcarLeidaConversacion,
  resumirAhora,
  refrescarCrm,
  dispararSyncAvatares,
  trazaConversacion,
  actividadOrvito,
} from "../lib/api.js";
import { fmtRelativo, fmtHora, fmtDiaSeparador, diaKey } from "../lib/format.js";
import { catLabel } from "./Resumenes.jsx";

const FILTROS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Con Orvito" },
  { value: "open", label: "Con agente" },
  { value: "resolved", label: "Resueltas" },
];
const TIPOS = [
  { value: "todos", label: "Todos" },
  { value: "interno", label: "Asesores / internos" },
  { value: "cliente", label: "Clientes" },
];
// Cuántas conversaciones se piden de golpe. Chico a propósito: el gateway sólo baja
// de Chatwoot las páginas que hagan falta y sólo resuelve en el CRM a esa gente, así
// que la lista aparece en cuanto hay algo que mostrar. El resto entra al bajar.
const POR_PAGINA = 25;
const ESTADO = {
  pending: { label: "Con Orvito", cls: "bg-soft text-brand-dark", dot: "bg-brand-leaf" },
  open: { label: "Con agente", cls: "bg-brand-green/10 text-brand-green", dot: "bg-brand-green" },
  resolved: { label: "Resuelta", cls: "bg-line text-muted", dot: "bg-muted2" },
};

export default function Conversaciones() {
  const toast = useToast();
  const [filtro, setFiltro] = useState("all");
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // todos | interno | cliente
  const [rolFiltro, setRolFiltro] = useState("todos"); // rol del CRM (Asesor Comercial, Coordinador…)
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sel, setSel] = useState(null); // id seleccionado
  const [mobileDetail, setMobileDetail] = useState(false);
  const [refrescandoTodos, setRefrescandoTodos] = useState(false);
  const [progTodos, setProgTodos] = useState({ done: 0, total: 0 });
  // Conteo REAL (total / internos / externos) de TODAS las páginas del filtro de estado.
  const [conteo, setConteo] = useState(null);
  const [searchParams] = useSearchParams();
  // Mientras el usuario busca/filtra, se pausan los auto-refresh de fondo
  // (12s y 30s) para que NO reinicien la lista a la página 1 y borren las
  // páginas que la búsqueda ya cargó. Ref porque el timer de 12s tiene closure
  // fijo (deps []).
  const filtrandoRef = useRef(false);
  // Cuántas páginas lleva cargadas el usuario. El auto-refresco silencioso vuelve a
  // pedir la página 1, así que sin esto le borraría lo que ya había bajado al scrollear.
  const paginaRef = useRef(1);
  // El observador del final de la lista puede dispararse varias veces seguidas;
  // este cerrojo evita pedir la misma página dos veces.
  const cargandoMasRef = useRef(false);
  const finListaRef = useRef(null);
  // El auto-refresco de la lista pisa `items` con lo que diga Chatwoot, y ahí vuelve
  // el badge de no leídos de la conversación que estás viendo. `loadList` es un
  // useCallback con deps [filtro], así que lee el seleccionado por ref.
  const selRef = useRef(null);

  // Lista canónica de roles internos del CRM (para que NO falten en el filtro
  // aunque no haya una conversación cargada de ese rol). Se unen los roles que
  // aparezcan en las conversaciones cargadas, por si el CRM agrega uno nuevo.
  const ROLES_CRM = [
    "Super Admin",
    "Director General",
    "Director EVO",
    "Director de Finanzas",
    "Director de  Mkt",
    "Gerente Ejecutivo",
    "Gerente Comercial",
    "Coordinador Comercial",
    "Asesor Comercial",
    "Asociados",
    "Eventos Marketing",
    "General",
  ];
  const rolesPresentes = items
    .filter((c) => (c.tipo || "cliente") === "interno" && c.crm_rol)
    .map((c) => c.crm_rol);
  const roles = Array.from(new Set([...ROLES_CRM, ...rolesPresentes]));

  const _norm = (s) => (s ?? "").toString().toLowerCase();
  const _q = _norm(busqueda).trim();
  const itemsVisibles = items.filter((c) => {
    if (tipoFiltro !== "todos" && (c.tipo || "cliente") !== tipoFiltro) return false;
    if (rolFiltro !== "todos" && c.crm_rol !== rolFiltro) return false;
    if (
      _q &&
      !_norm(c.nombre_mostrar).includes(_q) &&
      !_norm(c.contacto).includes(_q) &&
      !_norm(c.telefono).includes(_q)
    )
      return false;
    return true;
  });

  // ¿Seguimos cargando páginas para el filtro/búsqueda? (para el estado vacío)
  const filtrandoActivo = busqueda.trim().length >= 2 || rolFiltro !== "todos";
  const buscandoMas = filtrandoActivo && (hayMas || loadingMore);
  filtrandoRef.current = filtrandoActivo;

  // Abrir una conversación desde ?conv=ID (viene de Resúmenes IA)
  useEffect(() => {
    const c = searchParams.get("conv");
    if (c) {
      setSel(Number(c));
      setMobileDetail(true);
    }
  }, [searchParams]);

  // Al abrir una conversación: marcarla como leída (quita el badge aquí y en Chatwoot)
  useEffect(() => {
    selRef.current = sel;
    if (!sel) return;
    setItems((prev) => prev.map((c) => (c.id === sel ? { ...c, no_leidos: 0 } : c)));
    marcarLeidaConversacion(sel).catch(() => {});
  }, [sel]);

  const loadList = useCallback(
    async (opts = {}) => {
      const silent = opts.silent;
      if (!silent) setStatus("loading");
      try {
        // En el refresco silencioso se vuelven a pedir TANTAS como el usuario tuviera
        // cargadas (no sólo las primeras 25): si no, al llevar 100 bajadas se le
        // encogería la lista sola cada 30 s.
        const cuantas = silent ? Math.min(POR_PAGINA * paginaRef.current, 300) : POR_PAGINA;
        const r = await listarConversaciones({ status: filtro, page: 1, porPagina: cuantas });
        // El chat que estás viendo nunca debe salir con "no leídos": si llegaron
        // mensajes mientras lo tenías abierto, Chatwoot los siguió contando, así que
        // se vuelve a marcar como visto allá y se limpia el badge aquí.
        const abierta = selRef.current;
        let lista = r.conversaciones;
        if (abierta) {
          const c = lista.find((x) => x.id === abierta);
          if (c && c.no_leidos > 0) marcarLeidaConversacion(abierta).catch(() => {});
          lista = lista.map((x) => (x.id === abierta ? { ...x, no_leidos: 0 } : x));
        }
        setItems(lista);
        if (!silent) {
          setPagina(1);
          paginaRef.current = 1;
        }
        setHayMas(r.hayMas);
        setStatus("ready");
      } catch (e) {
        if (!silent) setStatus("error");
      }
    },
    [filtro]
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Conteo REAL de usuarios (total/internos/externos). El gateway lo calcula en UNA
  // sola llamada (recorre Chatwoot del lado servidor), así que ya no recorremos todas
  // las páginas desde el navegador. Se cachea en localStorage para pintarlo al instante
  // en la siguiente visita mientras se refresca en segundo plano.
  useEffect(() => {
    let cancel = false;
    const cacheKey = `orvito_conteo_${filtro}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      setConteo(cached && typeof cached.total === "number" ? cached : null);
    } catch {
      setConteo(null);
    }
    (async () => {
      try {
        const r = await conteoConversaciones(filtro);
        if (!cancel) {
          setConteo(r);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(r));
          } catch {
            /* localStorage lleno o bloqueado: no pasa nada */
          }
        }
      } catch {
        /* conteo silencioso: si falla, se queda con el cacheado (o vacío) */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [filtro]);

  // Al entrar al panel: dispara el sync de avatares (toma asesores nuevos sin esperar el cron).
  // Throttled a 5 min. A los 12s recarga suave: para entonces el sync ya actualizó la caché.
  useEffect(() => {
    dispararSyncAvatares();
    const t = setTimeout(() => {
      if (document.visibilityState === "visible" && !filtrandoRef.current) loadList({ silent: true });
    }, 12000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh suave cada 30s (solo pestaña visible y en página 1, para no perder scroll)
  useEffect(() => {
    const t = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        pagina === 1 &&
        !refrescandoTodos &&
        !filtrandoRef.current
      ) {
        loadList({ silent: true });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [loadList, pagina, refrescandoTodos]);

  // "Actualizar todos": recorre los chats cargados UNO POR UNO (secuencial) consultando
  // el CRM en vivo. Secuencial a propósito: el CRM tira las conexiones si le llegan en bloque.
  const actualizarTodos = async () => {
    if (refrescandoTodos) return;
    const objetivo = items.filter((c) => c.telefono);
    if (!objetivo.length) return;
    setRefrescandoTodos(true);
    setProgTodos({ done: 0, total: objetivo.length });
    for (let i = 0; i < objetivo.length; i++) {
      const c = objetivo[i];
      try {
        const r = await refrescarCrm(c.telefono, c.contacto);
        setItems((prev) =>
          prev.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  tipo: r.tipo,
                  crm_rol: r.crm_rol,
                  crm_avatar: r.crm_avatar,
                  crm_nombre: r.crm_nombre,
                  crm_sucursal: r.crm_sucursal,
                  nombre_mostrar: r.nombre_mostrar,
                }
              : x
          )
        );
      } catch (e) {
        /* si uno falla, seguimos con los demás */
      }
      setProgTodos({ done: i + 1, total: objetivo.length });
    }
    setRefrescandoTodos(false);
    toast.success("Datos del CRM actualizados.");
  };

  const cargarMas = useCallback(async () => {
    if (cargandoMasRef.current) return; // el observador puede disparar varias veces
    cargandoMasRef.current = true;
    setLoadingMore(true);
    try {
      const siguiente = paginaRef.current + 1;
      const r = await listarConversaciones({
        status: filtro,
        page: siguiente,
        porPagina: POR_PAGINA,
      });
      setItems((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...r.conversaciones.filter((c) => !ids.has(c.id))];
      });
      setPagina(r.pagina);
      paginaRef.current = r.pagina;
      setHayMas(r.hayMas);
    } catch (e) {
      toast.error(e.message);
    } finally {
      cargandoMasRef.current = false;
      setLoadingMore(false);
    }
  }, [filtro, toast]);

  // Cargar al llegar abajo: se observa un elemento invisible al final de la lista.
  // Se usa IntersectionObserver y no un onScroll porque quien hace scroll aquí es la
  // página entera, no un contenedor propio.
  useEffect(() => {
    const el = finListaRef.current;
    if (!el || !hayMas || status !== "ready") return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting) && !refrescandoTodos) cargarMas();
      },
      { rootMargin: "300px" } // se adelanta un poco para que no se note el salto
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, status, refrescandoTodos, cargarMas]);

  // Al buscar por nombre o filtrar por rol, carga en cascada el resto de
  // páginas para poder encontrar conversaciones que aún no estaban cargadas
  // (antes "buscar" solo miraba la primera página → salía "sin conversaciones").
  useEffect(() => {
    const filtrando = busqueda.trim().length >= 2 || rolFiltro !== "todos";
    if (filtrando && hayMas && !loadingMore && !refrescandoTodos && status === "ready") {
      cargarMas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, rolFiltro, hayMas, loadingMore, refrescandoTodos, status]);

  const abrir = (id) => {
    setSel(id);
    setMobileDetail(true);
  };
  const onEstadoCambiado = () => {
    loadList({ silent: true });
  };

  return (
    <Layout>
      <PageHeader
        title="Conversaciones"
        subtitle="Los chats de WhatsApp que atiende Orvito."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={actualizarTodos}
            disabled={refrescandoTodos || status !== "ready"}
            title="Consulta el CRM en vivo para todos los chats cargados (uno por uno)"
          >
            <Refresh size={16} className={refrescandoTodos ? "animate-spin" : ""} />
            {refrescandoTodos ? `Actualizando ${progTodos.done}/${progTodos.total}` : "Actualizar todos"}
          </Button>
        }
      />

      {/* Contador de usuarios: total / internos / externos (del filtro de estado) */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-md">
        <ConteoTile label="Usuarios" value={conteo?.total} tone="dark" cargando={conteo === null} />
        <ConteoTile label="Internos" value={conteo?.internos} tone="green" cargando={conteo === null} />
        <ConteoTile label="Externos" value={conteo?.externos} tone="muted" cargando={conteo === null} />
      </div>

      {/* filtros por estado */}
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filtro === f.value
                ? "bg-brand-dark text-white"
                : "border border-line bg-white text-muted hover:text-ink"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* filtro interno vs cliente (según el CRM) */}
      <div className="mb-3 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTipoFiltro(t.value)}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              tipoFiltro === t.value
                ? "bg-brand-green/15 text-brand-green ring-1 ring-brand-green/30"
                : "border border-line bg-white text-muted2 hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* búsqueda por nombre + filtro por rol de interno */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="w-full rounded-full border border-line bg-white px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-green/30 sm:max-w-xs"
        />
        {roles.length > 0 && (
          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            title="Filtrar por tipo de usuario interno (rol del CRM)"
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <option value="todos">Todos los roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {(busqueda || rolFiltro !== "todos") && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setRolFiltro("todos");
            }}
            className="text-xs font-medium text-muted hover:text-ink"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* LISTA */}
        <div className={cx("min-w-0", mobileDetail && "hidden md:block")}>
          {status === "loading" && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Card key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-5/6" />
                </Card>
              ))}
            </div>
          )}

          {status === "error" && (
            <ErrorState
              title="No pudimos cargar las conversaciones"
              text="Hubo un problema al conectar con el servidor."
              onRetry={() => loadList()}
            />
          )}

          {status === "ready" &&
            itemsVisibles.length === 0 &&
            (buscandoMas ? (
              <EmptyState
                icon={<Refresh size={22} className="animate-spin" />}
                title="Buscando…"
                text="Revisando todas las conversaciones."
              />
            ) : (
              <EmptyState
                icon={<Chat size={22} />}
                title="Sin conversaciones"
                text={
                  busqueda || rolFiltro !== "todos"
                    ? "Sin resultados para tu búsqueda o filtro."
                    : tipoFiltro === "todos"
                      ? "Cuando le escriban a Orvito, las verás aquí."
                      : `No hay conversaciones de ${tipoFiltro === "interno" ? "asesores/internos" : "clientes"} en este filtro.`
                }
              />
            ))}

          {status === "ready" && itemsVisibles.length > 0 && (
            <div className="seq space-y-2.5">
              {itemsVisibles.map((c) => (
                <ConvItem key={c.id} c={c} active={sel === c.id} onClick={() => abrir(c.id)} />
              ))}
              {/* Centinela: al entrar en pantalla se piden las siguientes. */}
              <div ref={finListaRef} aria-hidden className="h-px" />
              {hayMas && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={cargarMas}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Cargando…" : "Cargar más"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DETALLE */}
        <div className={cx("min-w-0 md:sticky md:top-6 md:self-start", !mobileDetail && "hidden md:block")}>
          {!sel ? (
            <Card className="hidden min-h-[420px] flex-col items-center justify-center p-10 text-center md:flex md:h-[calc(100vh-7rem)]">
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-soft text-brand-dark">
                <Chat size={22} />
              </span>
              <p className="text-sm text-muted">Elige una conversación para ver el hilo.</p>
            </Card>
          ) : (
            <Detalle
              id={sel}
              onBack={() => setMobileDetail(false)}
              onEstadoCambiado={onEstadoCambiado}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ---------- item de lista ---------- */
/** Mini-tarjeta de conteo: total de usuarios / internos / externos. */
function ConteoTile({ label, value, tone = "dark", cargando }) {
  const tones = {
    dark: "bg-brand-dark text-white",
    green: "bg-brand-green/10 text-brand-green ring-1 ring-brand-green/25",
    muted: "bg-soft text-brand-dark ring-1 ring-line",
  };
  return (
    <div className={cx("rounded-xl px-3 py-2", tones[tone] || tones.dark)}>
      <div className="text-lg font-bold leading-none">{cargando ? "…" : value ?? 0}</div>
      <div className="mt-1 text-[11px] font-medium opacity-80">{label}</div>
    </div>
  );
}

/** Etiqueta interno (con su rol del CRM) vs cliente. */
function TipoBadge({ tipo, rol, size = "sm" }) {
  const esInterno = tipo === "interno";
  const pad = size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        pad,
        esInterno ? "bg-brand-dark text-white" : "bg-line text-muted",
      )}
    >
      <span
        className={cx("h-1.5 w-1.5 rounded-full", esInterno ? "bg-brand-leaf" : "bg-muted2")}
      />
      {esInterno ? rol || "Asesor ORVE" : "Cliente"}
    </span>
  );
}

/** Foto de perfil del asesor (avatar_url del CRM). Fallback: iniciales o ícono. */
function initialsOf(name) {
  const s = String(name || "").trim();
  if (!s || /^[+\d]/.test(s)) return null; // teléfono o vacío → sin iniciales
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "";
  return (a + b).toUpperCase();
}
function UserGlyph({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
// Memoria de sesión: fotos que YA cargaron bien alguna vez (en la lista o el detalle).
// Una vez que una foto cargó, se recuerda su URL y ya no se vuelve a "perder" aunque el
// Storage tosa en un refresco: se pinta directo (cache-hit del navegador, 7 días).
const avatarOk = new Set();

// El Storage self-hosted NO aguanta la ráfaga: si la lista pide sus ~230 fotos de golpe,
// tira conexiones (medido: 2 de 30 fallan en paralelo, 0 de 30 pidiéndolas una por una).
// Por eso se pide de MAX_EN_VUELO en MAX_EN_VUELO y las demás esperan turno en la cola.
// `loading="lazy"` no basta: el navegador considera "cerca del viewport" varias pantallas.
const MAX_EN_VUELO = 5;
let enVuelo = 0;
const colaFotos = [];

function bombearCola() {
  while (enVuelo < MAX_EN_VUELO && colaFotos.length) {
    const t = colaFotos.shift();
    if (t.cancelado) continue;
    enVuelo += 1;
    t.ocupando = true;
    t.arrancar();
  }
}

/** Pide turno para bajar una foto. `soltar()` al terminar; `cancelar()` si se desmonta. */
function turnoDeCarga(arrancar) {
  const t = { arrancar, cancelado: false, ocupando: false };
  colaFotos.push(t);
  bombearCola();
  const soltar = () => {
    if (!t.ocupando) return;
    t.ocupando = false;
    enVuelo -= 1;
    bombearCola();
  };
  return { soltar, cancelar: () => { t.cancelado = true; soltar(); } };
}

function Avatar({ src, name, tipo, size = 44 }) {
  const esInterno = tipo === "interno";
  // Asesor interno sin foto real → mascota Orvito (default de marca). Cliente sin foto → iniciales.
  const effectiveSrc = src || (esInterno ? mascotaOrvito : null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(() => !!effectiveSrc && avatarOk.has(effectiveSrc));
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    setAttempt(0);
    // Si esta foto ya cargó antes en la sesión, arranca como "cargada" (sin reintentos ni flicker).
    setLoaded(!!effectiveSrc && avatarOk.has(effectiveSrc));
    setGaveUp(false);
  }, [effectiveSrc]);
  // La mascota es un asset local y una foto ya vista sale del cache del navegador:
  // ninguna de las dos toca el Storage, así que no gastan turno.
  const remota =
    !!effectiveSrc && /^https?:/i.test(effectiveSrc) && !avatarOk.has(effectiveSrc);
  // Solo se piden las fotos que de verdad están en pantalla. Es lo que de
  // verdad acota la carga: la lista puede traer 350 conversaciones, pero el
  // Storage solo ve la docena que el usuario está viendo. `loading="lazy"` no
  // alcanza (el navegador considera "cerca" varias pantallas de margen).
  const cajaRef = useRef(null);
  const [aLaVista, setALaVista] = useState(!remota);
  useEffect(() => {
    if (!remota) {
      setALaVista(true);
      return;
    }
    const el = cajaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setALaVista(true); // sin soporte, se comporta como antes
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setALaVista(true);
          io.disconnect(); // una vez visible, ya no se vuelve a soltar
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [remota, effectiveSrc]);
  const haceFalta = remota && aLaVista;
  const [turno, setTurno] = useState(!remota);
  const soltarRef = useRef(null);
  useEffect(() => {
    if (!haceFalta || gaveUp) {
      setTurno(!remota);
      return;
    }
    setTurno(false);
    const t = turnoDeCarga(() => setTurno(true));
    soltarRef.current = t.soltar;
    return () => {
      t.cancelar();
      soltarRef.current = null;
    };
  }, [effectiveSrc, haceFalta, gaveUp, attempt]);
  // Si la imagen falla o se queda colgada, se reintenta (con cache-bust) hasta 3 veces.
  // Timeout amplio (10s) para no abandonar una carga lenta-pero-buena bajo ráfaga.
  useEffect(() => {
    if (!effectiveSrc || !turno || loaded || gaveUp) return;
    const t = setTimeout(() => {
      if (attempt >= 3) setGaveUp(true);
      else setAttempt((a) => a + 1);
    }, 10000);
    return () => clearTimeout(t);
  }, [effectiveSrc, turno, attempt, loaded, gaveUp]);
  // El reintento espera antes de volver a pedir: insistir de inmediato sobre un Storage
  // que ya viene ahogado es justo lo que lo tumbaba.
  const reintentoRef = useRef(null);
  useEffect(() => () => clearTimeout(reintentoRef.current), []);
  const ini = initialsOf(name);
  const bust = effectiveSrc
    ? attempt > 0
      ? `${effectiveSrc}${effectiveSrc.includes("?") ? "&" : "?"}r=${attempt}`
      : effectiveSrc
    : null;
  // Iniciales/ícono SIEMPRE de fondo; la foto (si carga) va encima. Así nunca queda un círculo vacío.
  return (
    <span
      ref={cajaRef}
      className={cx(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold ring-1",
        esInterno ? "bg-brand-green/10 text-brand-green ring-brand-green/20" : "bg-soft text-brand-dark ring-line"
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      <span aria-hidden>{ini || <UserGlyph size={Math.round(size * 0.5)} />}</span>
      {bust && turno && !gaveUp && (
        <img
          key={attempt}
          src={bust}
          alt={name || "Foto de perfil"}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            if (effectiveSrc) avatarOk.add(effectiveSrc);
            setLoaded(true);
            soltarRef.current?.(); // libera el turno para la siguiente foto de la cola
          }}
          onError={() => {
            soltarRef.current?.();
            if (attempt >= 3) setGaveUp(true);
            else {
              clearTimeout(reintentoRef.current);
              reintentoRef.current = setTimeout(
                () => setAttempt((a) => a + 1),
                600 * (attempt + 1)
              );
            }
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}

function ConvItem({ c, active, onClick }) {
  const porOrvito = !c.atendida_por;
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full rounded-xl border p-3.5 text-left transition-colors",
        active ? "border-brand-leaf/50 bg-soft/50" : "border-line bg-white hover:bg-softer"
      )}
    >
      <div className="flex gap-3">
        <Avatar src={c.crm_avatar} name={c.nombre_mostrar || c.contacto} tipo={c.tipo} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-ink">{c.nombre_mostrar || c.contacto}</span>
            <span className="shrink-0 text-[11px] text-muted2">{fmtRelativo(c.ultima_actividad)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <TipoBadge tipo={c.tipo} rol={c.crm_rol} />
            {c.hilos > 1 && (
              <span
                className="rounded-full bg-softer px-1.5 py-0.5 text-[10px] font-medium text-muted2"
                title="Esta persona tiene varias conversaciones en Chatwoot; se muestra la más reciente."
              >
                {c.hilos} hilos
              </span>
            )}
          </div>
          {c.ultimo_mensaje && (
            <p className="mt-1 truncate text-sm text-muted">{stripFormato(c.ultimo_mensaje)}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className={cx("h-1.5 w-1.5 rounded-full", porOrvito ? "bg-brand-leaf" : "bg-brand-green")} />
              {porOrvito ? "Orvito" : c.atendida_por}
            </span>
            {c.no_leidos > 0 && (
              <span className="anim-pop grid h-5 min-w-5 place-items-center rounded-full bg-brand-dark px-1.5 text-[11px] font-semibold text-white">
                {c.no_leidos}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------- detalle / hilo ---------- */

/** Une mensajes sin duplicar y en orden. Los `nuevos` mandan si un id coincide. */
function fusionarMensajes(previos, nuevos) {
  const porId = new Map((previos || []).map((m) => [m.id, m]));
  (nuevos || []).forEach((m) => porId.set(m.id, m));
  return Array.from(porId.values()).sort((a, b) => (a.id || 0) - (b.id || 0));
}

function Detalle({ id, onBack, onEstadoCambiado }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [confirmDevolver, setConfirmDevolver] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [resumiendo, setResumiendo] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const scrollRef = useRef(null);
  const pegadoAbajoRef = useRef(true);

  // Limpieza única: versiones anteriores permitían arrastrar el chat y guardaban su
  // altura (global) en localStorage, lo que dejaba el chat "alargado" en todos los hilos.
  useEffect(() => {
    try {
      localStorage.removeItem("orvito_chat_h");
    } catch {
      /* noop */
    }
  }, []);

  // En el auto-refresco se piden SOLO los 20 últimos y se fusionan: antes cada vuelta
  // volvía a paginar todo el historial (hasta 80 llamadas seguidas a Chatwoot), tardaba
  // más que el propio intervalo y por eso el mensaje aparecía primero en la lista y
  // después en el chat.
  const load = useCallback(
    async ({ silent = false, soloRecientes = false } = {}) => {
      if (!silent) setStatus("loading");
      try {
        const r = await verConversacion(id, { soloRecientes });
        setData((prev) =>
          r.parcial && prev?.mensajes?.length
            ? { ...r, mensajes: fusionarMensajes(prev.mensajes, r.mensajes) }
            : r
        );
        setStatus("ready");
      } catch (e) {
        // Un refresco silencioso que falle no debe tumbar el chat que ya se está viendo.
        if (!silent) setStatus("error");
      }
    },
    [id]
  );

  // Al abrir un chat: primero los últimos mensajes (1 llamada, entra al instante) y
  // el historial completo detrás, en segundo plano. Traerlo todo de golpe tardaba
  // 6 s en un chat mediano y 15 s en uno largo, con la pantalla parada mientras tanto.
  useEffect(() => {
    let vivo = true;
    setData(null); // al cambiar de chat NO se pueden mezclar los mensajes del anterior
    (async () => {
      await load({ soloRecientes: true });
      if (!vivo) return;
      try {
        const completo = await verConversacion(id);
        if (!vivo) return;
        // Se fusiona en vez de reemplazar, por si llegó algo mientras bajaba.
        setData((prev) =>
          prev?.mensajes?.length
            ? { ...completo, mensajes: fusionarMensajes(completo.mensajes, prev.mensajes) }
            : completo
        );
      } catch {
        /* si el historial falla, queda lo reciente, que es lo que se está leyendo */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, load]);

  // Mensajes nuevos sin salir del chat: antes había que salir y volver a entrar.
  // Solo con la pestaña visible, para no consultar de gratis en segundo plano.
  // Cada vuelta cuesta 1 llamada a Chatwoot, así que se puede ir más seguido.
  useEffect(() => {
    let corriendo = false;
    const t = setInterval(async () => {
      // Si la vuelta anterior sigue en vuelo no se encima otra: apilarlas era
      // justo lo que saturaba el gateway y retrasaba el hilo.
      if (corriendo || document.visibilityState !== "visible") return;
      corriendo = true;
      try {
        await load({ silent: true });
      } finally {
        corriendo = false;
      }
    }, 6000);
    return () => clearInterval(t);
  }, [load]);

  // Baja solo si el usuario YA estaba hasta abajo: si subió a leer algo, no se le mueve.
  useEffect(() => {
    if (status === "ready" && scrollRef.current && pegadoAbajoRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [status, data]);

  const cambiarEstado = async (nuevo) => {
    setConfirmDevolver(false);
    setCambiando(true);
    try {
      await cambiarEstadoConversacion(id, nuevo);
      await load();
      onEstadoCambiado?.();
      toast.success(
        nuevo === "pending"
          ? "Conversación devuelta a Orvito."
          : nuevo === "resolved"
          ? "Conversación marcada como resuelta."
          : "Conversación reabierta."
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCambiando(false);
    }
  };

  const resumir = async () => {
    setResumiendo(true);
    try {
      const r = await resumirAhora(id);
      setResumen(r);
      toast.success("Resumen generado.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setResumiendo(false);
    }
  };

  // Fuerza una consulta en vivo al CRM (útil si la persona acaba de verificar su número).
  const refrescarCRM = async () => {
    const tel = data?.conversacion?.telefono;
    if (!tel || refrescando) return;
    setRefrescando(true);
    try {
      const r = await refrescarCrm(tel, data?.conversacion?.contacto);
      setData((prev) =>
        prev
          ? {
              ...prev,
              conversacion: {
                ...prev.conversacion,
                tipo: r.tipo,
                crm_nombre: r.crm_nombre,
                crm_rol: r.crm_rol,
                crm_sucursal: r.crm_sucursal,
                crm_avatar: r.crm_avatar,
                nombre_mostrar: r.nombre_mostrar,
              },
            }
          : prev
      );
      onEstadoCambiado?.(); // refresca también la lista
      toast.success(
        r.tipo === "interno"
          ? `Actualizado: ${r.crm_rol || "asesor"}`
          : "Actualizado: aún sin verificar en el CRM"
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRefrescando(false);
    }
  };

  const conv = data?.conversacion;
  const est = ESTADO[conv?.status] || ESTADO.pending;

  const grupos = useMemo(() => agruparPorDia(data?.mensajes || []), [data]);

  // ---- "Orvito está revisando el pipeline…" ----
  // Sólo se pregunta cuando tiene sentido: el último mensaje es del asesor y llegó hace
  // menos de 3 min. Fuera de eso no se consulta nada, para no pegarle al gateway de a
  // gratis en cada chat abierto.
  const [actividad, setActividad] = useState({ activo: false });
  const ultimo = (data?.mensajes || [])[(data?.mensajes || []).length - 1];
  const esperandoRespuesta =
    !!ultimo && ultimo.de !== "orvito" && Date.now() / 1000 - Number(ultimo.fecha) < 180;

  useEffect(() => {
    if (!esperandoRespuesta || !conv?.telefono) {
      setActividad({ activo: false });
      return;
    }
    let vivo = true;
    const mirar = async () => {
      const a = await actividadOrvito(conv.telefono);
      if (vivo) setActividad(a);
    };
    mirar();
    const t = setInterval(mirar, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [esperandoRespuesta, conv?.telefono]);

  // Orvito parte una respuesta en 2-3 mensajes, y los tres salen de la MISMA ejecución:
  // poner el proceso debajo de cada uno era repetir tres veces lo mismo. Se marca sólo
  // el ÚLTIMO de cada tanda seguida (mensajes de Orvito a menos de 2 min uno de otro) y
  // ahí se cuelga la traza, que además es donde la ejecución termina.
  const idsConTraza = useMemo(() => {
    const ms = data?.mensajes || [];
    const ids = new Set();
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.de !== "orvito" || m.privado) continue;
      const sig = ms[i + 1];
      const mismaTanda =
        sig && sig.de === "orvito" && !sig.privado && Number(sig.fecha) - Number(m.fecha) <= 120;
      if (!mismaTanda) ids.add(m.id);
    }
    return ids;
  }, [data]);

  // Mientras abre: nada del chat anterior en pantalla (ni nombre, ni foto, ni globos
  // de relleno), solo el logo. Se deja el botón de volver para no dejar atrapado a
  // quien esté en el celular si la red va lenta.
  if (status === "loading") {
    return (
      <Card className="relative flex h-[75vh] min-h-[420px] max-h-[calc(100vh-72px)] flex-col items-center justify-center overflow-hidden md:h-[calc(100vh-7rem)]">
        <button
          onClick={onBack}
          className="absolute left-3 top-3 rounded-lg p-1 text-muted hover:bg-soft hover:text-ink md:hidden"
          aria-label="Volver"
        >
          ←
        </button>
        <img src={LOGO_COLOR} alt="ORVE" className="h-10 w-auto animate-pulse" />
      </Card>
    );
  }

  return (
    <Card
      className="flex h-[75vh] min-h-[420px] max-h-[calc(100vh-72px)] flex-col overflow-hidden md:h-[calc(100vh-7rem)]"
    >
      {/* header: en móvil se apila (identidad arriba, acciones abajo); en desktop, una fila */}
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 items-center gap-2 md:flex-1">
          <button
            onClick={onBack}
            className="-ml-1 rounded-lg p-1 text-muted hover:bg-soft hover:text-ink md:hidden"
            aria-label="Volver"
          >
            ←
          </button>
          <Avatar
            src={conv?.crm_avatar}
            name={conv?.nombre_mostrar || conv?.contacto}
            tipo={conv?.tipo}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate font-semibold text-ink">
                {conv?.nombre_mostrar || conv?.contacto || "…"}
              </p>
              {conv && <TipoBadge tipo={conv.tipo} rol={conv.crm_rol} />}
            </div>
            <p className="truncate text-xs text-muted">
              {[conv?.crm_sucursal, conv?.telefono].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
          {conv && (
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", est.cls)}>
              <span className={cx("h-1.5 w-1.5 rounded-full", est.dot)} />
              {est.label}
            </span>
          )}
          {conv?.status === "open" && (
            <Button size="sm" onClick={() => setConfirmDevolver(true)} disabled={cambiando}>
              Devolver
            </Button>
          )}
          {conv?.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado("resolved")} disabled={cambiando}>
              Resolver
            </Button>
          )}
          {conv?.status === "resolved" && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado("open")} disabled={cambiando}>
              Reabrir
            </Button>
          )}
          {conv && (
            <Button
              size="icon"
              variant="ghost"
              onClick={refrescarCRM}
              disabled={refrescando}
              title="Actualizar datos del CRM (rol y foto) desde el CRM en vivo"
              aria-label="Actualizar CRM"
            >
              <Refresh size={18} className={refrescando ? "animate-spin" : ""} />
            </Button>
          )}
          {conv && (
            <Button
              size="icon"
              variant="ghost"
              onClick={resumir}
              disabled={resumiendo}
              title="Generar resumen IA de esta conversación"
              aria-label="Resumen IA"
            >
              <Sparkles size={18} className={resumiendo ? "animate-pulse" : ""} />
            </Button>
          )}
        </div>
      </div>

      {/* resumen IA (colapsable) */}
      {resumen && (
        <div className="border-b border-line bg-soft/40 px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-dark">
              <Sparkles size={14} /> Resumen IA
            </span>
            <button
              onClick={() => setResumen(null)}
              className="text-xs text-muted hover:text-ink"
            >
              Ocultar
            </button>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{resumen.resumen}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
              {catLabel(resumen.categoria)}
            </span>
            {String(resumen.proyectos || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-line bg-white px-2 py-0.5 text-[11px] text-brand-dark"
                >
                  {p}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* hilo */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pegadoAbajoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-4 overflow-y-auto bg-canvas/50 px-4 py-5"
      >
        {/* "loading" no llega hasta aquí: se atiende arriba con el logo a pantalla completa */}
        {status === "error" && (
          <ErrorState title="No pudimos cargar el hilo" onRetry={load} />
        )}
        {status === "ready" &&
          grupos.map((g) => (
            <div key={g.dia} className="space-y-3">
              <div className="flex justify-center">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted2 shadow-card">
                  {fmtDiaSeparador(g.epoch)}
                </span>
              </div>
              {g.mensajes.map((m) => (
                <Mensaje
                  key={m.id}
                  m={m}
                  telefono={conv?.telefono}
                  conTraza={idsConTraza.has(m.id)}
                />
              ))}
            </div>
          ))}

        {status === "ready" && actividad.activo && (
          <div className="flex justify-end">
            <div className="flex max-w-[78%] items-center gap-2 rounded-2xl bg-soft/70 px-3.5 py-2.5 text-sm text-muted shadow-card">
              <span className="flex gap-1">
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
              </span>
              {actividad.herramienta}…
            </div>
          </div>
        )}
      </div>

      {/* composer placeholder (solo lectura en esta fase) */}
      <div className="border-t border-line bg-white px-4 py-3">
        <div className="rounded-xl bg-softer px-4 py-2.5 text-center text-xs text-muted2">
          Este panel es de solo lectura. Para responder, usa Chatwoot.
        </div>
      </div>

      <Modal
        open={confirmDevolver}
        onClose={() => setConfirmDevolver(false)}
        title="Devolver a Orvito"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDevolver(false)}>
              Cancelar
            </Button>
            <Button onClick={() => cambiarEstado("pending")} disabled={cambiando}>
              Devolver a Orvito
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          La conversación volverá a manos de <b className="text-ink">Orvito</b>, que retomará la
          atención automática. ¿Continuar?
        </p>
      </Modal>
    </Card>
  );
}

/* ---------- burbuja de mensaje ---------- */
function Mensaje({ m, telefono, conTraza }) {
  if (m.de === "sistema") {
    return (
      <div className="flex justify-center">
        <span className="max-w-[85%] rounded-full bg-white/70 px-3 py-1 text-center text-[11px] text-muted2">
          {m.texto}
        </span>
      </div>
    );
  }
  const derecha = m.de === "orvito";
  return (
    <div className={cx("flex", derecha ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[78%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-card",
          m.privado
            ? "border border-amber/30 bg-amber/10 text-ink"
            : derecha
            ? "bg-soft text-ink"
            : "bg-white text-ink"
        )}
      >
        {m.privado && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber">
            🔒 Nota interna
          </div>
        )}
        {m.texto && <RichText text={m.texto} className="whitespace-pre-wrap break-words" />}
        {m.adjuntos.map((a, i) => (
          <Adjunto key={i} a={a} />
        ))}
        {derecha && !m.privado && conTraza && <TrazaOrvito telefono={telefono} cuando={m.fecha} />}
        <div className={cx("text-right text-[10px]", m.privado ? "text-amber/70" : "text-muted2")}>
          {fmtHora(m.fecha)}
        </div>
      </div>
    </div>
  );
}

/* ---------- qué hizo Orvito para dar esta respuesta ----------
   Se pide sólo al abrirlo (no en cada carga del hilo): reconstruirla implica leer la
   ejecución de n8n, y hacerlo para los 40 mensajes de un chat sería absurdo. */
function TrazaOrvito({ telefono, cuando }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | cargando | listo | vacio
  const [traza, setTraza] = useState(null);

  if (!telefono) return null;

  const alternar = async () => {
    if (abierto) return setAbierto(false);
    setAbierto(true);
    if (estado !== "idle") return; // ya se pidió: no se vuelve a pedir
    setEstado("cargando");
    try {
      // `cuando` viene de Chatwoot en epoch SEGUNDOS (igual que fmtHora/diaKey).
      // Mandarlo crudo daba 1970 y la ventana de búsqueda nunca coincidía.
      const t = await trazaConversacion(telefono, new Date(Number(cuando) * 1000).toISOString());
      setTraza(t);
      setEstado(t.sinTraza ? "vacio" : "listo");
    } catch {
      setTraza({ motivo: "No pudimos leer el proceso de este mensaje." });
      setEstado("vacio");
    }
  };

  const pasos = (traza?.pasos || []).filter((p) => p.tipo !== "pensar");

  return (
    <div className="border-t border-line/60 pt-1.5">
      <button
        type="button"
        onClick={alternar}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted2 transition-colors hover:text-brand-dark"
      >
        <span className={cx("transition-transform", abierto && "rotate-90")}>›</span>
        {estado === "listo"
          ? `${traza.herramientas} ${traza.herramientas === 1 ? "consulta" : "consultas"} · ${traza.duracion}s`
          : "Ver qué hizo Orvito"}
      </button>

      {abierto && (
        <div className="mt-1.5 space-y-1">
          {estado === "cargando" && <div className="text-[11px] text-muted2">Reconstruyendo el proceso…</div>}
          {estado === "vacio" && (
            <div className="text-[11px] text-muted2">{traza?.motivo || "Sin proceso que mostrar."}</div>
          )}
          {estado === "listo" &&
            (pasos.length === 0 ? (
              <div className="text-[11px] text-muted2">
                Contestó sin consultar nada: le bastó con lo que ya sabía.
              </div>
            ) : (
              pasos.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span className="w-9 shrink-0 text-right tabular-nums text-muted2">+{p.t}s</span>
                  <span
                    className={cx(
                      "mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full",
                      p.tipo === "respuesta"
                        ? "bg-muted2"
                        : p.estado === "ok"
                        ? "bg-brand"
                        : "bg-amber"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cx("font-medium", p.estado === "error" ? "text-amber" : "text-ink")}>
                      {p.tipo === "respuesta" ? "Respondió" : p.nombre}
                    </span>
                    {p.detalle && <span className="text-muted2"> — {p.detalle}</span>}
                  </span>
                  {p.tipo !== "respuesta" && (
                    <span className="shrink-0 tabular-nums text-muted2">{fmtDuracion(p.ms)}</span>
                  )}
                </div>
              ))
            ))}
        </div>
      )}
    </div>
  );
}

function fmtDuracion(ms) {
  const n = Number(ms) || 0;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

function Adjunto({ a }) {
  if (!a.url) return null;
  if (a.tipo === "audio") {
    return <audio controls src={a.url} className="w-full max-w-[240px]" />;
  }
  if (a.tipo === "image") {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer">
        <img src={a.url} alt="adjunto" className="max-h-56 rounded-lg border border-line object-cover" />
      </a>
    );
  }
  if (a.tipo === "video") {
    return <video controls src={a.url} className="max-h-56 w-full rounded-lg" />;
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-brand-dark hover:bg-softer"
    >
      📎 Ver archivo
    </a>
  );
}

/* ---------- agrupar por día ---------- */
function agruparPorDia(mensajes) {
  const out = [];
  let cur = null;
  for (const m of mensajes) {
    const k = diaKey(m.fecha);
    if (!cur || cur.dia !== k) {
      cur = { dia: k, epoch: m.fecha, mensajes: [] };
      out.push(cur);
    }
    cur.mensajes.push(m);
  }
  return out;
}
