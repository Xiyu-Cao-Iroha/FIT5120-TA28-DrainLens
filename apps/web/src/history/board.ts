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
import { yearLabel } from './artefact.js';
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
 * A count of emergency responses, with its unit.
 *
 * Singular at one, because a sparkline year with a single response is common
 * in the lower rows and "1 emergency responses" is the kind of slip that makes
 * a reader doubt the number beside it.
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
 * One sparkline bar, as its tooltip reads: `2010/11: 120 emergency responses`.
 *
 * A year inside an area with a withheld count is a minimum as well, which the
 * flood map's panel already says; the tooltip keeps the same `+`.
 */
export function yearTip(year: string | undefined, count: number, complete: boolean): string {
  return `${yearLabel(year)}: ${figureText(countFigure(count, complete))}`;
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

/**
 * The band's name alone, "High", for the badge on a list row (copy audit v2,
 * #76). The row already shows the rate, and the ranges are in the rules.
 */
export function bandName(rate: number | null): string | null {
  const index = bandOf(rate, SEVERITY_BREAKS);
  const band = index === null ? undefined : SEVERITY_BREAKS[index];
  return band === undefined ? null : (band.name ?? band.label);
}

/** The band thresholds as the rules list them, read from the constants rather than retyped. */
export const bandRules = (): readonly string[] => SEVERITY_BREAKS.map((band) => band.label);

export interface RankedRate {
  readonly rank: number;
  readonly area: MapArea & { readonly rate: number; readonly persons: number };
  /** True where a neighbour shows the same rate to two decimals. */
  readonly tied: boolean;
  /** The band's name alone, for the row's badge. */
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
    band: bandName(area.rate),
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

/** `209 emergency responses ÷ 18,055 people × 1,000 = 11.58 emergency responses per 1,000 people` */
export function exampleSum(example: WorkedExample): string {
  const count = figureText(countFigure(example.total, example.complete));
  const rate = figureText({
    value: example.rate.toFixed(2),
    minimum: !example.complete,
    unit: FLOOD.rateUnit,
  });
  return `${count} ÷ ${example.persons.toLocaleString('en-AU')} people × 1,000 = ${rate}`;
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

/**
 * What a `+` means, as the tooltip on a number that carries one.
 *
 * Copy audit v2, #70: the row's *exact count not published* badge is gone and
 * the `+` stays, with this sentence behind it. The value is written as the row
 * writes it, so the tooltip and the number cannot disagree.
 */
export const atLeastTip = (value: string): string => `At least ${value}. Some counts were hidden for privacy.`;

/**
 * The division behind one row's rate, for its tooltip.
 *
 * Copy audit v2, #76: the division was a line under every bar, a formula in
 * the main list. It is now behind the number, and the worked example under
 * *How the rate is calculated* still divides one area out in full.
 */
export function rateTip(area: Pick<MapArea, 'total' | 'complete' | 'rate' | 'persons'>): string | null {
  if (area.rate === null || area.persons === null) return null;
  const sum = `${figureText(countFigure(area.total, area.complete))} ÷ ${area.persons.toLocaleString('en-AU')} people × 1,000`;
  return area.complete ? sum : `${atLeastTip(area.rate.toFixed(2))} ${sum}`;
}

/**
 * The line under a list: "Top 5 of 30 areas." (copy audit v2, #71, #77).
 *
 * Both numbers are counted, not typed. The longer sentences it replaced named
 * the minimums and the ties hidden past the cut; the rows mark both now, with
 * a `+` and *Same count*.
 */
export function topNote(shown: number, of: number): string {
  return shown >= of ? `All ${String(of)} areas.` : `Top ${String(shown)} of ${String(of)} areas.`;
}

/** Why some areas are not in the rate ranking, with the threshold read from the population file. */
export const unratedNote = (minimumResidents: number): string =>
  `Areas with under ${minimumResidents.toLocaleString('en-AU')} people are not ranked.`;

/**
 * The sentence over the yearly chart (copy audit v2, #67).
 *
 * The audit's wording, *almost half*, is right for the published board, where
 * 2010/11 is 44.5% of the total. It is only said while it is true: a share
 * from 40% up to half is *almost half*, and anything else is written as its
 * rounded percentage, so a rebuilt board cannot make the sentence wrong.
 */
export function wetYearNote(totals: readonly number[], years: readonly string[]): string {
  const sum = totals.reduce((n, v) => n + v, 0);
  if (sum <= 0 || totals.length === 0) return '';
  const peak = Math.max(...totals);
  const year = yearLabel(years[totals.indexOf(peak)]);
  const share = peak / sum;
  if (share >= 0.4 && share < 0.5) {
    return `Almost half of these ${FLOOD.unit} came in one wet year, ${year}.`;
  }
  return `${String(Math.round(share * 100))}% of these ${FLOOD.unit} came in one year, ${year}.`;
}
