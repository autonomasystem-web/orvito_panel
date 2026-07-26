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
  dark: "#064F00",
  green: "#108707",
  leaf: "#38D030",
  moss: "#157a10",
  soft: "#EAF9E8",
  line: "#dde8dc",
  muted: "#5c6b60",
  amber: "#a6772a",
};
const PIE = ["#064F00", "#38D030", "#108707", "#83BC4A", "#a6772a", "#157a10", "#c7e6c0"];

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
          <h1 className="font-display text-2xl font-bold text-brand-dark md:text-3xl">{saludo()}</h1>
          <p className="mt-1 text-muted">
            Cómo va Orvito: qué tan bien funciona y qué mueve en el negocio.
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
        <div className={cx("seq space-y-10 transition-opacity", refetching && "opacity-60")}>
          {data.parcial && (
            <div className="rounded-xl border border-amber/25 bg-amber/5 px-4 py-3 text-sm text-amber">
              Algunas métricas no están disponibles en este momento. Mostramos lo que sí pudimos calcular.
            </div>
          )}

          {/* ============ OPERACIÓN ============ */}
          <section className="space-y-4">
            <GroupHeader
              eyebrow="Operación"
              title="¿La herramienta funciona bien?"
              hint="Salud del sistema en el periodo."
            />
            <KpiOperacion k={data.kpis} config={data.config} />
            <SerieDiaria serie={data.serie_diaria} />
          </section>

          {/* ============ ESTRATÉGICO ============ */}
          <section className="space-y-4">
            <GroupHeader
              eyebrow="Estratégico"
              title="¿Mueve el negocio?"
              hint="Valor real para el equipo comercial."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ResolucionCard k={data.kpis} />
              <AdopcionCard k={data.kpis} />
            </div>
            <GapsConocimiento gaps={data.gaps} />
            <ProximamenteNota />
          </section>

          {/* ============ ADOPCIÓN POR ESFUERZO ============ */}
          <section className="space-y-4">
            <GroupHeader
              eyebrow="Madurez"
              title="Adopción por esfuerzo"
              hint="Avance de Orvito por bloque de trabajo (evaluación estratégica, se ajusta manualmente)."
            />
            <AdopcionEsfuerzo />
          </section>

          {/* ============ DETALLE DE ACTIVIDAD ============ */}
          <section className="space-y-4">
            <GroupHeader
              eyebrow="Detalle"
              title="Actividad por proyecto y tipo"
              hint="El volumen detrás de los números de arriba."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ProyectosTop items={data.proyectos_top} />
              <Categorias items={data.categorias} />
            </div>
            <HorasPico horas={data.horas_pico} />
          </section>

          <p className="pt-2 text-center text-xs text-muted2">
            {diaLargo(data.periodo.desde)} — {diaLargo(data.periodo.hasta)} · Actualiza solo cada 5 min
          </p>
        </div>
      )}
    </Layout>
  );
}

/* ---------------- Encabezado de sección ---------------- */
function GroupHeader({ eyebrow, title, hint }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
      <span className="rounded-full bg-soft px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide text-brand-green">
        {eyebrow}
      </span>
      <h2 className="font-display text-xl font-bold text-brand-dark">{title}</h2>
      {hint && <p className="w-full text-sm text-muted md:ml-auto md:w-auto md:text-right">{hint}</p>}
    </div>
  );
}

