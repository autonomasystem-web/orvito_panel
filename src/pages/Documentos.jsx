import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Input,
  SearchInput,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  Field,
  cx,
  useToast,
} from "../components/ui.jsx";
import { Book, Save, Upload, Download, Trash, Sparkles, Plus, Folder, Pencil, Dots } from "../components/Icons.jsx";
import {
  listarDocumentos,
  verDocumento,
  guardarDocumento,
  eliminarDocumento,
  crearCarpeta,
  renombrarCarpeta,
  moverDocumento,
  eliminarCarpeta,
  guardarOrdenCarpetas,
} from "../lib/api.js";

marked.setOptions({ breaks: false, gfm: true });

const normaliza = (s) =>
  String(s || "")
    .trim()
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");

export default function Documentos() {
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [orden, setOrden] = useState([]); // orden guardado de las carpetas (incluye vacías)
  const [status, setStatus] = useState("loading");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null); // nombre_doc seleccionado
  const [nuevo, setNuevo] = useState(false); // modal nuevo documento
  const [nuevaCarpeta, setNuevaCarpeta] = useState(false); // modal nueva carpeta
  const [proyectoSel, setProyectoSel] = useState(null); // proyecto (categoría) abierto
  const [menuAbierto, setMenuAbierto] = useState(null); // carpeta con el menú ⋮ abierto
  const [renombrar, setRenombrar] = useState(null); // carpeta a renombrar
  const [aEliminar, setAEliminar] = useState(null); // carpeta a eliminar
  const dragIdx = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await listarDocumentos();
      setDocs(r.documentos);
      setOrden(r.carpetas_orden);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return docs.filter((d) => !t || d.nombre_doc.toLowerCase().includes(t));
  }, [docs, q]);

  // Agrupa por carpeta (categoría) + incluye carpetas vacías del registro,
  // ordenadas por el `orden` guardado (las no listadas van al final alfabético).
  const grupos = useMemo(() => {
    const m = new Map();
    for (const d of filtered) {
      const p = String(d.categoria || "").trim() || "general";
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(d);
    }
    if (!q.trim()) for (const c of orden) if (c && !m.has(c)) m.set(c, []);
    const pos = (p) => {
      const i = orden.indexOf(p);
      return i < 0 ? 9999 : i;
    };
    return [...m.entries()]
      .map(([proyecto, items]) => ({ proyecto, items }))
      .sort((a, b) => pos(a.proyecto) - pos(b.proyecto) || a.proyecto.localeCompare(b.proyecto, "es"));
  }, [filtered, orden, q]);

  const todasCarpetas = useMemo(() => grupos.map((g) => g.proyecto), [grupos]);

  // Reordenar carpetas por arrastre → guarda el nuevo orden.
  const soltarEn = async (destIdx) => {
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from == null || from === destIdx) return;
    const nombres = grupos.map((g) => g.proyecto);
    const [mv] = nombres.splice(from, 1);
    nombres.splice(destIdx, 0, mv);
    setOrden(nombres);
    try {
      await guardarOrdenCarpetas(nombres);
    } catch (e) {
      toast.error("No se pudo guardar el orden.");
      load();
    }
  };

  const crearNuevaCarpeta = async (nombre) => {
    setNuevaCarpeta(false);
    const nd = normaliza(nombre);
    if (!nd) return;
    try {
      await crearCarpeta(nd);
      toast.success(`Carpeta "${proyLabel(nd)}" creada.`);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const hacerRenombrar = async (actual, nuevoNombre) => {
    setRenombrar(null);
    const nd = normaliza(nuevoNombre);
    if (!nd || nd === actual) return;
    try {
      await renombrarCarpeta(actual, nd);
      if (proyectoSel === actual) setProyectoSel(nd);
      toast.success("Carpeta renombrada.");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const hacerEliminarCarpeta = async (nombre, moverA) => {
    setAEliminar(null);
    try {
      await eliminarCarpeta(nombre, moverA);
      if (proyectoSel === nombre) setProyectoSel(null);
      toast.success(moverA ? "Documentos movidos y carpeta eliminada." : "Carpeta eliminada.");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const moverDoc = async (nombreDoc, categoria) => {
    try {
      await moverDocumento(nombreDoc, categoria);
      toast.success(`Movido a "${proyLabel(categoria)}".`);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Nombre bonito del proyecto: "ccm" -> "CCM", "riviera_maya" -> "Riviera Maya".
  const proyLabel = (c) => {
    const s = String(c || "General").replace(/_/g, " ").trim();
    return s.length <= 4 ? s.toUpperCase() : s.replace(/\b\w/g, (m) => m.toUpperCase());
  };
  // Al abrir un bloque: si tiene 1 doc, va directo al md; si tiene varios, muestra su lista.
  const abrirProyecto = (proyecto, items) => {
    setProyectoSel(proyecto);
    setSel(items.length === 1 ? { nombre_doc: items[0].nombre_doc } : null);
  };

  const abrirNuevo = (nombre) => {
    const nd = normaliza(nombre);
    setNuevo(false);
    if (!nd) return;
    setSel({ nombre_doc: nd, nuevo: true });
  };

  const onGuardado = async () => {
    await load();
  };
  const onEliminado = async (nombre) => {
    setSel(null);
    await load();
    toast.success(`Documento "${nombre}" eliminado.`);
  };

  const selName = sel?.nombre_doc || null;

  return (
    <Layout>
      <PageHeader
        title="Base de conocimiento"
        subtitle="Lo que Orvito sabe. Edita el markdown y se reindexa solo en el agente."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setNuevaCarpeta(true)}>
              <Folder size={18} /> Nueva carpeta
            </Button>
            <Button onClick={() => setNuevo(true)}>
              <Plus size={18} /> Nuevo documento
            </Button>
          </div>
        }
      />

      {/* Buscador (siempre visible) */}
      <div className="mb-4 sm:max-w-md">
        <SearchInput
          placeholder="Buscar documento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}
      {status === "error" && (
        <ErrorState title="No pudimos cargar los documentos" onRetry={load} />
      )}
      {status === "ready" && filtered.length === 0 && (
        <EmptyState
          icon={<Book size={22} />}
          title={q ? "Sin resultados" : "Aún no hay documentos"}
          text="Crea el primero o súbelo desde el editor."
        />
      )}

      {status === "ready" &&
        filtered.length > 0 &&
        (!proyectoSel && !q.trim() ? (
          /* NIVEL 1 — bloques de proyecto a lo ancho (estilo Materiales) */
          <>
            <p className="mb-3 text-xs text-muted2">
              Arrastra las carpetas para reordenarlas · usa el menú <Dots size={12} className="inline" /> para renombrar o eliminar.
            </p>
            <div className="seq grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.map(({ proyecto, items }, i) => (
                <div
                  key={proyecto}
                  draggable={!q.trim()}
                  onDragStart={() => (dragIdx.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltarEn(i)}
                  onClick={() => abrirProyecto(proyecto, items)}
                  className="relative flex cursor-pointer flex-col rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-shadow hover:shadow-lg"
                >
                  <div className="absolute right-2 top-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbierto(menuAbierto === proyecto ? null : proyecto);
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink"
                      aria-label="Opciones de carpeta"
                    >
                      <Dots size={18} />
                    </button>
                    {menuAbierto === proyecto && (
                      <div
                        className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setMenuAbierto(null);
                            setRenombrar(proyecto);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-soft"
                        >
                          <Pencil size={15} /> Renombrar
                        </button>
                        <button
                          onClick={() => {
                            setMenuAbierto(null);
                            setAEliminar(proyecto);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                        >
                          <Trash size={15} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="mb-3 grid size-12 place-items-center rounded-xl bg-soft text-brand-dark">
                    <Folder size={22} />
                  </span>
                  <p className="text-lg font-bold text-brand-dark">{proyLabel(proyecto)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {items.length} {items.length === 1 ? "documento" : "documentos"}
                  </p>
                  <span className="mt-3 text-sm font-semibold text-brand-green">Ver documentos →</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* NIVEL 2 / búsqueda — lista de docs + editor del md */
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,300px)_1fr]">
            {/* LISTA */}
            <div className={cx("min-w-0", sel && "hidden md:block")}>
              {proyectoSel && !q.trim() && (
                <div className="mb-3">
                  <button
                    onClick={() => {
                      setProyectoSel(null);
                      setSel(null);
                    }}
                    className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
                  >
                    ← Proyectos
                  </button>
                  <h3 className="px-1 text-sm font-bold text-ink">{proyLabel(proyectoSel)}</h3>
                </div>
              )}
              <div className="seq space-y-2">
                {(q.trim()
                  ? filtered
                  : grupos.find((g) => g.proyecto === proyectoSel)?.items ?? []
                ).map((d) => (
                  <div key={d.nombre_doc} className="flex items-center gap-2">
                    <button
                      onClick={() => setSel({ nombre_doc: d.nombre_doc })}
                      className={cx(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-xl border p-3 text-left transition-colors",
                        selName === d.nombre_doc
                          ? "border-brand-leaf/50 bg-soft/60"
                          : "border-line bg-white hover:bg-softer"
                      )}
                    >
                      <span className="shrink-0 text-brand-green">
                        <Book size={16} />
                      </span>
                      <span className="truncate text-sm font-medium text-ink">{d.nombre_doc}</span>
                      {q.trim() && d.categoria && (
                        <span className="ml-auto shrink-0 rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                          {proyLabel(d.categoria)}
                        </span>
                      )}
                    </button>
                    <select
                      title="Mover a otra carpeta"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) moverDoc(d.nombre_doc, v);
                      }}
                      className="shrink-0 rounded-lg border border-line bg-white px-2 py-2 text-xs text-muted hover:text-ink"
                    >
                      <option value="">Mover a…</option>
                      {todasCarpetas
                        .filter((c) => c !== (String(d.categoria || "").trim() || "general"))
                        .map((c) => (
                          <option key={c} value={c}>
                            {proyLabel(c)}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* EDITOR */}
            <div className={cx("md:sticky md:top-6 md:self-start", !sel && "hidden md:block")}>
              {!sel ? (
                <Card className="hidden min-h-[420px] flex-col items-center justify-center p-10 text-center md:flex md:h-[calc(100vh-7rem)]">
                  <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-soft text-brand-dark">
                    <Book size={22} />
                  </span>
                  <p className="text-sm text-muted">Elige un documento para ver y editar su markdown.</p>
                </Card>
              ) : (
                <Editor
                  key={sel.nombre_doc}
                  nombre={sel.nombre_doc}
                  esNuevo={!!sel.nuevo}
                  onBack={() => setSel(null)}
                  onGuardado={onGuardado}
                  onEliminado={onEliminado}
                />
              )}
            </div>
          </div>
        ))}

      {/* clic afuera cierra el menú ⋮ de las carpetas */}
      {menuAbierto && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuAbierto(null)} />
      )}

      {/* modales */}
      <NuevoModal open={nuevo} onClose={() => setNuevo(false)} onCrear={abrirNuevo} />
      <NuevaCarpetaModal
        open={nuevaCarpeta}
        onClose={() => setNuevaCarpeta(false)}
        onCrear={crearNuevaCarpeta}
      />
      <RenombrarCarpetaModal
        carpeta={renombrar}
        proyLabel={proyLabel}
        onClose={() => setRenombrar(null)}
        onRenombrar={hacerRenombrar}
      />
      <EliminarCarpetaModal
        carpeta={aEliminar}
        proyLabel={proyLabel}
        carpetas={todasCarpetas}
        conteo={grupos.find((g) => g.proyecto === aEliminar)?.items.length ?? 0}
        onClose={() => setAEliminar(null)}
        onEliminar={hacerEliminarCarpeta}
      />
    </Layout>
  );
}

/* ---------------- Editor ---------------- */
function Editor({ nombre, esNuevo, onBack, onGuardado, onEliminado }) {
  const toast = useToast();
  const [status, setStatus] = useState(esNuevo ? "ready" : "loading");
  const [meta, setMeta] = useState({ titulo: nombre, categoria: "", total_chunks: 0 });
  const [texto, setTexto] = useState("");
  const [orig, setOrig] = useState("");
  const [tab, setTab] = useState("editar"); // editar | vista
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef(null);
  const soyNuevo = esNuevo && !savedOnce;

  useEffect(() => {
    if (esNuevo) {
      setTexto("");
      setOrig("");
      return;
    }
    let alive = true;
    (async () => {
      setStatus("loading");
      try {
        const d = await verDocumento(nombre);
        if (!alive) return;
        setMeta({ titulo: d.titulo, categoria: d.categoria, total_chunks: d.total_chunks });
        setTexto(d.contenido_md);
        setOrig(d.contenido_md);
        setStatus("ready");
      } catch (e) {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [nombre, esNuevo]);

  const dirty = texto !== orig;
  const puedeGuardar = texto.trim().length >= 50 && (dirty || soyNuevo);

  const guardar = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await guardarDocumento(nombre, texto);
      setOrig(texto);
      setSavedOnce(true);
      toast.success("Guardado y reindexado en el agente.");
      onGuardado?.();
      // refrescar conteo de chunks
      try {
        const d = await verDocumento(nombre);
        setMeta({ titulo: d.titulo, categoria: d.categoria, total_chunks: d.total_chunks });
      } catch {}
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = async () => {
    setConfirmDel(false);
    try {
      await eliminarDocumento(nombre);
      onEliminado?.(nombre);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const subirArchivo = async (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".md")) {
      toast.error("Solo archivos .md");
      return;
    }
    const t = await f.text();
    setTexto(t);
    setTab("editar");
    toast.success(`Cargado ${f.name} — revisa y guarda.`);
  };

  const descargarMd = () => {
    const blob = new Blob([texto || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(nombre || "documento").replace(/[^\w.-]+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const html = useMemo(() => {
    try {
      return marked.parse(texto || "");
    } catch {
      return "";
    }
  }, [texto]);

  return (
    <Card className="flex h-[75vh] min-h-[460px] flex-col overflow-hidden md:h-[calc(100vh-7rem)]">
      {/* header — en móvil se apila: título arriba, controles abajo (evita que choquen) */}
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:flex-wrap md:items-center">
        {/* título */}
        <div className="flex min-w-0 items-center gap-2 md:flex-1">
          <button
            onClick={onBack}
            className="shrink-0 rounded-lg p-1 text-muted hover:bg-soft hover:text-ink md:hidden"
            aria-label="Volver"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{nombre}</p>
            <p className="truncate text-xs text-muted2">
              {soyNuevo ? "Documento nuevo" : `${meta.categoria || "—"} · ${meta.total_chunks} fragmentos`}
              {dirty && <span className="ml-2 text-amber">• sin guardar</span>}
            </p>
          </div>
        </div>

        {/* controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* toggle editar / vista */}
          <div className="inline-flex rounded-xl border border-line bg-white p-0.5">
            {[
              { v: "editar", l: "Editar" },
              { v: "vista", l: "Vista" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setTab(o.v)}
                className={cx(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  tab === o.v ? "bg-soft text-brand-dark" : "text-muted hover:text-ink"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={(e) => subirArchivo(e.target.files?.[0])}
          />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} title="Cargar un .md">
            <Upload size={16} /> <span className="hidden sm:inline">Subir .md</span>
          </Button>
          {!soyNuevo && (
            <Button variant="ghost" size="sm" onClick={descargarMd} title="Descargar el .md">
              <Download size={16} /> <span className="hidden sm:inline">Descargar</span>
            </Button>
          )}
          {!soyNuevo && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/10"
              onClick={() => setConfirmDel(true)}
              title="Eliminar documento"
            >
              <Trash size={16} />
            </Button>
          )}
          <Button size="sm" onClick={guardar} disabled={!puedeGuardar || saving}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* cuerpo */}
      {status === "loading" && (
        <div className="flex-1 space-y-3 p-4 md:p-5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {status === "error" && (
        <div className="flex-1 p-4 md:p-5">
          <ErrorState title="No pudimos abrir el documento" onRetry={() => setStatus("ready")} />
        </div>
      )}
      {status === "ready" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "editar" ? (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              spellCheck={false}
              placeholder="# Título del documento&#10;&#10;Escribe el contenido en markdown…"
              className="h-full w-full resize-none border-0 bg-white px-5 py-4 font-mono text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-0"
            />
          ) : (
            <div
              className="md-body h-full overflow-y-auto px-6 py-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      )}

      {/* footer info */}
      <div className="border-t border-line bg-softer px-4 py-2 text-center text-[11px] text-muted2">
        {texto.length.toLocaleString("es-MX")} caracteres · al guardar se reindexa el RAG (embeddings) y Orvito lo aprende al instante
      </div>

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Eliminar documento"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDel(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarEliminar}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <b className="text-ink">{nombre}</b> se borrará del conocimiento de Orvito (todos sus
          fragmentos). Esta acción no se puede deshacer.
        </p>
      </Modal>
    </Card>
  );
}

/* ---------------- Modal nuevo ---------------- */
function NuevoModal({ open, onClose, onCrear }) {
  const [nombre, setNombre] = useState("");
  useEffect(() => {
    if (open) setNombre("");
  }, [open]);
  const nd = normaliza(nombre);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo documento"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onCrear(nombre)} disabled={!nd}>
            Crear y editar
          </Button>
        </>
      }
    >
      <Field
        label="Nombre del documento"
        hint={nd ? `Se identificará como: ${nd}` : "Ej. ccm_general, promociones_2026…"}
        hintTone={nd ? "brand" : "muted"}
      >
        <Input
          placeholder="Ej. ccm general"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />
      </Field>
      <p className="text-xs text-muted2">
        Se abre un editor en blanco. Escribe (o sube un .md) y al guardar se indexa en el RAG.
      </p>
    </Modal>
  );
}

/* ---------------- Modal nueva carpeta ---------------- */
function NuevaCarpetaModal({ open, onClose, onCrear }) {
  const [nombre, setNombre] = useState("");
  useEffect(() => {
    if (open) setNombre("");
  }, [open]);
  const nd = normaliza(nombre);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva carpeta"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onCrear(nombre)} disabled={!nd}>
            Crear carpeta
          </Button>
        </>
      }
    >
      <Field
        label="Nombre de la carpeta"
        hint={nd ? `Se guardará como: ${nd}` : "Ej. Promociones, Riviera Maya…"}
        hintTone={nd ? "brand" : "muted"}
      >
        <Input
          placeholder="Ej. Promociones"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />
      </Field>
      <p className="text-xs text-muted2">
        La carpeta aparece vacía. Mueve documentos a ella o crea uno nuevo dentro.
      </p>
    </Modal>
  );
}

/* ---------------- Modal renombrar carpeta ---------------- */
function RenombrarCarpetaModal({ carpeta, proyLabel, onClose, onRenombrar }) {
  const [nombre, setNombre] = useState("");
  useEffect(() => {
    setNombre(carpeta ? proyLabel(carpeta) : "");
  }, [carpeta, proyLabel]);
  const nd = normaliza(nombre);
  return (
    <Modal
      open={!!carpeta}
      onClose={onClose}
      title="Renombrar carpeta"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onRenombrar(carpeta, nombre)} disabled={!nd || nd === carpeta}>
            Renombrar
          </Button>
        </>
      }
    >
      <Field label="Nuevo nombre" hint={nd ? `Se guardará como: ${nd}` : ""} hintTone="brand">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Field>
      <p className="text-xs text-muted2">
        Todos los documentos de esta carpeta quedan bajo el nuevo nombre.
      </p>
    </Modal>
  );
}

/* ---------------- Modal eliminar carpeta ---------------- */
function EliminarCarpetaModal({ carpeta, proyLabel, carpetas, conteo, onClose, onEliminar }) {
  const [modo, setModo] = useState("mover"); // mover | borrar
  const [destino, setDestino] = useState("");
  useEffect(() => {
    if (carpeta) {
      setModo(conteo > 0 ? "mover" : "borrar");
      const otra = (carpetas || []).find((c) => c !== carpeta);
      setDestino(otra || "");
    }
  }, [carpeta, conteo, carpetas]);
  const puede = conteo === 0 || modo === "borrar" || (modo === "mover" && destino);
  return (
    <Modal
      open={!!carpeta}
      onClose={onClose}
      title="Eliminar carpeta"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!puede}
            onClick={() => onEliminar(carpeta, conteo > 0 && modo === "mover" ? destino : "")}
          >
            {conteo > 0 && modo === "borrar" ? "Eliminar todo" : "Eliminar carpeta"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        <b className="text-ink">{carpeta ? proyLabel(carpeta) : ""}</b>{" "}
        {conteo > 0
          ? `tiene ${conteo} ${conteo === 1 ? "documento" : "documentos"}.`
          : "está vacía."}
      </p>
      {conteo > 0 && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={modo === "mover"}
              onChange={() => setModo("mover")}
              className="mt-1"
            />
            <span className="flex-1">
              Mover sus documentos a otra carpeta y luego eliminarla.
              {modo === "mover" && (
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
                >
                  {(carpetas || [])
                    .filter((c) => c !== carpeta)
                    .map((c) => (
                      <option key={c} value={c}>
                        {proyLabel(c)}
                      </option>
                    ))}
                </select>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-danger">
            <input
              type="radio"
              checked={modo === "borrar"}
              onChange={() => setModo("borrar")}
              className="mt-1"
            />
            <span className="flex-1">
              Borrar la carpeta y TODOS sus documentos del conocimiento de Orvito (no se puede
              deshacer).
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}
