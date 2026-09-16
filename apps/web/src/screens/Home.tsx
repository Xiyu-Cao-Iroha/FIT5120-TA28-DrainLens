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
 * **The drain-blockage comparison is back, and it is not a mode.** AC 1.1.1
 * required it absent from the Iteration 1 interface, and absent meant not
 * described here either — a card explaining a feature is that feature
 * appearing in the interface. AC 3.1.1 requires it offered again, and this is
 * the only place it can be offered from: the screen that used to carry it is
 * reached by giving an address, and since this page replaced the address
 * field as the way in, nothing reaches it.
 *
 * It sits below the four rather than among them because it is a task and they
 * are layers. The four open a map; this one asks three questions first and
 * then opens a map that answers them. It also needs an address, which is why
 * pressing it goes to the address screen rather than straight there — the
 * session carries what it was for.
 *
 * Flood history arrived on 3 September and is the fifth card, set apart from
 * the four modes because it is the one way in that does not open the map. It
 * answers a question about the past across Greater Melbourne; the other four
 * answer questions about the ground in the City of Melbourne. Putting it in
 * the same row would suggest the map can show it, which the map cannot.
 *
 * **From 15 September both are sections of their own** (pair-programming
 * review 2, items 5 and 6). The flood history is a ranking beside a picture of
 * the area map, and the picture opens that map; the comparison is a feature
 * with a figure, like the hero, and its button goes straight to the address
 * search. The street photograph behind the hero now stays behind the page
 * down to *How to use the map* — see `.home__backdrop` in `ui/base.css`.
 */

import { useState } from 'react';

