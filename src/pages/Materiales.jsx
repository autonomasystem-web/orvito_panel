import { useEffect, useMemo, useRef, useState } from "react";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Field,
  Input,
  SearchInput,
  Textarea,
  Toggle,
  StatusChip,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  useToast,
} from "../components/ui.jsx";
import { Plus, Copy, Check, Dots, Pencil, Trash, Folder } from "../components/Icons.jsx";
import { listarBrochures, crearBrochure, editarBrochure, eliminarBrochure } from "../lib/api.js";
import { normalizeDropbox, isHttps, truthy } from "../lib/format.js";

export default function Materiales() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("activos"); // activos | todos
  const [modal, setModal] = useState(null); // {mode:'crear'|'editar', data}
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarBrochures());
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter((b) => (filtro === "activos" ? truthy(b.activo) : true))
      .filter((b) => !term || String(b.proyecto || "").toLowerCase().includes(term));
  }, [items, q, filtro]);

  const onSaved = async (msg) => {
    setModal(null);
    await load();
    toast.success(msg);
  };

  const quickToggle = async (b) => {
    try {
      await editarBrochure({ Id: b.Id, activo: !truthy(b.activo) });
      await load();
      toast.success(truthy(b.activo) ? "Material desactivado." : "Material activado.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmDelete = async () => {
    const b = toDelete;
    setToDelete(null);
    try {
      await eliminarBrochure(b.Id);
      await load();
      toast.success("Material eliminado.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Materiales"
        subtitle="Los brochures que Orvito comparte por WhatsApp."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nuevo material
          </Button>
        }
      />

      {/* toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            placeholder="Buscar por proyecto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="space-y-4 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar tus materiales"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && filtered.length === 0 && (
        <EmptyState
          icon={<Folder size={22} />}
          title={q || filtro === "activos" ? "Sin resultados" : "Aún no hay materiales"}
          text={
            q
              ? "No encontramos materiales con ese proyecto."
              : "Agrega el primer brochure para que Orvito lo comparta cuando lo pidan."
          }
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nuevo material
            </Button>
          }
        />
      )}

      {status === "ready" && filtered.length > 0 && (
        <div className="seq cards-lift grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <MaterialCard
              key={b.Id}
              b={b}
              onEdit={() => setModal({ mode: "editar", data: b })}
              onDelete={() => setToDelete(b)}
              onToggle={() => quickToggle(b)}
            />
          ))}
        </div>
      )}

      {modal && (
        <MaterialModal
          mode={modal.mode}
          data={modal.data}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Vas a eliminar este material"
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <b className="text-ink">{toDelete?.proyecto}</b> dejará de estar disponible y Orvito ya no
          lo compartirá. Esta acción se puede revertir reactivándolo.
        </p>
      </Modal>
    </Layout>
  );
}

/* --------- Card --------- */
function MaterialCard({ b, onEdit, onDelete, onToggle }) {
  const [menu, setMenu] = useState(false);
  const activo = truthy(b.activo);
  return (
    <Card className="relative flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-ink">{b.proyecto}</h3>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
            className="rounded-lg p-1 text-muted2 hover:bg-soft hover:text-ink"
            aria-label="Acciones"
          >
            <Dots size={18} />
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-modal">
              <MenuItem icon={<Pencil size={16} />} onClick={onEdit}>
                Editar
              </MenuItem>
              <MenuItem icon={<Check size={16} />} onClick={onToggle}>
                {activo ? "Marcar inactivo" : "Marcar activo"}
              </MenuItem>
              <MenuItem icon={<Trash size={16} />} danger onClick={onDelete}>
                Eliminar
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      <StatusChip estado={activo ? "Activo" : "Inactivo"} />

      <div className="space-y-1.5">
        <LinkChip label={b.url_en ? "ES" : null} url={b.url} />
        {b.url_en && <LinkChip label="EN" url={b.url_en} />}
      </div>

      {b.notas && <p className="text-sm leading-relaxed text-muted">{b.notas}</p>}
    </Card>
  );
}
function MenuItem({ icon, children, onClick, danger }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-soft " +
        (danger ? "text-danger" : "text-ink")
      }
    >
      {icon}
      {children}
    </button>
  );
}

/* --------- Modal crear/editar --------- */
function MaterialModal({ mode, data, onClose, onSaved }) {
  const toast = useToast();
  const [proyecto, setProyecto] = useState(data.proyecto || "");
  const [url, setUrl] = useState(data.url || "");
  const [urlEn, setUrlEn] = useState(data.url_en || "");
  const [notas, setNotas] = useState(data.notas || "");
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const norm = normalizeDropbox(url);
  const normEn = normalizeDropbox(urlEn);
  const urlOk = url && isHttps(url);
  const valid = proyecto.trim() && urlOk;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        proyecto: proyecto.trim(),
        url: url.trim(),
        url_en: urlEn.trim(),
        notas: notas.trim(),
        activo,
      };
      if (mode === "crear") await crearBrochure(payload);
      else await editarBrochure({ Id: data.Id, ...payload });
      onSaved(mode === "crear" ? "Material creado." : "Cambios guardados.");
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "crear" ? "Nuevo material" : "Editar material"}
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
        label="Proyecto"
        hint={touched && !proyecto.trim() ? "El proyecto es obligatorio." : ""}
        hintTone="amber"
      >
        <Input
          placeholder="Ej. Torre Mirador"
          value={proyecto}
          onChange={(e) => setProyecto(e.target.value)}
        />
      </Field>

      <Field
        label="Brochure en español (Dropbox)"
        hint={
          touched && !url
            ? "El enlace es obligatorio."
            : url && !urlOk
            ? "Debe ser un enlace https válido."
            : norm.changed
            ? "Se convertirá a descarga directa (raw=1)."
            : ""
        }
        hintTone={touched && (!url || !urlOk) ? "amber" : "brand"}
      >
        <Input
          placeholder="https://www.dropbox.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <Field
        label="Brochure en inglés (Dropbox) — opcional"
        hint={
          urlEn && !isHttps(urlEn)
            ? "Debe ser un enlace https válido."
            : normEn.changed
            ? "Se convertirá a descarga directa (raw=1)."
            : "Si lo agregas, Orvito lo envía cuando el cliente lo pide en inglés."
        }
        hintTone={urlEn && !isHttps(urlEn) ? "amber" : "brand"}
      >
        <Input
          placeholder="https://www.dropbox.com/…"
          value={urlEn}
          onChange={(e) => setUrlEn(e.target.value)}
        />
      </Field>

      <Field label="Notas" hint="Notas para tu equipo — Orvito no las comparte.">
        <Textarea
          placeholder="Notas para tu equipo — Orvito no las comparte."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Activo</p>
          <p className="text-xs text-muted">Orvito lo compartirá cuando lo pidan</p>
        </div>
        <Toggle checked={activo} onChange={setActivo} />
      </div>
    </Modal>
  );
}

/* --------- chip de enlace con copiar --------- */
function LinkChip({ label, url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-softer px-3 py-2">
      {label && (
        <span className="shrink-0 rounded bg-brand-dark px-1.5 py-0.5 text-[10px] font-bold text-white">
          {label}
        </span>
      )}
      <span className="truncate text-xs text-muted">{prettyUrl(url)}</span>
      <button
        onClick={copy}
        className="ml-auto shrink-0 rounded-md p-1 text-muted2 hover:bg-white hover:text-ink"
        aria-label="Copiar enlace"
        title="Copiar enlace"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/* --------- helpers UI locales --------- */
function prettyUrl(u) {
  if (!u) return "";
  return String(u).replace(/^https?:\/\//, "").slice(0, 46) + (String(u).length > 52 ? "…" : "");
}
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors " +
            (value === o.value ? "bg-soft text-brand-dark" : "text-muted hover:text-ink")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
