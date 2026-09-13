/**
 * The flood map: 281 statistical areas, two questions, one canvas.
 *
 * **One map with two paint functions rather than two screens**, which AC 4.1.1
 * asks for and which is also the cheaper answer: a mode change keeps the
 * position, the zoom and the selected area for free, where two screens would
 * make retaining any of them into work.
 *
 * The mode switch carries the *question* rather than a label — *how much was
 * recorded* against *how much relative to the people living there* — because
 * they are different questions and neither ranking is the correct one. That is
 * the mentor review's fifth point, and the size of it is measured: Dandenong
 * is 5th by count and 24th by rate, and the rate's top area is not in the
 * count's top twelve at all.
 *
 * **What is deliberately not on it.** No forecast, no probability, no depth,
 * and no claim about who was affected. The score's denominator is the
 * population; dividing by it is the opposite of counting people.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  type AreaMark,
  drawAreas,
  legendFor,
  markAt,
  marksFor,
} from '../history/drawAreas.js';
import {
  type MapArea,
  type MapMode,
  type PointsArtefact,
  type PopulationArtefact,
  type ScopeAreas,
  completenessOf,
  completenessText,
  scoreLabel,
  totalLabel,
} from '../history/severity.js';
import {
  DOTS_NOTE,
  INFORMATION_TYPES,
  type Point,
  activityEvidence,
  coverageEvidence,
  notAPrediction,
  severityEvidence,
} from '../history/evidence.js';
import { type Viewport, clamp, fitWithin, pan, scaleToContain, zoomAt } from '../map/viewport.js';
import {
  brand,
  ink,
  line,
  radius,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from '../ui/theme.js';

/** The question each mode answers, which is the thing being switched. */
const QUESTIONS: Readonly<Record<MapMode, { readonly tab: string; readonly asks: string }>> = {
  activity: {
    // AC 4.1.1.a names the mode.
    tab: 'Historical Flood Activity',
    asks: 'How much flood-related SES activity was recorded?',
  },
  severity: {
    tab: 'Severity Score',
    asks: 'How much was recorded relative to the people living there?',
  },
};

export interface FloodMapProps {
  readonly areas: readonly MapArea[];
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly points: PointsArtefact;
  readonly onBack: () => void;
}

