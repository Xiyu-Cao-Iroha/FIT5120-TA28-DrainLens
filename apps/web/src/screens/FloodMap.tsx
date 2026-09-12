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
  scoreLabel,
  totalLabel,
} from '../history/severity.js';
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
    tab: 'Recorded activity',
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
        </header>

        <div ref={frameRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            onClick={pick}
            aria-label={`${String(areas.length)} statistical areas, ${QUESTIONS[mode].asks}`}
            style={{ display: 'block', cursor: 'pointer', background: surface.sunken }}
          />
          <Legend mode={mode} />
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
            onPan={(dx, dy) => {
              setViewport((current) =>
                current === null ? current : clamp(pan(current, dx, dy), bounds),
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
          <Nothing count={areas.length} />
        ) : (
          <Detail
            area={chosen}
            mode={mode}
            years={years}
            population={population}
            scope={scope}
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
function Nothing({ count }: { readonly count: number }) {
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
    </div>
  );
}

/** What one area's record supports — AC 4.1.4. */
function Detail({
  area,
  mode,
  years,
  population,
  scope,
}: {
  readonly area: MapArea;
  readonly mode: MapMode;
  readonly years: readonly string[];
  readonly population: PopulationArtefact;
  readonly scope: ScopeAreas;
}) {
  const state = completenessOf(area, mode);
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
            </span>
          </div>
        ))}
      </Section>

      <Section title="Severity Score">
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
              No score: this area has fewer than{' '}
              {population.minimumResidents.toLocaleString('en-AU')} residents, and a rate per
              resident needs residents. It is not a low score.
            </>
          ) : (
            <>
              {area.persons.toLocaleString('en-AU')} residents at {population.denominator}, from{' '}
              {population.source.publisher}. It is not a count of people affected.
            </>
          )}
        </p>
      </Section>

      <Section title="How complete this is">
        <p style={{ margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
          {state === 'minimum' ? (
            <>
              <strong style={{ color: ink.strong }}>Minimum value.</strong> A count inside this
              area was withheld for privacy — {String(area.suppressedRegions)} of its{' '}
              {String(area.regions)} smaller regions — so the total is a lower bound rather than a
              number.
            </>
          ) : state === 'none' ? (
            <>
              <strong style={{ color: ink.strong }}>No recorded activity.</strong> The SES recorded
              no {scope.incidentType.toLowerCase()} dispatch here across the whole period. That is
              different from a small number.
            </>
          ) : state === 'unavailable' ? (
            <>
              <strong style={{ color: ink.strong }}>Not available.</strong> The counts are exact;
              the score is not published because there is no usable population to divide by.
            </>
          ) : (
            <>
              <strong style={{ color: ink.strong }}>Exact.</strong> No count inside this area was
              withheld.
            </>
          )}
        </p>
      </Section>

      <Section title="Recorded events">
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
function Legend({ mode }: { readonly mode: MapMode }) {
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

function Zoom({
  onZoom,
  onPan,
}: {
  readonly onZoom: (by: number) => void;
  readonly onPan: (dx: number, dy: number) => void;
}) {
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
      <button
        type="button"
        aria-label="Pan north"
        style={button}
        onClick={() => {
          onPan(0, 80);
        }}
      >
        ↑
      </button>
    </div>
  );
}
