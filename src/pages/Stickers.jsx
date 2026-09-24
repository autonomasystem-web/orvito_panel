import { useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Pencil, Trash, Sticker, Upload } from "../components/Icons.jsx";
import {
  listarStickers,
  crearSticker,
  editarSticker,
  eliminarSticker,
  revisarSticker,
} from "../lib/api.js";
import { gifAWebpAnimado } from "../lib/gif-a-webp.js";
import { truthy } from "../lib/format.js";
import { useAuth } from "../lib/auth.jsx";

/**
 * Stickers de Orvito.
 *
 * Orvito ya sabía mandar stickers, pero eran cinco archivos escritos a mano dentro
 * del workflow. Aquí se dan de alta y el agente ve exactamente los que existan: su
 * lista viaja al prompt, así que no puede inventarse un marcador.
 *
 * Lo delicado es el archivo. WhatsApp solo lo manda COMO STICKER si es un WebP de
 * 512x512 y no pasa de 100 KB (fijo) o 500 KB (animado). Con cualquier otra cosa el
 * mensaje no sale y nadie se entera, así que aquí se revisa antes de subir y se dice
 * qué corregir.
 */
export default function Stickers() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  // Los animados son los que vienen de un GIF. Se separan porque se usan distinto:
  // uno fijo cae bien en cualquier momento, uno animado llama mucho mas la atencion.
  const [tipo, setTipo] = useState("todos");

  const load = async () => {
    setStatus("loading");
    try {
      setItems(await listarStickers());
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
      [...items]
        .filter((x) =>
          tipo === "todos" ? true : tipo === "animados" ? truthy(x.animado) : !truthy(x.animado)
        )
        .sort(
        (a, b) =>
          Number(a.orden || 0) - Number(b.orden || 0) ||
          String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
        ),
    [items, tipo]
  );
  const nAnimados = items.filter((x) => truthy(x.animado)).length;

  const requestGuardar = (payload, mode, Id) => {
    setModal(null);
    setConfirm({
      title: mode === "crear" ? "Confirmar nuevo sticker" : "Confirmar cambios",
      okMsg: mode === "crear" ? "Sticker agregado. Orvito ya puede usarlo." : "Cambios guardados.",
      run: async () => {
        const r = mode === "crear" ? await crearSticker(payload) : await editarSticker({ Id, ...payload });
        // el gateway revisa el archivo otra vez; si lo rechaza, dice por qué
        if (r && r.ok === false && r.error) throw new Error(r.error);
      },
    });
  };
  const requestDelete = (s) => {
    setConfirm({
      title: "Quitar sticker",
      danger: true,
      subtitle: `Orvito dejará de poder enviar [STICKER:${s.nombre}]. El archivo no se borra.`,
      okMsg: "Sticker quitado.",
      run: async () => {
        await eliminarSticker(s.Id);
      },
    });
  };

  return (
    <Layout>
      <PageHeader
        title="Stickers de Orvito"
        subtitle="Los stickers que Orvito puede enviar por WhatsApp. Agregar uno aquí lo habilita en el agente en vivo."
        action={
          <Button onClick={() => setModal({ mode: "crear", data: {} })}>
            <Plus size={18} /> Nuevo sticker
          </Button>
        }
      />

      {status === "loading" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar los stickers"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <EmptyState
          icon={<Sticker size={22} />}
          title="Aún no hay stickers"
          text="Sube un .webp de 512x512 y Orvito podrá usarlo en sus mensajes."
          action={
            <Button onClick={() => setModal({ mode: "crear", data: {} })}>
              <Plus size={18} /> Nuevo sticker
            </Button>
          }
        />
      )}

      {status === "ready" && items.length > 0 && (
        <div className="mb-4 flex gap-1 rounded-xl bg-softer p-1 text-sm">
          {[
            { k: "todos", label: `Todos (${items.length})` },
            { k: "fijos", label: `Fijos (${items.length - nAnimados})` },
            { k: "animados", label: `Animados / GIF (${nAnimados})` },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTipo(t.k)}
              className={
                "flex-1 rounded-lg px-3 py-1.5 transition " +
                (tipo === t.k ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {status === "ready" && items.length > 0 && visibles.length === 0 && (
        <p className="rounded-xl bg-softer px-4 py-6 text-center text-sm text-muted">
          {tipo === "animados"
            ? "Todavía no hay stickers animados. Sube un GIF y se convierte solo."
            : "No hay stickers fijos."}
        </p>
      )}

      {status === "ready" && visibles.length > 0 && (
        <>
          <p className="mb-4 rounded-xl bg-softer px-4 py-3 text-xs text-muted">
            Orvito solo puede mandar los stickers de esta lista, y decide cuándo según lo que
            escribas en <b className="text-ink">Cuándo usarlo</b>. Los envía de vez en cuando, nunca
            en mensajes de precios ni temas legales. ¿Tienes un GIF?{" "}
            <b className="text-ink">Súbelo tal cual</b>: WhatsApp no manda GIFs, así que se convierte
            en sticker animado, que es justo como se ven allá.
          </p>
          <div className="seq cards-lift grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((s) => (
              <StickerCard
                key={s.Id}
                s={s}
                onEdit={() => setModal({ mode: "editar", data: s })}
                onDelete={() => requestDelete(s)}
              />
            ))}
          </div>
        </>
      )}

      {modal && (
        <StickerModal
          mode={modal.mode}
          data={modal.data}
          existentes={items}
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
function StickerCard({ s, onEdit, onDelete }) {
  const activo = truthy(s.activo);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{s.nombre || "—"}</h3>
            <StatusChip estado={activo ? "Activo" : "Inactivo"} />
            {truthy(s.animado) && (
              <span className="rounded-md bg-brand-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-green">
                GIF
              </span>
            )}
          </div>
          <code className="mt-0.5 block text-[11px] text-muted2">[STICKER:{s.nombre}]</code>
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

      {/* el damero deja ver la transparencia, que es justo lo que hace que parezca sticker */}
      <div
        className="mt-3 flex h-32 items-center justify-center rounded-xl border border-line"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#00000010 25%,transparent 25%,transparent 75%,#00000010 75%)," +
            "linear-gradient(45deg,#00000010 25%,transparent 25%,transparent 75%,#00000010 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
        }}
      >
        {s.url ? (
          <img src={s.url} alt={s.nombre} className="max-h-28 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted2">Sin archivo</span>
        )}
      </div>

      {s.descripcion && <p className="mt-2 text-sm text-muted">{s.descripcion}</p>}
      <p className="mt-1 text-[11px] text-muted2">
        {truthy(s.animado) ? "Animado" : "Fijo"}
        {s.peso_kb ? ` · ${s.peso_kb} KB` : ""}
      </p>
    </Card>
  );
}

/* --------- Alta / edición --------- */
function StickerModal({ mode, data, existentes, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(data.nombre || "");
  const [descripcion, setDescripcion] = useState(data.descripcion || "");
  const [activo, setActivo] = useState(data.activo === undefined ? true : truthy(data.activo));
  const [orden, setOrden] = useState(data.orden ?? "");
  const [archivo, setArchivo] = useState(null); // { archivo_b64, kb, animado, preview }
  const [errorArchivo, setErrorArchivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const fileRef = useRef(null);

  const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
  const nombreOk = /^[A-Z0-9_]{3,24}$/.test(nombreLimpio);
  const repetido =
    mode === "crear" &&
    existentes.some((x) => String(x.nombre || "").toUpperCase() === nombreLimpio);
  // al editar se puede dejar el archivo que ya tenía
  const archivoOk = mode === "editar" ? !errorArchivo : !!archivo;
  const valid = nombreOk && !repetido && archivoOk && !revisando;

  const elegir = async (file) => {
    if (!file) return;
    setRevisando(true);
    setErrorArchivo("");
    setArchivo(null);
    try {
      let usable = file;
      // Un GIF no se puede mandar por WhatsApp: se convierte a WebP animado, que es
      // lo que alla se ve como "gif". La conversion ocurre aqui, en el navegador.
      if (/gif$/i.test(file.type) || /\.gif$/i.test(file.name)) {
        setConvirtiendo(true);
        const conv = await gifAWebpAnimado(file);
        setConvirtiendo(false);
        usable = new File([conv.blob], file.name.replace(/\.gif$/i, "") + ".webp", {
          type: "image/webp",
        });
      }
      const r = await revisarSticker(usable);
      if (!r.ok) {
        setErrorArchivo(r.error);
      } else {
        setArchivo({ ...r, preview: URL.createObjectURL(usable) });
      }
    } catch (e) {
      // el conversor explica el motivo concreto (dura demasiado, no baja de X KB...)
      setErrorArchivo(e?.message || "No pudimos leer ese archivo.");
    }
    setConvirtiendo(false);
    setRevisando(false);
  };

  const submit = () => {
    if (!valid) return;
    const payload = {
      nombre: nombreLimpio,
      descripcion: descripcion.trim(),
      activo,
      orden: orden === "" ? 0 : Number(orden),
    };
    if (archivo) payload.archivo_b64 = archivo.archivo_b64;
    onSubmit(payload, mode, data.Id);
  };

  return (
    <Modal
      open
      title={mode === "crear" ? "Nuevo sticker" : "Editar sticker"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {mode === "crear" ? "Agregar" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Nombre"
          hint={
            repetido
              ? "Ya existe un sticker con ese nombre."
              : nombre && !nombreOk
              ? "Solo letras, números y guion bajo (3 a 24)."
              : `Orvito lo escribirá como [STICKER:${nombreLimpio || "NOMBRE"}]`
          }
          hintTone={repetido || (nombre && !nombreOk) ? "amber" : "brand"}
        >
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="BIENVENIDA"
          />
        </Field>

        <Field
          label="Cuándo usarlo"
          hint="Esto es lo que lee Orvito para decidir. Sé concreto: «al cerrar la conversación», «cuando el asesor celebra un cierre»."
        >
          <Textarea
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Al despedirse, cuando ya no queda nada pendiente."
          />
        </Field>

        <Field
          label="Archivo (.webp o .gif)"
          hint={
            errorArchivo ||
            (archivo
              ? `Listo: 512x512, ${archivo.kb} KB, ${archivo.animado ? "animado" : "fijo"}.`
              : "Sube un .webp de 512x512, o un .gif y lo convertimos a sticker animado.")
          }
          hintTone={errorArchivo ? "amber" : "brand"}
        >
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/webp,image/gif,.webp,.gif"
              className="hidden"
              onChange={(e) => elegir(e.target.files?.[0])}
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />{" "}
              {convirtiendo
                ? "Convirtiendo el GIF…"
                : revisando
                ? "Revisando…"
                : archivo
                ? "Cambiar archivo"
                : "Elegir archivo"}
            </Button>
            {(archivo?.preview || (mode === "editar" && data.url)) && (
              <img
                src={archivo?.preview || data.url}
                alt=""
                className="h-14 w-14 rounded-lg border border-line object-contain"
              />
            )}
          </div>
        </Field>

        <Field label="Orden" hint="Solo ordena la lista.">
          <Input
            type="number"
            min="0"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            placeholder="0"
            className="w-28"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-softer px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Activo</p>
            <p className="text-xs text-muted">
              {activo ? "Orvito puede enviarlo" : "Orvito no lo ve"}
            </p>
          </div>
          <Toggle checked={activo} onChange={setActivo} />
        </div>
      </div>
    </Modal>
  );
}

/* --------- Confirmación con contraseña (igual que en el resto del panel) --------- */
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
      toast.error(e?.message || "No pudimos completar la acción.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={confirm.title}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={go} disabled={!pwd || busy} variant={confirm.danger ? "danger" : "primary"}>
            {busy ? "Confirmando…" : "Confirmar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {confirm.subtitle && <p className="text-sm text-muted">{confirm.subtitle}</p>}
        <Field label="Tu contraseña" hint="Confirmamos que eres tú antes de tocar lo que ve Orvito.">
          <Input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
