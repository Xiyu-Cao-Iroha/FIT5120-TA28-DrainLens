/**
 * Where flood incidents have been recorded, and what that does not mean.
 *
 * A ranked list of suburbs is the most persuasive thing this product will ever
 * put on a screen and the least supported. The counts are real; almost every
 * reading a person will bring to them is not. So the page is built so that the
 * qualifications cannot be scrolled past: the period, the unit and the source
 * sit above the first row rather than in a footer, the year the counts came
 * from is drawn beside the ranking rather than described under it, and an area
 * whose total is a floor says so on its own row.
 *
 * **The bar is the ranking; the sparkline is the timing.** The bar is scaled
 * against every published area, so pressing *Show more locations* never
 * rescales the top five — the picture would change while the data did not. The
 * sparkline is scaled to each area's own peak, because its question is *when*,
 * not *how many*; the count beside it answers how many. That is said in the
 * column heading rather than left for somebody to work out.
 *
 * **Ties are shown.** Ranks five and six both recorded 133, so five rows would
 * quietly present "the five highest" as sharper than the counts behind it.
 */

import { useRef, useState } from 'react';

import {
  type FloodArea,
  type FloodHistoryArtefact,
  barScale,
  hasMore,
  incompleteCount,
  periodLabel,
  tiedBeyond,
} from '../history/artefact.js';
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
  readonly onOpenMap: () => void;
}

export function FloodHistory({ artefact, onOpenMap }: FloodHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const shown = expanded ? artefact.areas : artefact.areas.slice(0, artefact.defaultAreas);
  const scale = barScale(artefact);
  const incomplete = incompleteCount(shown);
  const alsoTied = expanded ? [] : tiedBeyond(artefact, shown.length);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: `${String(space(8))}px ${String(space(6))}px ${String(space(16))}px` }}>
      <Heading artefact={artefact} />
      <Provenance artefact={artefact} />
      <WhenChart artefact={artefact} />

      <p
        style={{
          margin: `${String(space(6))}px 0 ${String(space(2))}px`,
          font: type(text.small, { leading: 1.5 }),
          color: ink.subtle,
        }}
      >
        Ranked by total incidents. The small chart on each row is that area's six years scaled to
        its own busiest one — it shows <em>when</em>, not how many. The number beside it is how
        many.
      </p>
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
          overflow: 'hidden',
        }}
      >
        {shown.map((area) => (
          <Row key={area.name} area={area} scale={scale} years={artefact.reportingPeriod.years} />
        ))}
      </ol>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(4),
          flexWrap: 'wrap',
          marginTop: space(4),
        }}
      >
        {/*
          The control is a toggle, not a one-way door. AC 2.1.1.h calls the top
          five the default view, and a view somebody cannot get back to is not
          a default -- it is a state the page leaves you in.

          Collapsing scrolls the list back into sight, because the button sits
          under thirty rows and folding them away without it would drop the
          reader below the whole section, looking at the explanation with no
          idea the list had shrunk.
        */}
        {hasMore(artefact) && (
          <button
            type="button"
            onClick={() => {
              setExpanded((open) => {
                if (open) listRef.current?.scrollIntoView({ block: 'start' });
                return !open;
              });
            }}
            style={{
              padding: `${String(space(2))}px ${String(space(4))}px`,
              border: `1px solid ${line.strong}`,
              borderRadius: radius.base,
              background: surface.raised,
              color: ink.strong,
              font: type(text.label, { weight: weight.semibold }),
            }}
          >
            {expanded
              ? `Show the top ${String(artefact.defaultAreas)} only`
              : 'Show more locations'}
          </button>
        )}
        <span style={{ font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>
          {expanded
            ? `All ${String(artefact.areas.length)} published areas, of ${String(artefact.counts.areasWithIncidents)} in ${artefact.geography.scope} with a recorded incident.`
            : `Showing the ${String(artefact.defaultAreas)} highest of ${String(artefact.areas.length)} published areas.`}
          {incomplete > 0 &&
            ` ${String(incomplete)} of them ${incomplete === 1 ? 'holds' : 'hold'} a withheld count.`}
          {alsoTied.length > 0 &&
            ` ${alsoTied.map((a) => a.name).join(' and ')} recorded the same count as the last of them, and ${alsoTied.length === 1 ? 'appears' : 'appear'} under Show more locations.`}
        </span>
      </div>

      <Explanation artefact={artefact} />
      <ToTheMap artefact={artefact} onOpenMap={onOpenMap} />
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
        Areas ordered by how many times a State Emergency Service crew was sent to a flood,
        {' '}
        {periodLabel(artefact)}. It is a record of what was reported and attended —
        not of how deep the water was, what it damaged, or where it will happen next.
      </p>
    </>
  );
}

