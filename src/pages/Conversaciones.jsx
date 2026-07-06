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
import { Chat, Sparkles } from "../components/Icons.jsx";
import RichText, { stripFormato } from "../components/RichText.jsx";
import {
  listarConversaciones,
  verConversacion,
  cambiarEstadoConversacion,
  marcarLeidaConversacion,
  resumirAhora,
} from "../lib/api.js";
import { fmtRelativo, fmtHora, fmtDiaSeparador, diaKey } from "../lib/format.js";
import { catLabel } from "./Resumenes.jsx";

const FILTROS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Con Orvito" },
  { value: "open", label: "Con agente" },
  { value: "resolved", label: "Resueltas" },
];
const ESTADO = {
  pending: { label: "Con Orvito", cls: "bg-soft text-brand-dark", dot: "bg-brand-leaf" },
  open: { label: "Con agente", cls: "bg-brand-green/10 text-brand-green", dot: "bg-brand-green" },
  resolved: { label: "Resuelta", cls: "bg-line text-muted", dot: "bg-muted2" },
};

export default function Conversaciones() {
  const toast = useToast();
  const [filtro, setFiltro] = useState("all");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sel, setSel] = useState(null); // id seleccionado
  const [mobileDetail, setMobileDetail] = useState(false);
  const [searchParams] = useSearchParams();

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
    if (!sel) return;
    setItems((prev) => prev.map((c) => (c.id === sel ? { ...c, no_leidos: 0 } : c)));
    marcarLeidaConversacion(sel).catch(() => {});
  }, [sel]);

  const loadList = useCallback(
    async (opts = {}) => {
      const silent = opts.silent;
      if (!silent) setStatus("loading");
      try {
        const r = await listarConversaciones({ status: filtro, page: 1 });
        setItems(r.conversaciones);
        setPagina(1);
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

  // Auto-refresh suave cada 30s (solo pestaña visible y en página 1, para no perder scroll)
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && pagina === 1) {
        loadList({ silent: true });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [loadList, pagina]);

  const cargarMas = async () => {
    setLoadingMore(true);
    try {
      const r = await listarConversaciones({ status: filtro, page: pagina + 1 });
      setItems((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...r.conversaciones.filter((c) => !ids.has(c.id))];
      });
      setPagina(r.pagina);
      setHayMas(r.hayMas);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

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
      />

      {/* filtros */}
      <div className="mb-5 flex flex-wrap gap-2">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
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

          {status === "ready" && items.length === 0 && (
            <EmptyState
              icon={<Chat size={22} />}
              title="Sin conversaciones"
              text="Cuando los asesores le escriban a Orvito, las verás aquí."
            />
          )}

          {status === "ready" && items.length > 0 && (
            <div className="space-y-2.5">
              {items.map((c) => (
                <ConvItem key={c.id} c={c} active={sel === c.id} onClick={() => abrir(c.id)} />
              ))}
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
        <div className={cx("md:sticky md:top-6 md:self-start", !mobileDetail && "hidden md:block")}>
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
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-ink">{c.contacto}</span>
        <span className="shrink-0 text-[11px] text-muted2">{fmtRelativo(c.ultima_actividad)}</span>
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
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-dark px-1.5 text-[11px] font-semibold text-white">
            {c.no_leidos}
          </span>
        )}
      </div>
    </button>
  );
}

/* ---------- detalle / hilo ---------- */
function Detalle({ id, onBack, onEstadoCambiado }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [confirmDevolver, setConfirmDevolver] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [resumiendo, setResumiendo] = useState(false);
  const scrollRef = useRef(null);
  const cardRef = useRef(null);

  // Altura del chat ajustable por el usuario (arrastrando el borde inferior) y recordada.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const saved = Number(localStorage.getItem("orvito_chat_h"));
    if (saved && saved > 300) el.style.height = saved + "px";
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.round(el.getBoundingClientRect().height);
        if (h > 300) localStorage.setItem("orvito_chat_h", String(h));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await verConversacion(id));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status === "ready" && scrollRef.current) {
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

  const conv = data?.conversacion;
  const est = ESTADO[conv?.status] || ESTADO.pending;

  const grupos = useMemo(() => agruparPorDia(data?.mensajes || []), [data]);

  return (
    <Card
      ref={cardRef}
      className="flex h-[75vh] min-h-[420px] max-h-[calc(100vh-72px)] flex-col overflow-hidden md:h-[calc(100vh-7rem)] md:resize-y"
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink md:hidden"
          aria-label="Volver"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{conv?.contacto || "…"}</p>
          {conv?.telefono && <p className="truncate text-xs text-muted">{conv.telefono}</p>}
        </div>
        {conv && (
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", est.cls)}>
            <span className={cx("h-1.5 w-1.5 rounded-full", est.dot)} />
            {est.label}
          </span>
        )}
        {conv?.status === "open" && (
          <Button size="sm" onClick={() => setConfirmDevolver(true)} disabled={cambiando}>
            Devolver a Orvito
          </Button>
        )}
        {conv?.status === "pending" && (
          <Button size="sm" variant="outline" onClick={() => cambiarEstado("resolved")} disabled={cambiando}>
            Marcar resuelta
          </Button>
        )}
        {conv?.status === "resolved" && (
          <Button size="sm" variant="outline" onClick={() => cambiarEstado("open")} disabled={cambiando}>
            Reabrir
          </Button>
        )}
        {conv && (
          <Button
            size="sm"
            variant="ghost"
            onClick={resumir}
            disabled={resumiendo}
            title="Generar resumen IA de esta conversación"
          >
            <Sparkles size={16} /> {resumiendo ? "Resumiendo…" : "Resumir"}
          </Button>
        )}
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
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-canvas/50 px-4 py-5">
        {status === "loading" && (
          <div className="space-y-4">
            <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
            <Skeleton className="h-14 w-1/2 rounded-2xl" />
            <Skeleton className="ml-auto h-20 w-3/5 rounded-2xl" />
          </div>
        )}
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
                <Mensaje key={m.id} m={m} />
              ))}
            </div>
          ))}
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
function Mensaje({ m }) {
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
        <div className={cx("text-right text-[10px]", m.privado ? "text-amber/70" : "text-muted2")}>
          {fmtHora(m.fecha)}
        </div>
      </div>
    </div>
  );
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
