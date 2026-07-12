import { useEffect, useState } from "react";
import { Button, Modal, useToast } from "./ui.jsx";
import { obtenerConfig, setAgenteActivo } from "../lib/api.js";

// Banner global de encendido/apagado (modo mantenimiento) de Orvito.
export default function OrvitoStatus() {
  const toast = useToast();
  const [on, setOn] = useState(null); // null = cargando
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  useEffect(() => {
    obtenerConfig()
      .then((c) => setOn(c.agenteActivo))
      .catch(() => setOn(true));
  }, []);

  const apply = async (activo) => {
    setSaving(true);
    try {
      await setAgenteActivo(activo);
      setOn(activo);
      toast.success(activo ? "Orvito reactivado." : "Orvito en mantenimiento.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
      setConfirmOff(false);
    }
  };

  if (on === null) return null;

  return (
    <>
      {on ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-leaf opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-leaf" />
            </span>
            Orvito activo
          </span>
          <span className="text-xs text-muted">— atendiendo a los asesores por WhatsApp.</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setConfirmOff(true)}
            disabled={saving}
          >
            Poner en mantenimiento
          </Button>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber/30 bg-amber/10 px-4 py-2.5">
          <span className="text-lg leading-none">🔧</span>
          <span className="text-sm font-semibold text-amber">Orvito está en mantenimiento</span>
          <span className="text-xs text-amber/80">
            — a cada asesor que escriba le responde que vuelve en breve.
          </span>
          <Button size="sm" className="ml-auto" onClick={() => apply(true)} disabled={saving}>
            {saving ? "Reactivando…" : "Reactivar Orvito"}
          </Button>
        </div>
      )}

      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Poner a Orvito en mantenimiento"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOff(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => apply(false)} disabled={saving}>
              {saving ? "Apagando…" : "Sí, poner en mantenimiento"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Orvito <b className="text-ink">dejará de responder normalmente</b>. A cada asesor que le
          escriba le contestará amablemente que está en mantenimiento y que vuelve en breve. Lo
          puedes reactivar cuando quieras.
        </p>
      </Modal>
    </>
  );
}
