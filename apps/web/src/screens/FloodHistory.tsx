/**
 * Where flood incidents have been recorded, and what that does not mean.
 *
 * A ranked list of suburbs is the most persuasive thing this product will ever
 * put on a screen and the least supported. The counts are real; almost every
 * reading a person will bring to them is not. So the page is built so that the
 * qualifications cannot be scrolled past: the period and what one count is are
 * in the subtitle, the year the counts came from is drawn beside the ranking
 * rather than described under it, and an area whose total is a minimum carries
 * a `+` on its own row.
 *
 * **Said short, and said once** (copy audit v2, 15 September, #65 to #77;
 * copy audit v4, #65, #66, #70, #74, #76). The reporting period, source and
 * licence box above the chart is gone (#66): the years and the source are in
 * the subtitle, the area unit is one line under the list, and the licences are
 * in About the data. The seven folded limits became three icon rows a reader
 * can take in at a glance (#74), followed by *About the data ›*; the fold of
 * limits and data details is gone, because that page now says all of it. A
 * minimum is a `+` and a visible *At least* badge (#70), with one *Why "at
 * least"? ›* under the list, and the notes under the lists count what is shown
 * rather than explaining ties and minimums again (#71, #77).
 *
 * **AC 2.1.1 and 2.3.1 are still met on this page, not only behind a link:**
 * period and source in the subtitle, area unit under the list, what a count is
 * (`FLOOD.explain`), not severity and not current or future in the icon rows.
 *
 * **The bar is the ranking; the sparkline is the timing.** The bar is scaled
 * against every published area, so pressing *Show more locations* never
 * rescales the top five — the picture would change while the data did not. The
 * sparkline is scaled to each area's own peak, because its question is *when*,
 * not *how many*; the count beside it answers how many. That is said in the
 * column heading rather than left for somebody to work out.
 *
 * **Every number carries its unit.** The review of 14 September found `209`
 * beside a suburb with nothing saying what it counted, which reads as a score
 * as easily as a count. The unit is quieter than the number, not absent.
 *
 * **Ties are shown.** Ranks five and six both recorded 133, so the row says
 * *Same count*. The sentence that also named the tied area past the cut was
 * cut by the copy audit (#71) as an edge case the reader does not need.
 *
 * **Two rankings, because neither is the correct one.** By count answers
 * *where were crews sent most often*; per 1,000 people answers *where were
 * crews sent most often for the people living there*. The second needs the
 * flood map's area data, which is loaded when a reader first asks for a rate
 * and not before, and shared with the map so the two screens fetch it once.
 */

