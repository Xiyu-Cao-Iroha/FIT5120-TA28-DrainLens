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
 * **Short on the surface, the rest in About the data** (copy audit v2, #79 to
 * #87; copy audit v4, #81 to #89). The header spells the SES out once, says
 * how to read the colours and what one count is, and keeps one safety line.
 * The panel shows an area's numbers, each with a short status, and labels its
 * three kinds of information with grey links (*Past records ›*, *Our
 * calculation ›*, *Checked by our team ›*) instead of coloured badges. The
 * method, the coverage and the limits, which v2 folded under *More
 * information* in the panel, are sections of About the data now; the panel
 * keeps its own *About the data ›* link (AC 4.1.4).
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
  STATUS,
  type Status,
  completenessOf,
  scoreLabel,
  statusOf,
  totalLabel,
  yearRates,
} from '../history/severity.js';
import { AREA_KINDS, NOT_A_FORECAST, RATE_TIP, TOTAL_TIP } from '../history/evidence.js';
import {
  EVENTS_UNAVAILABLE,
  type FloodEvent,
  NOT_COMPLETE,
  NO_EVENTS,
  NO_EVENTS_TIP,
  againstRecord,
  eventDate,
  eventsFor,
} from '../history/events.js';
import { yearLabel, yearRange } from '../history/artefact.js';
import { atLeastTip } from '../history/board.js';
import { LEGEND_INSET_PX, legendBox, legendOpen } from '../history/legendFold.js';
import { type Viewport, clamp, fitWithin, pan, scaleToContain, zoomAt } from '../map/viewport.js';
import { type SourceLinkId } from '../ui/sources.js';
import { SourceLink } from '../ui/SourcesPanel.js';
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
          <Nothing />
        ) : (
          <Detail area={chosen} years={years} population={population} scope={scope} events={events} mode={mode} />
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
 * **One sentence and one link** (copy audit v4, #83). The evidence used to
 * open here, fifteen paragraphs down the densest column on the site; v2 folded
 * it under *More information*, and v4 moved it to About the data, which
 * *About the data ›* opens.
 */
function Nothing() {
  return (
    <div style={{ color: ink.muted, font: type(text.label, { leading: 1.6 }) }}>
      <h2
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.lead, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        Click an area to see its flood history.
      </h2>
      <SourceLink id="history" />
    </div>
  );
}

/** What one area's record supports — AC 4.1.4. */
function Detail({
  area,
  years,
  population,
  scope,
  events,
  mode,
}: {
  readonly mode: MapMode;
  readonly events: readonly FloodEvent[] | null;
  readonly area: MapArea;
  readonly years: readonly string[];
  readonly population: PopulationArtefact;
  readonly scope: ScopeAreas;
}) {
  // The panel follows the map (team feedback, 17 September): the figure the
  // map is coloured by comes first with its years under it, and the other
  // figure follows without them.
  const countLeads = mode === 'activity';
  const split = yearRates(area);
  const totalSection = (
    <>
      {/*
        Copy audit v4, #86 and #88: the number and its unit, what one count is
        behind an ⓘ, and the count's status on the line under it, for every
        area. The section is labelled "Past records ›" (#85).
      */}
      <Section title={FLOOD.callouts} link={AREA_KINDS.recorded}>
        <p style={{ margin: `0 0 ${String(space(1))}px` }}>
          <strong
            style={{
              font: type(countLeads ? text.display : text.title, { weight: weight.bold }),
              color: ink.strong,
            }}
            {...(area.complete ? {} : { title: atLeastTip(String(area.total)) })}
          >
            {totalLabel(area)}
          </strong>{' '}
          {area.total === 1 ? FLOOD.unitOne : FLOOD.unit}{' '}
          <InfoTip label="What is an emergency response?" text={TOTAL_TIP} />
        </p>
        <StatusLine status={statusOf(area, 'count')} />
        {countLeads ? (
          <YearBars years={years} values={area.byYear} label={String} complete={area.complete} />
        ) : null}
      </Section>
    </>
  );
  const rateSection = (
    <>
      {/*
        Copy audit v4, #87: the rate, its status, and how many people live
        here, with who calculated it and what the population is not behind the
        ⓘ. The section is labelled "Our calculation ›" (#85).
      */}
      <Section title={FLOOD.rate} link={AREA_KINDS.calculated}>
        <p style={{ margin: `0 0 ${String(space(1))}px` }}>
          <strong
            style={{
              font: type(countLeads ? text.title : text.display, { weight: weight.bold }),
              color: ink.strong,
            }}
            {...(area.rate === null || area.complete ? {} : { title: atLeastTip(area.rate.toFixed(2)) })}
          >
            {scoreLabel(area)}
          </strong>{' '}
          {area.rate === null ? '' : FLOOD.rateUnit}
        </p>
        <StatusLine status={statusOf(area, 'rate')} />
        {!countLeads && split !== null ? (
          <YearBars years={years} values={split} label={(value) => value.toFixed(2)} complete={area.complete} />
        ) : null}
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
            <>
              {/* The population date is said here, not only on About the data (AC 4.1.3, 4.1.4). */}
              {area.persons.toLocaleString('en-AU')} people lived here in {monthYear(population.denominator)}.{' '}
              <InfoTip label="About this rate" text={RATE_TIP} />
            </>
          )}
        </p>
      </Section>
    </>
  );

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

      {countLeads ? (
        <>
          {totalSection}
          {rateSection}
        </>
      ) : (
        <>
          {rateSection}
          {totalSection}
        </>
      )}

      <Section title="Checked flood events" link={AREA_KINDS.checked}>
        <Events area={area} events={events} period={scope.reportingPeriod} />
      </Section>

      {/* AC 4.1.4: the way to the evidence stays in the selected panel (copy audit v4, #83). */}
      <SourceLink id="history" />
    </div>
  );
}

