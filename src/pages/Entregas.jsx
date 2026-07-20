import { useEffect, useMemo, useState } from "react";
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

// Fecha de entrega + N meses de prórroga (cálculo)
function addMonths(iso, n) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + (Number(n) || 0));
  return d.toISOString().slice(0, 10);
}

export default function Entregas() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [proyectoF, setProyectoF] = useState("todos");
  const [filtro, setFiltro] = useState("activos"); // activos | todos
  const [modal, setModal] = useState(null);
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

  const proyectos = useMemo(
    () => [...new Set(items.map((e) => e.proyecto).filter(Boolean))].sort(),
    [items]
  );

  const visibles = useMemo(() => {
    let arr = [...items];
    if (filtro === "activos") arr = arr.filter((e) => truthy(e.activo));
    if (proyectoF !== "todos") arr = arr.filter((e) => e.proyecto === proyectoF);
    arr.sort(
      (a, b) =>
        String(a.proyecto || "").localeCompare(String(b.proyecto || "")) ||
        String(a.etapa || "").localeCompare(String(b.etapa || ""), "es", { numeric: true }) ||
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { numeric: true })
    );
    return arr;
  }, [items, filtro, proyectoF]);

  const grupos = useMemo(() => {
    const m = new Map();
    for (const e of visibles) {
      const k = e.proyecto || "(sin proyecto)";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()];
  }, [visibles]);

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

  return (
    <Layout>
      <PageHeader
        title="Entregas"
        subtitle="Fechas de entrega por proyecto. La info CLIENTE es lo que se comunica al cliente."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nueva entrega
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "activos", label: "Activas" },
            { value: "todos", label: "Todas" },
          ]}
        />
        {proyectos.length > 0 && (
          <select
            className={cx(inputCls, "h-9 w-auto py-0")}
            value={proyectoF}
            onChange={(e) => setProyectoF(e.target.value)}
          >
            <option value="todos">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar las entregas"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && visibles.length === 0 && (
        <EmptyState
          icon={<Calendar size={22} />}
          title={filtro === "activos" ? "Aún no hay entregas" : "Sin entregas"}
          text="Agrega la primera entrega con sus fechas y la info que se le comunica al cliente."
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nueva entrega
            </Button>
          }
        />
      )}

      {status === "ready" &&
        grupos.map(([proyecto, list]) => (
          <section key={proyecto} className="mb-7">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-dark">
              <MapPin size={16} /> {proyecto}
            </h2>
            <div className="seq cards-lift space-y-3">
              {list.map((e) => (
                <EntregaCard
                  key={e.Id}
                  e={e}
                  onEdit={() => setModal({ mode: "editar", data: e })}
                  onDelete={() => setToDelete(e)}
                />
              ))}
            </div>
          </section>
        ))}

      {modal && (
        <EntregaModal
          mode={modal.mode}
          data={modal.data}
          proyectos={proyectos}
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
            {toDelete?.etapa} · {toDelete?.tipo} {toDelete?.nombre}
          </b>{" "}
          de {toDelete?.proyecto} dejará de mostrarse. La puedes recuperar en "Todas".
        </p>
      </Modal>
    </Layout>
  );
}

/* --------- Card --------- */
function EntregaCard({ e, onEdit, onDelete }) {
  const activo = truthy(e.activo);
  const prorroga = addMonths(e.fecha_entrega, e.meses_prorroga ?? 12);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">
              {e.etapa || "—"} · {e.tipo} {e.nombre}
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
          hint={touched && !proyecto.trim() ? "Obligatorio." : ""}
          hintTone="amber"
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
            placeholder={tipo === "Torre" ? "Ej. Torre A" : "Ej. Privada 3"}
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
