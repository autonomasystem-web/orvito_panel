import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import Layout from "../components/Layout.jsx";
import { Card, Skeleton, EmptyState, ErrorState, cx } from "../components/ui.jsx";
import { Sparkles, Chat, Folder, Percent } from "../components/Icons.jsx";
import { dashboardMetricas } from "../lib/api.js";
import { catLabel } from "./Resumenes.jsx";

/* Paleta ORVE para SVG (Recharts no acepta clases de Tailwind) */
const C = {
  dark: "#1e4d3b",
  green: "#2e7d5b",
  leaf: "#3fa57a",
  moss: "#3b7a5e",
  soft: "#e9f0ec",
  line: "#e3e7e5",
  muted: "#6b7570",
  amber: "#a6772a",
};
const PIE = ["#1e4d3b", "#3fa57a", "#2e7d5b", "#6b9b83", "#a6772a", "#8fb8a3", "#c2d4ca"];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function diaCorto(iso) {
  const p = String(iso).slice(0, 10).split("-").map(Number);
  if (p.length < 3) return iso;
  return `${p[2]} ${MESES[p[1] - 1]}`;
}
function diaLargo(iso) {
  const p = String(iso).slice(0, 10).split("-").map(Number);
  if (p.length < 3) return iso;
  return `${p[2]} de ${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][p[1] - 1]}`;
}

function saludo() {
  const h = Number(
    new Date().toLocaleString("en-US", { timeZone: "America/Merida", hour: "2-digit", hour12: false }).match(/\d{1,2}/)?.[0] || 12
  ) % 24;
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const RANGOS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

export default function Dashboard() {
  const [rango, setRango] = useState("7d");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [refetching, setRefetching] = useState(false);
  const timer = useRef(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefetching(true);
      else setStatus("loading");
      try {
        const d = await dashboardMetricas(rango);
        setData(d);
        setStatus("ready");
      } catch (e) {
        if (!soft) setStatus("error");
      } finally {
        setRefetching(false);
      }
    },
    [rango]
  );

  useEffect(() => {
    load(!!data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango]);

  // Auto-refresh cada 5 min, solo con la pestaña visible
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load(true);
    };
    timer.current = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango]);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">{saludo()}</h1>
          <p className="mt-1 text-muted">
            Un vistazo a lo que Orvito está haciendo por tu equipo.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-line bg-white p-1">
          {RANGOS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRango(r.value)}
              className={cx(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                rango === r.value ? "bg-soft text-brand-dark" : "text-muted hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {status === "error" && (
        <ErrorState
          title="No pudimos cargar el dashboard"
          text="Ocurrió un problema al conectar con el servidor."
          onRetry={() => load(false)}
        />
      )}

      {status === "loading" && <DashboardSkeleton />}

      {status === "ready" && data && (
        <div className={cx("space-y-6 transition-opacity", refetching && "opacity-60")}>
          {data.parcial && (
            <div className="rounded-xl border border-amber/25 bg-amber/5 px-4 py-3 text-sm text-amber">
              Algunas métricas no están disponibles en este momento. Mostramos lo que sí pudimos calcular.
            </div>
          )}

          <KpiRow k={data.kpis} config={data.config} />

          <SerieDiaria serie={data.serie_diaria} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ProyectosTop items={data.proyectos_top} />
            <Categorias items={data.categorias} />
          </div>

          <HorasPico horas={data.horas_pico} />

          <p className="pt-2 text-center text-xs text-muted2">
            {diaLargo(data.periodo.desde)} — {diaLargo(data.periodo.hasta)} · Actualiza solo cada 5 min
          </p>
        </div>
      )}
    </Layout>
  );
}