/**
 * One bar per year, scaled to the area's own busiest year.
 *
 * Under the count, each year's count; under the rate, each year's share of it
 * (`yearRates`), which add up to the rate.
 */
function YearBars({
  years,
  values,
  label,
  complete,
}: {
  readonly years: readonly string[];
  readonly values: readonly number[];
  readonly label: (value: number) => string;
  readonly complete: boolean;
}) {
  const widest = Math.max(Number.MIN_VALUE, ...values);
  return (
    <>
      {values.map((value, index) => (
        <div
          key={years[index] ?? index}
          style={{ display: 'flex', alignItems: 'center', gap: space(3), marginBottom: space(1) }}
        >
          <span style={{ width: 62, font: type(text.micro), color: ink.subtle }}>{yearLabel(years[index])}</span>
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
                width: `${String((value / widest) * 100)}%`,
                height: '100%',
                background: brand.base,
              }}
            />
          </span>
          <span style={{ width: 36, textAlign: 'right', font: type(text.micro), color: ink.muted }}>
            {label(value)}
            {complete ? '' : '+'}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * An area figure's status, and why a minimum is one (copy audit v4, #88).
 *
 * Shown under the figure for every area, *Complete* included: the criterion
 * wants the state visible, not only the exception.
 */
function StatusLine({ status }: { readonly status: Status }) {
  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: space(2),
        flexWrap: 'wrap',
        margin: `0 0 ${String(space(3))}px`,
      }}
    >
      <span
        style={{
          padding: `1px ${String(space(2))}px`,
          borderRadius: radius.pill,
          background: surface.sunken,
          color: ink.base,
          font: type(text.micro, { weight: weight.medium, leading: 1.6 }),
          whiteSpace: 'nowrap',
        }}
      >
        {STATUS[status]}
      </span>
      {status === 'minimum' && <SourceLink id="minimum" />}
    </p>
  );
}

/**
 * AC 4.2.1 to 4.2.3 for one area.
 *
 * The empty state is written first and is not a placeholder: events are
 * written by hand and checked by a second person, so almost every one of the
 * 281 areas has none, and this is what the section says most of the time. It
 * is one line and an ⓘ since copy audit v4 (#89), and the section is never
 * hidden.
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
  if (here.length === 0) {
    return (
      <p style={note}>
        {NO_EVENTS} <InfoTip label="What does no event mean?" text={NO_EVENTS_TIP} />
      </p>
    );
  }
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

/**
 * One part of the area panel: its title, and the grey link that says which
 * kind of information it is (copy audit v4, #85; AC 4.3.4).
 */
function Section({
  title,
  link,
  children,
}: {
  readonly title: string;
  readonly link: SourceLinkId;
  readonly children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: space(5) }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space(3),
          flexWrap: 'wrap',
          margin: `0 0 ${String(space(2))}px`,
        }}
      >
        <h3
          style={{
            margin: 0,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          {title}
        </h3>
        <SourceLink id={link} />
      </div>
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
          and the repeated subtitle, and the area panel's section links say
          who recorded the counts and who calculated the rate. The key ends
          with "Why “at least”? ›" for its hatched entries (v4, #82).
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
        <SourceLink id="minimum" />
      </div>
    </div>
  );
}

/**
 * An information button beside a number, opening the sentence that explains it.
 *
 * Copy audit v2 and v4, #86, #87, #89: a sentence that matters but need not
 * sit under every area. A hover title alone would be out of reach on a phone
 * and to a keyboard, so it is a button: the title shows on hover, and pressing
 * it shows the sentence under the number.
 */
function InfoTip({ label, text: sentence }: { readonly label: string; readonly text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
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

/** "2012-06-30" as a resident reads it: "June 2012". */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthYear = (isoDate: string): string => {
  const [year, month] = isoDate.split('-');
  const name = MONTHS[Number(month) - 1];
  return name === undefined || year === undefined ? isoDate : `${name} ${year}`;
};
