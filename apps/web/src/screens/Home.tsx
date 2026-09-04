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

import type { DerivedArtefact } from '../map/derived.js';
import type { MapArtefact } from '../map/artefact.js';
import { FramedMap } from '../map/FramedMap.js';
import type { MapMode } from '../map/modes.js';
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
 * The accents are the colours those layers are actually drawn in, so the card
 * a person pressed is recognisable in the map that opens. Water flow and low
 * areas are both blue because both are blue on the map; correcting that here
 * would make the homepage prettier and the map harder to read back.
 */
const PATHS: readonly {
  readonly mode: MapMode;
  readonly title: string;
  readonly body: string;
  readonly action: string;
  readonly accent: string;
}[] = [
  {
    mode: 'drainage',
    title: 'Recorded drainage',
    body: 'The public pits and pipes the council has a record of, and where a path stops because the record does rather than because the water does.',
    action: 'Open drainage',
    accent: '#1f6f5c',
  },
  {
    mode: 'water-flow',
    title: 'Where rainwater may move',
    body: 'Indicative surface-water paths calculated from measured ground. They say which way water tends to run, not how much of it or how deep.',
    action: 'Open water flow',
    accent: '#2f7fb8',
  },
  {
    mode: 'terrain',
    title: 'The shape of the ground',
    body: 'Elevation shading across the pilot area, so you can see which way is downhill from a street before reading anything else over it.',
    action: 'Open terrain',
    accent: '#6c8c9e',
  },
  {
    mode: 'low-areas',
    title: 'Low points and depressions',
    body: 'Places the calculated surface says water can collect. Indicative, and not a statement that any of them has flooded or will.',
    action: 'Open low areas',
    accent: '#5aa0cd',
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
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
  /** Called with the mode the map should open in, or nothing for all of them. */
  readonly onOpenMap: (mode?: MapMode) => void;
  readonly onOpenHistory: () => void;
}

export function Home({ artefact, derived, onOpenMap, onOpenHistory }: HomeProps) {
  return (
    <div>
      {/*
        The hero's button is called, not forwarded. Its `onClick` hands the
        click event to whatever it is given, and an event arriving where a mode
        is expected is a mode nobody chose.
      */}
      <Hero
        artefact={artefact}
        derived={derived}
        onOpenMap={() => {
          onOpenMap();
        }}
      />
      <Paths onOpenMap={onOpenMap} onOpenHistory={onOpenHistory} />
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

function Hero({
  artefact,
  derived,
  onOpenMap,
}: {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly onOpenMap: () => void;
}) {
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

        <FramedMap artefact={artefact} derived={derived} />
      </div>
    </section>
  );
}

function Paths({
  onOpenMap,
  onOpenHistory,
}: {
  readonly onOpenMap: (mode?: MapMode) => void;
  readonly onOpenHistory: () => void;
}) {
  return (
    <Band tone="raised" id={SECTIONS.paths}>
      <SectionHeading
        title="Start with what you want to understand."
        body="Four ways in, each opening the same map with a different question already asked. None of them makes you learn the whole map first, and every one of them can be switched to the others once you are there."
      />
      <div
        style={{
          display: 'grid',
          gap: space(5),
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
        }}
      >
        {PATHS.map((path) => (
          <article
            key={path.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: surface.raised,
              border: `1px solid ${line.base}`,
              borderTop: `3px solid ${path.accent}`,
              borderRadius: radius.large,
              boxShadow: shadow.resting,
              padding: space(5),
            }}
          >
            <h3
              style={{
                margin: `0 0 ${String(space(2))}px`,
                font: type(text.lead, { weight: weight.semibold, leading: 1.3 }),
                letterSpacing: tracking.title,
                color: ink.strong,
              }}
            >
              {path.title}
            </h3>
            <p
              style={{
                margin: `0 0 ${String(space(5))}px`,
                flex: 1,
                font: type(text.label, { leading: 1.6 }),
                color: ink.muted,
              }}
            >
              {path.body}
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenMap(path.mode);
              }}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                padding: 0,
                font: type(text.label, { weight: weight.semibold }),
                color: brand.ink,
              }}
            >
              {path.action} →
            </button>
          </article>
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
          display: 'flex',
          gap: space(5),
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: space(6),
          padding: space(5),
          background: brand.wash,
          border: `1px solid ${brand.tint}`,
          borderRadius: radius.large,
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
            Recorded flood incidents across Greater Melbourne
          </h3>
          <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.muted }}>
            Which areas called the State Emergency Service about flooding most often between
            2009-10 and 2014-15, what a count actually means, and why it is not a measure of how
            bad the flooding was. This one is about the past, and about the whole city rather
            than the pilot area.
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
