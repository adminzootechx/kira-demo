"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend as RLegend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

/** One categorical ramp used across every engine so a series keeps its colour. */
export const palette = {
  navy: "#0F1729",
  accent: "#2F4FE0",
  accentLight: "#93A6F4",
  teal: "#0E9384",
  violet: "#7839EE",
  amber: "#B54708",
  blue: "#2F4FE0",
  green: "#17A45C",
  red: "#D92D20",
  grid: "#E2E8F2",
  axis: "#98A2B3",
};

/**
 * Recharts re-measures its container on every ResizeObserver callback and
 * re-renders the whole SVG each time, so any continuous width change — a
 * window drag, a panel opening — re-rendered every chart on the page on every
 * frame of it, measured at 2.5fps on the forecast screen with single frames
 * over a second long. Debouncing means the charts resize once, just after the
 * movement settles, and the movement itself stays cheap.
 */
export const RESIZE_DEBOUNCE = 180;

/**
 * Renders a chart only while it is near the viewport, holding its exact height
 * so nothing shifts when it arrives.
 *
 * Recharts re-renders every mounted chart whenever its container resizes. The
 * forecast screen mounts six charts but shows one, so a window resize paid to
 * redraw five charts nobody was looking at — the frames that still stuttered
 * after debouncing. Gating on visibility makes that cost proportional to what
 * is actually on screen, and takes the same five charts off the initial
 * render.
 *
 * The margin is deliberately generous: the chart is built well before it
 * scrolls into view, and released only once it is far behind, so scrolling
 * never shows an empty frame.
 */
function ChartFrame({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Falls back to the viewport if the shell's scroll container is absent,
    // which is the case on any page rendered outside the dashboard layout.
    const root = document.getElementById("main-content");
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: root ?? null, rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height }}>
      {near ? children : null}
    </div>
  );
}

/** Every chart in the product goes through here, so the debounce and the
 *  visibility gate are impossible to forget on a new one. */
function Responsive({ height, children }: { height: number; children: React.ReactElement }) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height={height} debounce={RESIZE_DEBOUNCE}>
        {children}
      </ResponsiveContainer>
    </ChartFrame>
  );
}

const axisProps = {
  stroke: palette.axis,
  tick: { fill: palette.axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: palette.grid },
};

/**
 * Horizontal rules only, dotted rather than dashed. A `1 6` pattern renders as
 * a row of points, which reads as a measuring guide behind the data instead of
 * a second set of lines competing with it — the treatment the benchmark panel
 * uses in the design.
 */
const dottedGrid = {
  strokeDasharray: "1 6",
  vertical: false,
  stroke: "#C7D2E4",
} as const;

function TipShell({
  active, payload, label, unit = "",
}: {
  active?: boolean;
  payload?: readonly { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-border bg-card px-3 py-2 shadow-[var(--shadow-raised)]">
      {label !== undefined && (
        <p className="mb-1 text-[11.5px] font-semibold text-navy">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-[12px] text-navy-soft">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold text-navy">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------ Simple bars ---------------------------- */

export function Bars({
  data, xKey, yKey, name, height = 220, unit = "", colorBy,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  name: string;
  height?: number;
  unit?: string;
  colorBy?: (row: Record<string, string | number>, index: number) => string;
}) {
  return (
    <Responsive height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid {...dottedGrid} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip content={<TipShell unit={unit} />} cursor={{ fill: "#EEF2FE", opacity: 0.7 }} />
        <Bar isAnimationActive={false} dataKey={yKey} name={name} radius={[3, 3, 0, 0]} barSize={26}>
          {data.map((row, i) => (
            <Cell key={i} fill={colorBy ? colorBy(row, i) : palette.navy} />
          ))}
        </Bar>
      </BarChart>
    </Responsive>
  );
}

/* -------------------------------- Radar -------------------------------- */

export function ScoreRadar({
  data, height = 240, color = palette.accent,
}: {
  data: { axis: string; value: number }[];
  height?: number;
  color?: string;
}) {
  return (
    <Responsive height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={palette.grid} />
        <PolarAngleAxis dataKey="axis" tick={{ fill: palette.axis, fontSize: 10.5 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar isAnimationActive={false} name="Score" dataKey="value" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
        <Tooltip content={<TipShell />} />
      </RadarChart>
    </Responsive>
  );
}

/* ------------------------------ Bubble map ----------------------------- */

export function OpportunityScatter({
  data, height = 300,
}: {
  data: { x: number; y: number; z: number; name: string }[];
  height?: number;
}) {
  return (
    <Responsive height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="1 6" stroke="#C7D2E4" />
        <XAxis
          type="number" dataKey="x" name="Growth" unit="%" {...axisProps}
          label={{ value: "Growth %", position: "insideBottom", offset: -4, fill: palette.axis, fontSize: 11 }}
        />
        <YAxis
          type="number" dataKey="y" name="Risk of losing them" unit="%" {...axisProps}
          label={{ value: "Risk of losing them %", angle: -90, position: "insideLeft", offset: 16, fill: palette.axis, fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="z" range={[60, 620]} name="Value" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { name: string; x: number; y: number; z: number };
            return (
              <div className="rounded-[12px] border border-border bg-card px-3 py-2 shadow-[var(--shadow-raised)]">
                <p className="text-[12px] font-semibold text-navy">{d.name}</p>
                <p className="text-[11.5px] text-muted-foreground">Growth {d.x}% · Risk of losing them {d.y}%</p>
                <p className="text-[11.5px] text-muted-foreground">Sales, last 12 months ${(d.z / 1_000_000).toFixed(2)}M</p>
              </div>
            );
          }}
        />
        <Scatter isAnimationActive={false} data={data}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.y > 55 ? palette.red : d.x > 15 ? palette.green : palette.accent}
              fillOpacity={0.62}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </Responsive>
  );
}

export { RLegend };
