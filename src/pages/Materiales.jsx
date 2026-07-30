import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Plus, Copy, Check, Dots, Pencil, Trash, Folder } from "../components/Icons.jsx";
import { listarBrochures, crearBrochure, editarBrochure, eliminarBrochure } from "../lib/api.js";
import { normalizeDropbox, isHttps, truthy } from "../lib/format.js";

const CATEGORIAS_SUG = ["General", "Torres", "Edificios", "Etapas", "Golf", "Town", "Amenidades", "Casa Club", "Ubicación"];

// Slug legible por proyecto para la URL (ej. "Ciudad Central Mérida" -> "ciudad-central-merida")
function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Materiales() {
  const { proyecto: slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nombreParam = searchParams.get("nombre") || ""; // proyecto nuevo aún sin materiales
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [filtro, setFiltro] = useState("activos"); // activos | todos
  const [modal, setModal] = useState(null);
  const [nuevoProy, setNuevoProy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarBrochures());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const proyectosNombres = useMemo(
    () => [...new Set(items.map((b) => b.proyecto).filter(Boolean))].sort(),
    [items]
  );

  // Proyecto seleccionado por la ruta
  const proyectoSel = useMemo(() => {
    if (!slug) return null;
    const hit = items.find((b) => slugify(b.proyecto) === slug);
    if (hit) return hit.proyecto;
    if (nombreParam && slugify(nombreParam) === slug) return nombreParam;
    return null;
  }, [slug, items, nombreParam]);

  // Bloques por proyecto (índice)
  const bloques = useMemo(() => {
    const m = new Map();
    for (const b of items) {
      if (filtro === "activos" && !truthy(b.activo)) continue;
      const p = b.proyecto || "(sin proyecto)";
      if (!m.has(p)) m.set(p, { proyecto: p, slug: slugify(p), total: 0 });
      m.get(p).total++;
    }
    return [...m.values()].sort((a, b) => a.proyecto.localeCompare(b.proyecto, "es"));
  }, [items, filtro]);

  // Materiales del proyecto, agrupados por categoría (detalle)
  const gruposCat = useMemo(() => {
    if (!proyectoSel) return [];
    let arr = items.filter((b) => b.proyecto === proyectoSel);
    if (filtro === "activos") arr = arr.filter((b) => truthy(b.activo));
    const m = new Map();
    for (const b of arr) {
      const c = (b.categoria || "General").trim() || "General";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(b);
    }
    return [...m.entries()]
      .map(([categoria, mats]) => ({ categoria, mats }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "es"));
  }, [items, proyectoSel, filtro]);

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

  const esDetalle = !!slug;

  return (
    <Layout>
      <PageHeader
        title={
          esDetalle ? (
            <span className="flex items-center gap-2">
              <button
                onClick={() => navigate("/materiales")}
                className="-ml-1 rounded-lg px-1.5 text-muted hover:bg-soft hover:text-ink"
                aria-label="Volver a proyectos"
                title="Volver a proyectos"
              >
                ←
              </button>
              <Folder size={20} className="text-brand-dark" />
              {proyectoSel || (status === "ready" ? "Proyecto" : "…")}
            </span>
          ) : (
            "Materiales"
          )
        }
        subtitle={
          esDetalle
            ? "Brochures e imágenes por categoría. La descripción le dice a Orvito cuándo compartir cada material."
            : "Elige un proyecto para ver y organizar sus materiales."
        }
        action={
          esDetalle ? (
            <Button
              onClick={() => setModal({ mode: "crear", data: { proyecto: proyectoSel || "" } })}
              disabled={!proyectoSel}
            >
              <Plus size={18} /> Nuevo material
            </Button>
          ) : (
            <Button onClick={() => setNuevoProy(true)}>
              <Plus size={18} /> Nuevo proyecto
            </Button>
          )
        }
      />

      <div className="mb-6">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
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

      {/* ---------- DETALLE: /materiales/:slug ---------- */}
      {status === "ready" && esDetalle && !proyectoSel && (
        <EmptyState
          icon={<Folder size={22} />}
          title="Proyecto no encontrado"
          text="Ese proyecto no tiene materiales o el enlace cambió."
          action={<Button onClick={() => navigate("/materiales")}>Ver proyectos</Button>}
        />
      )}

      {status === "ready" && esDetalle && proyectoSel && gruposCat.length === 0 && (
        <EmptyState
          icon={<Folder size={22} />}
          title="Sin materiales"
          text={
            filtro === "activos"
              ? "Este proyecto no tiene materiales activos. Cambia a 'Todos' o agrega uno."
              : "Agrega el primer material (brochure o imagen) de este proyecto."
          }
          action={
            <Button onClick={() => setModal({ mode: "crear", data: { proyecto: proyectoSel } })}>
              <Plus size={18} /> Nuevo material
            </Button>
          }
        />
      )}

      {status === "ready" && esDetalle && proyectoSel && gruposCat.length > 0 && (
        <div className="seq space-y-6">
          {gruposCat.map(({ categoria, mats }) => (
            <div key={categoria}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-dark">
                {categoria}
                <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                  {mats.length}
                </span>
              </h2>
              <div className="cards-lift grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mats.map((b) => (
                  <MaterialCard
                    key={b.Id}
                    b={b}
                    onEdit={() => setModal({ mode: "editar", data: b })}
                    onDelete={() => setToDelete(b)}
                    onToggle={() => quickToggle(b)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- ÍNDICE: /materiales ---------- */}
      {status === "ready" && !esDetalle && bloques.length === 0 && (
        <EmptyState
          icon={<Folder size={22} />}
          title={filtro === "activos" ? "Aún no hay proyectos con materiales" : "Sin proyectos"}
          text="Crea un proyecto y luego agrega sus brochures e imágenes por categoría."
          action={
            <Button onClick={() => setNuevoProy(true)}>
              <Plus size={18} /> Nuevo proyecto
            </Button>
          }
        />
      )}

      {status === "ready" && !esDetalle && bloques.length > 0 && (
        <div className="seq grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bloques.map((b) => (
            <ProyectoBlock key={b.slug} b={b} onClick={() => navigate(`/materiales/${b.slug}`)} />
          ))}
          <button
            onClick={() => setNuevoProy(true)}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-transparent p-5 text-muted transition-colors hover:border-brand-leaf/50 hover:bg-soft/30 hover:text-brand-dark"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-brand-dark">
              <Plus size={22} />
            </span>
            <span className="text-sm font-semibold">Nuevo proyecto</span>
          </button>
        </div>
      )}

      {nuevoProy && (
        <NuevoProyectoModal
          onClose={() => setNuevoProy(false)}
          onCrear={(nombre) => {
            setNuevoProy(false);
            navigate(`/materiales/${slugify(nombre)}?nombre=${encodeURIComponent(nombre)}`);
          }}
        />
      )}

      {modal && (
        <MaterialModal
          mode={modal.mode}
          data={modal.data}
          proyectos={proyectosNombres}
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
          <b className="text-ink">
            {toDelete?.categoria || "General"} · {(toDelete?.tipo || "brochure") === "imagen" ? "Imagen" : "Brochure"}
          </b>{" "}
          de {toDelete?.proyecto} dejará de compartirse. Se puede revertir reactivándolo en "Todos".
        </p>
      </Modal>
    </Layout>
  );
}

/* --------- Bloque de proyecto (índice) --------- */
function ProyectoBlock({ b, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-colors hover:border-brand-leaf/40 hover:bg-soft/30"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-brand-dark">
        <Folder size={22} />
      </span>
      <div className="min-w-0">
        <h3 className="truncate font-display text-lg font-bold text-brand-dark">{b.proyecto}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {b.total} {b.total === 1 ? "material" : "materiales"}
        </p>
      </div>
      <span className="mt-1 text-sm font-semibold text-brand-green transition-transform group-hover:translate-x-0.5">
        Ver materiales →
      </span>
    </button>
  );
}

/* --------- Modal: nuevo proyecto --------- */
function NuevoProyectoModal({ onClose, onCrear }) {
  const [nombre, setNombre] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = nombre.trim().length > 1;
  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onCrear(nombre.trim());
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo proyecto"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Continuar</Button>
        </>
      }
    >
      <Field
        label="Nombre del proyecto"
        hint={touched && !valid ? "Escribe el nombre del proyecto." : "Ej. Ciudad Central Mérida"}
        hintTone={touched && !valid ? "amber" : "muted"}
      >
        <Input
          autoFocus
          placeholder="Ej. Ciudad Central Mérida"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <p className="mt-1 text-xs text-muted2">Se abre el proyecto para que agregues sus materiales por categoría.</p>
    </Modal>
  );
}

/* --------- Card de material --------- */
function MaterialCard({ b, onEdit, onDelete, onToggle }) {
  const [menu, setMenu] = useState(false);
  const activo = truthy(b.activo);
  const esImg = (b.tipo || "brochure") === "imagen";
  return (
    <Card className="relative flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              esImg ? "bg-brand-leaf/15 text-brand-green" : "bg-brand-dark text-white"
            )}
          >
            {esImg ? "Imagen" : "Brochure"}
          </span>
          <StatusChip estado={activo ? "Activo" : "Inactivo"} />
        </div>
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

      {esImg && b.url && (
        <a href={b.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-softer">
          <img
            src={b.url}
            alt=""
            loading="lazy"
            className="h-32 w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </a>
      )}

      <div className="space-y-1.5">
        <LinkChip label={!esImg && b.url_en ? "ES" : null} url={b.url} />
        {!esImg && b.url_en && <LinkChip label="EN" url={b.url_en} />}
      </div>

      {b.descripcion && (
        <p className="rounded-lg bg-soft/50 px-2.5 py-1.5 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-brand-dark">Orvito la usa cuando: </span>
          {b.descripcion}
        </p>
      )}
      {b.notas && <p className="text-xs text-muted2">{b.notas}</p>}
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

/* --------- Modal crear/editar material --------- */
function MaterialModal({ mode, data, proyectos, onClose, onSaved }) {
  const toast = useToast();
  const [proyecto, setProyecto] = useState(data.proyecto || "");
  const [categoria, setCategoria] = useState(data.categoria || "General");
  const [tipo, setTipo] = useState(data.tipo || "brochure");
  const [url, setUrl] = useState(data.url || "");
  const [urlEn, setUrlEn] = useState(data.url_en || "");
  const [descripcion, setDescripcion] = useState(data.descripcion || "");
  const [notas, setNotas] = useState(data.notas || "");
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const esImg = tipo === "imagen";
  const norm = normalizeDropbox(url);
  const urlOk = url && isHttps(url);
  const valid = proyecto.trim() && categoria.trim() && urlOk;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        proyecto: proyecto.trim(),
        categoria: categoria.trim(),
        tipo,
        url: url.trim(),
        url_en: esImg ? "" : urlEn.trim(),
        descripcion: descripcion.trim(),
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
      size="lg"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Proyecto"
          hint={touched && !proyecto.trim() ? "Obligatorio." : "Escribe uno nuevo o elige de la lista."}
          hintTone={touched && !proyecto.trim() ? "amber" : "muted"}
        >
          <Input
            placeholder="Ej. Ciudad Central Mérida"
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            list="materiales-proyectos"
          />
          <datalist id="materiales-proyectos">
            {proyectos.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Categoría"
          hint={touched && !categoria.trim() ? "Obligatorio." : "General, Torres, Etapas, Golf, Town…"}
          hintTone={touched && !categoria.trim() ? "amber" : "muted"}
        >
          <Input
            placeholder="Ej. Torres"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="materiales-categorias"
          />
          <datalist id="materiales-categorias">
            {CATEGORIAS_SUG.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Tipo de material">
        <Segmented
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "brochure", label: "Brochure (PDF)" },
            { value: "imagen", label: "Imagen" },
          ]}
        />
      </Field>

      <Field
        label={esImg ? "Enlace de la imagen" : "Enlace del brochure (Dropbox)"}
        hint={
          touched && !url
            ? "El enlace es obligatorio."
            : url && !urlOk
            ? "Debe ser un enlace https válido."
            : !esImg && norm.changed
            ? "Se convertirá a descarga directa (raw=1)."
            : esImg
            ? "Pega la URL directa de la imagen (Dropbox, Drive público, web…)."
            : ""
        }
        hintTone={touched && (!url || !urlOk) ? "amber" : "brand"}
      >
        <Input
          placeholder={esImg ? "https://…/imagen.jpg" : "https://www.dropbox.com/…"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      {!esImg && (
        <Field
          label="Brochure en inglés (Dropbox) — opcional"
          hint={
            urlEn && !isHttps(urlEn)
              ? "Debe ser un enlace https válido."
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
      )}

      <Field
        label="¿Cuándo debe usarla Orvito?"
        hint="Descripción para que el agente sepa en qué momento compartir este material."
      >
        <Textarea
          placeholder="Ej. Cuando pregunten por las torres/edificios de CCM, o pidan ver cómo se ven las amenidades."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </Field>

      <Field label="Notas" hint="Notas para tu equipo — Orvito no las comparte.">
        <Textarea
          placeholder="Notas internas (opcional)."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Activo</p>
          <p className="text-xs text-muted">Orvito lo compartirá cuando aplique</p>
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
          type="button"
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
