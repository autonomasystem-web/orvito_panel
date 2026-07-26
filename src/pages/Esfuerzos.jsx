import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Skeleton,
  ErrorState,
  useToast,
  cx,
} from "../components/ui.jsx";
import { Plus, Trash, Save } from "../components/Icons.jsx";
import { listarEsfuerzos, guardarEsfuerzos } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

const ESTADOS = ["En producción", "Parcial", "Fase futura"];
const ESTADO_STYLE = {
  "En producción": "bg-soft text-brand-green",
  Parcial: "bg-amber/10 text-amber",
  "Fase futura": "bg-softer text-muted2",
};
const BARRA = { "En producción": "#38D030", Parcial: "#a6772a", "Fase futura": "#5c6b60" };

const rowKey = (r) => (r.Id != null ? `id-${r.Id}` : r._k);
let _seq = 0;
const nuevaFila = (orden) => ({
  _k: `n-${++_seq}`,
  codigo: `E${orden}`,
  nombre: "",
  pct: 0,
  estado: "Fase futura",
  orden,
});

export default function Esfuerzos() {
  const toast = useToast();
  const [original, setOriginal] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [confirm, setConfirm] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const data = await listarEsfuerzos();
      const norm = data.map((e) => ({
        Id: e.Id,
        codigo: e.codigo || "",
        nombre: e.nombre || "",
        pct: Number(e.pct) || 0,
        estado: ESTADOS.includes(e.estado) ? e.estado : "Fase futura",
        orden: Number(e.orden) || 0,
      }));
      setRows(norm);
      setOriginal(norm);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(stripKeys(rows)) !== JSON.stringify(stripKeys(original)),
    [rows, original]
  );
  const valido = rows.every((r) => r.nombre.trim() && r.codigo.trim());

  const setRow = (k, patch) =>
    setRows((rs) => rs.map((r) => (rowKey(r) === k ? { ...r, ...patch } : r)));
  const delRow = (k) => setRows((rs) => rs.filter((r) => rowKey(r) !== k));
  const addRow = () => setRows((rs) => [...rs, nuevaFila(rs.length + 1)]);
  const move = (k, dir) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => rowKey(r) === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const doGuardar = async () => {
    const items = rows.map((r, i) => ({
      Id: r.Id,
      codigo: r.codigo.trim(),
      nombre: r.nombre.trim(),
      pct: Math.max(0, Math.min(100, Math.round(Number(r.pct) || 0))),
      estado: r.estado,
      orden: i + 1,
    }));
    await guardarEsfuerzos(items);
  };

  return (
    <Layout>
      <PageHeader
        title="Adopción por esfuerzo"
        subtitle="Los bloques E1–E5 que se muestran en el dashboard. Es una evaluación estratégica: ajusta el % y el estado de cada uno."
        action={
          <Button onClick={() => setConfirm(true)} disabled={!dirty || !valido || status !== "ready"}>
            <Save size={18} /> Guardar cambios
          </Button>
        }
      />

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-4 md:p-5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar los esfuerzos"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && (
        <>
          <p className="mb-4 rounded-xl bg-softer px-4 py-3 text-xs text-muted">
            Estos valores <b className="text-ink">no se calculan solos</b>: reflejan tu lectura del avance
            de Orvito por bloque. Lo que guardes aquí es lo que verá el equipo en el dashboard.
          </p>

          <div className="space-y-3">
            {rows.map((r, i) => (
              <EsfuerzoRow
                key={rowKey(r)}
                r={r}
                first={i === 0}
                last={i === rows.length - 1}
                onChange={(patch) => setRow(rowKey(r), patch)}
                onDelete={() => delRow(rowKey(r))}
                onUp={() => move(rowKey(r), -1)}
                onDown={() => move(rowKey(r), 1)}
              />
            ))}
          </div>

          <button
            onClick={addRow}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-medium text-muted transition-colors hover:border-brand-leaf/40 hover:text-brand-dark"
          >
            <Plus size={18} /> Agregar bloque
          </button>

          {!valido && (
            <p className="mt-3 text-xs text-amber">
              Cada bloque necesita una etiqueta (E1…) y un nombre para poder guardar.
            </p>
          )}
        </>
      )}

      {confirm && (
        <ConfirmPassword
          onRun={doGuardar}
          onDone={async () => {
            setConfirm(false);
            await load();
            toast.success("Adopción por esfuerzo actualizada.");
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Layout>
  );
}

function stripKeys(rows) {
  return rows.map((r) => ({
    codigo: r.codigo.trim(),
    nombre: r.nombre.trim(),
    pct: Math.round(Number(r.pct) || 0),
    estado: r.estado,
  }));
}

/* --------- Fila editable --------- */
function EsfuerzoRow({ r, first, last, onChange, onDelete, onUp, onDown }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start gap-3">
        {/* reordenar */}
        <div className="flex flex-col gap-1 pt-1">
          <ReorderBtn dir="↑" disabled={first} onClick={onUp} label="Subir" />
          <ReorderBtn dir="↓" disabled={last} onClick={onDown} label="Bajar" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-16 shrink-0">
              <label className="mb-1 block text-xs font-medium text-muted">Etiqueta</label>
              <Input
                value={r.codigo}
                onChange={(e) => onChange({ codigo: e.target.value })}
                placeholder="E1"
                className="text-center"
              />
            </div>
            <div className="min-w-[10rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Nombre del bloque</label>
              <Input
                value={r.nombre}
                onChange={(e) => onChange({ nombre: e.target.value })}
                placeholder="Ej. Inventario"
              />
            </div>
          </div>

          {/* estado segmentado */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Estado</label>
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
              {ESTADOS.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ estado: s })}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    r.estado === s ? ESTADO_STYLE[s] : "text-muted hover:text-ink"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* pct slider */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Avance</label>
              <span className="font-display text-sm font-bold text-brand-dark">{r.pct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={r.pct}
              onChange={(e) => onChange({ pct: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: BARRA[r.estado] || "#38D030" }}
            />
          </div>
        </div>

        <button
          onClick={onDelete}
          className="shrink-0 rounded-lg p-1.5 text-muted2 hover:bg-danger/10 hover:text-danger"
          aria-label="Quitar bloque"
          title="Quitar bloque"
        >
          <Trash size={16} />
        </button>
      </div>
    </Card>
  );
}

function ReorderBtn({ dir, disabled, onClick, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "grid h-6 w-6 place-items-center rounded-md text-sm font-bold",
        disabled ? "cursor-not-allowed text-muted2/40" : "text-muted hover:bg-soft hover:text-brand-dark"
      )}
    >
      {dir}
    </button>
  );
}

/* --------- Confirmación por contraseña (igual que en Temas) --------- */
function ConfirmPassword({ onRun, onDone, onClose }) {
  const { verifyPassword } = useAuth();
  const toast = useToast();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!pwd || busy) return;
    setBusy(true);
    try {
      await verifyPassword(pwd);
      await onRun();
      await onDone();
    } catch (e) {
      toast.error(e.message || "No se pudo confirmar.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirmar cambios"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={go} disabled={busy}>
            {busy ? "Guardando…" : "Confirmar"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Vas a actualizar la vista de adopción por esfuerzo del dashboard.
      </p>
      <Field label="Tu contraseña" hint="Por seguridad, confírmala para aplicar el cambio.">
        <Input
          type="password"
          autoFocus
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="••••••••"
        />
      </Field>
    </Modal>
  );
}
