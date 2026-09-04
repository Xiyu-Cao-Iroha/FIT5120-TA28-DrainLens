/**
 * The homepage: what this is, before it asks anything of somebody.
 *
 * The first screen used to be the address field. That is the right first
 * question once you have decided to use the thing, and the wrong one before —
 * it asks a stranger to type where they live in order to find out what the
 * site does. This page answers that first, and every way onward from it goes
 * to the same map.
 *
 * **The ways in are the modes.** AC 1.1.2 asks that choosing a drainage,
 * water-flow or terrain option open the map with that mode active, so each
 * card names one and carries it through. A card that opened the same default
 * map as every other card would be four labels over one door.
 *
 * **What is deliberately not on it.**
 *
 * No drain-blockage comparison. AC 1.1.1 requires it to be absent from the
 * Iteration 1 interface, and absent means not described here either — a card
 * explaining a feature is that feature appearing in the interface. The screens
 * and their tests are untouched in the repository, waiting for Iteration 2.
 *
 * Flood history arrived on 3 September and is the fifth card, set apart from
 * the four modes because it is the one way in that does not open the map. It
 * answers a question about the past across Greater Melbourne; the other four
 * answer questions about the ground under one square kilometre. Putting it in
 * the same row would suggest the map can show it, which the map cannot.
 */

import { useState } from 'react';

import { DERIVED_DAY } from '../map/derived.js';
import {
  type FloodHistoryArtefact,
  barScale,
  defaultView,
  periodLabel,
} from '../history/artefact.js';
import { DAY } from '../map/draw.js';
import { FramedMap } from '../map/FramedMap.js';
import type { MapMode } from '../map/modes.js';
import { RAMP_HIGH_HEX, RAMP_LOW_HEX } from '../map/terrain.js';
import { PilotBadge } from '../ui/Shell.js';
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

export const SECTIONS = {
  paths: 'home-paths',
  flow: 'home-flow',
  limits: 'home-limits',
} as const;

/**
 * The four ways into the map, one per mode.
 *
 * The accents are the colours those layers are actually drawn in, and they are
 * imported from the map's own palettes rather than retyped, so the card a
 * person pressed is recognisable in the map that opens and cannot drift from
 * it. Water flow and low areas are both blue because both are blue on the map;
 * correcting that here would make the homepage prettier and the map harder to
 * read back. They are told apart by the shape of the picture instead.
 *
 * **One sentence each, from 4 September.** These carried two or three, and the
 * mentor review's fourth point was that nobody reads them — which is worse
 * than it sounds, because the sentences being skipped were the careful ones.
 * The qualifications are not gone: what a layer is and is not stays on the map
 * beside the layer (*Official recorded data* / *System-derived result*), and
 * *DrainLens does not provide* further down this page still says, in full, that
 * there are no forecasts and no depths. A caveat nobody reads is not a caveat.
 */
const PATHS: readonly {
  readonly mode: MapMode;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
}[] = [
  {
    mode: 'drainage',
    title: 'Recorded drainage',
    body: 'The public pits and pipes the council has a record of.',
    accent: DAY.pit,
  },
  {
    mode: 'water-flow',
    title: 'Where rainwater may move',
    body: 'Likely surface-water paths, calculated from measured ground.',
    accent: DERIVED_DAY.channel,
  },
  {
    mode: 'terrain',
    title: 'The shape of the ground',
    body: 'Elevation shading, so you can see which way is downhill.',
    accent: RAMP_LOW_HEX,
  },
  {
    mode: 'low-areas',
    title: 'Low points and depressions',
    body: 'Places the calculated surface says water can collect.',
    accent: DERIVED_DAY.lowPointEdge,
  },
];

const STEPS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Open the map',
    body: 'It opens over the pilot square kilometre with no address selected and nothing assumed about you.',
  },
  {
    title: 'Find a street',
    body: 'Search an address from the top of the map. It is matched against an index that ships with the site, so the search never leaves your browser.',
  },
  {
    title: 'Read what is recorded',
    body: 'Switch modes along the top, open Layers to show pits and pipes on their own, and see which parts are the council’s record and which DrainLens calculated.',
  },
];