import { DERIVED_DAY } from '../map/derived.js';
import {
  type FloodHistoryArtefact,
  barScale,
  defaultView,
} from '../history/artefact.js';
import { HATCH_ON_LIGHT, RAMPS } from '../history/drawAreas.js';
import { ACTIVITY_BREAKS } from '../history/severity.js';
import { BlockedDrainFigure } from './BlockedDrain.js';
import { DAY } from '../map/draw.js';
import { FramedMap } from '../map/FramedMap.js';
import type { MapMode } from '../map/modes.js';
import { RAMP } from '../map/terrain.js';
import { CoverageBadge } from '../ui/Shell.js';
import { SourceLink } from '../ui/SourcesPanel.js';
import { FLOOD, FULL_MAP, TOTAL_RAINFALL } from '../ui/terms.js';
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
  flood: 'home-flood',
  compare: 'home-compare',
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
 *
 * **What a person will see, not where it came from** (copy audit v2, #5 and
 * #14). *Shown in council records* and *calculated from ground-height data*
 * answered a question nobody pressing a card asks. The qualifications are not
 * gone: where each layer comes from is said once in the map legend's *About
 * this data*, and *More information* at the bottom of this page still says
 * there are no forecasts and no depths.
 */
/**
 * Exported so the chooser draws the same four cards from the same definition.
 * Two copies would drift, and the drift would be a card whose picture on one
 * screen is not the layer it opens on the other.
 */
export const PATHS: readonly {
  readonly mode: MapMode;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
}[] = [
  {
    mode: 'drainage',
    title: 'Recorded drainage',
    body: 'Street drains near you and the pipes that join them.',
    accent: DAY.pit,
  },
  {
    mode: 'water-flow',
    title: 'Where rainwater may move',
    body: 'Arrows show which way rain may flow downhill.',
    accent: DERIVED_DAY.channel,
  },
  {
    mode: 'terrain',
    title: 'The shape of the ground',
    body: 'Colours show which parts of your street sit higher or lower.',
    // The 20 m node: the ramp's pale low end is close to white and would not
    // read as an accent at all.
    accent: RAMP[7]!.hex,
  },
  {
    mode: 'low-areas',
    title: 'Low areas',
    body: 'Dips in the ground where rainwater may pool.',
    accent: DERIVED_DAY.lowPointEdge,
  },
];

/**
 * Three steps, one short action each (copy audit v2, #10).
 *
 * The third step used to say where each layer's data comes from, which is not
 * something to do; the map legend's source groups say that now. The privacy promise stays
 * in the second step because the code keeps it: the address index is searched
 * on the device and the address is written nowhere.
 */
const STEPS: readonly { readonly title: string; readonly body?: string }[] = [
  { title: 'Open the map' },
  { title: 'Search your address', body: 'Your address stays on your device.' },
  { title: 'Turn on the layers you want to see' },
];


export interface HomeProps {
  readonly history: FloodHistoryArtefact;
  /** Called with the mode the map should open in, or nothing for all of them. */
  readonly onOpenMap: (mode?: MapMode) => void;
  /**
   * The full map itself, through the notice before it — what the chooser's
   * *Skip to Full map* does. Not `onOpenMap`: a link named after the full map
   * that opened the chooser was the user test's 15 September finding.
   */
  readonly onOpenFullMap: () => void;
  readonly onOpenHistory: () => void;
  /** The flood area map, from the picture of it. */
  readonly onOpenFloodMap: () => void;
  /** Asks for an address, then opens the comparison — AC 3.1.1. */
  readonly onCompare: () => void;
}

export function Home({
  history,
  onOpenMap,
  onOpenFullMap,
  onOpenHistory,
  onOpenFloodMap,
  onCompare,
}: HomeProps) {
  return (
    /*
      `height: 100%` is what lets the hero's `minHeight: 100%` mean the first
      screen. Without a definite height here the percentage has nothing to
      resolve against and the hero is only as tall as its content. The
      sections after it overflow this box and `<main>` scrolls over them as
      before.
    */
    <div style={{ height: '100%' }}>
      {/*
        The photograph, behind everything down to `Flow`. One layer inside
        this wrapper rather than a background on each section, so it is one
        picture the sections scroll over and not four crops of it that jump at
        every section edge. Why it is built this way is in `ui/base.css`.
      */}
      <div className="home__backdrop">
        <div className="home__backdrop-layer" aria-hidden>
          <div className="home__backdrop-photo" />
        </div>
        {/*
          The hero's button is called, not forwarded. Its `onClick` hands the
          click event to whatever it is given, and an event arriving where a
          mode is expected is a mode nobody chose.
        */}
        <Hero
          onOpenMap={() => {
            onOpenMap();
          }}
        />
        <Paths onOpenMap={onOpenMap} onOpenFullMap={onOpenFullMap} />
        <FloodSection
          history={history}
          onOpenHistory={onOpenHistory}
          onOpenFloodMap={onOpenFloodMap}
        />
        <CompareSection onCompare={onCompare} />
      </div>
      <Flow />
      <Limits />
    </div>
  );
}

function Band({
  children,
  tone = 'page',
  id,
}: {
  readonly children: React.ReactNode;
  /** `photo` sits over the backdrop: a scrim, not a surface. See `.home__on-photo`. */
  readonly tone?: 'page' | 'raised' | 'tint' | 'photo';
  readonly id?: string;
}) {
  const inner = (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: `${String(space(16))}px ${String(space(6))}px`,
      }}
    >
      {children}
    </div>
  );
  if (tone === 'photo') {
    return (
      <section id={id} className="home__on-photo">
        {inner}
      </section>
    );
  }
  const background =
    tone === 'raised' ? surface.raised : tone === 'tint' ? surface.sunken : surface.page;
  return (
    <section id={id} style={{ background, borderTop: `1px solid ${line.hair}` }}>
      {inner}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  onPhoto = false,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
  /** Over the backdrop's scrim, in the colours measured against it. */
  readonly onPhoto?: boolean;
}) {
  return (
    <>
      {eyebrow !== undefined && <Eyebrow onPhoto={onPhoto}>{eyebrow}</Eyebrow>}
      <h2
        className="home__section-title"
        style={{
          // The body carries the gap to the content below; without one, the
          // heading has to.
          margin: `${String(space(3))}px 0 ${String(body === undefined ? space(10) : space(3))}px`,
          color: onPhoto ? ON_PHOTO.title : ink.strong,
          maxWidth: 720,
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
            color: onPhoto ? ON_PHOTO.lead : ink.muted,
          }}
        >
          {body}
        </p>
      )}
    </>
  );
}

function Eyebrow({
  children,
  onPhoto = false,
}: {
  readonly children: React.ReactNode;
  readonly onPhoto?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space(2),
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: tracking.caps,
        textTransform: 'uppercase',
        color: onPhoto ? ON_PHOTO.eyebrow : brand.ink,
      }}
    >
      <span
        aria-hidden
        style={{ width: 18, height: 2, background: onPhoto ? ON_PHOTO.eyebrow : brand.base }}
      />
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

