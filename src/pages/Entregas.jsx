import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Field,
  Input,
  Toggle,
  StatusChip,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  inputCls,
  cx,
  useToast,
} from "../components/ui.jsx";
import { Plus, Pencil, Trash, Calendar, MapPin } from "../components/Icons.jsx";
import { listarEntregas, crearEntrega, editarEntrega, eliminarEntrega } from "../lib/api.js";
import { fmtFecha, truthy } from "../lib/format.js";

const TIPOS = ["Privada", "Torre"];

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

// "Privada 3" / "Torre A", sin duplicar el tipo si el nombre ya lo trae
function unidadTxt(e) {
  if (!e) return "";
  const nom = String(e.nombre || "").trim();
  const tip = String(e.tipo || "").trim();
  if (tip && nom && !nom.toLowerCase().startsWith(tip.toLowerCase())) return `${tip} ${nom}`;
  return nom || tip;
}

// Fecha de entrega + N meses de prórroga (cálculo)
function addMonths(iso, n) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + (Number(n) || 0));
  return d.toISOString().slice(0, 10);
}

export default function Entregas() {
  const { proyecto: slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nombreParam = searchParams.get("nombre") || ""; // proyecto nuevo aún sin entregas
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [filtro, setFiltro] = useState("activos"); // activos | todos
  const [modal, setModal] = useState(null);
  const [nuevoProy, setNuevoProy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarEntregas());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  // Nombres de proyecto (para el autocompletado del modal)
  const proyectosNombres = useMemo(
    () => [...new Set(items.map((e) => e.proyecto).filter(Boolean))].sort(),
    [items]
  );

  // Proyecto seleccionado por la ruta (si hay slug)
  const proyectoSel = useMemo(() => {
    if (!slug) return null;
    const hit = items.find((e) => slugify(e.proyecto) === slug);
    if (hit) return hit.proyecto;
    // Proyecto recién creado (aún sin entregas): usa el nombre del query param.
    if (nombreParam && slugify(nombreParam) === slug) return nombreParam;
    return null;
  }, [slug, items, nombreParam]);

  // Bloques por proyecto (índice), con conteo según el filtro
  const bloques = useMemo(() => {
    const m = new Map();
    for (const e of items) {
      if (filtro === "activos" && !truthy(e.activo)) continue;
      const p = e.proyecto || "(sin proyecto)";
      if (!m.has(p)) m.set(p, { proyecto: p, slug: slugify(p), total: 0 });
      m.get(p).total++;
    }
    return [...m.values()].sort((a, b) => a.proyecto.localeCompare(b.proyecto, "es"));
  }, [items, filtro]);

  // Entregas del proyecto seleccionado (detalle)
  const entregasProyecto = useMemo(() => {
    if (!proyectoSel) return [];
    let arr = items.filter((e) => e.proyecto === proyectoSel);
    if (filtro === "activos") arr = arr.filter((e) => truthy(e.activo));
    arr.sort(
      (a, b) =>
        String(a.etapa || "").localeCompare(String(b.etapa || ""), "es", { numeric: true }) ||
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { numeric: true })
    );
    return arr;
  }, [items, proyectoSel, filtro]);

  const onSaved = async (msg) => {
    setModal(null);
    await load();
    toast.success(msg);
  };
  const confirmDelete = async () => {
    const e = toDelete;
    setToDelete(null);
    try {
      await eliminarEntrega(e.Id);
      await load();
      toast.success("Entrega quitada.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const esDetalle = !!slug;
  const filtroCtl = (
    <Segmented
      value={filtro}
      onChange={setFiltro}
      options={[
        { value: "activos", label: "Activas" },
        { value: "todos", label: "Todas" },
      ]}
    />
  );

  return (
    <Layout>
      <PageHeader
        title={
          esDetalle ? (
            <span className="flex items-center gap-2">
              <button
                onClick={() => navigate("/entregas")}
                className="-ml-1 rounded-lg px-1.5 text-muted hover:bg-soft hover:text-ink"
                aria-label="Volver a proyectos"
                title="Volver a proyectos"
              >
                ←
              </button>
              <MapPin size={20} className="text-brand-dark" />
              {proyectoSel || (status === "ready" ? "Proyecto" : "…")}
            </span>
          ) : (
            "Entregas"
          )
        }
        subtitle={
          esDetalle
            ? "Entregas por etapa. La info CLIENTE es lo que se comunica al cliente."
            : "Elige un proyecto para ver sus entregas por etapa."
        }
        action={
          esDetalle ? (
            <Button
              onClick={() => setModal({ mode: "crear", data: { proyecto: proyectoSel || "" } })}
              disabled={!proyectoSel}
            >
              <Plus size={18} /> Nueva entrega
            </Button>
          ) : (
            <Button onClick={() => setNuevoProy(true)}>
              <Plus size={18} /> Nuevo proyecto
            </Button>
          )
        }
      />

      <div className="mb-6">{filtroCtl}</div>

      {status === "loading" &&
        (esDetalle ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3 p-4 md:p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3 p-5">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        ))}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar las entregas"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {/* ---------- DETALLE: /entregas/:slug ---------- */}
      {status === "ready" && esDetalle && !proyectoSel && (
        <EmptyState
          icon={<MapPin size={22} />}
          title="Proyecto no encontrado"
          text="Ese proyecto no tiene entregas o el enlace cambió."
          action={<Button onClick={() => navigate("/entregas")}>Ver proyectos</Button>}
        />
      )}

      {status === "ready" && esDetalle && proyectoSel && entregasProyecto.length === 0 && (
        <EmptyState
          icon={<Calendar size={22} />}
          title="Sin entregas"
          text={
            filtro === "activos"
              ? "Este proyecto no tiene entregas activas. Cambia a 'Todas' o agrega una."
              : "Agrega la primera entrega de este proyecto."
          }
          action={
            <Button onClick={() => setModal({ mode: "crear", data: { proyecto: proyectoSel } })}>
              <Plus size={18} /> Nueva entrega
            </Button>
          }
        />
      )}

      {status === "ready" && esDetalle && proyectoSel && entregasProyecto.length > 0 && (
        <div className="seq cards-lift space-y-3">
          {entregasProyecto.map((e) => (
            <EntregaCard
              key={e.Id}
              e={e}
              onEdit={() => setModal({ mode: "editar", data: e })}
              onDelete={() => setToDelete(e)}
            />
          ))}
        </div>
      )}

      {/* ---------- ÍNDICE: /entregas ---------- */}
      {status === "ready" && !esDetalle && bloques.length === 0 && (
        <EmptyState
          icon={<MapPin size={22} />}
          title={filtro === "activos" ? "Aún no hay proyectos con entregas" : "Sin proyectos"}
          text="Crea un proyecto y luego agrega sus entregas por etapa."
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
            <ProyectoBlock key={b.slug} b={b} onClick={() => navigate(`/entregas/${b.slug}`)} />
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
            navigate(`/entregas/${slugify(nombre)}?nombre=${encodeURIComponent(nombre)}`);
          }}
        />
      )}

      {modal && (
        <EntregaModal
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
        title="Vas a quitar esta entrega"
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
          <b className="text-ink">
            {toDelete?.etapa} · {unidadTxt(toDelete)}
          </b>{" "}
          de {toDelete?.proyecto} dejará de mostrarse. La puedes recuperar en "Todas".
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
        <MapPin size={22} />
      </span>
      <div className="min-w-0">
        <h3 className="truncate font-display text-lg font-bold text-brand-dark">{b.proyecto}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {b.total} {b.total === 1 ? "entrega" : "entregas"}
        </p>
      </div>
      <span className="mt-1 text-sm font-semibold text-brand-green transition-transform group-hover:translate-x-0.5">
        Ver entregas →
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
        hint={touched && !valid ? "Escribe el nombre del proyecto." : "Ej. Ciudad Central Progreso"}
        hintTone={touched && !valid ? "amber" : "muted"}
      >
        <Input
          autoFocus
          placeholder="Ej. Ciudad Central Progreso"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <p className="mt-1 text-xs text-muted2">
        Se abre el proyecto para que agregues sus entregas por etapa.
      </p>
    </Modal>
  );
}

/* --------- Card --------- */
function EntregaCard({ e, onEdit, onDelete }) {
  const activo = truthy(e.activo);
  const prorroga = addMonths(e.fecha_entrega, e.meses_prorroga ?? 12);
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">
              {e.etapa || "—"} · {unidadTxt(e)}
            </h3>
            <StatusChip estado={activo ? "Activo" : "Inactivo"} />
          </div>
          {e.info_cliente && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-leaf/15 px-2.5 py-0.5 text-xs font-semibold text-brand-green">
              <Calendar size={12} /> Cliente: {e.info_cliente}
            </div>
          )}
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

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <DateItem label="Salida" value={e.fecha_salida} />
        <DateItem label="Entrega (ideal)" value={e.fecha_entrega} />
        <DateItem label={`+${e.meses_prorroga ?? 12} meses prórroga`} value={prorroga} muted />
        <DateItem label="Entrega REAL" value={e.fecha_entrega_real} strong />
      </div>
    </Card>
  );
}

function DateItem({ label, value, muted, strong }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted2">{label}</p>
      <p
        className={cx(
          "mt-0.5 font-medium",
          value ? (strong ? "text-brand-dark" : muted ? "text-muted" : "text-ink") : "text-muted2"
        )}
      >
        {value ? fmtFecha(value) : "—"}
      </p>
    </div>
  );
}

/* --------- Modal --------- */
function EntregaModal({ mode, data, proyectos, onClose, onSaved }) {
  const toast = useToast();
  const [proyecto, setProyecto] = useState(data.proyecto || "");
  const [etapa, setEtapa] = useState(data.etapa || "");
  const [tipo, setTipo] = useState(data.tipo || "Privada");
  const [nombre, setNombre] = useState(data.nombre || "");
  const [fechaSalida, setFechaSalida] = useState(
    data.fecha_salida ? String(data.fecha_salida).slice(0, 10) : ""
  );
  const [fechaEntrega, setFechaEntrega] = useState(
    data.fecha_entrega ? String(data.fecha_entrega).slice(0, 10) : ""
  );
  const [meses, setMeses] = useState(data.meses_prorroga ?? 12);
  const [fechaReal, setFechaReal] = useState(
    data.fecha_entrega_real ? String(data.fecha_entrega_real).slice(0, 10) : ""
  );
  const [infoCliente, setInfoCliente] = useState(data.info_cliente || "");
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const prorroga = addMonths(fechaEntrega, meses);
  const valid = proyecto.trim() && etapa.trim() && nombre.trim();

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        proyecto: proyecto.trim(),
        etapa: etapa.trim(),
        tipo,
        nombre: nombre.trim(),
        fecha_salida: fechaSalida || null,
        fecha_entrega: fechaEntrega || null,
        meses_prorroga: Number(meses) || 12,
        fecha_entrega_real: fechaReal || null,
        info_cliente: infoCliente.trim(),
        activo,
      };
      if (mode === "crear") await crearEntrega(payload);
      else await editarEntrega({ Id: data.Id, ...payload });
      onSaved(mode === "crear" ? "Entrega agregada." : "Cambios guardados.");
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "crear" ? "Nueva entrega" : "Editar entrega"}
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
          hint={
            touched && !proyecto.trim()
              ? "Obligatorio."
              : "Escribe uno nuevo o elige de la lista."
          }
          hintTone={touched && !proyecto.trim() ? "amber" : "muted"}
        >
          <Input
            placeholder="Ej. Ciudad Central Mérida"
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            list="entregas-proyectos"
          />
          <datalist id="entregas-proyectos">
            {proyectos.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Etapa" hint={touched && !etapa.trim() ? "Obligatorio." : ""} hintTone="amber">
          <Input placeholder="Ej. Etapa 1" value={etapa} onChange={(e) => setEtapa(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Segmented value={tipo} onChange={setTipo} options={TIPOS.map((t) => ({ value: t, label: t }))} />
        </Field>
        <Field
          label={tipo === "Torre" ? "Torre (nombre/N°)" : "Privada (nombre/N°)"}
          hint={touched && !nombre.trim() ? "Obligatorio." : ""}
          hintTone="amber"
        >
          <Input
            placeholder={tipo === "Torre" ? "Ej. A o Torre 1" : "Ej. 3 o Privada Norte"}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha de salida (inicio)">
          <Input type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} />
        </Field>
        <Field label="Fecha de entrega (ideal)">
          <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Meses de prórroga"
          hint={
            prorroga ? `Entrega + prórroga: ${fmtFecha(prorroga)}` : "Se calcula sobre la fecha de entrega."
          }
          hintTone="brand"
        >
          <Input
            type="number"
            min="0"
            value={meses}
            onChange={(e) => setMeses(e.target.value)}
            className="w-28"
          />
        </Field>
        <Field label="Fecha de entrega REAL" hint="Registro real (si ya se entregó).">
          <Input type="date" value={fechaReal} onChange={(e) => setFechaReal(e.target.value)} />
        </Field>
      </div>

      <Field
        label="Información CLIENTE"
        hint="Lo que se le comunica al cliente. Ej. 'Verano 2026', 'Invierno 2028', 'Uso prórroga', 'Sin comunicado'."
      >
        <Input
          placeholder="Ej. Verano 2026"
          value={infoCliente}
          onChange={(e) => setInfoCliente(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Activa</p>
          <p className="text-xs text-muted">Visible en el panel</p>
        </div>
        <Toggle checked={activo} onChange={setActivo} />
      </div>
    </Modal>
  );
}

/* --------- helpers --------- */
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