export function FloodMap({ areas, scope, population, points, onBack }: FloodMapProps) {
  const [mode, setMode] = useState<MapMode>('activity');
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const marksRef = useRef<readonly AreaMark[]>([]);
  // Dragging pans. It had only + , − and "pan north", so once zoomed in
  // nothing south, east or west of the view could be reached.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  const bounds = useMemo(
    () => ({ widthM: points.extent.width_m, heightM: points.extent.height_m }),
    [points.extent.width_m, points.extent.height_m],
  );

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setViewport((current) =>
        current === null
          ? fitWithin(width, height, bounds)
          : clamp({ ...current, widthPx: width, heightPx: height }, bounds),
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [bounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport === null) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.widthPx * ratio);
    canvas.height = Math.round(viewport.heightPx * ratio);
    canvas.style.width = `${String(viewport.widthPx)}px`;
    canvas.style.height = `${String(viewport.heightPx)}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const marks = marksFor(areas, mode, viewport, selected);
    marksRef.current = marks;
    drawAreas(context, {
      marks,
      mode,
      stateOf: (area) => completenessOf(area, mode),
      selected,
      viewport,
      width: viewport.widthPx,
      height: viewport.heightPx,
    });
  }, [areas, mode, selected, viewport]);

  const pick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const area = markAt(marksRef.current, event.clientX - rect.left, event.clientY - rect.top);
    // A click on nothing clears the selection rather than keeping it. A panel
    // describing an area the person is no longer pointing at is a caption on
    // the wrong photograph.
    setSelected(area?.code ?? null);
  }, []);

  const chosen = areas.find((a) => a.code === selected) ?? null;
  const years = scope.reportingPeriod.years;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            padding: `${String(space(5))}px ${String(space(6))}px ${String(space(4))}px`,
            borderBottom: `1px solid ${line.base}`,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: brand.ink,
              font: type(text.label, { weight: weight.medium }),
            }}
          >
            ← Back
          </button>
          <h1
            style={{
              margin: `${String(space(3))}px 0 ${String(space(1))}px`,
              font: type(text.title, { weight: weight.bold, leading: 1.2 }),
              letterSpacing: tracking.title,
              color: ink.strong,
            }}
          >
            Flood history across {scope.geography.scope}
          </h1>
          <p style={{ margin: 0, font: type(text.label), color: ink.muted }}>
            {scope.reportingPeriod.start} to {scope.reportingPeriod.end} ·{' '}
            {String(areas.length)} {scope.geography.unit} areas · recorded {scope.incidentType}{' '}
            activity, grouped by statistical area
          </p>

          <div
            style={{
              display: 'flex',
              gap: space(2),
              alignItems: 'center',
              marginTop: space(4),
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                font: type(text.micro, { weight: weight.semibold }),
                letterSpacing: tracking.caps,
                textTransform: 'uppercase',
                color: ink.subtle,
              }}
            >
              Map view
            </span>
            {(Object.keys(QUESTIONS) as MapMode[]).map((each) => (
              <button
                key={each}
                type="button"
                aria-pressed={mode === each}
                onClick={() => {
                  setMode(each);
                }}
                style={{
                  padding: `${String(space(2))}px ${String(space(4))}px`,
                  borderRadius: radius.pill,
                  border: `1px solid ${mode === each ? brand.tint : line.base}`,
                  background: mode === each ? brand.wash : surface.raised,
                  color: mode === each ? brand.ink : ink.muted,
                  font: type(text.label, { weight: weight.semibold }),
                }}
              >
                {QUESTIONS[each].tab}
              </button>
            ))}
          </div>
          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              font: type(text.label),
              color: ink.muted,
            }}
          >
            {QUESTIONS[mode].asks}
          </p>
          <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro, { leading: 1.5 }), color: ink.subtle }}>
            {notAPrediction(scope)} {DOTS_NOTE}
          </p>
        </header>

        <div ref={frameRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            onClick={(event) => {
              // A drag that ends over a dot is a pan, not a choice.
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              pick(event);
            }}
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, y: event.clientY };
              dragged.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const from = drag.current;
              if (from === null) return;
              const dx = event.clientX - from.x;
              const dy = event.clientY - from.y;
              if (!dragged.current && Math.hypot(dx, dy) < 4) return;
              dragged.current = true;
              drag.current = { x: event.clientX, y: event.clientY };
              setViewport((current) => (current === null ? current : clamp(pan(current, dx, dy), bounds)));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onWheel={(event) => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) return;
              const at: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
              setViewport((current) =>
                current === null
                  ? current
                  : zoomAt(current, event.deltaY < 0 ? 1.2 : 1 / 1.2, at, bounds, scaleToContain(current.widthPx, current.heightPx, bounds)),
              );
            }}
            aria-label={`${String(areas.length)} statistical areas, ${QUESTIONS[mode].asks}`}
            style={{ display: 'block', cursor: 'grab', background: surface.sunken, touchAction: 'none' }}
          />
          <Legend mode={mode} years={years} />
          <Zoom
            onZoom={(by) => {
              setViewport((current) =>
                current === null
                  ? current
                  : zoomAt(
                      current,
                      by,
                      [current.widthPx / 2, current.heightPx / 2],
                      bounds,
                      scaleToContain(current.widthPx, current.heightPx, bounds),
                    ),
              );
            }}
          />
        </div>
      </div>

      <aside
        style={{
          width: 380,
          flexShrink: 0,
          overflow: 'auto',
          borderLeft: `1px solid ${line.base}`,
          background: surface.raised,
          padding: space(5),
        }}
      >
        {chosen === null ? (
          <Nothing count={areas.length} mode={mode} scope={scope} population={population} areas={areas} />
        ) : (
          <Detail
            area={chosen}
            mode={mode}
            years={years}
            population={population}
            scope={scope}
            areas={areas}
          />
        )}
      </aside>
    </div>
  );
}

/**
 * The panel before anything is chosen.
 *
 * It says what pressing an area gives, rather than sitting empty. An empty
 * panel beside a full map reads as a panel that failed to load.
 */
function Nothing({
  count,
  mode,
  scope,
  population,
  areas,
}: {
  readonly count: number;
  readonly mode: MapMode;
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly areas: readonly MapArea[];
}) {
  return (
    <div style={{ color: ink.muted, font: type(text.label, { leading: 1.6 }) }}>
      <h2
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.lead, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        Select an area to see its records
      </h2>
      <p style={{ margin: 0 }}>
        Any of the {String(count)} areas on the map. Each one shows what was recorded in it, how
        that was spread across the years, the population the score is measured against, and how
        complete the record is.
      </p>
      <Evidence mode={mode} scope={scope} population={population} areas={areas} open />
    </div>
  );
}

/**
 * The evidence behind the map, AC 4.3.1 to 4.3.4 and 4.1.4.h.
 *
 * Open beside the map before anything is chosen, and one press away inside an
 * area's record: "learn more" is not a link to a document somebody will not
 * open, it is the sentences, here.
 */
function Evidence({
  mode,
  scope,
  population,
  areas,
  open = false,
}: {
  readonly mode: MapMode;
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly areas: readonly MapArea[];
  readonly open?: boolean;
}) {
  const [shown, setShown] = useState(open);
  const view = mode === 'activity' ? activityEvidence(scope, areas) : severityEvidence(scope, population);
  return (
    <section style={{ marginTop: space(5) }}>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => {
          setShown((now) => !now);
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: brand.ink,
          font: type(text.label, { weight: weight.semibold }),
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        About the data, the calculation and its limits
      </button>
      {shown && (
        <div style={{ marginTop: space(3) }}>
          <Points
            heading={mode === 'activity' ? 'Historical Flood Activity' : 'Severity Score'}
            points={view}
          />
          <Points heading="Coverage and uncertainty" points={coverageEvidence(scope, population, areas)} />
          <h4 style={headingStyle}>Three kinds of information</h4>
          {INFORMATION_TYPES.map((kind) => (
            <div key={kind.key} style={{ marginBottom: space(3) }}>
              <Badge kind={kind.key} />
              <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.micro, { leading: 1.55 }), color: ink.muted }}>
                <strong style={{ color: ink.strong }}>{kind.what}.</strong> {kind.purpose} {kind.limits}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const headingStyle = {
  margin: `${String(space(3))}px 0 ${String(space(2))}px`,
  font: type(text.micro, { weight: weight.semibold }),
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: ink.subtle,
} as const;

function Points({ heading, points }: { readonly heading: string; readonly points: readonly Point[] }) {
  return (
    <>
      <h4 style={headingStyle}>{heading}</h4>
      {points.map((point) => (
        <p key={point.title} style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.micro, { leading: 1.55 }), color: ink.muted }}>
          <strong style={{ color: ink.strong }}>{point.title}.</strong> {point.body}
        </p>
      ))}
    </>
  );
}

const BADGES = {
  recorded: { label: 'Recorded by the SES', background: '#dcece6', color: '#1f5b4e' },
  calculated: { label: 'Calculated by DrainLens', background: '#dde8f2', color: '#2a5678' },
  written: { label: 'Written by the DrainLens team', background: '#f3e8f6', color: '#6a3a78' },
} as const;

/** AC 4.3.4.a: the three kinds of information carry three different marks. */
function Badge({ kind }: { readonly kind: keyof typeof BADGES }) {
  const badge = BADGES[kind];
  return (
    <span
      style={{
        display: 'inline-block',
        marginBottom: space(2),
        padding: '1px 7px',
        borderRadius: 999,
        font: type(text.micro, { weight: weight.semibold }),
        background: badge.background,
        color: badge.color,
      }}
    >
      {badge.label}
    </span>
  );
}

/** What one area's record supports — AC 4.1.4. */
function Detail({
  area,
  mode,
  years,
  population,
  scope,
  areas,
}: {
  readonly area: MapArea;
  readonly mode: MapMode;
  readonly years: readonly string[];
  readonly population: PopulationArtefact;
  readonly scope: ScopeAreas;
  readonly areas: readonly MapArea[];
}) {
  const state = completenessOf(area, mode);
  const completeness = completenessText(area, state, scope.incidentType);
  const widest = Math.max(1, ...area.byYear);

  return (
    <div>
      <h2
        style={{
          margin: `0 0 ${String(space(1))}px`,
          font: type(text.lead, { weight: weight.semibold }),
          letterSpacing: tracking.title,
          color: ink.strong,
        }}
      >
        {area.name}
      </h2>
      <p style={{ margin: `0 0 ${String(space(5))}px`, font: type(text.micro), color: ink.subtle }}>
        {scope.geography.unit} · {scope.reportingPeriod.start} to {scope.reportingPeriod.end}
      </p>

      <Section title="Recorded activity">
        <Badge kind="recorded" />
        <p style={{ margin: `0 0 ${String(space(3))}px` }}>
          <strong style={{ font: type(text.display, { weight: weight.bold }), color: ink.strong }}>
            {totalLabel(area)}
          </strong>{' '}
          recorded {scope.incidentType} dispatches
        </p>
        {area.byYear.map((count, index) => (
          <div
            key={years[index] ?? index}
            style={{ display: 'flex', alignItems: 'center', gap: space(3), marginBottom: space(1) }}
          >
            <span style={{ width: 62, font: type(text.micro), color: ink.subtle }}>
              {years[index] ?? ''}
            </span>
            <span
              style={{
                flex: 1,
                height: 8,
                borderRadius: radius.pill,
                background: surface.sunken,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${String((count / widest) * 100)}%`,
                  height: '100%',
                  background: brand.base,
                }}
              />
            </span>
            <span style={{ width: 28, textAlign: 'right', font: type(text.micro), color: ink.muted }}>
              {String(count)}
              {area.complete ? '' : '+'}
            </span>
          </div>
        ))}
        <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro, { leading: 1.55 }), color: ink.subtle }}>
          One count is one SES crew dispatch, not one flood event.
          {area.complete
            ? ''
            : ' A count inside this area was withheld, so each year is a minimum as well as the total.'}
        </p>
      </Section>

      <Section title="Severity Score">
        <Badge kind="calculated" />
        <p style={{ margin: `0 0 ${String(space(2))}px` }}>
          <strong style={{ font: type(text.title, { weight: weight.bold }), color: ink.strong }}>
            {scoreLabel(area)}
          </strong>{' '}
          {area.rate === null ? '' : 'dispatches per 1,000 residents'}
        </p>
        <p style={{ margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
          {/*
            Branched on the residents rather than on the rate, which is not a
            style choice: they are null together, and only one of them says so
            to the type checker. The first version read the rate here and then
            printed the population in the other arm, where it is still `number
            | null` as far as anything can tell.
          */}
          {area.persons === null ? (
            <>
              No score: this area had{' '}
              {(area.personsByYear[population.asAt.indexOf(population.denominator)] ?? 0).toLocaleString('en-AU')}{' '}
              residents on {population.denominator}, fewer than{' '}
              {population.minimumResidents.toLocaleString('en-AU')}, and a rate per resident needs
              residents. It is not a low score.
            </>
          ) : (
            <>
              {area.persons.toLocaleString('en-AU')} residents at {population.denominator}, from{' '}
              {population.source.publisher}. It is not a count of people affected.
              {area.complete
                ? ''
                : ' Because a count inside this area was withheld, the score is a minimum too.'}
            </>
          )}
        </p>
        <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro, { leading: 1.55 }), color: ink.subtle }}>
          Calculated by DrainLens from recorded SES activity and ABS population. It is not the
          physical severity of any flood, a flood probability, or a measure of current or future
          flood risk.
        </p>
      </Section>

      <Section title="How complete this is">
        <p style={{ margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
          <strong style={{ color: ink.strong }}>{completeness.label}</strong> {completeness.body}
        </p>
      </Section>

      <Section title="Recorded events">
        <Badge kind="written" />
        {/*
          The empty state first, and it is not a placeholder. Verified events
          are written by hand from named sources, so almost every one of the
          281 areas will have none — this is what the section says most of the
          time, and a section that only looks right when it is full would be
          wrong on nearly every area.
        */}
        <p style={{ margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
          No verified events have been recorded for {area.name}. That means nobody has written one
          up from a named source — not that nothing happened here. The dispatch counts above are
          the record.
        </p>
      </Section>
      <Evidence mode={mode} scope={scope} population={population} areas={areas} />
    </div>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: space(5) }}>
      <h3
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        {title}
      </h3>
      <div style={{ font: type(text.label, { leading: 1.6 }), color: ink.muted }}>{children}</div>
    </section>
  );
}