/**
 * The photograph behind the first screen, and the price of putting one there.
 *
 * A wet street with water running to a grated inlet, which is the one thing
 * this product is about and the one thing a drawing of a map cannot show: the
 * moment the surface hands the water over. The homepage's other pictures are
 * all drawn for a stated reason — *a screenshot at thumbnail size is a grey
 * smear* — and that reasoning holds for them. It does not hold here, because
 * what this has to say is not a map.
 *
 * **It is a photograph, so it is not evidence.** Nothing in it is measured,
 * it is not the mapped area, and no number on this site comes from it. The
 * badge and the footer say what the data is; this says what the subject is.
 *
 * 157 KB of WebP at 1600 px — about 15% on top of a first visit, which is the
 * real cost and is written down rather than absorbed. Resized from the source
 * rather than shipped at 2.6 MB, and not upscaled past the 1860 px it came at.
 *
 * The picture lives in `ui/base.css` as `.home__backdrop-photo`, behind this
 * section and the three after it, and the hero's scrim as `.home__hero-photo`,
 * because how dark the scrim has to be depends on whether the text has a
 * column of its own — which is a layout question and belongs where the other
 * layout question on this page is already answered.
 *
 * **These colours are the ones measured against it**, against the
 * brightest pixel under the text rather than the average, because a
 * photograph's contrast changes with every pixel and the only number worth
 * checking is the worst one.
 *
 * Below the hero, text can land over any part of the picture as the page
 * scrolls, so those sections were measured against the brightest pixel in the
 * whole photograph — pure white — under their flat 0.78 scrim: white 9.30, the
 * lead 7.61, the quiet line 6.38 and the eyebrow's mint 6.28.
 */
const ON_PHOTO = {
  title: '#ffffff',
  lead: '#e4e9ec',
  quiet: '#cfd7dc',
  eyebrow: '#a7e0cb',
} as const;

