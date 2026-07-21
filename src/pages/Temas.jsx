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
  useToast,
} from "../components/ui.jsx";
import { Plus, Pencil, Trash, Brain } from "../components/Icons.jsx";
import { listarTemas, crearTema, editarTema, eliminarTema } from "../lib/api.js";
import { truthy } from "../lib/format.js";
import { useAuth } from "../lib/auth.jsx";

export default function Temas() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [modal, setModal] = useState(null); // { mode, data }
  const [confirm, setConfirm] = useState(null); // { title, danger, subtitle, run, okMsg }

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarTemas());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const visibles = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (Number(a.orden || 0) - Number(b.orden || 0)) ||
          String(a.tema || "").localeCompare(String(b.tema || ""), "es")
      ),
    [items]
  );

  // Toda escritura pasa por confirmación de contraseña.
  const requestGuardar = (payload, mode, Id) => {
    setModal(null);
    setConfirm({
      title: mode === "crear" ? "Confirmar nuevo tema" : "Confirmar cambios",
      okMsg: mode === "crear" ? "Tema agregado." : "Cambios guardados.",
      run: async () => {
        if (mode === "crear") await crearTema(payload);
        else await editarTema({ Id, ...payload });
      },
    });
  };
  const requestDelete = (t) => {
    setConfirm({
      title: "Quitar tema",
      danger: true,
      subtitle: `"${t.tema}" dejará de estar en el alcance de Orvito.`,
      okMsg: "Tema quitado.",
      run: async () => {
        await eliminarTema(t.Id);
      },
    });
  };

  return (
    <Layout>
      <PageHeader
        title="Temas / Alcance de Orvito"
        subtitle="Temas que Orvito reconoce y busca en su base de conocimiento. Cambiar aquí actualiza al agente en vivo."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nuevo tema
          </Button>
        }
      />

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar los temas"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && visibles.length === 0 && (
        <EmptyState
          icon={<Brain size={22} />}
          title="Aún no hay temas"
          text="Agrega un tema para que Orvito lo reconozca y lo busque en su base de conocimiento."
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nuevo tema
            </Button>
          }
        />
      )}

      {status === "ready" && visibles.length > 0 && (
        <>
          <p className="mb-4 rounded-xl bg-softer px-4 py-3 text-xs text-muted">
            Estos temas se inyectan al cerebro de Orvito. Recuerda subir también el documento
            correspondiente en <b className="text-ink">Conocimiento</b> — aquí solo defines que Orvito
            lo reconozca y lo busque.
          </p>
          <div className="seq cards-lift space-y-3">
            {visibles.map((t) => (
              <TemaCard
                key={t.Id}
                t={t}
                onEdit={() => setModal({ mode: "editar", data: t })}
                onDelete={() => requestDelete(t)}
              />
            ))}
          </div>
        </>
      )}

      {modal && (
        <TemaModal
          mode={modal.mode}
          data={modal.data}
          onClose={() => setModal(null)}
          onSubmit={requestGuardar}
        />
      )}

      {confirm && (
        <ConfirmPassword
          confirm={confirm}
          onDone={async () => {
            const msg = confirm.okMsg;
            setConfirm(null);
            await load();
            toast.success(msg);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Layout>
  );
}

/* --------- Card --------- */
function TemaCard({ t, onEdit, onDelete }) {
  const activo = truthy(t.activo);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{t.tema || "—"}</h3>
            <StatusChip estado={activo ? "Activo" : "Inactivo"} />
          </div>
          {t.descripcion && <p className="mt-1.5 text-sm text-muted">{t.descripcion}</p>}
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
    </Card>
  );
}

/* --------- Modal de tema --------- */
function TemaModal({ mode, data, onClose, onSubmit }) {
  const [tema, setTema] = useState(data.tema || "");
  const [descripcion, setDescripcion] = useState(data.descripcion || "");
  const [orden, setOrden] = useState(data.orden ?? "");
  const [activo, setActivo] = useState(mode === "crear" ? true : truthy(data.activo));
  const [touched, setTouched] = useState(false);
  const valid = tema.trim();

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit(
      {
        tema: tema.trim(),
        descripcion: descripcion.trim(),
        orden: orden === "" ? null : Number(orden) || 0,
        activo,
      },
      mode,
      data.Id
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "crear" ? "Nuevo tema" : "Editar tema"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Continuar</Button>
        </>
      }
    >
      <Field label="Tema" hint={touched && !tema.trim() ? "Obligatorio." : ""} hintTone="amber">
        <Input placeholder="Ej. Campus ORVE" value={tema} onChange={(e) => setTema(e.target.value)} />
      </Field>
      <Field
        label="Descripción"
        hint="Breve. Ayuda a Orvito a entender de qué trata (aparece en su alcance)."
      >
        <Textarea
          rows={3}
          placeholder="Ej. Plataforma de capacitación para asesores: cursos, programas y recursos."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Orden" hint="Para ordenar la lista (menor primero).">
          <Input
            type="number"
            min="0"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="w-28"
          />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-softer px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Activo</p>
            <p className="text-xs text-muted">Orvito lo reconoce</p>
          </div>
          <Toggle checked={activo} onChange={setActivo} />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted2">
        Al continuar te pediremos tu contraseña para confirmar el cambio.
      </p>
    </Modal>
  );
}

/* --------- Confirmación por contraseña --------- */
function ConfirmPassword({ confirm, onDone, onClose }) {
  const { verifyPassword } = useAuth();
  const toast = useToast();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!pwd || busy) return;
    setBusy(true);
    try {
      await verifyPassword(pwd);
      await confirm.run();
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
      title={confirm.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={confirm.danger ? "danger" : "primary"} onClick={go} disabled={busy}>
            {busy ? "Confirmando…" : "Confirmar"}
          </Button>
        </>
      }
    >
      {confirm.subtitle && <p className="mb-3 text-sm text-muted">{confirm.subtitle}</p>}
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
