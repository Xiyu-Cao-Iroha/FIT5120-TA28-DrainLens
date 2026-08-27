import { useEffect, useState } from 'react';

import { type MapArtefact, assertUsable } from './map/artefact.js';
import { MapCanvas } from './map/MapCanvas.js';
import type { Hit } from './map/hit.js';

export function App() {
  const [artefact, setArtefact] = useState<MapArtefact | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);

  useEffect(() => {
    fetch('/data/map.json')
      .then((response) => response.json())
      .then((value: unknown) => {
        assertUsable(value);
        setArtefact(value);
      })
      .catch((error: unknown) => setProblem(String(error)));
  }, []);

  if (problem !== null) return <p style={{ padding: 24 }}>{problem}</p>;
  if (artefact === null) return <p style={{ padding: 24 }}>Loading the pilot area…</p>;

  const selected = hit?.kind === 'pit' ? (hit.feature.asset_number ?? null) : null;

  return (
    <main style={{ position: 'fixed', inset: 0, font: '14px system-ui, sans-serif' }}>
      <MapCanvas artefact={artefact} selectedPit={selected} onSelect={setHit} />
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          maxWidth: 320,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.94)',
          borderRadius: 10,
          boxShadow: '0 2px 14px rgba(0,0,0,0.12)',
          lineHeight: 1.45,
        }}
      >
        <strong>{artefact.extent.name} pilot</strong>
        <div style={{ color: '#5b6b7a' }}>
          {artefact.layers.pit?.length ?? 0} pits · {artefact.layers.pipe?.length ?? 0} pipes
        </div>
        <div style={{ marginTop: 10, minHeight: 40 }}>
          {hit === null ? (
            <span style={{ color: '#5b6b7a' }}>Select a drainage pit or pipe.</span>
          ) : hit.kind === 'pit' ? (
            <>
              <div>
                <strong>Pit {hit.feature.asset_number}</strong>
              </div>
              <div style={{ color: '#5b6b7a' }}>{hit.feature.asset_description}</div>
            </>
          ) : (
            <>
              <div>
                <strong>Pipe {hit.feature.ref}</strong>
              </div>
              <div style={{ color: '#5b6b7a' }}>
                {hit.feature.diameter ? `${hit.feature.diameter} mm · ` : ''}
                {hit.feature.material}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
