/**
 * What the flood history board writes beside its numbers, and the second
 * ranking it offers.
 *
 * The review of the board found numbers with no unit — `209` beside a suburb
 * reads as a score as easily as a count — and no way to see the ranking the
 * mentor review asked for, where an area's call-outs are set against how many
 * people live there. Both are wording and ordering judgements, so they live
 * here, out of the component, where a test can hold them.
 *
 * **Nothing here recomputes the rate.** `joinAreas` in `severity.ts` is the one
 * place it is calculated; this file orders the result, says which band it is
 * in, and writes the division out for one real area so a reader can repeat it.
 */

import { FLOOD } from '../ui/terms.js';
import { financialYear } from './artefact.js';
import { type MapArea, SEVERITY_BREAKS, bandOf } from './severity.js';

/** A number and the unit written after it, kept apart so the unit can be quieter. */
export interface Figure {
  readonly value: string;
  /** True where the number is a lower bound, drawn as a trailing `+`. */
  readonly minimum: boolean;
  readonly unit: string;
}

/** The figure as one string, for tooltips, labels and tests. */
export const figureText = (figure: Figure): string =>
  `${figure.value}${figure.minimum ? '+' : ''} ${figure.unit}`;

/**
 * A count of call-outs, with its unit.
 *
 * Singular at one, because a sparkline year with a single call-out is common
 * in the lower rows and "1 call-outs" is the kind of slip that makes a reader
 * doubt the number beside it.
 */
export function countFigure(count: number, complete: boolean): Figure {
  return {
    value: count.toLocaleString('en-AU'),
    minimum: !complete,
    unit: count === 1 ? FLOOD.unitOne : FLOOD.unit,
  };
}

/**
 * A rate, with its unit, or null where the area has none.
 *
 * The same two decimals and `+` as the map's `scoreLabel` — a test holds the
 * two together, so the board and the map cannot drift to different rounding.
 * Only the `+` is split off, to be styled.
 */
export function rateFigure(area: Pick<MapArea, 'rate' | 'complete'>): Figure | null {
  if (area.rate === null) return null;
  return { value: area.rate.toFixed(2), minimum: !area.complete, unit: FLOOD.rateUnit };
}

/**
 * One sparkline bar, as its tooltip reads: `2010–11: 120 call-outs`.
 *
 * A year inside an area with a withheld count is a minimum as well, which the
 * flood map's panel already says; the tooltip keeps the same `+`.
 */
export function yearTip(year: string | undefined, count: number, complete: boolean): string {
  return `${financialYear(year)}: ${figureText(countFigure(count, complete))}`;
}

/** Every bar at once, for the sparkline's accessible name. */
export function sparklineLabel(byYear: readonly number[], years: readonly string[], complete: boolean): string {
  return byYear.map((count, i) => yearTip(years[i], count, complete)).join(', ');
}

/**
 * The band a rate falls in, as the legend writes it — name and range.
 *
 * The range stays attached. `severity.ts` puts the reason best: a band name
 * without its numbers is a judgement with the workings hidden.
 */
export function bandLabel(rate: number | null): string | null {
  const index = bandOf(rate, SEVERITY_BREAKS);
  return index === null ? null : (SEVERITY_BREAKS[index]?.label ?? null);
}

/** The band thresholds as the rules list them, read from the constants rather than retyped. */
export const bandRules = (): readonly string[] => SEVERITY_BREAKS.map((band) => band.label);

export interface RankedRate {
  readonly rank: number;
  readonly area: MapArea & { readonly rate: number; readonly persons: number };
  /** True where a neighbour shows the same rate to two decimals. */
  readonly tied: boolean;
  readonly band: string | null;
}

export interface RateRanking {
  readonly ranked: readonly RankedRate[];
  /** Areas with too few residents to divide by, which are not ranked at all. */
  readonly unrated: readonly MapArea[];
  /** The highest rate, which every bar is drawn against. */
  readonly scale: number;
}