/* ---------------- KPIs ---------------- */
function KpiRow({ k, config }) {
  const cards = [
    { label: "Conversaciones", value: k.conversaciones_totales ?? 0, sub: "en el periodo", icon: <Chat size={18} /> },
    { label: "Atendido por Orvito", value: `${k.porcentaje_bot ?? 0}%`, sub: "sin intervención humana", icon: <Sparkles size={18} />, hero: true },
    { label: "Asesores únicos", value: k.asesores_unicos ?? 0, sub: "escribieron a Orvito", icon: <Chat size={18} /> },
    { label: "Con un agente", value: k.abiertas_ahora ?? 0, sub: "ahora mismo", dot: (k.abiertas_ahora ?? 0) > 0 },
    { label: "Materiales activos", value: config.materiales_activos ?? 0, sub: "listos para compartir", icon: <Folder size={18} /> },
    { label: "Promos vigentes", value: config.promos_vigentes ?? 0, sub: "en curso", icon: <Percent size={18} /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  );
}
function KpiCard({ label, value, sub, icon, hero, dot }) {
  return (
    <Card
      className={cx(
        "flex flex-col gap-1.5 p-5",
        hero && "border-brand-leaf/30 bg-gradient-to-br from-soft to-white"
      )}
    >
      <div className="flex items-center gap-2 text-muted2">
        {dot && <span className="h-2 w-2 rounded-full bg-amber" />}
        {icon && !dot && <span className={hero ? "text-brand-leaf" : "text-muted2"}>{icon}</span>}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <div
        className={cx(
          "font-display font-bold leading-none",
          hero ? "text-4xl text-brand-green" : "text-3xl text-brand-dark"
        )}
      >
        {value}
      </div>
      <span className="text-xs text-muted2">{sub}</span>
    </Card>
  );
}

/* ---------------- Serie diaria ---------------- */
function SerieDiaria({ serie }) {
  const hayHandoff = serie.some((d) => d.con_handoff > 0);
  return (
    <Card className="p-5">
      <SectionTitle title="Conversaciones por día" hint="Volumen diario que Orvito atendió." />
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.leaf} stopOpacity={0.28} />
                <stop offset="100%" stopColor={C.leaf} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis
              dataKey="fecha"
              tickFormatter={diaCorto}
              tick={{ fontSize: 12, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip content={<SerieTooltip />} />
            <Area
              type="monotone"
              dataKey="conversaciones"
              stroke={C.dark}
              strokeWidth={2.5}
              fill="url(#gConv)"
              name="Conversaciones"
              dot={{ r: 2.5, fill: C.dark, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {hayHandoff && (
              <Line
                type="monotone"
                dataKey="con_handoff"
                stroke={C.amber}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Con agente"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hayHandoff && (
        <div className="mt-1 flex items-center gap-4 pl-2 text-xs text-muted">
          <Legend color={C.dark}>Conversaciones</Legend>
          <Legend color={C.amber} dashed>
            Intervino un agente
          </Legend>
        </div>
      )}
    </Card>
  );
}
function SerieTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const conv = payload.find((p) => p.dataKey === "conversaciones")?.value ?? 0;
  const hand = payload.find((p) => p.dataKey === "con_handoff")?.value ?? 0;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-modal">
      <p className="mb-1 font-semibold text-ink">{diaLargo(label)}</p>
      <p className="text-muted">
        <b className="text-brand-dark">{conv}</b> conversaciones
      </p>
      {hand > 0 && (
        <p className="text-muted">
          <b className="text-amber">{hand}</b> con intervención de agente
        </p>
      )}
    </div>
  );
}
function Legend({ color, dashed, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-4 rounded"
        style={{ background: dashed ? "transparent" : color, borderTop: dashed ? `2px dashed ${color}` : "none" }}
      />
      {children}
    </span>
  );
}

/* ---------------- Proyectos top ---------------- */
function ProyectosTop({ items }) {
  if (!items.length) {
    return (
      <Card className="p-5">
        <SectionTitle title="Proyectos más consultados" hint="Lo que más piden los asesores." />
        <MiniEmpty text="Aún no hay consultas por proyecto en este periodo." />
      </Card>
    );
  }
  const data = items.map((x) => ({ name: x.proyecto, value: x.consultas }));
  return (
    <Card className="p-5">
      <SectionTitle title="Proyectos más consultados" hint="Lo que más piden los asesores." />
      <div className="w-full" style={{ height: Math.max(180, data.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={C.line} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12, fill: C.dark }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: C.soft }} content={<CountTooltip unidad="consultas" />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? C.dark : C.moss} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------------- Categorías ---------------- */
function Categorias({ items }) {
  if (!items.length) {
    return (
      <Card className="p-5">
        <SectionTitle title="Qué piden los asesores" hint="Tipo de consulta más frecuente." />
        <MiniEmpty text="Aún no hay resúmenes para clasificar en este periodo." />
      </Card>
    );
  }
  const data = items.map((x, i) => ({ name: catLabel(x.categoria), value: x.total, color: PIE[i % PIE.length] }));
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <Card className="p-5">
      <SectionTitle title="Qué piden los asesores" hint="Tipo de consulta más frecuente." />
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<CountTooltip unidad="consultas" />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2">
          {data.map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 text-ink">{d.name}</span>
              <span className="font-semibold text-brand-dark">{d.value}</span>
              <span className="w-10 text-right text-xs text-muted2">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
function CountTooltip({ active, payload, unidad }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-modal">
      <span className="font-semibold text-ink">{p.payload.name}: </span>
      <span className="text-brand-dark">{p.value} {unidad}</span>
    </div>
  );
}

/* ---------------- Horas pico ---------------- */
function HorasPico({ horas }) {
  const total = horas.reduce((a, b) => a + (b.conversaciones || 0), 0);
  if (!total) return null; // se oculta si no hay datos
  const top3 = [...horas].sort((a, b) => b.conversaciones - a.conversaciones).slice(0, 3).map((h) => h.hora);
  const data = horas.map((h) => ({ ...h, etiqueta: `${String(h.hora).padStart(2, "0")}h` }));
  return (
    <Card className="p-5">
      <SectionTitle title="Horas pico" hint="Cuándo escriben más los asesores (hora de Mérida)." />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} interval={1} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip cursor={{ fill: C.soft }} content={<HoraTooltip />} />
            <Bar dataKey="conversaciones" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={top3.includes(d.hora) ? C.leaf : C.soft} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
function HoraTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-modal">
      <span className="font-semibold text-ink">{String(d.hora).padStart(2, "0")}:00 · </span>
      <span className="text-brand-dark">{d.conversaciones} conversaciones</span>
    </div>
  );
}

/* ---------------- Piezas comunes ---------------- */
function SectionTitle({ title, hint }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-bold text-brand-dark">{title}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
function MiniEmpty({ text }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line bg-softer/60 px-4 text-center text-sm text-muted2">
      {text}
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="mb-4 h-5 w-52" />
        <Skeleton className="h-64 w-full" />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="h-48 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
