-- `pipe.ref` was a primary key because of the sample, not because of the data.
--
-- Every one of Kensington's 893 pipes carries a reference number and every one
-- is unique, so `ref bigint PRIMARY KEY` looked like a fact about the dataset.
-- It is a fact about one square kilometre. Across the council's 17,242 pipes:
--
--   * **85 carry no `ref` at all.** They carry no `upstr_pit` and no
--     `dnstr_pit` either -- one is 1.3 m of line with `material: "Unknown"`.
--     They are geometry the council recorded and identified with nothing.
--   * **one `ref` is used twice.** Two pipes claiming one reference is a
--     defect in the export, and it is the export's defect to have.
--
-- This is the same mistake the schema already argues against one column over.
-- `upstr_pit` and `dnstr_pit` are deliberately not foreign keys, because "a
-- constraint here would reject sixty-nine rows the council record actually
-- contains -- the database editing the record rather than storing it". A
-- primary key on `ref` rejects eighty-six more for the same reason.
--
-- So `pipe` gets a surrogate key, which is what `road` and `street_label` have
-- had since the first schema for exactly this reason: they are geometry the
-- council publishes without a stable identifier of its own. `ref` stays as a
-- nullable, non-unique column -- it is what the council calls the pipe when it
-- calls it anything, and the trace still joins on the pits rather than on it.

BEGIN;

ALTER TABLE pipe DROP CONSTRAINT pipe_pkey;
ALTER TABLE pipe ADD COLUMN id bigserial PRIMARY KEY;
ALTER TABLE pipe ALTER COLUMN ref DROP NOT NULL;

-- Still worth finding a pipe by the number the council gives it, and still
-- worth finding one by where it starts. Neither is unique now, and the index
-- says so by not claiming to be.
CREATE INDEX IF NOT EXISTS pipe_ref_idx ON pipe (ref);

INSERT INTO schema_migration (version) VALUES (3)
ON CONFLICT (version) DO NOTHING;

COMMIT;