const PROVIDES: readonly string[] = [
  'Recorded public drainage pits and pipes, and where a path stops because the record does',
  'Surface-water paths, low points and a ground surface calculated from measured terrain',
  'A plain-English note on every layer saying whether it is recorded or calculated',
  'Recorded flood-incident counts by area across Greater Melbourne, 2009-10 to 2014-15',
];

const WITHHOLDS: readonly string[] = [
  'Live warnings, forecasts, or any prediction of future flooding',
  'How deep water would be, or when it would arrive',
  'Anywhere outside one square kilometre of Kensington',
];

export interface HomeProps {
  readonly history: FloodHistoryArtefact;
  /** Called with the mode the map should open in, or nothing for all of them. */
  readonly onOpenMap: (mode?: MapMode) => void;
  readonly onOpenHistory: () => void;
}

export function Home({ history, onOpenMap, onOpenHistory }: HomeProps) {
  return (
    <div>
      {/*
        The hero's button is called, not forwarded. Its `onClick` hands the
        click event to whatever it is given, and an event arriving where a mode
        is expected is a mode nobody chose.
      */}
      <Hero
        onOpenMap={() => {
          onOpenMap();
        }}
      />
      <Paths onOpenMap={onOpenMap} onOpenHistory={onOpenHistory} history={history} />
      <Flow />
      <Limits />
      <ClosingNote />
    </div>
  );
}

function Band({
  children,
  tone = 'page',
  id,
}: {
  readonly children: React.ReactNode;
  readonly tone?: 'page' | 'raised' | 'tint';
  readonly id?: string;
}) {
  const background =
    tone === 'raised' ? surface.raised : tone === 'tint' ? surface.sunken : surface.page;
  return (
    <section id={id} style={{ background, borderTop: `1px solid ${line.hair}` }}>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: `${String(space(16))}px ${String(space(6))}px`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
}) {
  return (
    <>
      {eyebrow !== undefined && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className="home__section-title"
        style={{
          margin: `${String(space(3))}px 0 ${String(space(3))}px`,
          color: ink.strong,
          maxWidth: 620,
        }}
      >
        {title}
      </h2>
      {body !== undefined && (
        <p
          style={{
            margin: `0 0 ${String(space(10))}px`,
            maxWidth: 620,
            font: type(text.body, { leading: 1.6 }),
            color: ink.muted,
          }}
        >
          {body}
        </p>
      )}
    </>
  );
}

function Eyebrow({ children }: { readonly children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space(2),
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: tracking.caps,
        textTransform: 'uppercase',
        color: brand.ink,
      }}
    >
      <span aria-hidden style={{ width: 18, height: 2, background: brand.base }} />
      {children}
    </span>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onPress}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{
        padding: `${String(space(3))}px ${String(space(5))}px`,
        font: type(text.body, { weight: weight.semibold }),
        color: ink.inverse,
        background: hovered ? brand.hover : brand.base,
        border: 'none',
        borderRadius: radius.base,
        transition: 'background-color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

function TickMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="m5 8.2 2 2 4-4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Hero({ onOpenMap }: { readonly onOpenMap: () => void }) {
  return (
    <section style={{ background: surface.page }}>
      <div
        className="home__hero"
        style={{ maxWidth: 1080, margin: '0 auto', padding: `${String(space(16))}px ${String(space(6))}px` }}
      >
        <div>
          <Eyebrow>Local drainage made easier to understand</Eyebrow>
          <h1
            className="home__title"
            style={{ margin: `${String(space(4))}px 0 ${String(space(4))}px`, color: ink.strong }}
          >
            Understand how water moves through your neighbourhood.
          </h1>
          <p
            style={{
              margin: `0 0 ${String(space(7))}px`,
              maxWidth: 460,
              font: type(text.lead, { leading: 1.6 }),
              color: ink.muted,
            }}
          >
            Explore recorded drainage infrastructure, the shape of the ground, and where surface
            water is likely to run around a local address.
          </p>

          {/*
            One button, not two.

            The hero used to offer the map and the flood history side by side,
            which made the first decision on the page a choice between two
            things a first-time reader cannot yet tell apart. The flood board
            keeps its own way in further down the page, where the paragraph
            beside it has had a chance to say what it is; here the page asks
            for one thing.
          */}
          <div style={{ display: 'flex', gap: space(3), flexWrap: 'wrap' }}>
            <PrimaryButton label="Explore the map →" onPress={onOpenMap} />
          </div>

          <div
            style={{
              display: 'flex',
              gap: space(6),
              flexWrap: 'wrap',
              marginTop: space(6),
              font: type(text.small),
              color: ink.subtle,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: space(2) }}>
              <TickMark /> Official drainage records
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: space(2) }}>
              <TickMark /> No account required
            </span>
          </div>

          <div style={{ marginTop: space(6) }}>
            <PilotBadge />
          </div>
        </div>

        <FramedMap />
      </div>
    </section>
  );
}

