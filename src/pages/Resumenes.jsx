import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout, { PageHeader } from "../components/Layout.jsx";
import {
  Button,
  Card,
  Input,
  SearchInput,
  Skeleton,
  EmptyState,
  ErrorState,
  cx,
  useToast,
} from "../components/ui.jsx";
import { Sparkles, Chat } from "../components/Icons.jsx";
import { listarResumenes } from "../lib/api.js";
import { todayISO, fmtHoraISO, truthy } from "../lib/format.js";

export const CATEGORIAS = [
  { value: "consulta_dato", label: "Consulta de dato" },
  { value: "objecion", label: "Objeción" },
  { value: "material", label: "Material" },
  { value: "promocion", label: "Promoción" },
  { value: "registro", label: "Registro" },
  { value: "soporte", label: "Soporte" },
  { value: "otro", label: "Otro" },
];
export function catLabel(v) {
  return CATEGORIAS.find((c) => c.value === v)?.label || "Otro";
}

export default function Resumenes() {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(todayISO());
  const [categoria, setCategoria] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [status, setStatus] = useState("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const r = await listarResumenes({ fecha, categoria: categoria || undefined, page: 1 });
      setItems(r.resumenes);
      setPagina(1);
      setHayMas(r.hayMas);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, categoria]);

  const cargarMas = async () => {
    setLoadingMore(true);
    try {
      const r = await listarResumenes({ fecha, categoria: categoria || undefined, page: pagina + 1 });
      setItems((prev) => [...prev, ...r.resumenes]);
      setPagina(r.pagina);
      setHayMas(r.hayMas);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((r) => !term || String(r.contacto || "").toLowerCase().includes(term));
  }, [items, q]);

  return (
    <Layout>
      <PageHeader
        title="Resúmenes IA"
        subtitle="Lo que pasó en cada conversación, resumido por Orvito."
      />

      {/* filtros */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-auto"
          />
          <div className="min-w-[200px] flex-1">
            <SearchInput
              placeholder="Buscar por contacto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={categoria === ""} onClick={() => setCategoria("")}>
            Todas
          </Chip>
          {CATEGORIAS.map((c) => (
            <Chip key={c.value} active={categoria === c.value} onClick={() => setCategoria(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="space-y-2 p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar los resúmenes"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={load}
        />
      )}

      {status === "ready" && filtered.length === 0 && (
        <EmptyState
          icon={<Sparkles size={22} />}
          title="Sin resúmenes para este filtro"
          text="Los resúmenes del día se generan automáticamente a las 9 pm — o genera uno al instante desde cualquier conversación."
        />
      )}

      {status === "ready" && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ResumenCard
              key={`${r.conversation_id}-${r.fecha}`}
              r={r}
              onVer={() => navigate(`/conversaciones?conv=${r.conversation_id}`)}
            />
          ))}
          {hayMas && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={cargarMas}
              disabled={loadingMore}
            >
              {loadingMore ? "Cargando…" : "Cargar más"}
            </Button>
          )}
        </div>
      )}
    </Layout>
  );
}

function ResumenCard({ r, onVer }) {
  const proyectos = String(r.proyectos || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{r.contacto}</span>
            <span className="text-xs text-muted2">{fmtHoraISO(r.generado_en)}</span>
            {truthy(r.hubo_handoff) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
                Intervino agente
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{r.resumen}</p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs font-medium text-brand-green">
              {catLabel(r.categoria)}
            </span>
            {proyectos.map((p) => (
              <span
                key={p}
                className="rounded-lg border border-line bg-soft/60 px-2 py-0.5 text-xs text-brand-dark"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onVer}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-brand-dark hover:bg-soft"
        >
          <Chat size={15} /> Ver conversación
        </button>
      </div>
    </Card>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-dark text-white" : "border border-line bg-white text-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