/* ---------------- KPIs ---------------- */
// Cuenta de 0 al valor (respeta reduce-motion)
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) {
      setN(target);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) {
      setN(target);
      return;
    }
    let raf;
    let start;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min((ts - start) / ms, 1);
      setN(Math.round(ease(p) * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}
function CountUp({ value, suffix = "" }) {
  const n = useCountUp(value);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

// Pill de tendencia vs periodo anterior. positivo→verde, negativo→ámbar.
function Trend({ value, suffix = "", invert = false }) {
  if (value == null) return null;
  const flat = value === 0;
  const bueno = invert ? value < 0 : value > 0;
  const cls = flat
    ? "text-muted2 bg-softer"
    : bueno
    ? "text-brand-green bg-soft"
    : "text-amber bg-amber/10";
  const arrow = flat ? "→" : value > 0 ? "↑" : "↓";
  return (
    <span className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", cls)}>
      {arrow}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

function KpiOperacion({ k, config }) {
  const cards = [
    {
      label: "Conversaciones",
      value: k.conversaciones_totales ?? 0,
      sub: "en el periodo",
      icon: <Chat size={18} />,
      delta: k.conversaciones_delta_pct != null ? { value: k.conversaciones_delta_pct, suffix: "%" } : null,
    },
    {
      label: "Escaladas a un asesor",
      value: k.escaladas ?? 0,
      sub: "pasaron a un humano",
      icon: <Chat size={18} />,
    },
    {
      label: "Con un agente",
      value: k.abiertas_ahora ?? 0,
      sub: "ahora mismo",
      dot: (k.abiertas_ahora ?? 0) > 0,
    },
    {
      label: "Materiales activos",
      value: config.materiales_activos ?? 0,
      sub: "listos para compartir",
      icon: <Folder size={18} />,
    },
    {
      label: "Promos vigentes",
      value: config.promos_vigentes ?? 0,
      sub: "en curso",
      icon: <Percent size={18} />,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  );
}

function KpiCard({ label, value, suffix, sub, icon, hero, dot, delta }) {
  return (
    <Card
      className={cx(
        "flex flex-col gap-1.5 p-4 md:p-5",
        hero && "border-brand-leaf/30 bg-gradient-to-br from-soft to-white"
      )}
    >
      <div className="flex items-center gap-2 text-muted2">
        {dot && <span className="anim-pop h-2 w-2 rounded-full bg-amber" />}
        {icon && !dot && <span className={hero ? "text-brand-leaf" : "text-muted2"}>{icon}</span>}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <div
        className={cx(
          "font-display font-bold leading-none",
          hero ? "text-4xl text-brand-green" : "text-3xl text-brand-dark"
        )}
      >
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {delta && <Trend value={delta.value} suffix={delta.suffix} invert={delta.invert} />}
        <span className="text-xs text-muted2">{sub}</span>
      </div>
    </Card>
  );
}

/* ---------------- Estratégico: Resolución sin escalar (hero) ---------------- */
function ResolucionCard({ k }) {
  const pct = k.porcentaje_bot ?? 0;
  const delta = k.resolucion_delta_pts;
  return (
    <Card className="flex flex-col gap-2 border-brand-leaf/30 bg-gradient-to-br from-soft to-white p-5 md:p-6">
      <div className="flex items-center gap-2 text-brand-leaf">
        <Sparkles size={18} />
        <span className="text-xs font-medium text-muted">Resolución sin escalar</span>
      </div>
      <div className="font-display text-5xl font-bold leading-none text-brand-green">
        <CountUp value={pct} suffix="%" />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {delta != null && <Trend value={delta} suffix=" pts" />}
        <span className="text-xs text-muted2">Orvito resolvió sin pasar a un asesor</span>
      </div>
    </Card>
  );
}

/* ---------------- Estratégico: Adopción real ---------------- */
function AdopcionCard({ k }) {
  const activos = k.asesores_unicos ?? 0;
  const total = k.total_asesores_acceso; // null hasta que negocio lo defina
  const pct = total ? Math.round((activos / total) * 100) : null;
  return (
    <Card className="flex flex-col gap-2 p-5 md:p-6">
      <div className="flex items-center gap-2 text-muted2">
        <Chat size={18} />
        <span className="text-xs font-medium text-muted">Adopción real</span>
      </div>
      {pct != null ? (
        <>
          <div className="font-display text-5xl font-bold leading-none text-brand-dark">
            <CountUp value={pct} suffix="%" />
          </div>
          <span className="text-xs text-muted2">
            {activos} de {total} asesores con acceso escribieron a Orvito
          </span>
        </>
      ) : (
        <>
          <div className="font-display text-5xl font-bold leading-none text-brand-dark">
            <CountUp value={activos} />
          </div>
          <span className="text-xs text-muted2">personas únicas escribieron a Orvito</span>
          <p className="mt-1 rounded-lg bg-softer px-2.5 py-1.5 text-[11px] leading-snug text-muted">
            Para ver el <b>% de adopción</b>, falta definir cuántos asesores tienen acceso (pendiente con el equipo).
          </p>
        </>
      )}
    </Card>
  );
}

/* ---------------- Estratégico: Gaps de conocimiento ---------------- */
function GapsConocimiento({ gaps }) {
  const items = gaps || [];
  const max = items.reduce((m, g) => Math.max(m, g.consultas), 0) || 1;
  return (
    <Card className="p-4 md:p-5">
      <SectionTitle
        title="Gaps de conocimiento"
        hint="Temas que más terminan con un asesor — dónde reforzar a Orvito."
      />
      {!items.length ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line bg-softer/60 px-4 text-center text-sm text-muted2">
          Ninguna consulta se escaló a un asesor en este periodo. 🎉
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((g, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{gapLabel(g.tema)}</span>
                <span className="shrink-0 font-semibold text-brand-dark">
                  {g.consultas} {g.consultas === 1 ? "consulta" : "consultas"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-softer">
                <div
                  className="h-full rounded-full bg-amber/70"
                  style={{ width: `${Math.max(8, Math.round((g.consultas / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
// El tema puede ser un proyecto (legible tal cual) o una categoría conocida.
function gapLabel(tema) {
  if (!tema) return "Sin clasificar";
  const asCat = catLabel(tema);
  return asCat && asCat !== tema ? asCat : tema;
}

/* ---------------- Estratégico: nota de próximamente ---------------- */
function ProximamenteNota() {
  const pend = ["Tiempo de respuesta", "Cotizaciones con seguimiento", "Alertas con acción tomada"];
  return (
    <p className="text-xs text-muted2">
      <span className="font-medium text-muted">Próximamente</span>, cuando el stack lo permita:{" "}
      {pend.join(" · ")}.
    </p>
  );
}

/* ---------------- Adopción por esfuerzo (E1–E5) ---------------- */
const ESFUERZOS = [
  { id: "E1", nombre: "Producto / Información", pct: 82, estado: "En producción" },
  { id: "E2", nombre: "Inventario", pct: 68, estado: "En producción" },
  { id: "E3", nombre: "Espacio Comercial · DDV", pct: 35, estado: "Parcial" },
  { id: "E4", nombre: "Cotizaciones", pct: 57, estado: "En producción" },
  { id: "E5", nombre: "Contractual + Legal", pct: 12, estado: "Fase futura" },
];
const ESTADO_STYLE = {
  "En producción": "bg-soft text-brand-green",
  Parcial: "bg-amber/10 text-amber",
  "Fase futura": "bg-softer text-muted2",
};
function AdopcionEsfuerzo() {
  return (
    <Card className="p-4 md:p-5">
      <ul className="space-y-4">
        {ESFUERZOS.map((e) => (
          <li key={e.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-display text-sm font-bold text-brand-dark">{e.id}</span>
              <span className="text-sm text-ink">{e.nombre}</span>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  ESTADO_STYLE[e.estado] || "bg-softer text-muted2"
                )}
              >
                {e.estado}
              </span>
              <span className="ml-auto font-display text-sm font-bold text-brand-dark">{e.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-softer">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${e.pct}%`,
                  background: e.estado === "Fase futura" ? C.muted : e.estado === "Parcial" ? C.amber : C.leaf,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Serie diaria ---------------- */
function SerieDiaria({ serie }) {
  const hayResuelto = serie.some((d) => d.pct_resuelto != null);
  return (
    <Card className="p-4 md:p-5">
      <SectionTitle
        title="Conversaciones por día"
        hint="Volumen diario y qué tanto resolvió Orvito sin escalar."
      />
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 10, right: hayResuelto ? 4 : 8, left: -18, bottom: 0 }}>
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
              yAxisId="left"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            {hayResuelto && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: C.green }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
            )}
            <Tooltip content={<SerieTooltip />} />
            <Area
              yAxisId="left"
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
            {hayResuelto && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pct_resuelto"
                stroke={C.green}
                strokeWidth={2}
                dot={{ r: 2.5, fill: C.green, strokeWidth: 0 }}
                name="% resuelto sin escalar"
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-4 pl-2 text-xs text-muted">
        <Legend color={C.dark}>Conversaciones</Legend>
        {hayResuelto && <Legend color={C.green}>% resuelto sin escalar</Legend>}
      </div>
    </Card>
  );
}
function SerieTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const conv = payload.find((p) => p.dataKey === "conversaciones")?.value ?? 0;
  const pct = payload.find((p) => p.dataKey === "pct_resuelto")?.value;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-modal">
      <p className="mb-1 font-semibold text-ink">{diaLargo(label)}</p>
      <p className="text-muted">
        <b className="text-brand-dark">{conv}</b> conversaciones
      </p>
      {pct != null && (
        <p className="text-muted">
          <b className="text-brand-green">{pct}%</b> resuelto sin escalar
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
      <Card className="p-4 md:p-5">
        <SectionTitle title="Proyectos más consultados" hint="Lo que más piden los asesores." />
        <MiniEmpty text="Aún no hay consultas por proyecto en este periodo." />
      </Card>
    );
  }
  const data = items.map((x) => ({ name: x.proyecto, value: x.consultas }));
  return (
    <Card className="p-4 md:p-5">
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
      <Card className="p-4 md:p-5">
        <SectionTitle title="Qué piden los asesores" hint="Tipo de consulta más frecuente." />
        <MiniEmpty text="Aún no hay resúmenes para clasificar en este periodo." />
      </Card>
    );
  }
  const data = items.map((x, i) => ({ name: catLabel(x.categoria), value: x.total, color: PIE[i % PIE.length] }));
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <Card className="p-4 md:p-5">
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
    <Card className="p-4 md:p-5">
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
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="space-y-3 p-4 md:p-5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </Card>
        ))}
      </div>
      <Card className="p-4 md:p-5">
        <Skeleton className="mb-4 h-5 w-52" />
        <Skeleton className="h-64 w-full" />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="p-4 md:p-5">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="h-48 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
