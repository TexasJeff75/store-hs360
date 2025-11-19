/*
  # Create Product Secret Costs Table

  ## Overview
  Creates the product_secret_costs table for storing confidential product acquisition costs.

  ## New Tables
  - `product_secret_costs`
    - `id` (uuid, primary key)
    - `product_id` (integer, unique) - Links to BigCommerce product
    - `secret_cost` (numeric) - Confidential acquisition cost
    - `notes` (text) - Optional notes about the cost
    - `created_by` (uuid) - User who created the entry
    - `updated_by` (uuid) - User who last updated the entry
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - Row Level Security enabled
  - Only cost admins can view/edit secret costs
  - All access is logged

  ## Indexes
  - Fast lookups on product_id
  - Timestamp index for recent updates
*/

-- Create product_secret_costs table
CREATE TABLE IF NOT EXISTS public.product_secret_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer NOT NULL,
  secret_cost numeric(10,2) NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on product_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_secret_costs_product_id_key'
  ) THEN
    ALTER TABLE public.product_secret_costs 
    ADD CONSTRAINT product_secret_costs_product_id_key UNIQUE(product_id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_secret_costs_product_id 
  ON public.product_secret_costs(product_id);

CREATE INDEX IF NOT EXISTS idx_product_secret_costs_updated 
  ON public.product_secret_costs(updated_at DESC);

-- Enable RLS
ALTER TABLE public.product_secret_costs ENABLE ROW LEVEL SECURITY;

-- Create or replace is_cost_admin function
CREATE OR REPLACE FUNCTION public.is_cost_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND can_view_secret_cost = true
  );
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Cost admins can view all secret costs" ON public.product_secret_costs;
DROP POLICY IF EXISTS "Cost admins can insert secret costs" ON public.product_secret_costs;
DROP POLICY IF EXISTS "Cost admins can update secret costs" ON public.product_secret_costs;
DROP POLICY IF EXISTS "Cost admins can delete secret costs" ON public.product_secret_costs;

-- Create RLS Policies
CREATE POLICY "Cost admins can view all secret costs"
  ON public.product_secret_costs
  FOR SELECT
  TO authenticated
  USING (public.is_cost_admin());

CREATE POLICY "Cost admins can insert secret costs"
  ON public.product_secret_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_cost_admin());

CREATE POLICY "Cost admins can update secret costs"
  ON public.product_secret_costs
  FOR UPDATE
  TO authenticated
  USING (public.is_cost_admin())
  WITH CHECK (public.is_cost_admin());

CREATE POLICY "Cost admins can delete secret costs"
  ON public.product_secret_costs
  FOR DELETE
  TO authenticated
  USING (public.is_cost_admin());

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_product_secret_costs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_product_secret_costs_updated_at ON public.product_secret_costs;

CREATE TRIGGER update_product_secret_costs_updated_at
  BEFORE UPDATE ON public.product_secret_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_secret_costs_timestamp();

-- Add helpful comments
COMMENT ON TABLE public.product_secret_costs IS 'Confidential product acquisition costs visible only to cost admins';
