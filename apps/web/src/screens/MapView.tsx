/**
 * The map, with the layers the chosen task wants on by default.
 *
 * AC 1.1.2 asks the follow task to open with surface-water paths and pits and
 * one instruction, with everything else collapsed. The full-map task asks for
 * the opposite. Both are the same map; what differs is what is on when it
 * opens, and that difference is the whole reason the task question exists.
 */

import { useMemo, useState } from 'react';

import type { MapArtefact } from '../map/artefact.js';
import type { DerivedArtefact, DerivedVisibility } from '../map/derived.js';
import type { Hit } from '../map/hit.js';
import { MapCanvas } from '../map/MapCanvas.js';
import type { SupportedAddress, Task } from '../session.js';
import { type TraceArtefact, traceDownstream } from '../trace/graph.js';
import { PitDetail } from './PitDetail.js';

const BASIS_STYLE: Readonly<Record<string, { background: string; color: string }>> = {
  'Official recorded data': { background: '#dcece6', color: '#1f5b4e' },
  'System-derived result': { background: '#dde8f2', color: '#2a5678' },
};

const LAYERS = [
  { key: 'network', label: 'Drainage pits and pipes', basis: 'Official recorded data' },
  { key: 'channel', label: 'Likely surface water paths', basis: 'System-derived result' },
  { key: 'lowPoint', label: 'Low points and depressions', basis: 'System-derived result' },
  { key: 'unavailable', label: 'Not enough ground measured', basis: 'System-derived result' },
] as const;

/** What the follow task opens with: the two layers its question needs. */
const GUIDED: DerivedVisibility = { channel: true, lowPoint: false, unavailable: false };
const EVERYTHING: DerivedVisibility = { channel: true, lowPoint: true, unavailable: true };

export interface MapViewProps {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly address: SupportedAddress | null;
  readonly task: Task | null;
  readonly onBack: () => void;
  /** The side panel is suppressed when the map sits beside another one. */
  readonly panel?: boolean;
}

export function MapView({ map, derived, trace, address, task, onBack, panel = true }: MapViewProps) {
  const guided = task !== 'full-map';
  const [show, setShow] = useState<DerivedVisibility>(guided ? GUIDED : EVERYTHING);
  const [moreOpen, setMoreOpen] = useState(!guided);
  const [hit, setHit] = useState<Hit | null>(null);
  const [following, setFollowing] = useState<string | null>(null);

  const selected = hit?.kind === 'pit' ? (hit.feature.asset_number ?? null) : null;

  // Recomputed only when the followed pit changes. The traversal is cheap,
  // but it runs inside a render that also happens on every pan.
  const followed = useMemo(
    () => (following === null ? null : traceDownstream(trace, following)),
    [trace, following],
  );

  return (
    <>
      <MapCanvas
        artefact={map}
        derived={derived}
        show={show}
        selectedPit={selected}
        address={address === null ? null : [address.eastingM, address.northingM]}
        trace={followed}
        onSelect={(next) => {
          setHit(next);
          // Selecting something else abandons the path. Leaving it drawn
          // would attach the previous answer to the new question.
          if (next?.kind !== 'pit' || String(next.feature.asset_number) !== following) {
            setFollowing(null);
          }
        }}
      />

      {panel && (
      <aside
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          width: 310,
          maxHeight: 'calc(100% - 32px)',
          overflow: 'auto',
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 10,
          boxShadow: '0 2px 14px rgba(0,0,0,0.12)',
          fontSize: 14,
        }}
      >
        {address && (
          <>
            <span style={{ fontSize: 12, letterSpacing: 0.6, color: '#8593a0' }}>
              SELECTED ADDRESS
            </span>
            <strong style={{ display: 'block', margin: '2px 0 10px' }}>{address.label}</strong>
          </>
        )}

        {guided && (
          <p
            style={{
              margin: '0 0 12px',
              padding: '9px 11px',
              background: '#eef4f0',
              borderRadius: 8,
              color: '#2c5f52',
            }}
          >
            <strong style={{ display: 'block', fontSize: 12, letterSpacing: 0.6 }}>
              YOUR NEXT STEP
            </strong>
            Select a highlighted surface-water path or a nearby drainage pit.
          </p>
        )}

        <span style={{ fontSize: 12, letterSpacing: 0.6, color: '#8593a0' }}>MAP LAYERS</span>
        <div style={{ marginTop: 8 }}>
          {LAYERS.filter((layer) => moreOpen || layer.key === 'network' || layer.key === 'channel').map(
            (layer) => {
              const toggleable = layer.key !== 'network';
              const on = toggleable ? show[layer.key as keyof DerivedVisibility] : true;
              const style = BASIS_STYLE[layer.basis] ?? { background: '#eee', color: '#444' };
              return (
                <label
                  key={layer.key}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    marginBottom: 9,
                    cursor: toggleable ? 'pointer' : 'default',
                    opacity: toggleable ? 1 : 0.8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!toggleable}
                    onChange={() =>
                      toggleable &&
                      setShow((current) => ({
                        ...current,
                        [layer.key]: !current[layer.key as keyof DerivedVisibility],
                      }))
                    }
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block' }}>{layer.label}</span>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 3,
                        padding: '1px 7px',
                        borderRadius: 999,
                        fontSize: 11,
                        ...style,
                      }}
                    >
                      {layer.basis}
                    </span>
                  </span>
                </label>
              );
            },
          )}
        </div>

        {guided && (
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: '#1f6f5c',
              cursor: 'pointer',
            }}
          >
            {moreOpen ? '▾ Fewer map layers' : '▸ More map layers'}
          </button>
        )}

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e6ebe4', minHeight: 44 }}>
          {hit === null ? (
            <span style={{ color: '#6b7a88' }}>Select a drainage pit or pipe.</span>
          ) : hit.kind === 'pit' ? (
            <PitDetail
              pit={hit.feature}
              artefact={trace}
              trace={followed}
              onFollow={() => setFollowing(String(hit.feature.asset_number))}
              onClear={() => setFollowing(null)}
            />
          ) : (
            <>
              <strong>Pipe {hit.feature.ref}</strong>
              <div style={{ color: '#6b7a88' }}>
                {hit.feature.diameter ? `${hit.feature.diameter} mm · ` : ''}
                {hit.feature.material}
              </div>
              <Badge basis="Official recorded data" />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            color: '#1f6f5c',
            cursor: 'pointer',
          }}
        >
          ← Back to choose a task
        </button>
      </aside>
      )}
    </>
  );
}

function Badge({ basis }: { readonly basis: string }) {
  const style = BASIS_STYLE[basis] ?? { background: '#eee', color: '#444' };
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 6,
        padding: '1px 7px',
        borderRadius: 999,
        fontSize: 11,
        ...style,
      }}
    >
      {basis}
    </span>
  );
}
