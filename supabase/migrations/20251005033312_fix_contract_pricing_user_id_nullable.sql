/*
  # Fix contract_pricing user_id constraint

  1. Problem
    - The `user_id` column is NOT NULL but shouldn't be required for organization/location pricing
    - The unified pricing model uses `entity_id` with `pricing_type` to handle all pricing types
    - `user_id` is a legacy column that should be nullable

  2. Changes
    - Make `user_id` column nullable since it's no longer the primary identifier
    - `entity_id` + `pricing_type` now determine the relationship
    - For individual pricing: entity_id = user_id
    - For organization pricing: entity_id = organization_id
    - For location pricing: entity_id = location_id

  3. Data Integrity
    - This change is safe because entity_id is now used for all lookups
    - Existing data will not be affected
    - RLS policies use entity_id and pricing_type, not user_id
*/

-- Make user_id nullable
ALTER TABLE contract_pricing 
ALTER COLUMN user_id DROP NOT NULL;

-- Update the comment to clarify its legacy status
COMMENT ON COLUMN contract_pricing.user_id IS 'DEPRECATED: Legacy column for backwards compatibility. Use entity_id with pricing_type=individual instead.';