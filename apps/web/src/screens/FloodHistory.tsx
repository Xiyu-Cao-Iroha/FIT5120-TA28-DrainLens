/**
 * Where flood incidents have been recorded, and what that does not mean.
 *
 * A ranked list of suburbs is the most persuasive thing this product will ever
 * put on a screen and the least supported. The counts are real; almost every
 * reading a person will bring to them is not. So the page is built so that the
 * qualifications cannot be scrolled past: the period and the source sit above
 * the first row rather than in a footer, the area unit is under Data details,
 * the year the counts came from is drawn beside the ranking rather than
 * described under it, and an area whose total is a minimum says so on its own
 * row.
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
 * **Ties are shown.** Ranks five and six both recorded 133, so five rows would
 * quietly present "the five highest" as sharper than the counts behind it.
 *
 * **Two rankings, because neither is the correct one.** By count answers
 * *where were crews sent most often*; per 1,000 residents answers *where were
 * crews sent most often for the people living there*. The second needs the
 * flood map's area data, which is loaded when a reader first asks for a rate
 * and not before, and shared with the map so the two screens fetch it once.
 */

import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from 'react';

import {
  type FloodHistoryArtefact,
  barScale,
  financialYear,
  hasMore,
  incompleteCount,
  tiedBeyond,
  yearRange,
} from '../history/artefact.js';
import {
  type Figure,
  type RateRanking,
  bandRules,
  countFigure,
  exampleSum,
  figureText,
  listNames,
  rankByRate,
  rateFigure,
  rateTiedBeyond,
  readableDate,
  sparklineLabel,
  workedExample,
  yearTip,
} from '../history/board.js';
import type { PopulationArtefact } from '../history/severity.js';
import type { AreaLoad } from '../history/useAreas.js';
import { FLOOD, SOURCE } from '../ui/terms.js';
import {
  basis as basisTone,
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
      <Heading artefact={artefact} />
      <Provenance artefact={artefact} />
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
          The ranking per 1,000 residents is unavailable, because the population figures could not
          be loaded ({areas.problem}). The ranking by call-outs below is not affected.
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

      <div style={{ marginTop: space(4) }}>
        <RateRules artefact={artefact} areas={areas} onOpen={onNeedAreas} />
      </div>

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

      <Explanation artefact={artefact} />
      <ToTheMap artefact={artefact} onOpenMap={onOpenMap} />

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

function Heading({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
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
        Recorded flood incidents
      </p>
      <h1
        style={{
          margin: `${String(space(2))}px 0 ${String(space(3))}px`,
          font: type(text.display, { weight: weight.bold, leading: 1.15 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        Where {artefact.geography.scope} called the SES about flooding
      </h1>
      <p
        style={{
          margin: `0 0 ${String(space(6))}px`,
          maxWidth: 640,
          font: type(text.lead, { leading: 1.55 }),
          color: ink.muted,
        }}
      >
        Areas are ranked by SES flood call-outs from {yearRange(artefact.reportingPeriod.years)}, or
        by call-outs per 1,000 residents. The data does not show flood depth, damage or future risk.
      </p>
    </>
  );
}

/** AC 2.1.1.f, above the ranking rather than beneath it. */
function Provenance({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const facts: readonly (readonly [string, string])[] = [
    ['Reporting period', yearRange(artefact.reportingPeriod.years)],
    ['Source', `${artefact.source.publisher} · ${artefact.source.licence}`],
    ['Area names', `${artefact.geographySource.publisher} · ${artefact.geographySource.licence}`],
  ];

  return (
    <dl
      style={{
        display: 'grid',
        gap: space(4),
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        margin: 0,
        padding: space(4),
        background: surface.sunken,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.large,
      }}
    >
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt
            style={{
              font: type(text.micro, { weight: weight.semibold }),
              letterSpacing: tracking.caps,
              textTransform: 'uppercase',
              color: ink.subtle,
            }}
          >
            {label}
          </dt>
          <dd style={{ margin: `${String(space(1))}px 0 0`, font: type(text.small, { leading: 1.45 }), color: ink.base }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The six years, summed across the areas on the board.
 *
 * Drawn rather than described, because the fact it carries is the one most
 * likely to be misread: 2010-11 is most of this total, so the ranking is
 * largely a picture of one summer. A sentence saying so under a chart is a
 * sentence people skim past a chart to reach.
 *
 * **The yearly totals are minimums whenever any area's is.** A sum with a
 * withheld count inside it is a floor, and the rows below already mark theirs.
 */
function WhenChart({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const [active, setActive] = useState<number | null>(null);
  const { years } = artefact.reportingPeriod;
  const totals = years.map((_, i) => artefact.areas.reduce((n, a) => n + (a.byYear[i] ?? 0), 0));
  const peak = Math.max(1, ...totals);
  const sum = totals.reduce((n, v) => n + v, 0);
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
        When these incidents were recorded
      </h2>
      <p style={{ margin: `0 0 ${String(space(3))}px`, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
        Across all {artefact.areas.length} areas below,{' '}
        {Math.round((100 * peak) / Math.max(1, sum))}% of the incidents occurred in{' '}
        {financialYear(years[biggest])}, so that year strongly affects the ranking.
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
                {financialYear(years[i])}
              </span>
              <span style={{ display: 'block', font: type(text.micro, { weight: weight.medium, leading: 1.35 }), color: ink.base }}>
                {figure.value}
                {figure.minimum && <span style={{ color: ink.subtle }}>+</span>}{' '}
                {/* No break inside "call-outs": at phone width it split at the hyphen. */}
                <span style={{ fontWeight: weight.regular, color: ink.subtle, whiteSpace: 'nowrap' }}>{figure.unit}</span>
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
    ['callouts', 'Call-outs'],
    ['rate', 'Call-outs per 1,000 residents'],
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
  const incomplete = incompleteCount(shown);
  const alsoTied = expanded ? [] : tiedBeyond(artefact, shown.length);

  return (
    <>
      <Intro>
        Ranked by total SES flood call-outs. Each mini-chart shows <em>when</em> they occurred —
        hover or tap a bar for that year. Compare the totals, not the mini-chart heights, between
        areas.
      </Intro>
      <ListCard listRef={listRef}>
        {shown.map((area, i) => (
          <Row
            key={area.name}
            first={i === 0}
            rank={area.rank}
            name={area.name}
            tied={area.tied}
            complete={area.complete}
            byYear={area.byYear}
            years={artefact.reportingPeriod.years}
            width={(100 * area.total) / scale}
            figure={countFigure(area.total, area.complete)}
          />
        ))}
      </ListCard>
      <MoreControl more={hasMore(artefact)} expanded={expanded} onToggle={onToggle}>
        {expanded
          ? `All ${String(artefact.areas.length)} published areas, of ${String(artefact.counts.areasWithIncidents)} in ${artefact.geography.scope} with a recorded incident.`
          : `Showing the ${String(artefact.defaultAreas)} highest of ${String(artefact.areas.length)} published areas.`}
        {incomplete > 0 &&
          ` ${String(incomplete)} of them ${incomplete === 1 ? 'has a minimum total' : 'have minimum totals'}, because an exact count was not published.`}
        {alsoTied.length > 0 &&
          ` ${alsoTied.map((a) => a.name).join(' and ')} recorded the same count as the last of them, and ${alsoTied.length === 1 ? 'appears' : 'appear'} under Show more locations.`}
      </MoreControl>
    </>
  );
}

/**
 * The same list, ordered per 1,000 residents.
 *
 * **As long as the count list, not as long as the data.** Expanded shows as
 * many rows as the board publishes, so the two views are the same size and
 * *Show more* means the same thing in both; every rated area is on the area
 * map, and the sentence says so.
 *
 * Each row writes its division out under the bar — the count and the
 * residents — so a rate is never on screen without the two numbers it came
 * from.
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
  const incomplete = shown.filter((row) => !row.area.complete).length;
  const alsoTied = rateTiedBeyond(ranked, shown.length);
  const minimum = population.minimumResidents.toLocaleString('en-AU');
  const asAt = readableDate(population.denominator);

  return (
    <>
      <Intro>
        Ranked by {FLOOD.rate}, using residents at {asAt}. Bars are scaled against the highest rate.
        Each mini-chart still shows <em>when</em> call-outs occurred — hover or tap a bar for that
        year.
      </Intro>
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
              tied={row.tied}
              complete={row.area.complete}
              byYear={row.area.byYear}
              years={years}
              width={(100 * row.area.rate) / scale}
              figure={figure}
              stacked
              band={row.band}
              detail={`${figureText(countFigure(row.area.total, row.area.complete))} ÷ ${row.area.persons.toLocaleString('en-AU')} residents`}
            />
          );
        })}
      </ListCard>
      <MoreControl more={ranked.length > artefact.defaultAreas} expanded={expanded} onToggle={onToggle}>
        {expanded
          ? `The ${String(shown.length)} highest rates of ${String(ranked.length)} areas with a rate. All of them are on the area map.`
          : `Showing the ${String(shown.length)} highest rates of ${String(ranked.length)} areas with a rate.`}
        {incomplete > 0 &&
          ` ${String(incomplete)} of them ${incomplete === 1 ? 'has a minimum rate' : 'have minimum rates'}, because an exact count was not published.`}
        {alsoTied.length > 0 &&
          ` ${listNames(alsoTied.map((row) => row.area.name))} ${alsoTied.length === 1 ? 'shows' : 'show'} the same rate as the last of them, and ${alsoTied.length === 1 ? 'is' : 'are'} ${expanded ? 'on the area map' : 'under Show more locations'}.`}
        {unrated.length > 0 &&
          ` ${String(unrated.length)} ${unrated.length === 1 ? 'area' : 'areas'} had fewer than ${minimum} residents at ${asAt}, so ${unrated.length === 1 ? 'it has' : 'they have'} no rate and ${unrated.length === 1 ? 'is' : 'are'} not ranked: ${listNames(unrated.map((a) => a.name))}.`}
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
  detail,
}: {
  readonly first: boolean;
  readonly rank: number;
  readonly name: string;
  readonly tied: boolean;
  readonly complete: boolean;
  readonly byYear: readonly number[];
  readonly years: readonly string[];
  /** The bar's length, as a percentage of the ranking's own scale. */
  readonly width: number;
  readonly figure: Figure;
  /** Put the unit under the number, for a unit too long to sit beside it. */
  readonly stacked?: boolean;
  readonly band?: string | null;
  readonly detail?: string;
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
          {band !== null && <Flag tone="quiet">{band}</Flag>}
          {tied && <Flag tone="quiet">tied</Flag>}
          {!complete && <Flag tone="loud">exact count not published</Flag>}
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
        {detail !== undefined && (
          <span style={{ display: 'block', marginTop: space(1), font: type(text.micro, { leading: 1.4 }), color: ink.subtle }}>
            {detail}
          </span>
        )}
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
        <Sparkline byYear={byYear} years={years} complete={complete} />
        <span style={{ minWidth: 44, textAlign: 'right' }}>
          <strong
            style={{
              font: type(text.lead, { weight: weight.semibold, leading: 1.2 }),
              color: ink.strong,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
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

function Flag({ tone, children }: { readonly tone: 'quiet' | 'loud'; readonly children: string }) {
  const palette = tone === 'loud' ? basisTone.assumed : { fill: surface.sunken, ink: ink.subtle };
  return (
    <span
      style={{
        padding: `1px ${String(space(2))}px`,
        borderRadius: radius.pill,
        background: palette.fill,
        color: palette.ink,
        font: type(text.micro, { weight: weight.medium, leading: 1.6 }),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * How the rate is calculated, folded under the list.
 *
 * **Every number in it is read, not typed.** The dates come from the
 * artefacts, the bands from `SEVERITY_BREAKS`, the minimum from the population
 * file, and the example is divided out from a real area's figures. A rules
 * box that restated the thresholds by hand would be the first thing to go
 * stale when the bands are next revisited, and the one place nobody checks.
 *
 * Opening it asks for the area data, so the worked example is there to read
 * without having to switch rankings first.
 */
function RateRules({
  artefact,
  areas,
  onOpen,
}: {
  readonly artefact: FloodHistoryArtefact;
  readonly areas: AreaLoad;
  readonly onOpen: () => void;
}) {
  const { data, problem } = areas;
  const example = data === null ? null : workedExample(data.areas, artefact.areas.map((a) => a.name));
  const unrated = data === null ? [] : data.areas.filter((a) => a.rate === null).map((a) => a.name);
  const gap = { margin: `0 0 ${String(space(2))}px` };
  const list = { margin: `0 0 ${String(space(2))}px`, paddingLeft: space(5) };

  return (
    <Point title="How the rate is calculated" onOpen={onOpen}>
      <p style={gap}>
        The rate — {FLOOD.rate} — compares how often the SES was called to an area for flooding
        with how many people live there.
      </p>
      <ol style={list}>
        <li>
          Take the SES flood call-outs recorded in the area from{' '}
          {readableDate(artefact.reportingPeriod.start)} to {readableDate(artefact.reportingPeriod.end)}.
        </li>
        <li>
          Divide by the area&apos;s estimated resident population
          {data === null
            ? ' in the middle of that period.'
            : ` at ${readableDate(data.population.denominator)}, from the ${data.population.source.publisher}.`}
        </li>
        <li>Multiply by 1,000, so the answer reads as {FLOOD.rateUnit}.</li>
      </ol>

      {problem !== null ? (
        <p style={gap}>
          The population figures could not be loaded, so the worked example and the minimum number
          of residents cannot be shown here.
        </p>
      ) : data === null ? (
        <p style={gap}>Loading the population figures for a worked example…</p>
      ) : (
        <>
          {example !== null && (
            <p style={gap}>
              <strong style={{ color: ink.strong }}>Worked example.</strong> {example.name}:{' '}
              {exampleSum(example)}
              {example.band === null ? '.' : `, in the band ${example.band}.`}
            </p>
          )}
          <p style={gap}>
            Areas with fewer than {data.population.minimumResidents.toLocaleString('en-AU')} residents
            get no rate, because one call-out among a handful of residents gives a large number that
            means little.
            {unrated.length > 0 &&
              ` ${String(unrated.length)} ${unrated.length === 1 ? 'area is' : 'areas are'} left out for this reason: ${listNames(unrated)}.`}
          </p>
        </>
      )}

      <p style={gap}>Each rate is placed in one of three bands, set near the quartiles of all the rates:</p>
      <ul style={list}>
        {bandRules().map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <p style={gap}>
        Where an exact count within an area was not published, its total is a minimum, so its rate is
        a minimum too and is marked +.
      </p>
      <p style={{ margin: 0 }}>
        <strong style={{ color: ink.strong }}>{SOURCE.derived}</strong>, not published by the SES.
        Like the counts, the rate does not measure flood depth, damage or current risk, and it is not
        a count of people affected.
      </p>
    </Point>
  );
}

/** AC 2.3.1, all four parts, on the page rather than behind a link. */
function Explanation({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const withheld = artefact.counts.suppressedRegions;

  return (
    <section
      style={{
        marginTop: space(10),
        padding: space(6),
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
      }}
    >
      <h2
        style={{
          margin: `0 0 ${String(space(4))}px`,
          font: type(text.title, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.title,
          color: ink.strong,
        }}
      >
        What these numbers are, and what they are not
      </h2>

      <p
        style={{
          margin: `0 0 ${String(space(4))}px`,
          font: type(text.label, { leading: 1.6 }),
          color: ink.muted,
        }}
      >
        Six things this ranking cannot tell you, then the data details. Each one says what it
        says here; open it for the detail behind it.
      </p>

      <Point title="Each count is one SES crew response, not one flood event">
        {artefact.note} It is recorded by {artefact.source.publisher} in{' '}
        {artefact.source.dataset}, published under {artefact.source.licence}.
      </Point>

      <Point title="Not a measure of severity or damage">
        A call-out to a flooded garage and a call-out to a flooded street are one count each.
        Nothing in this data says how deep the water was, how long it stayed, or what it cost —
        and a higher count does not mean worse flooding, only more calls attended. The same is true
        of the rate per 1,000 residents: a higher rate means more calls for the people living there,
        not worse flooding.
      </Point>

      <Point
        title={`The record ends ${readableDate(artefact.reportingPeriod.end)}, and describes no conditions since`}
      >
        The record ends on {readableDate(artefact.reportingPeriod.end)}. Drainage, development and
        rainfall have all changed since. Nothing here describes conditions today or predicts them.
      </Point>

      <Point title="These totals do not include incidents recorded as flash flooding">
        {artefact.excludes} An area whose flooding arrives as sudden run-off in a heavy storm can
        therefore sit lower on this list than a resident would expect.
      </Point>

      <Point title={`The exact count was not published for ${String(withheld)} small areas`}>
        {withheld} of the {artefact.counts.regions.toLocaleString()} small areas behind this
        ranking had no exact count published, under the Privacy and Data Protection Act 2014,
        because too few people live there for a count to be published safely. Any area marked{' '}
        <em>exact count not published</em> holds at least one, so some totals are minimums: the
        real total may be higher.
      </Point>

      <Point title="A count depends on who calls, which varies by area">
        Areas differ in population, in how much of the drainage is public, and in how likely people
        are to call the SES rather than the council or nobody. The ranking reflects those
        differences as much as it reflects water.
      </Point>

      <Point title="Data details">
        Areas are {artefact.geography.unit}s — statistical areas defined by the{' '}
        {artefact.geographySource.publisher} in the {artefact.geography.standard}. The reporting
        period runs from {readableDate(artefact.reportingPeriod.start)} to{' '}
        {readableDate(artefact.reportingPeriod.end)}.
      </Point>
    </section>
  );
}

/**
 * One limitation, folded, with the claim on the outside.
 *
 * **The face has to be the assertion, not a label for it.** "Severity" folded
 * away says nothing; "Not a measure of severity or damage" says the whole
 * thing and offers the paragraph to anybody who wants the rest. Folding then
 * costs detail and never costs the claim -- which matters here more than
 * anywhere else on the site, because AC 2.3.1.c and 2.3.1.d *are* two of these
 * six, and a reader who never expands one has still been told.
 *
 * Each keeps its own heading and its own paragraph. The acceptance file
 * records that as a decision, and a collapsible does not merge them into a
 * clause inside something else.
 *
 * The body is a `div`, not a `p`, so a fold can hold a list — the rate's
 * rules are steps, and steps written as one paragraph are harder to follow.
 */
function Point({
  title,
  onOpen,
  children,
}: {
  readonly title: string;
  /** Called each time the fold is opened, for a body that needs something loaded. */
  readonly onOpen?: () => void;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        marginBottom: space(2),
        border: `1px solid ${line.hair}`,
        borderRadius: radius.base,
        background: surface.page,
      }}
    >
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={() => {
            if (!open) onOpen?.();
            setOpen((was) => !was);
          }}
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: space(3),
            width: '100%',
            padding: `${String(space(3))}px ${String(space(4))}px`,
            background: 'none',
            border: 'none',
            textAlign: 'left',
            font: type(text.label, { weight: weight.semibold, leading: 1.4 }),
            color: ink.strong,
            cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1 }}>{title}</span>
          {/*
            The only mark saying this opens, so it is coloured like something
            to see: `ink.subtle` measures 3.1:1 on this card, below the 4.5:1
            normal text needs, and an affordance nobody notices is a paragraph
            nobody knows is there.
          */}
          <span aria-hidden style={{ color: ink.muted }}>
            {open ? '⌃' : '⌄'}
          </span>
        </button>
      </h3>
      {open && (
        <div
          style={{
            margin: 0,
            padding: `0 ${String(space(4))}px ${String(space(3))}px`,
            font: type(text.label, { leading: 1.6 }),
            color: ink.muted,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** AC 2.1.1.i, made concrete by the pilot area rather than left as a link. */
function ToTheMap({
  artefact,
  onOpenMap,
}: {
  readonly artefact: FloodHistoryArtefact;
  readonly onOpenMap: () => void;
}) {
  const pilot = artefact.pilotArea;

  return (
    <section
      style={{
        marginTop: space(6),
        padding: space(6),
        background: brand.wash,
        border: `1px solid ${brand.tint}`,
        borderRadius: radius.large,
      }}
    >
      <h2
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.title, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.title,
          color: ink.strong,
        }}
      >
        These figures show past SES call-outs
      </h2>
      <p style={{ margin: `0 0 ${String(space(4))}px`, maxWidth: 620, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
        {pilot === null
          ? 'The drainage map shows current council records and calculated ground information: the City of Melbourne\'s recorded pits and pipes, the shape of the measured ground, and where surface water is likely to run.'
          : `${pilot.name}, where the drainage map began, recorded ${String(pilot.total)}${pilot.complete ? '' : ' or more'} SES flood call-outs over the same six years, which places it well down this list. The drainage map does not rank anything. It shows current council records and calculated ground information: the City of Melbourne\'s recorded pits and pipes, the shape of the measured ground, and where surface water is likely to run.`}
      </p>
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
