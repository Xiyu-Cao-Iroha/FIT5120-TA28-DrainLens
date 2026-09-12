-- The flood tables held the board. They now hold the scope, and the board is
-- thirty rows of it.
--
-- `flood_area` and `flood_area_coverage` were loaded from `flood-history.json`,
-- which publishes the highest thirty areas. Epic 4's map has to draw all 281
-- in Greater Melbourne: a map of thirty implies the other 251 are empty, and
-- 245 of them are not.
--
-- **The thirty stay countable, because AC 2.2.1.b is a cap on what may be
-- shown and Iteration 1 recorded it as enforced in the data rather than in a
-- screen.** `board_rank` is that enforcement moved rather than abandoned:
-- exactly thirty rows carry one, the rest are NULL, and the API selects the
-- board by asking for the rows that have a rank. A `LIMIT 30` in a query would
-- have put the cap in one SQL clause instead, where a later edit could change
-- it without anything in the data disagreeing.
--
-- **`sa2_code` is the reason for all of this.** `population` is keyed by
-- `SA2_MAINCODE_2011` because it comes from a national dataset where a name is
-- not a key; these tables were keyed by name because the flood counts never
-- leave one Victorian file. With the two of them in one database and nothing
-- between them, the Severity Score could not be computed from rows at all --
-- which was recorded as an assertion in `load.test.ts` rather than left to be
-- discovered. This is that assertion's answer.
--
-- Nullable rather than NOT NULL: the column has to exist before the loader
-- that fills it runs, and a migration that rewrites rows is a migration that
-- can disagree with the artefact. The loader truncates and reloads.

BEGIN;

ALTER TABLE flood_area_coverage ADD COLUMN IF NOT EXISTS sa2_code char(9);
ALTER TABLE flood_area_coverage ADD COLUMN IF NOT EXISTS board_rank integer;

-- The join the Severity Score needs, in the direction it is made: given an
-- area, find its population.
CREATE INDEX IF NOT EXISTS flood_area_coverage_sa2_idx ON flood_area_coverage (sa2_code);

-- The board, which is read on every visit to the flood page and is thirty of
-- two hundred and eighty-one rows.
CREATE INDEX IF NOT EXISTS flood_area_coverage_board_idx ON flood_area_coverage (board_rank)
  WHERE board_rank IS NOT NULL;

INSERT INTO schema_migration (version) VALUES (4)
ON CONFLICT (version) DO NOTHING;

COMMIT;
