import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Toggle,
  StatusChip,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  cx,
  useToast,
} from "../components/ui.jsx";
import { Plus, Copy, Check, Pencil, Trash, Newspaper, Sparkles } from "../components/Icons.jsx";
import { listarBlogs, crearBlog, editarBlog, eliminarBlog } from "../lib/api.js";
import { isHttps, truthy, fmtFecha, todayISO } from "../lib/format.js";

export default function Blogs() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [filtro, setFiltro] = useState("activos"); // activos | todos
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarBlogs());
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  // ordenados por fecha desc; el más reciente ACTIVO es el que comparte Orvito
  const ordenados = useMemo(() => {
    const arr = [...items].sort((a, b) =>
      String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );
    return filtro === "activos" ? arr.filter((b) => truthy(b.activo)) : arr;
  }, [items, filtro]);

  const idReciente = useMemo(() => {
    const activos = items
      .filter((b) => truthy(b.activo) && b.fecha)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return activos[0]?.Id ?? null;
  }, [items]);

  const onSaved = async (msg) => {
    setModal(null);
    await load();
    toast.success(msg);
  };
  const confirmDelete = async () => {
    const b = toDelete;
    setToDelete(null);
    try {
      await eliminarBlog(b.Id);
      await load();
      toast.success("Blog quitado.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Blogs"
        subtitle="Tendencias inmobiliarias. Orvito comparte siempre el más reciente."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nuevo blog
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "activos", label: "Activos" },
            { value: "todos", label: "Todos" },
          ]}
        />
      </div>

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar los blogs"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && ordenados.length === 0 && (
        <EmptyState
          icon={<Newspaper size={22} />}
          title={filtro === "activos" ? "Aún no hay blogs" : "Sin blogs"}
          text="Agrega el primer blog de tendencias. Orvito compartirá automáticamente el de la fecha más reciente."
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nuevo blog
            </Button>
          }
        />
      )}

      {status === "ready" && ordenados.length > 0 && (
        <div className="space-y-3">
          {ordenados.map((b) => (
            <BlogCard
              key={b.Id}
              b={b}
              esReciente={b.Id === idReciente}
              onEdit={() => setModal({ mode: "editar", data: b })}
              onDelete={() => setToDelete(b)}
            />
          ))}
        </div>
      )}

      {modal && (
        <BlogModal
          mode={modal.mode}
          data={modal.data}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Vas a quitar este blog"
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Quitar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <b className="text-ink">{toDelete?.titulo}</b> dejará de estar disponible. Si era el más
          reciente, Orvito pasará a compartir el siguiente más nuevo.
        </p>
      </Modal>
    </Layout>
  );
}

/* --------- Card --------- */
function BlogCard({ b, esReciente, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const activo = truthy(b.activo);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.url || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <Card className={cx("p-5", esReciente && "border-brand-leaf/40 ring-1 ring-brand-leaf/20")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{b.titulo || "(sin título)"}</h3>
            {esReciente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-leaf/15 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
                <Sparkles size={12} /> Lo comparte Orvito
              </span>
            )}
            <StatusChip estado={activo ? "Activo" : "Inactivo"} />
          </div>
          <p className="mt-1 text-xs text-muted2">{b.fecha ? fmtFecha(b.fecha) : "Sin fecha"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-muted2 hover:bg-soft hover:text-ink"
            aria-label="Editar"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-muted2 hover:bg-danger/10 hover:text-danger"
            aria-label="Quitar"
            title="Quitar"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-softer px-3 py-2">
        <a
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-brand-dark hover:underline"
          title={b.url}
        >
          {prettyUrl(b.url)}
        </a>
        <button
          onClick={copy}
          className="ml-auto shrink-0 rounded-md p-1 text-muted2 hover:bg-white hover:text-ink"
          aria-label="Copiar enlace"
          title="Copiar enlace"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      {b.notas && <p className="mt-2 text-sm leading-relaxed text-muted">{b.notas}</p>}
    </Card>
  );
}

/* --------- Modal --------- */
function BlogModal({ mode, data, onClose, onSaved }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(data.titulo || "");
  const [url, setUrl] = useState(data.url || "");
  const [fecha, setFecha] = useState(data.fecha ? String(data.fecha).slice(0, 10) : todayISO());
  const [notas, setNotas] = useState(data.notas || "");
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const urlOk = url && isHttps(url);
  const valid = titulo.trim() && urlOk && fecha;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload = { titulo: titulo.trim(), url: url.trim(), fecha, notas: notas.trim(), activo };
      if (mode === "crear") await crearBlog(payload);
      else await editarBlog({ Id: data.Id, ...payload });
      onSaved(mode === "crear" ? "Blog agregado." : "Cambios guardados.");
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "crear" ? "Nuevo blog" : "Editar blog"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <Field
        label="Título"
        hint={touched && !titulo.trim() ? "El título es obligatorio." : ""}
        hintTone="amber"
      >
        <Input
          placeholder="Ej. Tendencias inmobiliarias — Julio 2026"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Field>

      <Field
        label="Enlace del blog"
        hint={touched && !url ? "El enlace es obligatorio." : url && !urlOk ? "Debe ser un enlace https válido." : ""}
        hintTone="amber"
      >
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <Field
        label="Fecha de publicación"
        hint="Orvito comparte el blog activo con la fecha más reciente."
      >
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      </Field>

      <Field label="Notas" hint="Para tu equipo — Orvito no las comparte.">
        <Textarea
          placeholder="Notas internas del blog…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Activo</p>
          <p className="text-xs text-muted">Entra en la rotación que Orvito puede compartir</p>
        </div>
        <Toggle checked={activo} onChange={setActivo} />
      </div>
    </Modal>
  );
}

/* --------- helpers --------- */
function prettyUrl(u) {
  if (!u) return "";
  return String(u).replace(/^https?:\/\//, "").slice(0, 52) + (String(u).length > 58 ? "…" : "");
}
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-soft text-brand-dark" : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
