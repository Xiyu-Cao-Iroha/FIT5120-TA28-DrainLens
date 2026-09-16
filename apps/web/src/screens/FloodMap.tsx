/**
 * The flood map: 281 statistical areas, two questions, one canvas.
 *
 * **One map with two paint functions rather than two screens**, which AC 4.1.1
 * asks for and which is also the cheaper answer: a mode change keeps the
 * position, the zoom and the selected area for free, where two screens would
 * make retaining any of them into work.
 *
 * The mode switch carries the *question* rather than a label -- *how many
 * emergency responses* against *how many per 1,000 people* -- because they
 * are different questions and neither ranking is the correct one. That is
 * the mentor review's fifth point, and the size of it is measured: Dandenong
 * is 5th by count and 24th by rate, and the rate's top area is not in the
 * count's top twelve at all.
 *
 * **What is deliberately not on it.** No forecast, no probability, no depth,
 * and no claim about who was affected. The rate's denominator is the
 * population; dividing by it is the opposite of counting people.
 *
 * **Short on the surface, the rest under More information** (copy audit v2,
 * 15 September, #79 to #87). The header spells the SES out once, says how to
 * read the colours and what one count is, and keeps one safety line. The panel
 * shows an area's numbers with one sentence each; the method, the coverage and
 * who recorded what are folded below it, and the source badges are gone.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  EMPTY_FILL,
  GROUND,
  MAX_AREA_SCALE,
  areaAt,
  drawAreas,
  legendFor,
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
  INFORMATION_TYPES,
  NOT_A_FORECAST,
  type Point,
  activityEvidence,
  coverageEvidence,
  severityEvidence,
} from '../history/evidence.js';
import {
  EVENTS_UNAVAILABLE,
  type FloodEvent,
  NOT_COMPLETE,
  againstRecord,
  eventDate,
  eventsFor,
  noEventsText,
} from '../history/events.js';
import { yearLabel, yearRange } from '../history/artefact.js';
import { atLeastTip } from '../history/board.js';
import { LEGEND_INSET_PX, legendBox, legendOpen } from '../history/legendFold.js';
import { type Viewport, clamp, fitWithin, pan, scaleToContain, zoomAt } from '../map/viewport.js';
import { FLOOD } from '../ui/terms.js';
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

/**
 * The question each mode answers, which is the thing being switched.
 *
 * `asks` is how to read the colours (copy audit v2, #81): the question as a
 * sentence about darker areas. `legend` is the key's title (#82), the unit
 * and the years, since the page has spelled the SES out above it.
 */
const QUESTIONS: Readonly<Record<MapMode, { readonly tab: string; readonly asks: string; readonly legend: string }>> = {
  activity: {
    // AC 4.1.1.a names the mode.
    tab: FLOOD.callouts,
    asks: 'Darker areas had more SES emergency responses.',
    legend: FLOOD.legend,
  },
  severity: {
    tab: FLOOD.rate,
    asks: 'Darker areas had more SES emergency responses for every 1,000 people.',
    legend: `SES ${FLOOD.rateUnit}, ${FLOOD.period}`,
  },
};

export interface FloodMapProps {
  readonly areas: readonly MapArea[];
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly points: PointsArtefact;
  /** Checked events only, or null when the list could not be loaded. */
  readonly events: readonly FloodEvent[] | null;
  readonly onBack: () => void;
}