/** AC 2.1.1.f, above the ranking rather than beneath it. */
function Provenance({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const facts: readonly (readonly [string, string])[] = [
    ['Reporting period', `${periodLabel(artefact)} (${artefact.reportingPeriod.start} to ${artefact.reportingPeriod.end})`],
    ['Area unit', `${artefact.geography.unit}, ${artefact.geography.standard}`],
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
 */
function WhenChart({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const { years } = artefact.reportingPeriod;
  const totals = years.map((_, i) => artefact.areas.reduce((n, a) => n + (a.byYear[i] ?? 0), 0));
  const peak = Math.max(1, ...totals);
  const sum = totals.reduce((n, v) => n + v, 0);
  const biggest = totals.indexOf(peak);

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
        Across all {artefact.areas.length} areas below. {years[biggest]} alone is{' '}
        {Math.round((100 * peak) / Math.max(1, sum))}% of them, so the ranking is substantially a
        record of that year rather than of a standing difference between suburbs.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: space(2), height: 96 }}>
        {totals.map((value, i) => (
          <div key={years[i]} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: Math.max(2, Math.round((72 * value) / peak)),
                background: i === biggest ? brand.base : brand.tint,
                borderRadius: `${String(radius.small)}px ${String(radius.small)}px 0 0`,
              }}
            />
            <span style={{ display: 'block', marginTop: space(1), font: type(text.micro), color: ink.subtle }}>
              {years[i]}
            </span>
            <span style={{ display: 'block', font: type(text.micro, { weight: weight.medium }), color: ink.base }}>
              {value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Row({
  area,
  scale,
  years,
}: {
  readonly area: FloodArea;
  readonly scale: number;
  readonly years: readonly string[];
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: space(3),
        padding: `${String(space(4))}px ${String(space(4))}px`,
        borderTop: area.rank === 1 ? 'none' : `1px solid ${line.hair}`,
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
        {area.rank}
      </span>

      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: space(2), flexWrap: 'wrap' }}>
          <strong style={{ font: type(text.body, { weight: weight.semibold, leading: 1.3 }), color: ink.strong }}>
            {area.name}
          </strong>
          {area.tied && <Flag tone="quiet">tied</Flag>}
          {!area.complete && <Flag tone="loud">a count withheld</Flag>}
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
              width: `${String(Math.max(2, Math.round((100 * area.total) / scale)))}%`,
              background: brand.base,
              borderRadius: radius.pill,
            }}
          />
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
        <Sparkline area={area} years={years} />
        <strong
          style={{
            minWidth: 44,
            textAlign: 'right',
            font: type(text.lead, { weight: weight.semibold, leading: 1.2 }),
            color: ink.strong,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {area.total.toLocaleString()}
          {!area.complete && <span style={{ color: ink.subtle }}>+</span>}
        </strong>
      </span>
    </li>
  );
}

/**
 * Six years of one area, scaled to that area's own peak.
 *
 * Shape, not magnitude — two sparklines of the same height are not the same
 * number of incidents, and the count beside them is what carries that. The
 * label says so, because a reader who does not know this will read it wrongly
 * and be right to.
 */
function Sparkline({ area, years }: { readonly area: FloodArea; readonly years: readonly string[] }) {
  const peak = Math.max(1, ...area.byYear);
  const width = 78;
  const height = 26;
  const step = width / area.byYear.length;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label={area.byYear
        .map((v, i) => `${String(years[i])}: ${String(v)}`)
        .join(', ')}
      style={{ flexShrink: 0 }}
    >
      {area.byYear.map((value, i) => {
        const barHeight = Math.max(1, Math.round((height - 2) * (value / peak)));
        return (
          <rect
            key={years[i]}
            x={i * step + 1}
            y={height - barHeight}
            width={step - 2}
            height={barHeight}
            rx={1}
            fill={brand.base}
            opacity={0.85}
          />
        );
      })}
    </svg>
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

      <Point title="One count is one crew dispatch">
        {artefact.note} It is recorded by {artefact.source.publisher} in{' '}
        {artefact.source.dataset}, published under {artefact.source.licence}.
      </Point>

      <Point title="It does not measure severity or damage">
        A dispatch to a flooded garage and a dispatch to a flooded street are one count each.
        Nothing in this data says how deep the water was, how long it stayed, or what it cost —
        and a higher count does not mean worse flooding, only more calls attended.
      </Point>

      <Point title="It is not current, and it is not a forecast">
        The record ends on {readableDate(artefact.reportingPeriod.end)}. Drainage, development and
        rainfall have all changed since. Nothing here describes conditions today or predicts them.
      </Point>

      <Point title="Flash flooding is counted somewhere else">
        {artefact.excludes} An area whose flooding arrives as sudden run-off in a heavy storm can
        therefore sit lower on this list than a resident would expect.
      </Point>

      <Point title="Some counts are withheld, and the totals are floors">
        {withheld} of the {artefact.counts.regions.toLocaleString()} small areas behind this
        ranking had their counts withheld under the Privacy and Data Protection Act 2014, because
        too few people live there for a count to be published safely. Any area marked{' '}
        <em>a count withheld</em> holds at least one, so its total is a minimum rather than a
        measurement.
      </Point>

      <Point title="A count depends on who calls">
        Areas differ in population, in how much of the drainage is public, and in how likely people
        are to call the SES rather than the council or nobody. The ranking reflects those
        differences as much as it reflects water.
      </Point>
    </section>
  );
}

/**
 * An ISO date as a sentence reads it.
 *
 * Parsed as parts rather than through `Date`, which would apply the reader's
 * time zone to a date that has none and can move it a day.
 */
function readableDate(iso: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;
  const month = months[Number(match[2]) - 1];
  if (month === undefined) return iso;
  return `${String(Number(match[3]))} ${month} ${String(match[1])}`;
}

function Point({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: space(4) }}>
      <h3
        style={{
          margin: `0 0 ${String(space(1))}px`,
          font: type(text.label, { weight: weight.semibold, leading: 1.4 }),
          color: ink.strong,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
        {children}
      </p>
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
        This is history. The map is what is under the street now.
      </h2>
      <p style={{ margin: `0 0 ${String(space(4))}px`, maxWidth: 620, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
        {pilot === null
          ? 'The drainage map covers one square kilometre of Kensington and shows the recorded pits and pipes, the shape of the ground, and where surface water is likely to run.'
          : `${pilot.name} — the area the drainage map covers — recorded ${String(pilot.total)}${pilot.complete ? '' : ' or more'} flood incidents over the same six years, which places it well down this list. The map does not rank anything: it shows the recorded pits and pipes under one square kilometre, the shape of the ground, and where surface water is likely to run.`}
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
