/*
  # Create User Favorites Table

  ## Overview
  Creates a table to store user favorite products with proper security and performance optimizations.

  ## New Tables
    - `favorites`
      - `id` (uuid, primary key) - Unique identifier for the favorite
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `product_id` (integer) - ID of the favorited product
      - `created_at` (timestamptz) - When the favorite was added
      - Unique constraint on (user_id, product_id) to prevent duplicates

  ## Security
    - Enable RLS on `favorites` table
    - Policy: Users can view their own favorites
    - Policy: Users can add their own favorites
    - Policy: Users can remove their own favorites

  ## Performance
    - Index on user_id for fast user-specific queries
    - Index on product_id for analytics
    - Composite unique index on (user_id, product_id) for constraint and fast lookups
*/

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_product UNIQUE (user_id, product_id)
);

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);

-- RLS Policies
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorites"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
