-- Remove the DEFAULT 45.00 from distributors.commission_rate
-- Commission rates must always be explicitly set per CLAUDE.md conventions.
-- Also make the column nullable so distributors can be created without a rate.

ALTER TABLE distributors
  ALTER COLUMN commission_rate DROP DEFAULT,
  ALTER COLUMN commission_rate DROP NOT NULL;