function Hero({ onOpenMap }: { readonly onOpenMap: () => void }) {
  return (
    <section
      className="home__hero-photo"
      style={{
        // The first screen is the whole screen. `minHeight` rather than
        // `height`: on a short window, or with the browser's own font size
        // turned up, the content must be allowed to make the section taller
        // rather than be cut off by it.
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="home__hero"
        style={{
          width: '100%',
          maxWidth: 1080,
          margin: '0 auto',
          padding: `${String(space(16))}px ${String(space(6))}px`,
        }}
      >
        <div>
          <h1
            className="home__title"
            style={{ margin: `0 0 ${String(space(4))}px`, color: ON_PHOTO.title }}
          >
            Understand how water moves through your neighbourhood.
          </h1>
          <p
            style={{
              margin: `0 0 ${String(space(7))}px`,
              maxWidth: 460,
              font: type(text.lead, { leading: 1.6 }),
              color: ON_PHOTO.lead,
            }}
          >
            Search your address to see nearby street drains, how the ground slopes and where rain
            may flow.
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
            <PrimaryButton label="Get started →" onPress={onOpenMap} />
          </div>

          <div
            style={{
              display: 'flex',
              gap: space(6),
              flexWrap: 'wrap',
              marginTop: space(6),
              font: type(text.small),
              color: ON_PHOTO.quiet,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: space(2) }}>
              <TickMark /> Council drain records
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: space(2) }}>
              <TickMark /> No account required
            </span>
          </div>

          <div style={{ marginTop: space(6) }}>
            <CoverageBadge />
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
 * They are not screenshots: a screenshot of the map at
 * thumbnail size is a grey smear, and it would also go stale silently the
 * next time the artefacts are rebuilt. These say what the *mark* looks like —
 * dots and lines, arrows, a ramp, pooled shapes — which is the thing a person
 * has to recognise when the map opens.
 *
 * No external images, and none fetched: this product loads nothing from a
 * third party, and four thumbnails are not the place to start.
 */
export function PathThumb({ mode }: { readonly mode: MapMode }) {
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
            {RAMP.map((node, index) => (
              <stop key={node.metres} offset={index / (RAMP.length - 1)} stopColor={node.hex} />
            ))}
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
 * `assertFloodHistory` enforces at load. Both are in the section's heading, which
 * names the SES in full, so the note under the list no longer repeats the
 * publisher (copy audit v2, #8). And the `+` on an incomplete total,
 * because nine of the thirty areas contain a count the publisher withheld, and
 * a floor shown as an exact figure is a wrong number rather than a rounded one.
 *
 * **The unit is written beside every number** from 15 September. A bare 209
 * next to a suburb's name is a score, and the thing it counts is the whole
 * qualification.
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
    <div>
      <ol className="home__ranks" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {top.map((area) => (
          <li
            key={area.name}
            className="home__rank"
            style={{
              padding: `${String(space(3))}px 0`,
              borderTop: area.rank === 1 ? 'none' : `1px solid ${line.hair}`,
            }}
          >
            <span
              aria-hidden
              style={{
                gridArea: 'rank',
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
                gridArea: 'name',
                font: type(text.label, { weight: weight.semibold, leading: 1.3 }),
                color: ink.strong,
              }}
            >
              {area.name}
            </span>
            <span
              aria-hidden
              style={{
                gridArea: 'bar',
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
            <span
              style={{
                gridArea: 'count',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                font: type(text.small, { leading: 1.3 }),
                color: ink.subtle,
              }}
            >
              <strong
                style={{
                  font: type(text.label, { weight: weight.semibold }),
                  color: ink.strong,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {area.total.toLocaleString()}
                {!area.complete && <span style={{ color: ink.subtle }}>+</span>}
              </strong>{' '}
              {area.total === 1 ? FLOOD.unitOne : FLOOD.unit}
            </span>
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
        {/* The source line moved to About the data (copy audit v4, #8). */}
        <strong>+</strong> means at least this many. <SourceLink id="history" inline />
      </p>
    </div>
  );
}

function Paths({
  onOpenMap,
  onOpenFullMap,
}: {
  readonly onOpenMap: (mode?: MapMode) => void;
  readonly onOpenFullMap: () => void;
}) {
  return (
    <Band tone="photo" id={SECTIONS.paths}>
      <SectionHeading
        onPhoto
        eyebrow="What you can explore"
        title="Four ways to understand your area"
        body="Choose a topic to open the map. You can change layers at any time."
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
        The unnarrowed way in, kept quieter than the four. Somebody who already
        knows what the map holds should not have to pick a question first, but
        it is the wrong first suggestion for somebody who does not.

        It goes where it says: the full map, through the notice before it, as
        the chooser's *Skip to Full map* does. It used to open the chooser,
        which is the four cards' door, and a reader who pressed a link named
        after the full map landed on a question instead (user test, 15
        September).
      */}
      <p style={{ margin: `${String(space(5))}px 0 0` }}>
        <button
          type="button"
          onClick={() => {
            onOpenFullMap();
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.label, { weight: weight.semibold }),
            color: ON_PHOTO.title,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Open the {FULL_MAP.toLowerCase()} →
        </button>
      </p>
    </Band>
  );
}

/**
 * Which areas had the most flood emergencies: the ranking, and the map beside it.
 *
 * **The fifth kind of information AC 1.1.1.b names, and the only one that is
 * not a map layer.** It keeps a section of its own rather than a fifth card
 * among the four, because a card in that row would say "this opens the map
 * too", and the difference between the past across a city and the ground in
 * one council area is the thing most worth not blurring.
 *
 * **The picture is the flood area map, drawn from its own data.** A WebP
 * rendered by `pipeline/…/flood_thumbnail.py` from `sa2-points.json`,
 * `sa2-areas.json` and `population.json` with the map's own breaks and ramp —
 * which a test holds to `severity.ts` and `drawAreas.ts`, and which another
 * test re-renders and compares with the committed file. Drawn here at runtime
 * it would cost the homepage 220 KB of area data for a thumbnail; the file is
 * 52 KB and the areas are still fetched only when the map is opened.
 *
 * The legend is HTML rather than part of the picture, so it can be read aloud
 * and cannot be cropped.
 */
function FloodSection({
  history,
  onOpenHistory,
  onOpenFloodMap,
}: {
  readonly history: FloodHistoryArtefact;
  readonly onOpenHistory: () => void;
  readonly onOpenFloodMap: () => void;
}) {
  return (
    <Band tone="photo" id={SECTIONS.flood}>
      {/*
        The first place this page names the SES, so in full, with what one
        emergency response is beside it (copy audit v2, #6). `FLOOD.explain`
        rather than the audit's *each crew sent counts as one*, which the
        publisher's data quality statement contradicts. The scope stays in the
        sentence: the four cards above are the City of Melbourne, and this is
        Greater Melbourne.
      */}
      <SectionHeading
        onPhoto
        eyebrow="Flood history"
        title="Which areas had the most flood emergencies?"
        body={`How often the ${FLOOD.ses} sent crews to help with flooding across ${history.geography.scope}, ${FLOOD.period}. ${FLOOD.explain}`}
      />
      <div className="home__split">
        <article style={{ ...floodCard, padding: space(5) }}>
          <h3 style={cardTitle}>Top 5 areas</h3>
          <FloodPreview artefact={history} />
          <div style={{ marginTop: 'auto', paddingTop: space(5) }}>
            <PrimaryButton label="See flood history →" onPress={onOpenHistory} />
          </div>
        </article>

        <FloodMapCard
          scope={history.geography.scope}
          onOpen={onOpenFloodMap}
        />
      </div>
    </Band>
  );
}

const floodCard = {
  display: 'flex',
  flexDirection: 'column',
  background: surface.raised,
  border: `1px solid ${line.base}`,
  borderRadius: radius.large,
  boxShadow: shadow.resting,
} as const;

const cardTitle = {
  margin: `0 0 ${String(space(3))}px`,
  font: type(text.lead, { weight: weight.semibold, leading: 1.3 }),
  letterSpacing: tracking.title,
  color: ink.strong,
} as const;

/**
 * The picture of the area map, as one button.
 *
 * The whole card is the target, for the reason `PathCard` gives: somebody
 * pointing at a map and pressing is doing the obvious thing. The affordance is
 * still written out, because a picture that happens to be pressable is not
 * something anyone discovers by looking at it.
 */
function FloodMapCard({
  scope,
  onOpen,
}: {
  readonly scope: string;
  readonly onOpen: () => void;
}) {
  const [raised, setRaised] = useState(false);
  const bands = ACTIVITY_BREAKS.map((band, index) => ({
    label: band.label,
    fill: RAMPS.activity[index] ?? line.base,
  }));
  return (
    <button
      type="button"
      onClick={onOpen}
      // One sentence rather than everything inside read out in a row: the
      // legend is a key to colours, which a screen reader has no use for.
      aria-label={`Open the area map: ${scope} areas shaded by ${FLOOD.legend}`}
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
        ...floodCard,
        overflow: 'hidden',
        padding: 0,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        borderColor: raised ? brand.base : line.base,
        boxShadow: raised ? shadow.lifted : shadow.resting,
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
    >
      {/*
        The frame, not the picture, decides the height: 4:3 when the cards are
        stacked, and beside the ranking whatever room the ranking leaves (see
        `.home__flood-thumb`). The picture is contained in it rather than
        cropped, on its own ground colour, so a taller or wider frame adds
        margin and never cuts off the bay.
      */}
      <span
        className="home__flood-thumb"
        style={{ background: '#e3e7eb', borderBottom: `1px solid ${line.hair}` }}
      >
        <img
          src="/flood-areas-thumb.webp"
          alt=""
          width={960}
          height={720}
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </span>
      <span style={{ display: 'block', padding: space(5), flex: 'none' }}>
        <span style={{ ...cardTitle, display: 'block', margin: `0 0 ${String(space(2))}px` }}>
          The flood area map
        </span>
        <span
          style={{
            display: 'block',
            marginBottom: space(2),
            font: type(text.small, { weight: weight.semibold, leading: 1.4 }),
            color: ink.base,
          }}
        >
          {FLOOD.legend}
        </span>
        <span
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: `${String(space(1))}px ${String(space(3))}px`,
            font: type(text.small, { leading: 1.4 }),
            color: ink.muted,
          }}
        >
          {bands.map((band) => (
            <span key={band.label} style={legendItem}>
              <span aria-hidden style={{ ...swatch, background: band.fill }} />
              {band.label}
            </span>
          ))}
          <span style={legendItem}>
            <span
              aria-hidden
              style={{
                ...swatch,
                background: `repeating-linear-gradient(135deg, ${HATCH_ON_LIGHT} 0 1.5px, ${RAMPS.activity[1] ?? line.base} 1.5px 4px)`,
              }}
            />
            At least (+)
          </span>
        </span>
        <span
          style={{
            display: 'block',
            marginTop: space(4),
            font: type(text.label, { weight: weight.semibold }),
            color: brand.ink,
          }}
        >
          Open the area map →
        </span>
      </span>
    </button>
  );
}

const legendItem = { display: 'inline-flex', alignItems: 'center', gap: space(1) + 2 } as const;
const swatch = {
  flexShrink: 0,
  width: 14,
  height: 10,
  borderRadius: 2,
  boxShadow: 'inset 0 0 0 1px rgba(23, 36, 46, 0.12)',
} as const;

/**
 * The comparison, as a feature: a figure and the words beside it.
 *
 * **Its button goes straight to the address search** (review 2, item 6). It
 * used to say *Set up a comparison*, which promised the setup and delivered an
 * address field; the label now says the step it opens, and the line under it
 * says what follows. The session carries the task through the address screen
 * — `task-wanted` in `session.ts` — so choosing an address lands on the setup.
 *
 * The words say what it compares against and what it is not, in that order,
 * because the second is the part a person will otherwise supply for
 * themselves. AC 3.1.2.d and 3.1.2.e put the same distinction on the controls;
 * this is the version that has to survive being read once, quickly, by
 * somebody deciding whether to press it.
 */
function CompareSection({ onCompare }: { readonly onCompare: () => void }) {
  return (
    <Band tone="photo" id={SECTIONS.compare}>
      <div className="home__feature">
        <BlockedDrainFigure />
        <div>
          <Eyebrow onPhoto>What-if comparison</Eyebrow>
          <h2
            className="home__section-title"
            style={{ margin: `${String(space(3))}px 0`, color: ON_PHOTO.title }}
          >
            What happens if a drain is blocked? Do Assumptions here!
          </h2>
          <p
            style={{
              margin: `0 0 ${String(space(6))}px`,
              maxWidth: 480,
              font: type(text.body, { leading: 1.6 }),
              color: ON_PHOTO.lead,
            }}
          >
            Choose a nearby drain and compare two settings under the same{' '}
            {TOTAL_RAINFALL.toLowerCase()}: clear and blocked. This is a model comparison, not an
            observation or forecast.
          </p>
          <PrimaryButton label="Search an address to start →" onPress={onCompare} />
          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              font: type(text.small, { leading: 1.5 }),
              color: ON_PHOTO.quiet,
            }}
          >
            After you choose an address, we find the nearest drain you can test, then you choose how blocked it is and the rainfall.
          </p>
        </div>
      </div>
    </Band>
  );
}

function Flow() {
  return (
    <Band tone="tint" id={SECTIONS.flow}>
      <SectionHeading
        title="How to use the map"
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
            {step.body !== undefined && (
              <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
                {step.body}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Band>
  );
}

/**
 * The line the whole site is built around, said once more on the way out, with
 * a link to the rest.
 *
 * **One visible line, and the lists one press away.** The seven items used to
 * stand open in two cards, and the audit found nobody reads seven caveats at
 * the bottom of a page; v2 folded them (#11). Copy audit v4 (#11) replaces the
 * fold with *What DrainLens can and cannot show ›*, which opens About the
 * data at *What DrainLens cannot tell you*, so the list is kept in one place.
 * The line that must survive a quick read stays open: this is not a warning
 * service, and where the warnings are.
 *
 * The footer says the same on every screen. This repeats it at the bottom of
 * the page somebody reads before deciding to trust the thing, which is the
 * other moment it can change what they expect.
 */
function Limits() {
  return (
    <section
      id={SECTIONS.limits}
      style={{
        background: basisTone.derived.fill,
        borderTop: `1px solid ${line.base}`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: `${String(space(8))}px ${String(space(6))}px`,
        }}
      >
        <p
          style={{
            margin: 0,
            font: type(text.body, { weight: weight.semibold, leading: 1.6 }),
            color: basisTone.derived.ink,
          }}
        >
          DrainLens is not a live flood warning. For current warnings, check VicEmergency.
        </p>
        <p style={{ margin: `${String(space(3))}px 0 0` }}>
          <SourceLink id="homeLimits" />
        </p>
      </div>
    </section>
  );
}