export function FloodMap({ areas, scope, population, points, events, onBack }: FloodMapProps) {
  const [mode, setMode] = useState<MapMode>('activity');
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
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

    viewportRef.current = viewport;
    drawAreas(context, {
      areas,
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
    const current = viewportRef.current;
    if (!current) return;
    const area = areaAt(areas, current, event.clientX - rect.left, event.clientY - rect.top);
    // A click on nothing clears the selection rather than keeping it. A panel
    // describing an area the person is no longer pointing at is a caption on
    // the wrong photograph.
    setSelected(area?.code ?? null);
  }, [areas]);

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
          {/* Copy audit v2, #79: the first time this page names the SES. */}
          <p style={{ margin: 0, font: type(text.label), color: ink.muted }}>
            Emergency responses to floods by the {FLOOD.ses}, by area, {FLOOD.period}
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
            {FLOOD.explain} {NOT_A_FORECAST}
          </p>
        </header>

        <div ref={frameRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            onClick={(event) => {
              // A drag that ends over an area is a pan, not a choice.
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
                  : zoomAt(
                      current,
                      event.deltaY < 0 ? 1.2 : 1 / 1.2,
                      at,
                      bounds,
                      scaleToContain(current.widthPx, current.heightPx, bounds),
                      MAX_AREA_SCALE,
                    ),
              );
            }}
            aria-label={`Map of ${String(areas.length)} areas. ${QUESTIONS[mode].asks}`}
            style={{ display: 'block', cursor: 'grab', background: GROUND, touchAction: 'none' }}
          />
          <Legend
            mode={mode}
            frameWidth={viewport?.widthPx ?? null}
            frameHeight={viewport?.heightPx ?? null}
          />
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
                      MAX_AREA_SCALE,
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
          <Nothing mode={mode} scope={scope} population={population} areas={areas} />
        ) : (
          <Detail
            area={chosen}
            mode={mode}
            years={years}
            population={population}
            scope={scope}
            areas={areas}
            events={events}
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
 *
 * **One sentence, and More information folded** (copy audit v2, #83). The
 * evidence used to open here by default, fifteen paragraphs down the densest
 * column on the site; it now starts closed, as it already did inside an area.
 */
function Nothing({
  mode,
  scope,
  population,
  areas,
}: {
  readonly mode: MapMode;
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly areas: readonly MapArea[];
}) {
  return (
    <div style={{ color: ink.muted, font: type(text.label, { leading: 1.6 }) }}>
      <h2
        style={{
          margin: 0,
          font: type(text.lead, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        Click an area to see its flood history.
      </h2>
      <Evidence mode={mode} scope={scope} population={population} areas={areas} />
    </div>
  );
}

/**
 * The evidence behind the map, AC 4.3.1 to 4.3.4 and 4.1.4.h.
 *
 * One press away, before anything is chosen and inside an area's record:
 * "learn more" is not a link to a document somebody will not open, it is the
 * sentences, here. Closed by default everywhere since copy audit v2 (#83), and
 * named *More information* like the flood history page's fold.
 *
 * **Who recorded what is said here, once** (#85). The three kinds of
 * information are kept apart in words rather than by coloured badges on every
 * section of the panel and in the key.
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
        More information
      </button>
      {shown && (
        <div style={{ marginTop: space(3) }}>
          <Points heading={QUESTIONS[mode].tab} points={view} />
          <Points heading="Coverage and uncertainty" points={coverageEvidence(scope, population, areas)} />
          <h4 style={headingStyle}>Three kinds of information</h4>
          {INFORMATION_TYPES.map((kind) => (
            <p key={kind.key} style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.micro, { leading: 1.55 }), color: ink.muted }}>
              <strong style={{ color: ink.strong }}>{kind.what}.</strong> {kind.from} {kind.purpose} {kind.limits}
            </p>
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

/** What one area's record supports — AC 4.1.4. */
function Detail({
  area,
  mode,
  years,
  population,
  scope,
  areas,
  events,
}: {
  readonly events: readonly FloodEvent[] | null;
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
        Statistical area · {yearRange(years)}
      </p>

      {/*
        Copy audit v2, #86: the number and its unit, with what one count is
        behind an information button rather than a sentence under the bars.
      */}
      <Section title={FLOOD.callouts}>
        <p style={{ margin: `0 0 ${String(space(3))}px` }}>
          <strong
            style={{ font: type(text.display, { weight: weight.bold }), color: ink.strong }}
            {...(area.complete ? {} : { title: atLeastTip(String(area.total)) })}
          >
            {totalLabel(area)}
          </strong>{' '}
          {area.total === 1 ? FLOOD.unitOne : FLOOD.unit} <InfoTip text={FLOOD.explain} />
        </p>
        {area.byYear.map((count, index) => (
          <div
            key={years[index] ?? index}
            style={{ display: 'flex', alignItems: 'center', gap: space(3), marginBottom: space(1) }}
          >
            <span style={{ width: 62, font: type(text.micro), color: ink.subtle }}>
              {yearLabel(years[index])}
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
      </Section>

      {/*
        Copy audit v2, #87: the rate and how many people live here, one line
        each. Where the population figure comes from, what the rate is not and
        that DrainLens calculated it are under More information.
      */}
      <Section title={FLOOD.rate}>
        <p style={{ margin: `0 0 ${String(space(2))}px` }}>
          <strong
            style={{ font: type(text.title, { weight: weight.bold }), color: ink.strong }}
            {...(area.rate === null || area.complete ? {} : { title: atLeastTip(area.rate.toFixed(2)) })}
          >
            {scoreLabel(area)}
          </strong>{' '}
          {area.rate === null ? '' : FLOOD.rateUnit}
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
              Too few residents to compare:{' '}
              {(area.personsByYear[population.asAt.indexOf(population.denominator)] ?? 0).toLocaleString('en-AU')}{' '}
              people lived here, under {population.minimumResidents.toLocaleString('en-AU')}. It is not
              a low rate.
            </>
          ) : (
            <>{area.persons.toLocaleString('en-AU')} people live here.</>
          )}
        </p>
      </Section>

      <Section title="How complete this is">
        <p style={{ margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
          <strong style={{ color: ink.strong }}>{completeness.label}</strong> {completeness.body}
        </p>
      </Section>

      <Section title="Verified flood events">
        <Events area={area} events={events} period={scope.reportingPeriod} />
      </Section>
      <Evidence mode={mode} scope={scope} population={population} areas={areas} />
    </div>
  );
}

/**
 * AC 4.2.1 to 4.2.3 for one area.
 *
 * The empty state is written first and is not a placeholder: events are
 * written by hand and checked by a second person, so almost every one of the
 * 281 areas has none, and this is what the section says most of the time.
 */
function Events({
  area,
  events,
  period,
}: {
  readonly area: MapArea;
  readonly events: readonly FloodEvent[] | null;
  readonly period: { readonly start: string; readonly end: string };
}) {
  const note = { margin: 0, font: type(text.micro, { leading: 1.6 }), color: ink.muted };
  if (events === null) return <p style={note}>{EVENTS_UNAVAILABLE}</p>;
  const here = eventsFor(events, area.code);
  if (here.length === 0) return <p style={note}>{noEventsText(area.name)}</p>;
  return (
    <>
      {here.map((event) => (
        <article
          key={event.id}
          style={{
            margin: `0 0 ${String(space(3))}px`,
            padding: space(3),
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            background: surface.raised,
          }}
        >
          <h4 style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
            {event.name}
          </h4>
          <p style={{ margin: `${String(space(1))}px 0 ${String(space(2))}px`, font: type(text.micro), color: ink.subtle }}>
            <time dateTime={event.date}>{eventDate(event.date)}</time> · {event.places.join(', ')}
          </p>
          <p style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.micro, { leading: 1.6 }), color: ink.muted }}>
            {event.summary}
          </p>
          <p style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.micro, { leading: 1.55 }), color: ink.subtle }}>
            {againstRecord(event, period)} Areas: {event.areas.map((a) => a.name).join(', ')}.
          </p>
          <ul style={{ margin: `0 0 ${String(space(2))}px`, paddingLeft: space(4), font: type(text.micro, { leading: 1.6 }) }}>
            {event.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: brand.base }}>
                  {source.title}
                </a>{' '}
                <span style={{ color: ink.subtle }}>— {source.publisher}</span>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, font: type(text.micro), color: ink.subtle }}>
            Written by the DrainLens team; checked against these sources by {event.checkedBy} on{' '}
            {event.checkedOn === null ? '' : eventDate(event.checkedOn)}.
          </p>
        </article>
      ))}
      <p style={note}>{NOT_COMPLETE}</p>
    </>
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

/**
 * The key, over the map rather than beside it, because the map is the page.
 *
 * **It folds to its title**, and starts folded when the map is narrow; the
 * rules for both, and for how much of the map an open key may take, are in
 * `history/legendFold.ts` where they are tested. The title stays in the
 * header row outside the scrolling part, so a capped key that scrolls still
 * says which question its colours answer.
 */
function Legend({
  mode,
  frameWidth,
  frameHeight,
}: {
  readonly mode: MapMode;
  /** The map frame's size, or null before it is measured. */
  readonly frameWidth: number | null;
  readonly frameHeight: number | null;
}) {
  // Null until somebody presses the control; until then the frame decides.
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = legendOpen(frameWidth, choice);
  const box = legendBox(frameWidth, frameHeight);
  const bodyId = useId();

  return (
    <div
      style={{
        position: 'absolute',
        top: LEGEND_INSET_PX,
        right: LEGEND_INSET_PX,
        maxWidth: box.maxWidth,
        ...(box.maxHeight === null ? {} : { maxHeight: box.maxHeight }),
        display: 'flex',
        flexDirection: 'column',
        padding: `${String(space(3))}px ${String(space(4))}px`,
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: space(3), flexShrink: 0 }}>
        <p
          style={{
            margin: 0,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          {QUESTIONS[mode].legend}
        </p>
        <button
          type="button"
          onClick={() => {
            setChoice(!open);
          }}
          aria-expanded={open}
          aria-controls={bodyId}
          // The visible word is kept at the start of the name, so a person
          // using voice control can say what they see.
          aria-label={open ? 'Hide map key' : 'Show map key'}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.micro, { weight: weight.medium }),
            color: ink.muted,
            whiteSpace: 'nowrap',
          }}
        >
          {open ? '‹ Hide' : '› Show'}
        </button>
      </div>

      <div id={bodyId} hidden={!open} style={{ marginTop: space(3), minHeight: 0, overflowY: 'auto' }}>
        {/*
          AC 4.1.3.c and e, 4.3.3.d: what the numbers are and over what years
          is the title above, which stays visible when the key is folded. Who
          produced them was a badge here; copy audit v2 (#82, #85) removed it
          and the repeated subtitle, and More information in the panel says
          who recorded the counts and who calculated the rate.
        */}
        {legendFor(mode).map((entry) => (
          <div
            key={entry.label}
            style={{ display: 'flex', gap: space(3), alignItems: 'center', marginBottom: space(2) }}
          >
            <span
              aria-hidden
              style={{
                width: 16,
                height: 12,
                flexShrink: 0,
                borderRadius: 2,
                // The same hatch the map draws over a floor: 45°, six pixels apart.
                background: entry.hatched
                  ? `repeating-linear-gradient(135deg, rgba(30, 43, 54, 0.55) 0 1px, transparent 1px 6px), ${entry.fill ?? EMPTY_FILL}`
                  : (entry.fill ?? EMPTY_FILL),
                border: `1px ${entry.dashed ? 'dashed' : 'solid'} ${entry.stroke}`,
              }}
            />
            <span style={{ font: type(text.micro, { leading: 1.45 }), color: ink.muted }}>
              {entry.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * An information button beside a number, opening the sentence that explains it.
 *
 * Copy audit v2, #86: *what one count is* matters but need not sit under every
 * area. A hover title alone would be out of reach on a phone and to a
 * keyboard, so it is a button: the title shows on hover, and pressing it
 * shows the sentence under the number.
 */
function InfoTip({ text: sentence }: { readonly text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="What is an emergency response?"
        aria-expanded={shown}
        title={sentence}
        onClick={() => {
          setShown((now) => !now);
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: brand.ink,
          font: type(text.label, { weight: weight.semibold }),
          cursor: 'pointer',
          verticalAlign: 'baseline',
        }}
      >
        ⓘ
      </button>
      {shown && (
        <span style={{ display: 'block', marginTop: space(1), font: type(text.micro, { leading: 1.55 }), color: ink.muted }}>
          {sentence}
        </span>
      )}
    </>
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