/**
 * The picture on each card, drawn rather than photographed.
 *
 * Four small SVGs, in the map's own colours, on the map's own ground tint.
 * They are not screenshots: a screenshot of the pilot square kilometre at
 * thumbnail size is a grey smear, and it would also go stale silently the
 * next time the artefacts are rebuilt. These say what the *mark* looks like —
 * dots and lines, arrows, a ramp, pooled shapes — which is the thing a person
 * has to recognise when the map opens.
 *
 * No external images, and none fetched: this product loads nothing from a
 * third party, and four thumbnails are not the place to start.
 */
function PathThumb({ mode }: { readonly mode: MapMode }) {
  const frame = { width: '100%', height: 104, display: 'block' } as const;
  const common = { viewBox: '0 0 200 104', role: 'presentation', style: frame } as const;

  if (mode === 'drainage') {
    return (
      <svg {...common}>
        <rect width="200" height="104" fill={DAY.ground} />
        <path d="M-8 74h216M64 -8v120M110 -12 214 92" stroke={DAY.road} strokeWidth="13" fill="none" />
        <path
          d="M20 74h96M64 74V26M64 74l52 12M116 86h56"
          stroke={DAY.pipe}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {[
          [20, 74],
          [64, 74],
          [64, 26],
          [116, 86],
          [172, 86],
        ].map(([cx, cy]) => (
          <circle
            key={`${String(cx)}-${String(cy)}`}
            cx={cx}
            cy={cy}
            r="5"
            fill={DAY.pitEdge}
            stroke={DAY.pit}
            strokeWidth="2.4"
          />
        ))}
      </svg>
    );
  }

  if (mode === 'water-flow') {
    // Straight segments converging on one outlet, so each arrowhead's angle is
    // arithmetic rather than a hand-tuned rotation. The card is advertising the
    // one thing the map's arrows say — which way — so a head at the wrong angle
    // would be the exact mistake this picture exists to avoid.
    const flows = [
      [6, 12, 178, 44],
      [6, 44, 178, 50],
      [6, 74, 178, 56],
      [6, 98, 178, 62],
    ] as const;
    return (
      <svg {...common}>
        <rect width="200" height="104" fill={DAY.ground} />
        {flows.map(([x1, y1, x2, y2]) => {
          const degrees = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          const heads = [0.42, 0.78].map((at) => [
            x1 + (x2 - x1) * at,
            y1 + (y2 - y1) * at,
          ]);
          return (
            <g key={`${String(x1)}-${String(y1)}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={DERIVED_DAY.channel}
                strokeWidth="2"
                strokeDasharray="7 5"
                strokeLinecap="round"
              />
              {/* Filled, exactly as they are on the map. */}
              {heads.map(([hx, hy]) => (
                <path
                  key={`${String(hx)}-${String(hy)}`}
                  d="M4 0 -4 4 -4 -4Z"
                  fill={DERIVED_DAY.channel}
                  transform={`translate(${String(hx)} ${String(hy)}) rotate(${String(degrees)})`}
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  if (mode === 'terrain') {
    return (
      <svg {...common}>
        <defs>
          <linearGradient id="drainlens-thumb-ramp" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={RAMP_LOW_HEX} />
            <stop offset="1" stopColor={RAMP_HIGH_HEX} />
          </linearGradient>
        </defs>
        <rect width="200" height="104" fill="url(#drainlens-thumb-ramp)" />
        {[18, 40, 62, 84].map((offset) => (
          <path
            key={offset}
            d={`M-10 ${String(offset + 26)}q50 -26 100 -18t110 -22`}
            fill="none"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="1.6"
          />
        ))}
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect width="200" height="104" fill={DAY.ground} />
      <path d="M0 62h200M92 0v104" stroke={DAY.road} strokeWidth="12" fill="none" />
      {(
        [
          [56, 34, 21, 13],
          [128, 74, 26, 15],
          [154, 30, 14, 9],
        ] as const
      ).map(([cx, cy, rx, ry]) => (
        <g key={`${String(cx)}-${String(cy)}`}>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={DERIVED_DAY.lowPoint}
            stroke={DERIVED_DAY.lowPointEdge}
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill={DERIVED_DAY.lowPoint} />
        </g>
      ))}
    </svg>
  );
}

/**
 * One way in, as a card you press rather than a card with a link in it.
 *
 * **The whole card is the button.** It used to be a heading, a paragraph and
 * an *Open drainage →* link at the bottom, which makes the target the size of
 * a line of text inside a target the size of a card. A person pointing at the
 * picture and pressing is doing the obvious thing, and the obvious thing did
 * nothing.
 *
 * The accent survives from the older design as the strip under the picture:
 * it is the colour the layer is drawn in, and it is the fastest way to
 * recognise the card you pressed in the map that opens.
 */
function PathCard({
  path,
  onOpen,
}: {
  readonly path: (typeof PATHS)[number];
  readonly onOpen: () => void;
}) {
  const [raised, setRaised] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => {
        setRaised(true);
      }}
      onMouseLeave={() => {
        setRaised(false);
      }}
      onFocus={() => {
        setRaised(true);
      }}
      onBlur={() => {
        setRaised(false);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        overflow: 'hidden',
        background: surface.raised,
        border: `1px solid ${raised ? path.accent : line.base}`,
        borderRadius: radius.large,
        boxShadow: raised ? shadow.lifted : shadow.resting,
        padding: 0,
        font: 'inherit',
        color: 'inherit',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
    >
      <PathThumb mode={path.mode} />
      <span style={{ display: 'block', height: 3, background: path.accent }} />
      <span style={{ display: 'block', padding: space(5) }}>
        <span
          style={{
            display: 'block',
            marginBottom: space(2),
            font: type(text.body, { weight: weight.semibold, leading: 1.3 }),
            letterSpacing: tracking.title,
            color: ink.strong,
          }}
        >
          {path.title}
        </span>
        <span
          style={{
            display: 'block',
            font: type(text.label, { leading: 1.55 }),
            color: ink.muted,
          }}
        >
          {path.body}
        </span>
      </span>
    </button>
  );
}

/**
 * The top of the flood board, on the homepage.
 *
 * **The numbers are the real ones**, read from the same artefact the board
 * reads and scaled with the same `barScale`, so a bar here and a bar there
 * mean the same thing. The layout this follows was drawn as a mock with
 * *Area A … Area E* and invented totals, back when the data had not been
 * verified; shipping that mock with its placeholders would put five fabricated
 * suburb rankings on the front page of a product whose entire position is that
 * it does not overstate what it knows.
 *
 * **Two things travel with the numbers or the numbers do not go.** The period
 * and the source, because a league table of suburbs with nothing qualifying it
 * is the one shape this data must never take — the same rule
 * `assertFloodHistory` enforces at load. And the `+` on an incomplete total,
 * because nine of the thirty areas contain a count the publisher withheld, and
 * a floor shown as an exact figure is a wrong number rather than a rounded one.
 *
 * It is a preview, not a second board: no per-year sparkline, no tie flags, no
 * *what a count means*. Those are on the page this links to, which is one
 * press away and says all of it.
 */
function FloodPreview({ artefact }: { readonly artefact: FloodHistoryArtefact }) {
  const top = defaultView(artefact);
  const scale = barScale(artefact);
  if (top.length === 0) return null;

  return (
    <div style={{ marginTop: space(5) }}>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          background: surface.raised,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          overflow: 'hidden',
        }}
      >
        {top.map((area) => (
          <li
            key={area.name}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(96px, 0.9fr) 1.6fr auto',
              alignItems: 'center',
              gap: space(3),
              padding: `${String(space(3))}px ${String(space(4))}px`,
              borderTop: area.rank === 1 ? 'none' : `1px solid ${line.hair}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20,
                textAlign: 'right',
                font: type(text.small, { weight: weight.semibold }),
                color: ink.subtle,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {area.rank}
            </span>
            <span
              style={{
                font: type(text.label, { weight: weight.semibold, leading: 1.3 }),
                color: ink.strong,
              }}
            >
              {area.name}
            </span>
            <span
              aria-hidden
              style={{
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
            <strong
              style={{
                minWidth: 40,
                textAlign: 'right',
                font: type(text.label, { weight: weight.semibold }),
                color: ink.strong,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {area.total.toLocaleString()}
              {!area.complete && <span style={{ color: ink.subtle }}>+</span>}
            </strong>
          </li>
        ))}
      </ol>
      <p
        style={{
          margin: `${String(space(3))}px 0 0`,
          font: type(text.small, { leading: 1.5 }),
          color: ink.subtle,
        }}
      >
        {artefact.incidentType} incidents recorded by {artefact.source.publisher}, {periodLabel(artefact)},
        by {artefact.geography.unit} across {artefact.geography.scope}. A <strong>+</strong> means a
        count inside that area was withheld, so the total is a floor.
      </p>
    </div>
  );
}

function Paths({
  onOpenMap,
  onOpenHistory,
  history,
}: {
  readonly onOpenMap: (mode?: MapMode) => void;
  readonly onOpenHistory: () => void;
  readonly history: FloodHistoryArtefact;
}) {
  return (
    <Band tone="raised" id={SECTIONS.paths}>
      <SectionHeading
        eyebrow="What you can explore"
        title="Four ways to understand your area"
        body="Each one shows a different piece of the picture, and opens the same map with that question already asked. You can turn them on and off at any time once you are there."
      />
      <div
        style={{
          display: 'grid',
          gap: space(5),
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        }}
      >
        {PATHS.map((path) => (
          <PathCard
            key={path.title}
            path={path}
            onOpen={() => {
              onOpenMap(path.mode);
            }}
          />
        ))}
      </div>

      {/*
        The fifth kind of information AC 1.1.1.b names, and the only one that
        is not a map layer. It gets a band of its own rather than a fifth card
        because a card in that row would say "this opens the map too", and the
        difference between the past across a city and the ground under a
        square kilometre is the thing most worth not blurring.
      */}
      <article
        style={{
          marginTop: space(6),
          padding: space(5),
          background: brand.wash,
          border: `1px solid ${brand.tint}`,
          borderRadius: radius.large,
        }}
      >
        <div
          style={{
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
                letterSpacing: tracking.title,
                color: ink.strong,
              }}
            >
              Recorded flood incidents across {history.geography.scope}
            </h3>
            <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
              Which areas called the State Emergency Service about flooding most often across{' '}
              {periodLabel(history)}, what a count actually means, and why it is not a measure of
              how bad the flooding was. This one is about the past, and about the whole city
              rather than the pilot area.
            </p>
          </span>
          <button
            type="button"
            onClick={onOpenHistory}
            style={{
              padding: `${String(space(3))}px ${String(space(5))}px`,
              border: 'none',
              borderRadius: radius.base,
              background: brand.base,
              color: ink.inverse,
              font: type(text.label, { weight: weight.semibold }),
            }}
          >
            See flood history →
          </button>
        </div>

        <FloodPreview artefact={history} />
      </article>

      {/*
        The unnarrowed way in, kept quieter than the four. Somebody who already
        knows what the map holds should not have to pick a question first, but
        it is the wrong first suggestion for somebody who does not.
      */}
      <p
        style={{
          margin: `${String(space(5))}px 0 0`,
          font: type(text.label, { leading: 1.6 }),
          color: ink.muted,
        }}
      >
        Or{' '}
        <button
          type="button"
          onClick={() => {
            onOpenMap();
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.label, { weight: weight.semibold }),
            color: brand.ink,
          }}
        >
          open the map with every mode on →
        </button>
      </p>
    </Band>
  );
}

function Flow() {
  return (
    <Band tone="tint" id={SECTIONS.flow}>
      <SectionHeading
        title="From an address to a clearer local picture."
        body="A short path that keeps the map approachable the first time somebody opens it."
      />
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: space(8),
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span
              aria-hidden
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: radius.pill,
                background: ink.strong,
                color: ink.inverse,
                font: type(text.label, { weight: weight.semibold, leading: 1 }),
              }}
            >
              {index + 1}
            </span>
            <h3
              style={{
                margin: `${String(space(3))}px 0 ${String(space(2))}px`,
                font: type(text.body, { weight: weight.semibold, leading: 1.35 }),
                color: ink.strong,
              }}
            >
              {step.title}
            </h3>
            <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Band>
  );
}

function Limits() {
  return (
    <Band id={SECTIONS.limits}>
      <SectionHeading
        title="Clear about what the information means."
        body="The boundaries stay visible rather than living in a policy nobody opens. The detail behind them is available without crowding this page."
      />
      <div
        style={{
          display: 'grid',
          gap: space(5),
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        }}
      >
        <ClaimCard title="DrainLens provides" items={PROVIDES} tone="recorded" />
        <ClaimCard title="DrainLens does not provide" items={WITHHOLDS} tone="withheld" />
      </div>
    </Band>
  );
}

function ClaimCard({
  title,
  items,
  tone,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly tone: 'recorded' | 'withheld';
}) {
  return (
    <section
      style={{
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        boxShadow: shadow.resting,
        padding: space(5),
      }}
    >
      <h3
        style={{
          margin: `0 0 ${String(space(4))}px`,
          font: type(text.body, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            style={{
              display: 'flex',
              gap: space(3),
              alignItems: 'flex-start',
              marginBottom: space(3),
              font: type(text.label, { leading: 1.6 }),
              color: ink.muted,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                marginTop: 8,
                width: tone === 'recorded' ? 14 : 5,
                height: 5,
                borderRadius: radius.pill,
                background: tone === 'recorded' ? basisTone.recorded.ink : line.strong,
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The line the whole site is built around, said once more on the way out.
 *
 * The banner above says it on every screen. This repeats it at the bottom of
 * the page somebody reads before deciding to trust the thing, which is the
 * other moment it can change what they expect.
 */
function ClosingNote() {
  return (
    <section
      style={{
        background: basisTone.derived.fill,
        borderTop: `1px solid ${line.base}`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: `${String(space(6))}px ${String(space(6))}px`,
          font: type(text.label, { leading: 1.6 }),
          color: basisTone.derived.ink,
        }}
      >
        DrainLens is not a live warning service. For current emergencies and warnings, use official
        channels.
      </div>
    </section>
  );
}