import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import { type FloodHistoryArtefact, barScale, hasMore, yearLabel } from '../history/artefact.js';
import {
  type Figure,
  type RateRanking,
  atLeastTip,
  countFigure,
  rankByRate,
  rateFigure,
  rateTip,
  sparklineLabel,
  topNote,
  unratedNote,
  wetYearNote,
  yearTip,
} from '../history/board.js';
import type { PopulationArtefact } from '../history/severity.js';
import type { AreaLoad } from '../history/useAreas.js';
import { SourceLink } from '../ui/SourcesPanel.js';
import { FLOOD } from '../ui/terms.js';
import {
  brand,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from '../ui/theme.js';

export interface FloodHistoryProps {
  readonly artefact: FloodHistoryArtefact;
  /**
   * The flood map's area data, for the ranking per 1,000 residents. The same
   * load the map uses, so opening the rate here and the map afterwards is one
   * fetch, not two.
   */
  readonly areas: AreaLoad;
  /** Ask for `areas` to be loaded. Called when a reader first needs a rate. */
  readonly onNeedAreas: () => void;
  readonly onOpenMap: () => void;
  /** The same records drawn rather than ranked — every area, not the top thirty. */
  readonly onOpenAreas: () => void;
  /** AC 2.1.2: back to the homepage, without the browser's own control. */
  readonly onBack: () => void;
}

type Ranking = 'callouts' | 'rate';

export function FloodHistory({ artefact, areas, onNeedAreas, onOpenMap, onOpenAreas, onBack }: FloodHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [ranking, setRanking] = useState<Ranking>('callouts');
  const listRef = useRef<HTMLOListElement | null>(null);
  const years = artefact.reportingPeriod.years;

  // A failed load falls back to the count ranking rather than leaving a
  // reader on an empty list: the counts do not depend on the population.
  const rateUnavailable = areas.problem !== null;
  const view: Ranking = rateUnavailable ? 'callouts' : ranking;
  const byRate = useMemo(() => (areas.data === null ? null : rankByRate(areas.data.areas)), [areas.data]);

  const toggleExpanded = () => {
    setExpanded((open) => {
      if (open) listRef.current?.scrollIntoView({ block: 'start' });
      return !open;
    });
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: `${String(space(8))}px ${String(space(6))}px ${String(space(16))}px` }}>
      <Heading />
      <WhenChart artefact={artefact} />

      <RankingToggle
        value={view}
        unavailable={rateUnavailable}
        onChange={(next) => {
          if (next === 'rate') onNeedAreas();
          setRanking(next);
        }}
      />
      {rateUnavailable && (
        <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
          The ranking per 1,000 people is not available, because the population figures could not
          be loaded ({areas.problem}). The ranking by {FLOOD.callouts.toLowerCase()} below still works.
        </p>
      )}

      {view === 'callouts' ? (
        <CalloutList artefact={artefact} expanded={expanded} onToggle={toggleExpanded} listRef={listRef} />
      ) : byRate === null || areas.data === null ? (
        <p style={{ margin: `${String(space(4))}px 0`, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
          Loading the population figures…
        </p>
      ) : (
        <RateList
          artefact={artefact}
          ranking={byRate}
          population={areas.data.population}
          years={years}
          expanded={expanded}
          onToggle={toggleExpanded}
          listRef={listRef}
        />
      )}

      <ListFoot
        geography={artefact.geographySource.publisher}
        rate={view === 'rate'}
        minimum={artefact.areas.some((a) => !a.complete)}
      />

      {/*
        The map of every area, offered where the ranking ends.

        **This list is thirty of {areasInScope}, and the sentence above says
        so.** A reader who has just been told that 275 areas recorded an
        incident and that they are looking at thirty of them has exactly the
        question this answers.
      */}
      <section
        style={{
          marginTop: space(6),
          padding: space(5),
          background: brand.wash,
          border: `1px solid ${brand.tint}`,
          borderRadius: radius.large,
          display: 'flex',
          gap: space(5),
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ flex: '1 1 320px' }}>
          <h3
            style={{
              margin: `0 0 ${String(space(2))}px`,
              font: type(text.lead, { weight: weight.semibold, leading: 1.3 }),
              color: ink.strong,
            }}
          >
            See all {String(artefact.counts.areasInScope)} areas on a map
          </h3>
          <span style={{ color: ink.muted, font: type(text.label, { leading: 1.55 }) }}>
            This page lists the {String(artefact.areas.length)} highest totals. Open the map to see
            all {artefact.geography.scope} areas and compare incident counts with population.
          </span>
        </span>
        <button
          type="button"
          onClick={onOpenAreas}
          style={{
            padding: `${String(space(3))}px ${String(space(5))}px`,
            border: 'none',
            borderRadius: radius.base,
            background: brand.base,
            color: ink.inverse,
            font: type(text.label, { weight: weight.semibold }),
          }}
        >
          Open the area map →
        </button>
      </section>

      <KeyPoints />
      <ToTheMap onOpenMap={onOpenMap} />

      {/*
        AC 2.1.2. The breadcrumb already goes home, and this is not redundant
        with it: the criterion asks for a control the reader can reach at the
        end of the page, and after six screens of explanation the crumb is a
        long way up.
      */}
      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: space(6),
          background: 'none',
          border: 'none',
          padding: 0,
          font: type(text.label, { weight: weight.medium }),
          color: brand.ink,
        }}
      >
        ← Back to the homepage
      </button>
    </div>
  );
}

/**
 * The eyebrow, the question and the one sentence that says what a count is.
 *
 * Copy audit v2 and v4, #65: the service is spelled out the first time the
 * page names it, and `FLOOD.explain` sits beside it. *Not live or future
 * flooding* is one of the icon rows under the list rather than a third clause
 * here.
 */
