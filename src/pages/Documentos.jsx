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
import { Book, Save, Upload, Trash, Sparkles, Plus } from "../components/Icons.jsx";
import {
  listarDocumentos,
  verDocumento,
  guardarDocumento,
  eliminarDocumento,
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
  const [status, setStatus] = useState("loading");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null); // nombre_doc seleccionado
  const [nuevo, setNuevo] = useState(false); // modal nuevo

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setDocs(await listarDocumentos());
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
          <Button onClick={() => setNuevo(true)}>
            <Plus size={18} /> Nuevo documento
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,300px)_1fr]">
        {/* LISTA */}
        <div className={cx("min-w-0", sel && "hidden md:block")}>
          <div className="mb-3">
            <SearchInput
              placeholder="Buscar documento…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {status === "loading" && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
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
          {status === "ready" && filtered.length > 0 && (
            <div className="seq space-y-2">
              {filtered.map((d) => (
                <button
                  key={d.nombre_doc}
                  onClick={() => setSel({ nombre_doc: d.nombre_doc })}
                  className={cx(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selName === d.nombre_doc
                      ? "border-brand-leaf/50 bg-soft/60"
                      : "border-line bg-white hover:bg-softer"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-brand-green">
                      <Book size={16} />
                    </span>
                    <span className="truncate text-sm font-medium text-ink">{d.nombre_doc}</span>
                  </div>
                  {d.categoria && (
                    <span className="ml-6 mt-0.5 inline-block rounded-full bg-soft px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                      {d.categoria}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* EDITOR */}
        <div className={cx(!sel && "hidden md:block")}>
          {!sel ? (
            <Card className="hidden min-h-[420px] flex-col items-center justify-center p-10 text-center md:flex md:h-[calc(100vh-13rem)]">
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

      {/* modal nuevo documento */}
      <NuevoModal open={nuevo} onClose={() => setNuevo(false)} onCrear={abrirNuevo} />
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

  const html = useMemo(() => {
    try {
      return marked.parse(texto || "");
    } catch {
      return "";
    }
  }, [texto]);

  return (
    <Card className="flex h-[70vh] min-h-[460px] flex-col overflow-hidden md:h-[calc(100vh-13rem)]">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink md:hidden"
          aria-label="Volver"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{nombre}</p>
          <p className="text-xs text-muted2">
            {soyNuevo ? "Documento nuevo" : `${meta.categoria || "—"} · ${meta.total_chunks} fragmentos`}
            {dirty && <span className="ml-2 text-amber">• sin guardar</span>}
          </p>
        </div>

        {/* toggle editar / vista */}
        <div className="inline-flex rounded-xl border border-line bg-white p-0.5">
          {[
            { v: "editar", l: "Editar" },
            { v: "vista", l: "Vista previa" },
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
          <Upload size={16} /> Subir .md
        </Button>
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

      {/* cuerpo */}
      {status === "loading" && (
        <div className="flex-1 space-y-3 p-5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {status === "error" && (
        <div className="flex-1 p-5">
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
