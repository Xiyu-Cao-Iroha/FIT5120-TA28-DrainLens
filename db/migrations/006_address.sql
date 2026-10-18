-- The address index, which until 9 October only ever existed in a browser.
--
-- **This table is the one the privacy argument was written against, so it
-- carries the decision rather than leaving it to a commit message.** Every
-- earlier version of this schema deliberately had no addresses in it, and
-- `docs/DATABASE-DESIGN.md` had a section called *The line that does not move*
-- explaining why. The line moved: the team decided on 9 October that the
-- address search would be served, and that the two sentences on screen
-- promising it never left the device would be withdrawn in the same change
-- rather than quietly left to go stale.
--
-- What did not change is AD1, because AD1 is about what is *held*. Nothing
-- here is a resident: these are 62,397 published council addresses, the same
-- list the site already shipped to every visitor as a 1.3 MB file. The row a
-- resident picks is not recorded, the query they typed is not logged -- the
-- `run.googleapis.com/requests` log is excluded at the sink, before entries
-- are written -- and the search route is answered with `no-store` and no memo
-- key, so it is not held in the process either.
--
-- **The index stays bundled as well.** This is the same arrangement the other
-- four artefacts have: the API answers when the database is up, the container
-- copy answers when it is not, and the footer says which. For the address
-- search that is not a nicety -- it is step one of everything else the product
-- does, and a cold database during the showcase would otherwise take the whole
-- product down with it.
BEGIN;

-- One published address.
--
-- **`number` is text and that is not an oversight.** The council publishes
-- `12A`, `1/46` and `U 3 220`; an integer column would have to either reject
-- them or round them into somebody else's front door. It is also never
-- arithmetic here: the matcher compares it to a typed word.
--
-- `at_pos` is the address's position in its street's *published* group,
-- counted before anything was left out. `address-catchments.json` is keyed by
-- street and position, and the Kensington fallback drops the addresses outside
-- the smaller map -- so a position counted in what survives would hand every
-- address after the first gap somebody else's drainage area. Stored, not
-- derived from row order, for exactly that reason.
CREATE TABLE IF NOT EXISTS address (
  -- `idOf(area, label)` in `packages/address`: "city-of-melbourne/46-gatehouse-drive-kensington".
  -- One definition, because the ground trend published per address is keyed by
  -- the same string and `pipeline/address_ground.py` builds it the same way.
  id          text PRIMARY KEY,
  extent_id   text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  label       text NOT NULL,
  number      text NOT NULL,
  street      text NOT NULL,
  -- Empty rather than NULL when the published record has no suburb: `labelOf`
  -- already treats '' as "no suburb part" and a NULL here would be a second
  -- way to say the same thing, which is how two code paths start disagreeing.
  suburb      text NOT NULL,
  e_m         double precision NOT NULL,
  n_m         double precision NOT NULL,
  at_pos      integer NOT NULL,
  -- `normalise()` from `packages/address`, applied at load time.
  --
  -- **Precomputed because the API must rank exactly as the browser does.** The
  -- alternative -- an ILIKE over `label` with SQL's own idea of case and
  -- punctuation -- would quietly admit a different candidate set than
  -- `scoreOne` scores, and the two paths a resident can meet in one session
  -- would answer differently. This column is the matcher's own input, stored.
  label_norm  text NOT NULL,
  dataset_id  text NOT NULL REFERENCES source(dataset_id)
);

CREATE INDEX IF NOT EXISTS address_extent_idx ON address (extent_id);

-- **No trigram index, and the reason is measured rather than assumed.** The
-- search prefilter is `label_norm LIKE '%word%'`, which no btree can serve, so
-- the planner reads the table. At 62,397 short rows that is the cheapest scan
-- in this database and it needs no extension -- `CREATE EXTENSION pg_trgm`
-- wants a privilege the `drainlens` role does not have, and asking for it to
-- speed up a query nobody has shown to be slow is the wrong order.

-- Every street the pilot publishes, which is more than the streets its
-- addresses mention.
--
-- **That gap is the whole reason this is its own table.** AC 1.1.8 needs *that
-- address is real and outside the covered part* kept apart from *we have no
-- record of that street*, and the signal is whether the street is published.
-- Deriving the list from `address.street` instead says "no record of that
-- street" about every street whose addresses all fell outside the extent --
-- 129 of them when the index was a stand-in -- which is the wrong sentence to
-- a resident who lives on one.
CREATE TABLE IF NOT EXISTS address_street (
  extent_id  text NOT NULL REFERENCES extent(id) ON DELETE CASCADE,
  name       text NOT NULL,
  PRIMARY KEY (extent_id, name)
);

INSERT INTO schema_migration (version) VALUES (6)
ON CONFLICT (version) DO NOTHING;

COMMIT;
