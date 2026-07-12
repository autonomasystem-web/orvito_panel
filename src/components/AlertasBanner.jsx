import { useEffect, useState } from "react";
import { Button, useToast } from "./ui.jsx";
import { Alert } from "./Icons.jsx";
import { listarAlertas, resolverAlertas } from "../lib/api.js";

// Banner de alertas: muestra los fallos que registró el Guardian de Orvito.
// Se refresca solo cada minuto. "Descartar" marca las alertas como resueltas.
export default function AlertasBanner() {
  const toast = useToast();
  const [alertas, setAlertas] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [descartando, setDescartando] = useState(false);

  const cargar = () => {
    listarAlertas()
      .then(setAlertas)
      .catch(() => {})
      .finally(() => setCargado(true));
  };

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, []);

  const descartar = async () => {
    setDescartando(true);
    try {
      await resolverAlertas();
      setAlertas([]);
      toast.success("Alertas descartadas.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDescartando(false);
    }
  };

  if (!cargado || alertas.length === 0) return null;

  const fmt = (f) => {
    try {
      return new Date(f).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-danger">
          <Alert size={18} />
          Orvito registró {alertas.length} {alertas.length === 1 ? "fallo" : "fallos"} sin revisar
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={descartar}
          disabled={descartando}
        >
          {descartando ? "Descartando…" : "Descartar"}
        </Button>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-danger/90">
        {alertas.slice(0, 3).map((a) => (
          <li key={a.id} className="truncate">
            <span className="font-semibold">{a.nodo || a.workflow || "Orvito"}</span>
            {a.error ? ` — ${a.error}` : ""}
            {a.fecha ? <span className="text-danger/60"> · {fmt(a.fecha)}</span> : null}
          </li>
        ))}
        {alertas.length > 3 && (
          <li className="text-danger/60">y {alertas.length - 3} más…</li>
        )}
      </ul>
    </div>
  );
}
