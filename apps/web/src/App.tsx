import { useEffect, useState } from 'react';

import { type MapArtefact, assertUsable } from './map/artefact.js';
import { type DerivedArtefact, type DerivedVisibility, assertDerived } from './map/derived.js';
import { MapCanvas } from './map/MapCanvas.js';
import type { Hit } from './map/hit.js';

/**
 * Layers, with the basis each one carries.
 *
 * The label is not decoration. §5.5 requires every value the interface shows
 * to carry a basis, and a map layer is a value like any other: the drainage
 * network is published record, the water paths are a calculation over a
 * filtered surface, and drawing them side by side without saying which is
 * which lends one the authority of the other.
 */
const LAYERS = [
  { key: 'network', label: 'Drainage pits and pipes', basis: 'Official recorded data' },
  { key: 'channel', label: 'Likely surface water paths', basis: 'System-derived result' },
  { key: 'lowPoint', label: 'Low points and depressions', basis: 'System-derived result' },
  { key: 'unavailable', label: 'Not enough ground measured', basis: 'System-derived result' },
] as const;

const BASIS_STYLE: Record<string, { background: string; color: string }> = {
  'Official recorded data': { background: '#dcece6', color: '#1f5b4e' },
  'System-derived result': { background: '#dde8f2', color: '#2a5678' },
};

export function App() {
  const [artefact, setArtefact] = useState<MapArtefact | null>(null);
  const [derived, setDerived] = useState<DerivedArtefact | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  const [show, setShow] = useState<DerivedVisibility>({
    channel: true,
    lowPoint: true,
    unavailable: true,
  });

  useEffect(() => {
    Promise.all([
      fetch('/data/map.json').then((r) => r.json()),
      fetch('/data/derived.json').then((r) => r.json()),
    ])
      .then(([map, layers]: [unknown, unknown]) => {
        assertUsable(map);
        assertDerived(layers);
        setArtefact(map);
        setDerived(layers);
      })
      .catch((error: unknown) => setProblem(String(error)));
  }, []);

  if (problem !== null) return <p style={{ padding: 24 }}>{problem}</p>;
  if (artefact === null || derived === null) {
    return <p style={{ padding: 24 }}>Loading the pilot area…</p>;
  }

  const selected = hit?.kind === 'pit' ? (hit.feature.asset_number ?? null) : null;

  return (
    <main style={{ position: 'fixed', inset: 0, font: '14px system-ui, sans-serif' }}>
      <MapCanvas
        artefact={artefact}
        derived={derived}
        show={show}
        selectedPit={selected}
        onSelect={setHit}
      />

      <aside
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          width: 300,
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 10,
          boxShadow: '0 2px 14px rgba(0,0,0,0.12)',
          lineHeight: 1.45,
        }}
      >
        <strong>{artefact.extent.name} pilot</strong>
        <div style={{ color: '#5b6b7a', fontSize: 13 }}>
          {artefact.layers.pit?.length ?? 0} pits · {artefact.layers.pipe?.length ?? 0} pipes ·{' '}
          {derived.layers['low-point']?.length ?? 0} low points
        </div>

        <div style={{ marginTop: 14, borderTop: '1px solid #e6ebe4', paddingTop: 12 }}>
          {LAYERS.map((layer) => {
            const toggleable = layer.key !== 'network';
            const on = toggleable ? show[layer.key as keyof DerivedVisibility] : true;
            const style = BASIS_STYLE[layer.basis] ?? { background: '#eee', color: '#444' };
            return (
              <label
                key={layer.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 9,
                  cursor: toggleable ? 'pointer' : 'default',
                  opacity: toggleable ? 1 : 0.75,
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
          })}
        </div>

        <div
          style={{
            marginTop: 6,
            paddingTop: 10,
            borderTop: '1px solid #e6ebe4',
            minHeight: 44,
          }}
        >
          {hit === null ? (
            <span style={{ color: '#5b6b7a' }}>Select a drainage pit or pipe.</span>
          ) : hit.kind === 'pit' ? (
            <>
              <strong>Pit {hit.feature.asset_number}</strong>
              <div style={{ color: '#5b6b7a' }}>{hit.feature.asset_description}</div>
            </>
          ) : (
            <>
              <strong>Pipe {hit.feature.ref}</strong>
              <div style={{ color: '#5b6b7a' }}>
                {hit.feature.diameter ? `${hit.feature.diameter} mm · ` : ''}
                {hit.feature.material}
              </div>
            </>
          )}
        </div>
      </aside>
    </main>
  );
}
