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
import { Plus, Pencil, Trash, Percent } from "../components/Icons.jsx";
import {
  listarPromociones,
  crearPromocion,
  editarPromocion,
  eliminarPromocion,
  listarBrochures,
  proyectosDesdeBrochures,
} from "../lib/api.js";
import { estadoPromo, fmtRango, truthy } from "../lib/format.js";

export default function Promociones() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [status, setStatus] = useState("loading");
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [showExpiradas, setShowExpiradas] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const [promos, brochures] = await Promise.all([listarPromociones(), listarBrochures()]);
      setItems(promos);
      setProyectos(proyectosDesdeBrochures(brochures));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const { vigentes, expiradas } = useMemo(() => {
    const withEstado = items.map((p) => ({ ...p, _estado: estadoPromo(p) }));
    // orden: Vigente, Programada, Inactiva; Expiradas aparte
    const rank = { Vigente: 0, Programada: 1, Inactiva: 2 };
    const activos = withEstado
      .filter((p) => p._estado !== "Expirada")
      .sort((a, b) => (rank[a._estado] ?? 3) - (rank[b._estado] ?? 3));
    const exp = withEstado.filter((p) => p._estado === "Expirada");
    return { vigentes: activos, expiradas: exp };
  }, [items]);

  const onSaved = async (msg) => {
    setModal(null);
    await load();
    toast.success(msg);
  };
  const confirmDelete = async () => {
    const p = toDelete;
    setToDelete(null);
    try {
      await eliminarPromocion(p.Id);
      await load();
      toast.success("Promoción eliminada.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Promociones"
        subtitle="Lo que Orvito anuncia y ofrece a tus clientes."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nueva promoción
          </Button>
        }
      />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-soft px-4 py-2 text-sm text-brand-dark">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-leaf" />
        Los cambios se reflejan en Orvito en el siguiente mensaje — sin despliegues, sin esperar.
      </div>

      {status === "loading" && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-6">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar tus promociones"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <EmptyState
          icon={<Percent size={22} />}
          title="Aún no hay promociones"
          text="Crea una promoción y Orvito la anunciará dentro de su vigencia."
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nueva promoción
            </Button>
          }
        />
      )}

      {status === "ready" && items.length > 0 && (
        <div className="seq cards-lift space-y-4">
          {vigentes.map((p) => (
            <PromoCard
              key={p.Id}
              p={p}
              onEdit={() => setModal({ mode: "editar", data: p })}
              onDelete={() => setToDelete(p)}
            />
          ))}

          {expiradas.length > 0 && (
            <div className="pt-2">
              {!showExpiradas ? (
                <Button variant="outline" size="sm" onClick={() => setShowExpiradas(true)}>
                  Ver expiradas ({expiradas.length})
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted">Expiradas</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowExpiradas(false)}>
                      Ocultar
                    </Button>
                  </div>
                  {expiradas.map((p) => (
                    <PromoCard
                      key={p.Id}
                      p={p}
                      dimmed
                      onEdit={() => setModal({ mode: "editar", data: p })}
                      onDelete={() => setToDelete(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {modal && (
        <PromoModal
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
        title="Vas a eliminar esta promoción"
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
          <b className="text-ink">{toDelete?.titulo}</b> dejará de anunciarse. Puedes reactivarla
          después si la necesitas.
        </p>
      </Modal>
    </Layout>
  );
}

/* --------- Card --------- */
function PromoCard({ p, onEdit, onDelete, dimmed }) {
  const proyectos = String(p.proyectos_aplica || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Card className={cx("p-6", dimmed && "opacity-70")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-ink">{p.titulo}</h3>
          {(p.beneficio || p.descripcion) && (
            <p className="text-sm leading-relaxed text-muted">{p.beneficio || p.descripcion}</p>
          )}
          {p.codigo_cupon && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted2">Cupón:</span>
              <span className="rounded bg-brand/15 px-2 py-0.5 font-mono font-semibold text-brand-dark">
                {p.codigo_cupon}
              </span>
            </div>
          )}
          {p.participantes && (
            <p className="text-xs text-muted2">Participantes: {p.participantes}</p>
          )}
          {proyectos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {proyectos.map((pr) => (
                <span
                  key={pr}
                  className="rounded-lg border border-line bg-softer px-2.5 py-1 text-xs text-muted"
                >
                  {pr}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-muted2 hover:bg-soft hover:text-ink"
              aria-label="Editar"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-muted2 hover:bg-danger/10 hover:text-danger"
              aria-label="Eliminar"
            >
              <Trash size={17} />
            </button>
          </div>
          <StatusChip estado={p._estado} />
          <span className="whitespace-nowrap text-xs text-muted2">
            {fmtRango(p.vigencia_inicio, p.vigencia_fin)}
          </span>
        </div>
      </div>
    </Card>
  );
}

/* --------- Modal --------- */
function PromoModal({ mode, data, proyectos, onClose, onSaved }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(data.titulo || "");
  const [beneficio, setBeneficio] = useState(data.beneficio || data.descripcion || "");
  const [legales, setLegales] = useState(data.legales || "");
  const [participantes, setParticipantes] = useState(data.participantes || "");
  const [codigoCupon, setCodigoCupon] = useState(data.codigo_cupon || "");
  const [aplica, setAplica] = useState(
    String(data.proyectos_aplica || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [ini, setIni] = useState((data.vigencia_inicio || "").slice(0, 10));
  const [fin, setFin] = useState((data.vigencia_fin || "").slice(0, 10));
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const rangoInvalido = ini && fin && fin < ini;
  const valid = titulo.trim() && !rangoInvalido;

  const toggleProyecto = (pr) =>
    setAplica((a) => (a.includes(pr) ? a.filter((x) => x !== pr) : [...a, pr]));

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        beneficio: beneficio.trim(),
        legales: legales.trim(),
        participantes: participantes.trim(),
        codigo_cupon: codigoCupon.trim(),
        proyectos_aplica: aplica.join(", "),
        vigencia_inicio: ini || null,
        vigencia_fin: fin || null,
        activo,
      };
      if (mode === "crear") await crearPromocion(payload);
      else await editarPromocion({ Id: data.Id, ...payload });
      onSaved(mode === "crear" ? "Promoción creada." : "Cambios guardados.");
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  const opciones = proyectos.length ? proyectos : aplica;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={mode === "crear" ? "Nueva promoción" : "Editar promoción"}
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
        label="Nombre de la promo"
        hint={touched && !titulo.trim() ? "El nombre es obligatorio." : ""}
        hintTone="amber"
      >
        <Input
          placeholder="Ej. Preventa con 10% de descuento"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Field>

      <Field label="Regalo o beneficio al cliente al adquirir la promoción">
        <Textarea
          placeholder="Qué se lleva el cliente al aprovechar la promoción…"
          value={beneficio}
          onChange={(e) => setBeneficio(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Código para cupón">
          <Input
            placeholder="Ej. ORVE10"
            value={codigoCupon}
            onChange={(e) => setCodigoCupon(e.target.value)}
          />
        </Field>
        <Field label="Participantes">
          <Input
            placeholder="Quién puede participar"
            value={participantes}
            onChange={(e) => setParticipantes(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Legales de la promoción" hint="Restricciones, letras chiquitas, condiciones.">
        <Textarea
          placeholder="Términos y condiciones legales de la promoción…"
          value={legales}
          onChange={(e) => setLegales(e.target.value)}
        />
      </Field>

      <div>
        <span className="mb-2 block text-sm font-medium text-muted">Aplica a estos proyectos</span>
        {opciones.length === 0 ? (
          <p className="text-xs text-muted2">
            Agrega materiales primero para elegir proyectos, o deja vacío para “todos”.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {opciones.map((pr) => {
              const on = aplica.includes(pr);
              return (
                <button
                  key={pr}
                  type="button"
                  onClick={() => toggleProyecto(pr)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    on
                      ? "border-brand-dark bg-brand-dark text-white"
                      : "border-line bg-white text-muted hover:border-brand-leaf/50 hover:text-ink"
                  )}
                >
                  {pr}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Inicio de vigencia">
          <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
        </Field>
        <Field
          label="Fin de vigencia"
          hint={rangoInvalido ? "El fin debe ser igual o posterior al inicio." : ""}
          hintTone="amber"
        >
          <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Activa</p>
          <p className="text-xs text-muted">Orvito la anunciará dentro de su vigencia</p>
        </div>
        <Toggle checked={activo} onChange={setActivo} />
      </div>
    </Modal>
  );
}
