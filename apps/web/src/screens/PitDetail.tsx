/**
 * What the council recorded about one pit, and where its water goes next.
 *
 * AC 1.2.1.c pushes provenance down to the individual value, so every field
 * here is either shown with its recorded label or listed as not recorded.
 * There is no third option: an empty row and an absent row say different
 * things, and the person reading this has no way to tell a field we chose not
 * to display from one the council never filled in.
 *
 * The wording lives in this file as data rather than inline in the markup,
 * for the same reason as `scenario/outcome.ts` — sentences that carry a claim
 * about certainty are reviewable in one place and are not reviewable scattered
 * through JSX.
 */

import type { Pit } from '../map/artefact.js';
import { type Trace, type TraceArtefact, endingsByReason } from '../trace/graph.js';
import { stoppedBecauseOfTheRecord } from '../trace/draw.js';

const RECORDED_BADGE = 'Official recorded data';

/**
 * The fields the pit layer carries, in the order a person reads them.
 *
 * Depth is deliberately absent. Invert values are missing for 95.4% of the
 * council's pits and the surviving fraction is internally inconsistent, so a
 * depth row would be empty almost always and untrustworthy the rest of the
 * time. AC 1.3.1.d is served by saying so, not by showing a blank.
 */
const FIELDS: readonly { readonly key: keyof Pit; readonly label: string }[] = [
  { key: 'asset_number', label: 'Asset number' },
  { key: 'asset_description', label: 'Description' },
  { key: 'object_type_lupvalue', label: 'Type' },
];

export const NOT_RECORDED = 'Not recorded';

export const DEPTH_NOTE =
  'Pit depth is not shown. The council record leaves it out for almost every ' +
  'pit in this area, and filling the gap with an estimate would present a ' +
  'guess as a measurement.';

/** One line per way a path can stop, in the person's words rather than ours. */
export const ENDING_LABELS: Readonly<Record<string, string>> = {
  'no-recorded-connection': 'the record has no pipe leaving that pit',
  'unrecorded-destination': 'a pipe leaves, but the record does not say where it goes',
  'leaves-mapped-area': 'the pipe continues outside the mapped area',
  'cycle-guard': 'the recorded connections loop back on themselves',
};

export const NO_OUTLET_NOTE =
  'This area has no recorded outfall, so a path always ends where the record ' +
  'ends rather than where the water leaves the drainage system.';

const LABEL: React.CSSProperties = { fontSize: 12, letterSpacing: 0.6, color: '#8593a0' };

const BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 11,
  background: '#dcece6',
  color: '#1f5b4e',
};

export interface PitDetailProps {
  readonly pit: Pit;
  readonly artefact: TraceArtefact;
  readonly trace: Trace | null;
  readonly onFollow: () => void;
  readonly onClear: () => void;
}

export function PitDetail({ pit, artefact, trace, onFollow, onClear }: PitDetailProps) {
  const asset = pit.asset_number === undefined ? null : String(pit.asset_number);
  const links = asset === null ? undefined : artefact.links[asset];
  const followable = links !== undefined && links.some((link) => link.to !== undefined);
  const hasRecord = links !== undefined && links.length > 0;

  return (
    <div>
      <span style={LABEL}>SELECTED PIT</span>
      <div style={{ margin: '4px 0 8px' }}>
        <span style={BADGE}>{RECORDED_BADGE}</span>
      </div>

      <dl style={{ margin: '0 0 12px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
        {FIELDS.map(({ key, label }) => {
          const value = pit[key];
          const recorded = value !== undefined && value !== null && String(value).trim() !== '';
          return (
            <div key={key} style={{ display: 'contents' }}>
              <dt style={{ color: '#6b7a88' }}>{label}</dt>
              <dd style={{ margin: 0, color: recorded ? '#1e2b36' : '#94a2ae' }}>
                {recorded ? String(value) : NOT_RECORDED}
              </dd>
            </div>
          );
        })}
      </dl>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7a88' }}>{DEPTH_NOTE}</p>

      {trace === null ? (
        <>
          <button
            type="button"
            disabled={!followable}
            onClick={onFollow}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: followable ? '#1f6f5c' : '#dde3dd',
              color: followable ? '#ffffff' : '#8593a0',
              font: 'inherit',
              cursor: followable ? 'pointer' : 'default',
            }}
          >
            Follow the recorded downstream path
          </button>
          {!followable && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8593a0' }}>
              {hasRecord
                ? 'Every pipe leaving this pit stops at the edge of the record, so there is no path to follow.'
                : 'The record has no pipe leaving this pit, so there is no path to follow.'}
            </p>
          )}
        </>
      ) : (
        <TraceSummary trace={trace} onClear={onClear} />
      )}
    </div>
  );
}

/**
 * What the followed path did.
 *
 * The count of stops is given before the reasons, because "it stopped in four
 * places" is the fact that changes how much of this path a person should
 * trust, and the reasons only qualify it.
 */
function TraceSummary({ trace, onClear }: { readonly trace: Trace; readonly onClear: () => void }) {
  const reasons = endingsByReason(trace);
  const brokenRecord = trace.endings.filter((ending) =>
    stoppedBecauseOfTheRecord(ending.reason),
  ).length;

  return (
    <div style={{ paddingTop: 10, borderTop: '1px solid #e6ebe4' }}>
      <span style={LABEL}>FOLLOWED PATH</span>
      <p style={{ margin: '6px 0 8px' }}>
        {trace.pipes.length === 0 ? (
          'No pipe could be followed from this pit.'
        ) : (
          <>
            <strong>
              {trace.pipes.length} recorded {trace.pipes.length === 1 ? 'pipe' : 'pipes'}
            </strong>{' '}
            across {trace.steps} {trace.steps === 1 ? 'step' : 'steps'} downstream.
          </>
        )}
      </p>

      <p style={{ margin: '0 0 6px' }}>
        The path stops in {trace.endings.length} {trace.endings.length === 1 ? 'place' : 'places'}
        {brokenRecord > 0 ? ':' : ', all at the edge of the mapped area:'}
      </p>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18, color: '#4a5b68' }}>
        {reasons.map(({ reason, count }) => (
          <li key={reason} style={{ marginBottom: 3 }}>
            {count > 1 ? `${count} × ` : ''}
            {ENDING_LABELS[reason] ?? reason}
          </li>
        ))}
      </ul>

      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7a88' }}>{NO_OUTLET_NOTE}</p>

      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: '#1f6f5c',
          cursor: 'pointer',
        }}
      >
        Clear the followed path
      </button>
    </div>
  );
}
