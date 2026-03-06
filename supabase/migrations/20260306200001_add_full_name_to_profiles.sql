/*
  # Add full_name column to profiles

  The profiles table is missing a full_name column that is referenced by 9+ files
  in the codebase (AdminDashboard, CommissionManagement, PricingForm, etc.).
  All usage sites already handle null values with email fallbacks.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