function Heading() {
  return (
    <>
      <p
        style={{
          margin: 0,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: brand.ink,
        }}
      >
        Flood history
      </p>
      <h1
        style={{
          margin: `${String(space(2))}px 0 ${String(space(3))}px`,
          font: type(text.display, { weight: weight.bold, leading: 1.15 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        Which areas had the most flood emergencies?
      </h1>
      <p
        style={{
          margin: 0,
          maxWidth: 640,
          font: type(text.lead, { leading: 1.55 }),
          color: ink.muted,
        }}
      >
        Areas ranked by emergency responses to flooding from the {FLOOD.ses}, {FLOOD.period}.{' '}
        {FLOOD.explain}
      </p>
    </>
  );
}

/**
 * The six years, summed across the areas on the board.
 *
 * Drawn rather than described, because the fact it carries is the one most
 * likely to be misread: 2010/11 is almost half of this total, so the ranking
 * is largely a picture of one summer. A sentence saying so under a chart is a
 * sentence people skim past a chart to reach.
 *
 * **The sentence is computed** (`wetYearNote`): *almost half* only while the
 * share is from 40% to under half, the rounded percentage otherwise.
 *
 * **The yearly totals are minimums whenever any area's is.** A sum with a
 * withheld count inside it is a floor, and the rows below already mark theirs.
 * The label under each bar is the number and its `+` alone (copy audit v2,
 * #67); the heading says what it counts, and the tooltip keeps the unit.
 */
function WhenChart({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const [active, setActive] = useState<number | null>(null);
  const { years } = artefact.reportingPeriod;
  const totals = years.map((_, i) => artefact.areas.reduce((n, a) => n + (a.byYear[i] ?? 0), 0));
  const peak = Math.max(1, ...totals);
  const biggest = totals.indexOf(peak);
  const complete = artefact.areas.every((a) => a.complete);
  const barArea = 72;

  return (
    <section style={{ marginTop: space(6) }}>
      <h2
        style={{
          margin: `0 0 ${String(space(1))}px`,
          font: type(text.label, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        Emergency responses by year
      </h2>
      <p style={{ margin: `0 0 ${String(space(3))}px`, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
        {wetYearNote(totals, years)}
      </p>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: space(2) }}
        onPointerLeave={() => {
          setActive(null);
        }}
      >
        {totals.map((value, i) => {
          const figure = countFigure(value, complete);
          const barHeight = Math.max(2, Math.round((barArea * value) / peak));
          const on = active === i;
          return (
            <div
              key={years[i]}
              style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
              onPointerEnter={() => {
                setActive(i);
              }}
              onPointerDown={() => {
                setActive(i);
              }}
            >
              <div style={{ position: 'relative', height: barArea, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: barHeight,
                    background: on ? brand.pressed : i === biggest ? brand.base : brand.tint,
                    borderRadius: `${String(radius.small)}px ${String(radius.small)}px 0 0`,
                  }}
                />
                {on && (
                  <Tip left="50%" bottom={barHeight + space(1.5)}>
                    {yearTip(years[i], value, complete)}
                  </Tip>
                )}
              </div>
              <span style={{ display: 'block', marginTop: space(1), font: type(text.micro), color: ink.subtle }}>
                {yearLabel(years[i])}
              </span>
              <span style={{ display: 'block', font: type(text.micro, { weight: weight.medium, leading: 1.35 }), color: ink.base }}>
                {figure.value}
                {figure.minimum && <span style={{ color: ink.subtle }}>+</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Which ranking the list shows, as a pair of pressed buttons.
 *
 * Buttons rather than tabs because nothing else on the page changes with it:
 * the explanation, the rules and the map link stay where they are. The rate's
 * button says it is unavailable rather than disappearing, so a failed load is
 * a sentence the reader can see and not a feature that was never there.
 */
function RankingToggle({
  value,
  unavailable,
  onChange,
}: {
  readonly value: Ranking;
  readonly unavailable: boolean;
  readonly onChange: (next: Ranking) => void;
}) {
  const options: readonly (readonly [Ranking, string])[] = [
    // Copy audit v2, #68: the same two names as the area map's view buttons.
    ['callouts', FLOOD.callouts],
    ['rate', FLOOD.rate],
  ];

  return (
    <div
      role="group"
      aria-label="Ranked by"
      style={{ display: 'flex', alignItems: 'center', gap: space(2), flexWrap: 'wrap', marginTop: space(6) }}
    >
      <span style={{ font: type(text.small, { weight: weight.semibold }), color: ink.muted }}>Ranked by:</span>
      <span
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: 2,
          background: surface.sunken,
          border: `1px solid ${line.base}`,
          borderRadius: radius.base,
        }}
      >
        {options.map(([id, label]) => {
          const on = value === id;
          const off = id === 'rate' && unavailable;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              disabled={off}
              onClick={() => {
                onChange(id);
              }}
              style={{
                padding: `${String(space(1.5))}px ${String(space(3))}px`,
                border: 'none',
                borderRadius: radius.small,
                background: on ? surface.raised : 'transparent',
                boxShadow: on ? shadow.resting : 'none',
                color: off ? ink.subtle : on ? ink.strong : ink.muted,
                font: type(text.label, { weight: on ? weight.semibold : weight.medium }),
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
              {off ? ' (unavailable)' : ''}
            </button>
          );
        })}
      </span>
    </div>
  );
}

/** The list card both rankings are drawn in. */
function ListCard({
  listRef,
  children,
}: {
  readonly listRef: React.RefObject<HTMLOListElement | null>;
  readonly children: ReactNode;
}) {
  return (
    <ol
      ref={listRef}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        background: surface.raised,
        boxShadow: shadow.resting,
        // Not `overflow: hidden`. The rows have no background to clip at the
        // rounded corners, and clipping would cut off the sparkline tooltip
        // on the first row, which is the row most people hover.
      }}
    >
      {children}
    </ol>
  );
}

function Intro({ children }: { readonly children: ReactNode }) {
  return (
    <p style={{ margin: `${String(space(3))}px 0 ${String(space(2))}px`, font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>
      {children}
    </p>
  );
}

/**
 * *Show more locations*, and the sentence saying what is shown.
 *
 * The control is a toggle, not a one-way door. AC 2.1.1.h calls the top five
 * the default view, and a view somebody cannot get back to is not a default —
 * it is a state the page leaves you in.
 *
 * Collapsing scrolls the list back into sight, because the button sits under
 * thirty rows and folding them away without it would drop the reader below
 * the whole section, looking at the explanation with no idea the list had
 * shrunk.
 */
function MoreControl({
  more,
  expanded,
  onToggle,
  children,
}: {
  readonly more: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space(4), flexWrap: 'wrap', marginTop: space(4) }}>
      {more && (
        <button
          type="button"
          onClick={onToggle}
          style={{
            padding: `${String(space(2))}px ${String(space(4))}px`,
            border: `1px solid ${line.strong}`,
            borderRadius: radius.base,
            background: surface.raised,
            color: ink.strong,
            font: type(text.label, { weight: weight.semibold }),
          }}
        >
          {expanded ? 'Show fewer locations' : 'Show more locations'}
        </button>
      )}
      <span style={{ font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>{children}</span>
    </div>
  );
}

function CalloutList({
  artefact,
  expanded,
  onToggle,
  listRef,
}: {
  readonly artefact: FloodHistoryArtefact;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly listRef: React.RefObject<HTMLOListElement | null>;
}) {
  const shown = expanded ? artefact.areas : artefact.areas.slice(0, artefact.defaultAreas);
  const scale = barScale(artefact);

  return (
    <>
      <Intro>Hover a small bar to see each year&apos;s emergency responses.</Intro>
      <ListCard listRef={listRef}>
        {shown.map((area, i) => {
          const figure = countFigure(area.total, area.complete);
          return (
            <Row
              key={area.name}
              first={i === 0}
              rank={area.rank}
              name={area.name}
              tied={area.tied ? 'Same count' : null}
              complete={area.complete}
              byYear={area.byYear}
              years={artefact.reportingPeriod.years}
              width={(100 * area.total) / scale}
              figure={figure}
              stacked
              tip={figure.minimum ? atLeastTip(figure.value) : null}
            />
          );
        })}
      </ListCard>
      <MoreControl more={hasMore(artefact)} expanded={expanded} onToggle={onToggle}>
        {topNote(shown.length, artefact.areas.length)}
      </MoreControl>
    </>
  );
}

/**
 * The same list, ordered per 1,000 people.
 *
 * **As long as the count list, not as long as the data.** Expanded shows as
 * many rows as the board publishes, so the two views are the same size and
 * *Show more* means the same thing in both; every rated area is on the area
 * map.
 *
 * The division behind each rate, the count and the people, is the number's
 * tooltip rather than a line under the bar (copy audit v2, #76). The fold
 * that divided one real area out in full is now *Our calculation ›* under the
 * list (copy audit v4, #76), which opens About the data at the rate.
 */
function RateList({
  artefact,
  ranking,
  population,
  years,
  expanded,
  onToggle,
  listRef,
}: {
  readonly artefact: FloodHistoryArtefact;
  readonly ranking: RateRanking;
  readonly population: PopulationArtefact;
  readonly years: readonly string[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly listRef: React.RefObject<HTMLOListElement | null>;
}) {
  const { ranked, unrated, scale } = ranking;
  const cap = Math.max(artefact.defaultAreas, artefact.areas.length);
  const shown = ranked.slice(0, expanded ? cap : artefact.defaultAreas);

  return (
    <>
      <Intro>{FLOOD.rate}, so small and large areas compare fairly.</Intro>
      <ListCard listRef={listRef}>
        {shown.map((row, i) => {
          const figure = rateFigure(row.area);
          if (figure === null) return null;
          return (
            <Row
              key={row.area.code}
              first={i === 0}
              rank={row.rank}
              name={row.area.name}
              tied={row.tied ? 'Same rate' : null}
              complete={row.area.complete}
              byYear={row.area.byYear}
              years={years}
              width={(100 * row.area.rate) / scale}
              figure={figure}
              stacked
              band={row.band}
              tip={rateTip(row.area)}
            />
          );
        })}
      </ListCard>
      <MoreControl more={ranked.length > artefact.defaultAreas} expanded={expanded} onToggle={onToggle}>
        {topNote(shown.length, ranked.length)}
        {unrated.length > 0 && ` ${unratedNote(population.minimumResidents)}`}
      </MoreControl>
    </>
  );
}

function Row({
  first,
  rank,
  name,
  tied,
  complete,
  byYear,
  years,
  width,
  figure,
  stacked = false,
  band = null,
  tip,
}: {
  readonly first: boolean;
  readonly rank: number;
  readonly name: string;
  /** *Same count* or *Same rate* where a neighbour shows the same number, or null. */
  readonly tied: string | null;
  readonly complete: boolean;
  readonly byYear: readonly number[];
  readonly years: readonly string[];
  /** The bar's length, as a percentage of the ranking's own scale. */
  readonly width: number;
  readonly figure: Figure;
  /** Put the unit under the number, for a unit too long to sit beside it. */
  readonly stacked?: boolean;
  readonly band?: string | null;
  /**
   * What hovering the number says: what its `+` means, and for a rate the
   * division behind it. Null for a complete count, which needs no note.
   */
  readonly tip: string | null;
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: space(3),
        padding: `${String(space(4))}px ${String(space(4))}px`,
        borderTop: first ? 'none' : `1px solid ${line.hair}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          textAlign: 'right',
          font: type(text.lead, { weight: weight.semibold, leading: 1.2 }),
          color: ink.subtle,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </span>

      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: space(2), flexWrap: 'wrap' }}>
          <strong style={{ font: type(text.body, { weight: weight.semibold, leading: 1.3 }), color: ink.strong }}>
            {name}
          </strong>
          {band !== null && <Flag>{band}</Flag>}
          {figure.minimum && <Flag>At least</Flag>}
          {tied !== null && <Flag>{tied}</Flag>}
        </span>
        <span
          aria-hidden
          style={{
            display: 'block',
            marginTop: space(2),
            height: 8,
            borderRadius: radius.pill,
            background: surface.sunken,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${String(Math.max(2, Math.round(width)))}%`,
              background: brand.base,
              borderRadius: radius.pill,
            }}
          />
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
        <Sparkline byYear={byYear} years={years} complete={complete} />
        <span style={{ minWidth: 44, textAlign: 'right' }} {...(tip === null ? {} : { title: tip })}>
          <strong
            style={{
              font: type(text.lead, { weight: weight.semibold, leading: 1.2 }),
              color: ink.strong,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              ...(tip === null ? {} : { cursor: 'help' }),
            }}
          >
            {figure.value}
            {figure.minimum && <span style={{ color: ink.subtle }}>+</span>}
          </strong>
          {stacked ? '' : ' '}
          <span
            style={{
              font: type(text.micro, { leading: 1.3 }),
              color: ink.subtle,
              ...(stacked ? { display: 'block', maxWidth: 104, marginLeft: 'auto' } : { whiteSpace: 'nowrap' }),
            }}
          >
            {figure.unit}
          </span>
        </span>
      </span>
    </li>
  );
}

/**
 * Six years of one area, scaled to that area's own peak.
 *
 * Shape, not magnitude — two sparklines of the same height are not the same
 * number of call-outs, and the figure beside them is what carries that. The
 * label says so, because a reader who does not know this will read it wrongly
 * and be right to.
 *
 * **The tooltip gives each bar its number back.** Each column's hit area is
 * the full height, not the bar, because a year with two call-outs is a bar
 * one pixel tall and nobody can land a pointer on that. One tab stop per
 * chart, with the arrow keys moving between years, rather than six per row
 * across thirty rows; a tap shows the year and a tap elsewhere hides it.
 */
function Sparkline({
  byYear,
  years,
  complete,
}: {
  readonly byYear: readonly number[];
  readonly years: readonly string[];
  readonly complete: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(1, ...byYear);
  const width = 78;
  const height = 26;
  const step = width / byYear.length;
  const last = byYear.length - 1;

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, (at: number) => number> = {
      ArrowRight: (at) => Math.min(last, at + 1),
      ArrowLeft: (at) => Math.max(0, at - 1),
      Home: () => 0,
      End: () => last,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      setActive((at) => move(at ?? 0));
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setActive(null);
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="img"
        tabIndex={0}
        aria-label={sparklineLabel(byYear, years, complete)}
        onFocus={() => {
          // Keyboard focus opens on the busiest year, the one the chart is
          // usually there to show; a click has already chosen its own.
          setActive((at) => at ?? Math.max(0, byYear.indexOf(Math.max(...byYear))));
        }}
        onBlur={() => {
          setActive(null);
        }}
        onKeyDown={onKey}
        style={{ display: 'block', borderRadius: 3 }}
      >
        {byYear.map((value, i) => {
          const barHeight = Math.max(1, Math.round((height - 2) * (value / peak)));
          const on = active === i;
          return (
            <g key={years[i] ?? i}>
              <rect
                x={i * step}
                y={0}
                width={step}
                height={height}
                fill={on ? surface.sunken : 'transparent'}
                onPointerEnter={() => {
                  setActive(i);
                }}
                onPointerDown={() => {
                  setActive(i);
                }}
              />
              <rect
                x={i * step + 1}
                y={height - barHeight}
                width={step - 2}
                height={barHeight}
                rx={1}
                fill={on ? brand.pressed : brand.base}
                opacity={active === null ? 0.85 : on ? 1 : 0.4}
                pointerEvents="none"
              />
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <Tip left={(active + 0.5) * step} bottom={`calc(100% + ${String(space(1.5))}px)`}>
          {yearTip(years[active], byYear[active] ?? 0, complete)}
        </Tip>
      )}
    </span>
  );
}

/**
 * A small dark label above what is hovered.
 *
 * Hidden from assistive technology because it repeats the chart's accessible
 * name, which already carries every year; announcing it again on each move
 * would read the same number twice.
 */
function Tip({
  left,
  bottom,
  children,
}: {
  readonly left: number | string;
  readonly bottom: number | string;
  readonly children: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left,
        bottom,
        transform: 'translateX(-50%)',
        zIndex: 2,
        padding: `${String(space(1))}px ${String(space(2))}px`,
        background: ink.strong,
        color: ink.inverse,
        borderRadius: radius.small,
        boxShadow: shadow.floating,
        font: type(text.micro, { weight: weight.medium, leading: 1.4 }),
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {children}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          width: 0,
          height: 0,
          marginLeft: -5,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${ink.strong}`,
        }}
      />
    </span>
  );
}

/**
 * A quiet label beside an area's name: its band, *At least*, or *Same count*.
 *
 * There was a loud one as well, for a withheld count. Copy audit v2 (#70)
 * replaced it with the `+` and a tooltip; v4 (#70) brought back a short,
 * quiet *At least*, because a tooltip is not there on a phone.
 */
function Flag({ children }: { readonly children: string }) {
  return (
    <span
      style={{
        padding: `1px ${String(space(2))}px`,
        borderRadius: radius.pill,
        background: surface.sunken,
        color: ink.subtle,
        font: type(text.micro, { weight: weight.medium, leading: 1.6 }),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * The small lines under either list (copy audit v4, #66, #70, #76).
 *
 * The area unit, which AC 2.1.1 and 2.3.1 want on the page now that the source
 * box is gone, and the links that replaced the folds: *Why "at least"? ›*
 * while any area on the board is a minimum, and *Our calculation ›* in the
 * rate ranking, where *How the rate is calculated* used to open.
 */
function ListFoot({
  geography,
  rate,
  minimum,
}: {
  readonly geography: string;
  readonly rate: boolean;
  readonly minimum: boolean;
}) {
  return (
    <div style={{ marginTop: space(3), font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>
      <p style={{ margin: 0 }}>Areas follow {geography} boundaries.</p>
      {(minimum || rate) && (
        <p style={{ margin: `${String(space(1))}px 0 0`, display: 'flex', gap: space(4), flexWrap: 'wrap' }}>
          {minimum && <SourceLink id="minimum" />}
          {rate && <SourceLink id="calculation" />}
        </p>
      )}
    </div>
  );
}

/**
 * AC 2.3.1 in three lines a reader can take in without opening anything.
 *
 * **Copy audit v2, #74.** This was a titled section, a sentence introducing
 * it and seven folds, and the audit's point was that seven fold titles are
 * themselves a wall of text when a resident needs to keep three things: the
 * data is old, it counts responses rather than how bad floods were, and it is
 * not live or future flooding. Those three are here, on the outside, so a
 * reader who opens nothing has still been told. The detail behind them is
 * About the data (copy audit v4, #74: this wording, and the link under them).
 */
function KeyPoints() {
  const points: readonly (readonly [ReactNode, string])[] = [
    [<CalendarIcon key="calendar" />, `${FLOOD.period} records only`],
    [<JobsIcon key="jobs" />, 'Counts times the SES was sent, not how bad floods were'],
    [<ForecastIcon key="forecast" />, 'Not live or future flooding'],
  ];

  return (
    <>
    <ul
      aria-label="About these numbers"
      style={{
        listStyle: 'none',
        margin: `${String(space(10))}px 0 0`,
        padding: space(5),
        display: 'grid',
        gap: space(3),
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
      }}
    >
      {points.map(([icon, words]) => (
        <li key={words} style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              background: brand.wash,
              color: brand.ink,
            }}
          >
            {icon}
          </span>
          <span style={{ font: type(text.label, { weight: weight.semibold, leading: 1.4 }), color: ink.strong }}>
            {words}
          </span>
        </li>
      ))}
    </ul>
    <p style={{ margin: `${String(space(2))}px 0 0` }}>
      <SourceLink id="history" />
    </p>
    </>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
} as const;

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
    </svg>
  );
}

function JobsIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.5" />
      <path d="M8 3.5V2.5h4v1M7.5 9l1.5 1.5 3.5-3.5M7.5 14h5" />
    </svg>
  );
}

function ForecastIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 15h8a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 5.8 9 3 3 0 0 0 6 15Z" />
      <path d="M3 3l14 14" />
    </svg>
  );
}

/**
 * AC 2.1.1.i: the way from the history to the drainage map.
 *
 * Copy audit v2, #75: a title that says what the map is for and the button.
 * The paragraph comparing Kensington's count with this list, and saying what
 * the drainage map shows, was background the button does not need.
 */
function ToTheMap({ onOpenMap }: { readonly onOpenMap: () => void }) {
  return (
    <section
      style={{
        marginTop: space(6),
        padding: space(6),
        background: brand.wash,
        border: `1px solid ${brand.tint}`,
        borderRadius: radius.large,
        display: 'flex',
        gap: space(4),
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <h2
        style={{
          margin: 0,
          font: type(text.title, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.title,
          color: ink.strong,
        }}
      >
        See drains near your home
      </h2>
      <button
        type="button"
        onClick={onOpenMap}
        style={{
          padding: `${String(space(3))}px ${String(space(5))}px`,
          border: 'none',
          borderRadius: radius.base,
          background: brand.base,
          color: ink.inverse,
          font: type(text.label, { weight: weight.semibold }),
        }}
      >
        Open the drainage map →
      </button>
    </section>
  );
}
