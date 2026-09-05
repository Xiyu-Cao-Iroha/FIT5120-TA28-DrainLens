-- DrainLens, initial schema.
--
-- Written against the artefacts as they exist rather than invented: every
-- column here holds something `apps/web/public/data/*.json` already carries,
-- and the loader in `apps/api/src/load.ts` fails if a field it expects is
-- missing rather than inserting a NULL that means "we did not look".
--
-- Coordinates are metres east and north of the extent's south-west corner, to
-- a decimetre -- the frame every artefact uses. Nothing is reprojected on the
-- way in, so there is no second place for the map and the database to disagree
-- about where a pit is.
--
-- Idempotent: it can be applied to a fresh database or re-applied to one that
-- already has it, because the test suite does exactly that between runs.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migration (
  version     integer PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Provenance
-- ---------------------------------------------------------------------------

-- Every dataset the product redistributes. Provenance is a row rather than a
-- string repeated in five artefacts, because AC 1.1.4.g and the CC BY
-- attribution both read from it and they must not be able to drift apart.
CREATE TABLE IF NOT EXISTS source (
  dataset_id  text PRIMARY KEY,
  -- Nullable, because most of these datasets do not have one. The map
  -- artefact carries an id, a publisher and a licence per layer and no human
  -- title; the flood history carries a dataset name. Writing the id into this
  -- column to make it look filled would be inventing a title.
  title       text,
  publisher   text NOT NULL,
  licence     text NOT NULL,
  -- When the *publisher* last changed the dataset, which is what the
  -- artefacts record. It is not when we downloaded it: those are different
  -- facts and a column named for one holding the other is a lie that survives
  -- every future reader.
  last_modified date
);

-- One row per published extent, so a second pilot area is more rows rather
-- than a second database.
CREATE TABLE IF NOT EXISTS extent (
  id        text PRIMARY KEY,
  min_e     double precision NOT NULL,
  min_n     double precision NOT NULL,
  width_m   double precision NOT NULL,
  height_m  double precision NOT NULL,
  crs       text NOT NULL
);

-- ---------------------------------------------------------------------------
-- The recorded drainage network
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pit (
  asset_number  bigint PRIMARY KEY,
  extent_id     text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  e_m           double precision NOT NULL,
  n_m           double precision NOT NULL,
  -- Nullable, and the distinction is the point: NULL is "the council record
  -- has no value here", which is a different statement from an empty string
  -- and from a value we chose not to display. AC 1.1.7.f turns on it, and it
  -- is not hypothetical -- 22 of the 895 pits have no recorded object type.
  description   text,
  object_type   text,
  dataset_id    text NOT NULL REFERENCES source(dataset_id)
);

CREATE INDEX IF NOT EXISTS pit_extent_idx ON pit (extent_id);

CREATE TABLE IF NOT EXISTS pipe (
  ref           bigint PRIMARY KEY,
  extent_id     text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  -- Not foreign keys to pit, and this is measured rather than assumed:
  -- **69 of the 893 pipes name a downstream pit that is not in this extent.**
  -- A constraint here would reject sixty-nine rows the council record actually
  -- contains -- the database editing the record rather than storing it. It is
  -- also the same fact the map already shows a resident, as a path that stops
  -- because the record stops. Whether a pit is present is a question the API
  -- answers, not one the schema forbids asking.
  upstr_pit     bigint,
  dnstr_pit     bigint,
  diameter_mm   integer,
  material      text,
  -- The polyline, in the artefact's own [[e, n], ...] shape.
  path          jsonb NOT NULL,
  dataset_id    text NOT NULL REFERENCES source(dataset_id)
);

CREATE INDEX IF NOT EXISTS pipe_extent_idx ON pipe (extent_id);
CREATE INDEX IF NOT EXISTS pipe_upstr_idx ON pipe (upstr_pit);

CREATE TABLE IF NOT EXISTS road (
  id          bigserial PRIMARY KEY,
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  str_type    text,
  seg_descr   text,
  rings       jsonb NOT NULL,
  dataset_id  text NOT NULL REFERENCES source(dataset_id)
);

CREATE INDEX IF NOT EXISTS road_extent_idx ON road (extent_id);

CREATE TABLE IF NOT EXISTS street_label (
  id          bigserial PRIMARY KEY,
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  name        text NOT NULL,
  path        jsonb NOT NULL,
  dataset_id  text NOT NULL REFERENCES source(dataset_id)
);

CREATE INDEX IF NOT EXISTS street_label_extent_idx ON street_label (extent_id);

-- ---------------------------------------------------------------------------
-- Derived layers -- calculated, never recorded, and labelled so everywhere
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS derived_shape (
  id          bigserial PRIMARY KEY,
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  layer       text NOT NULL CHECK (layer IN ('channel', 'low-point', 'unavailable')),
  geometry    text NOT NULL CHECK (geometry IN ('line', 'polygon')),
  coordinates jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS derived_shape_extent_layer_idx ON derived_shape (extent_id, layer);

-- ---------------------------------------------------------------------------
-- Where a followed path stops, and why
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trace_link (
  from_pit    bigint NOT NULL,
  to_pit      bigint,
  via_pipe    bigint,
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  PRIMARY KEY (extent_id, from_pit, via_pipe)
);

-- Why a path can stop, and the sentence shown when it does.
--
-- **This is a vocabulary, not a per-pit assignment**, and the first draft of
-- this schema got that wrong. The artefact does not say which pit ends for
-- which reason: it publishes the four reasons, the sentence for each, and how
-- many pits fall into each. Which reason applies to a given pit is worked out
-- when a path is followed, because it depends on where the walk started.
--
-- Storing a `reason` per pit would have looked reasonable and been fiction.
CREATE TABLE IF NOT EXISTS trace_reason (
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  reason      text NOT NULL,   -- 'no-recorded-connection', 'cycle-guard', ...
  sentence    text NOT NULL,   -- shown to a resident, in the record's words
  occurrences integer,         -- NULL where the artefact publishes no count
  PRIMARY KEY (extent_id, reason)
);

-- ---------------------------------------------------------------------------
-- Recorded flood incidents
-- ---------------------------------------------------------------------------

-- The finest grain the source publishes: one row per SA1 region per financial
-- year, all 13,339 of them.
--
-- **Nothing loads this yet, and the reason is worth writing down.** The
-- published artefact holds the thirty-area rollup, not the regions underneath
-- it -- the pipeline computes 13,339 and discards them at build time. Filling
-- this table means the pipeline emitting the full grain as a file the loader
-- can read, which in turn means re-fetching the VICSES and ABS sources: they
-- are downloaded per run and are not kept in the repository.
--
-- It is declared now because it is the table the population join needs, and
-- because the alternative -- inventing SA1 codes for thirty areas so that a
-- table looks populated -- would be fabricating the identifiers this whole
-- product refuses to fabricate.
CREATE TABLE IF NOT EXISTS flood_incident (
  sa1_code_2011   char(7) NOT NULL,
  financial_year  char(7) NOT NULL,
  incident_type   text NOT NULL,
  -- NULL means the publisher withheld it for privacy. It does not mean zero,
  -- and a schema that could not tell the two apart would produce a ranking
  -- that is quietly wrong: 144 of the 13,339 regions are withheld, and nine of
  -- the thirty published areas contain one, which is why those totals are
  -- shown as floors.
  count           integer,
  PRIMARY KEY (sa1_code_2011, financial_year, incident_type)
);

CREATE INDEX IF NOT EXISTS flood_incident_year_idx ON flood_incident (financial_year);

-- The published rollup: one row per named area per financial year, which is
-- exactly what flood-history.json carries and what the board reads.
--
-- It is a table rather than a view **for now**. When the pipeline emits the
-- SA1 grain, this becomes a view over flood_incident joined to sa1_region and
-- the two can no longer disagree; today it is loaded directly, because a view
-- over an empty table would serve an empty board.
CREATE TABLE IF NOT EXISTS flood_area (
  extent_scope        text NOT NULL,        -- 'Greater Melbourne'
  area_name           text NOT NULL,
  financial_year      char(7) NOT NULL,
  incident_type       text NOT NULL,
  count               integer NOT NULL,     -- the published rollup omits none
  PRIMARY KEY (extent_scope, area_name, financial_year, incident_type)
);

-- Per-area facts that do not vary by year, kept beside the counts rather than
-- recomputed.  is false where a region inside the area had its count
-- withheld, which makes the area total a floor rather than a figure.
CREATE TABLE IF NOT EXISTS flood_area_coverage (
  extent_scope        text NOT NULL,
  area_name           text NOT NULL,
  regions             integer NOT NULL,
  suppressed_regions  integer NOT NULL,
  complete            boolean NOT NULL,
  PRIMARY KEY (extent_scope, area_name)
);

CREATE TABLE IF NOT EXISTS sa1_region (
  sa1_code_2011    char(7) PRIMARY KEY,
  sa2_name         text NOT NULL,
  greater_capital  text NOT NULL
);

CREATE INDEX IF NOT EXISTS sa1_region_sa2_idx ON sa1_region (sa2_name);
CREATE INDEX IF NOT EXISTS sa1_region_capital_idx ON sa1_region (greater_capital);

-- ---------------------------------------------------------------------------
-- Population -- declared, and deliberately empty
-- ---------------------------------------------------------------------------

-- Nothing loads this yet. The dataset is not in the repository and has not
-- been reconciled against its own documentation or matched to ABS ASGS 2011,
-- which is the discipline every other source here went through. The table is
-- declared so the shape of the intended join is visible, and so that the
-- first person to load it has to decide the grain deliberately rather than
-- inventing one at 2 a.m.
--
-- See docs/DATABASE-DESIGN.md, "Open questions".
CREATE TABLE IF NOT EXISTS population (
  area_code   text NOT NULL,
  area_level  text NOT NULL CHECK (area_level IN ('SA1', 'SA2')),
  as_at       date NOT NULL,
  persons     integer NOT NULL CHECK (persons >= 0),
  dataset_id  text NOT NULL REFERENCES source(dataset_id),
  PRIMARY KEY (area_code, area_level, as_at)
);

INSERT INTO schema_migration (version) VALUES (1)
ON CONFLICT (version) DO NOTHING;

COMMIT;
