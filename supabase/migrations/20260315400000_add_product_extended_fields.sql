-- Add extended_description and reference link fields to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS extended_description text,
  ADD COLUMN IF NOT EXISTS reference_1 text,
  ADD COLUMN IF NOT EXISTS reference_2 text,
  ADD COLUMN IF NOT EXISTS reference_3 text;