const hasRate = (area: MapArea): area is RankedRate['area'] => area.rate !== null && area.persons !== null;

/**
 * Every area with a rate, highest first.
 *
 * **All of them, not the thirty on the board.** The board's thirty are the
 * highest counts, and ranking those by rate would quietly drop Riddells Creek,
 * which has the highest rate of all and is nowhere near the count's top thirty.
 *
 * **A tie is what the reader can see.** The rates are written to two decimals,
 * so two rows showing 3.14 are marked tied even where the unrounded values
 * differ in the fourth place — a rank order between them would be a precision
 * the page never shows. Equal rates are ordered by name so the list is stable.
 */
export function rankByRate(areas: readonly MapArea[]): RateRanking {
  const rated = areas.filter(hasRate).sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const shown = rated.map((area) => area.rate.toFixed(2));
  const ranked = rated.map((area, i) => ({
    rank: i + 1,
    area,
    tied: shown[i] === shown[i - 1] || shown[i] === shown[i + 1],
    band: bandLabel(area.rate),
  }));
  return {
    ranked,
    unrated: areas.filter((area) => !hasRate(area)),
    scale: Math.max(Number.EPSILON, ...rated.map((area) => area.rate)),
  };
}

/**
 * Areas hidden by the cut that show the same rate as the last one shown.
 *
 * The same rule `tiedBeyond` applies to the counts, for the same reason: a
 * top five ending on a tie with nothing visible to be tied to is a sharper
 * ranking than the data holds.
 */
export function rateTiedBeyond(ranked: readonly RankedRate[], shown: number): readonly RankedRate[] {
  const last = ranked[shown - 1];
  if (last === undefined || shown >= ranked.length) return [];
  const at = last.area.rate.toFixed(2);
  return ranked.slice(shown).filter((row) => row.area.rate.toFixed(2) === at);
}

export interface WorkedExample {
  readonly name: string;
  readonly total: number;
  readonly persons: number;
  readonly rate: number;
  readonly complete: boolean;
  readonly band: string | null;
}

/**
 * One real area to divide out on the page.
 *
 * The board's own top area where it can be — the reader has just seen its
 * count, so the example starts from a number already on screen. A complete
 * total is preferred, because a worked example that ends in "and a minimum"
 * teaches the exception before the rule.
 */
export function workedExample(areas: readonly MapArea[], preferred: readonly string[]): WorkedExample | null {
  const rated = areas.filter(hasRate);
  const byName = new Map(rated.map((area) => [area.name, area]));
  const inOrder = [
    ...preferred.map((name) => byName.get(name)).filter((area) => area !== undefined),
    ...[...rated].sort((a, b) => b.rate - a.rate),
  ];
  const chosen = inOrder.find((area) => area.complete) ?? inOrder[0];
  if (chosen === undefined) return null;
  return {
    name: chosen.name,
    total: chosen.total,
    persons: chosen.persons,
    rate: chosen.rate,
    complete: chosen.complete,
    band: bandLabel(chosen.rate),
  };
}

/** `209 call-outs ÷ 18,055 residents × 1,000 = 11.58 call-outs per 1,000 residents` */
export function exampleSum(example: WorkedExample): string {
  const count = figureText(countFigure(example.total, example.complete));
  const rate = figureText({
    value: example.rate.toFixed(2),
    minimum: !example.complete,
    unit: FLOOD.rateUnit,
  });
  return `${count} ÷ ${example.persons.toLocaleString('en-AU')} residents × 1,000 = ${rate}`;
}

/**
 * The names of the unrated areas, as a sentence lists them.
 *
 * Named rather than counted, because "7 areas" invites the reader to wonder
 * whether one of them is theirs, and every one of them is an airport, a
 * racecourse or industrial land.
 */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${String(names.at(-1))}`;
}

/**
 * An ISO date as a sentence reads it.
 *
 * Parsed as parts rather than through `Date`, which would apply the reader's
 * time zone to a date that has none and can move it a day.
 */
export function readableDate(iso: string): string {
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