/** The key, over the map rather than beside it, because the map is the page. */
function Legend({ mode, years }: { readonly mode: MapMode; readonly years: readonly string[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: space(4),
        right: space(4),
        maxWidth: 260,
        padding: space(4),
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
      }}
    >
      <p
        style={{
          margin: `0 0 ${String(space(3))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        {QUESTIONS[mode].tab}
      </p>
      {/*
        AC 4.1.3.c and e, 4.3.3.d: what the numbers are, over what years, and
        who produced them. A band name without its unit is a judgement with
        the workings hidden; a score without "calculated" borrows the SES's
        authority.
      */}
      <p style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.micro, { leading: 1.4 }), color: ink.muted }}>
        {mode === 'activity'
          ? `SES crew dispatches, ${years[0] ?? ''} to ${years.at(-1) ?? ''}`
          : `Dispatches per 1,000 residents, ${years[0] ?? ''} to ${years.at(-1) ?? ''}`}
      </p>
      <Badge kind={mode === 'activity' ? 'recorded' : 'calculated'} />
      {legendFor(mode).map((entry) => (
        <div
          key={entry.label}
          style={{ display: 'flex', gap: space(3), alignItems: 'center', marginBottom: space(2) }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              flexShrink: 0,
              borderRadius: '50%',
              background: entry.fill ?? 'transparent',
              border: `${entry.ringed ? '2px' : '1px'} ${entry.dashed ? 'dashed' : 'solid'} ${entry.stroke}`,
            }}
          />
          <span style={{ font: type(text.micro, { leading: 1.45 }), color: ink.muted }}>
            {entry.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Zoom({ onZoom }: { readonly onZoom: (by: number) => void }) {
  const button = {
    width: 32,
    height: 32,
    borderRadius: radius.base,
    border: `1px solid ${line.base}`,
    background: surface.raised,
    color: ink.strong,
    font: type(text.label, { weight: weight.semibold }),
  } as const;
  return (
    <div
      style={{
        position: 'absolute',
        right: space(4),
        bottom: space(4),
        display: 'flex',
        flexDirection: 'column',
        gap: space(2),
      }}
    >
      <button type="button" aria-label="Zoom in" style={button} onClick={() => { onZoom(1.5); }}>
        +
      </button>
      <button type="button" aria-label="Zoom out" style={button} onClick={() => { onZoom(1 / 1.5); }}>
        −
      </button>

    </div>
  );
}
