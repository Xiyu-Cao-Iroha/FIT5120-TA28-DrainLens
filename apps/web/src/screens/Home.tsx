/**
 * The homepage: what this is, before it asks anything of somebody.
 *
 * The first screen used to be the address field. That is the right first
 * question once you have decided to use the thing, and the wrong one before —
 * it asks a stranger to type where they live in order to find out what the
 * site does. This page answers that first, and every way onward from it goes
 * to the same map.
 *
 * **What is deliberately not on it.** No flood history entry, because the
 * board does not exist yet and the only dataset that could feed it honestly
 * has not been fetched. A navigation item pointing at a page nobody built is
 * a promise the site cannot keep, and this product's whole argument is that
 * it does not make those.
 */

import { useState } from 'react';

import type { DerivedArtefact } from '../map/derived.js';
import type { MapArtefact } from '../map/artefact.js';
import { FramedMap } from '../map/FramedMap.js';
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

/** The three ways into the map, which are the three the product actually has. */
const PATHS: readonly {
  readonly title: string;
  readonly body: string;
  readonly action: string;
  readonly accent: string;
}[] = [
  {
    title: 'Follow local water and drainage',
    body: 'See where rainwater may move near an address, and follow the recorded drainage connections downstream until the record stops.',
    action: 'Open the drainage map',
    accent: '#1f6f5c',
  },
  {
    title: 'Compare a drain-blockage scenario',
    body: 'Choose a pit, a blockage assumption and a rainfall amount, then compare the result against the same rainfall with every drain clear.',
    action: 'Set up a comparison',
    accent: '#2f7fb8',
  },
  {
    title: 'Explore the whole pilot area',
    body: 'Every layer at once — terrain, pits, pipes, surface-water paths and low areas — without a guided task in the way.',
    action: 'Open the full map',
    accent: '#7c5cc4',
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
    body: 'Turn layers on and off, select a pit or pipe, and see which parts are the council’s record and which DrainLens calculated.',
  },
];

const PROVIDES: readonly string[] = [
  'Recorded public drainage pits and pipes, and where a path stops because the record does',
  'Surface-water paths, low points and a ground surface calculated from measured terrain',
  'One blocked drain compared against the same rainfall with every drain clear',
];

const WITHHOLDS: readonly string[] = [
  'Live warnings, forecasts, or any prediction of future flooding',
  'How deep water would be, or when it would arrive',
  'Anywhere outside one square kilometre of Kensington',
];

export interface HomeProps {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly onOpenMap: () => void;
  readonly onFindAddress: () => void;
}

export function Home({ artefact, derived, onOpenMap, onFindAddress }: HomeProps) {
  return (
    <div>
      <Hero
        artefact={artefact}
        derived={derived}
        onOpenMap={onOpenMap}
        onFindAddress={onFindAddress}
      />
      <Paths onOpenMap={onOpenMap} />
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

function QuietButton({
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
        color: brand.ink,
        background: hovered ? brand.wash : surface.raised,
        border: `1px solid ${hovered ? brand.tint : line.strong}`,
        borderRadius: radius.base,
        transition: 'background-color 120ms ease, border-color 120ms ease',
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
  onFindAddress,
}: {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly onOpenMap: () => void;
  readonly onFindAddress: () => void;
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

          <div style={{ display: 'flex', gap: space(3), flexWrap: 'wrap' }}>
            <PrimaryButton label="Explore the map →" onPress={onOpenMap} />
            <QuietButton label="Start from an address" onPress={onFindAddress} />
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

function Paths({ onOpenMap }: { readonly onOpenMap: () => void }) {
  return (
    <Band tone="raised" id={SECTIONS.paths}>
      <SectionHeading
        title="Start with what you want to understand."
        body="Three ways in, each opening the same map with different things turned on. None of them asks you to learn the whole map first."
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
              onClick={onOpenMap}
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
