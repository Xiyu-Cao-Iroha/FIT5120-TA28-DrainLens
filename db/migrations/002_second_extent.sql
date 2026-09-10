-- A second published extent, and the one table that could not hold two.
--
-- `extent` has said since the first schema that "a second pilot area is more
-- rows rather than a second database". Every layer honoured that: `pit`,
-- `pipe`, `road`, `street_label`, `derived_shape` and the trace tables all
-- carry `extent_id` and index it. **`artefact_envelope` did not.** Its primary
-- key is `name` alone, so 'map' can exist once — and the moment
-- `city-of-melbourne` is loaded beside `kensington`, the second load either
-- fails on a duplicate key or one extent's prose silently answers for the
-- other's data.
--
-- That is the whole of this migration. Nothing else in the schema needed a
-- change to hold a second extent, which is the design working.

BEGIN;

-- The flood history is not scoped to a pilot extent, and it never was: it
-- covers 30 areas across Greater Melbourne over six financial years. It was
-- carrying NULL here, which is honest and cannot be part of a primary key.
--
-- So Greater Melbourne becomes an extent row of its own. That is not a fudge
-- to satisfy a constraint -- it is the same fact the flood tables already
-- state in `extent_scope text NOT NULL -- 'Greater Melbourne'`, written once
-- more in the place the envelope can reference. Its bounds are the published
-- ASGS extremes of the Greater Melbourne GCCSA rather than a rectangle drawn
-- to look plausible, and its CRS says so.
INSERT INTO extent (id, min_e, min_n, width_m, height_m, crs)
VALUES ('greater-melbourne', 144.5938, -38.5033, 1.1097, 1.1030, 'EPSG:4326')
ON CONFLICT (id) DO NOTHING;

UPDATE artefact_envelope SET extent_id = 'greater-melbourne' WHERE extent_id IS NULL;

ALTER TABLE artefact_envelope ALTER COLUMN extent_id SET NOT NULL;

ALTER TABLE artefact_envelope DROP CONSTRAINT artefact_envelope_pkey;
ALTER TABLE artefact_envelope ADD PRIMARY KEY (name, extent_id);

-- Reading an envelope without naming an extent is now ambiguous, and the API
-- passes one. This index is what makes that lookup a seek rather than a scan
-- once there are several extents' worth of rows.
CREATE INDEX IF NOT EXISTS artefact_envelope_extent_idx ON artefact_envelope (extent_id);

INSERT INTO schema_migration (version) VALUES (2)
ON CONFLICT (version) DO NOTHING;

COMMIT;
