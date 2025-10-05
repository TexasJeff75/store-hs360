/*
  # Fix Security and Performance Issues

  This migration addresses critical security and performance issues identified in the database audit:

  ## 1. Add Missing Foreign Key Indexes
  - Add index on `contract_pricing.created_by`
  - Add index on `location_pricing.created_by`
  - Add index on `organization_pricing.created_by`

  ## 2. Optimize RLS Policies
  Replace `auth.uid()` with `(select auth.uid())` in all policies to prevent re-evaluation for each row.
  This significantly improves query performance at scale.

  ## 3. Fix Function Search Paths
  Add `SECURITY DEFINER` and explicit `search_path` to all functions to prevent search path manipulation attacks.

  ## 4. Consolidate Multiple Permissive Policies
  Combine multiple SELECT policies into single policies using OR conditions for better performance.

  ## Notes
  - Unused indexes are kept as they'll be used as the application grows
  - The "leaked password protection" warning is a Supabase Auth setting that must be enabled in the dashboard
  - Uses profiles.role = 'admin' for admin checks
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'contract_pricing' AND indexname = 'idx_contract_pricing_created_by'
  ) THEN
    CREATE INDEX idx_contract_pricing_created_by ON contract_pricing(created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'location_pricing' AND indexname = 'idx_location_pricing_created_by'
  ) THEN
    CREATE INDEX idx_location_pricing_created_by ON location_pricing(created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'organization_pricing' AND indexname = 'idx_organization_pricing_created_by'
  ) THEN
    CREATE INDEX idx_organization_pricing_created_by ON organization_pricing(created_by);
  END IF;
END $$;

-- ============================================================================
-- 2. DROP AND RECREATE ALL RLS POLICIES WITH OPTIMIZED PATTERNS
-- ============================================================================

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Allow profile creation during signup"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- ORGANIZATIONS TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can read organizations they belong to" ON organizations;

CREATE POLICY "Users can read organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = organizations.id
      AND user_organization_roles.user_id = (select auth.uid())
      AND user_organization_roles.role IN ('admin', 'member')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- LOCATIONS TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Admins can manage all locations" ON locations;
DROP POLICY IF EXISTS "Users can read locations in their organizations" ON locations;

CREATE POLICY "Users can read locations"
  ON locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = locations.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage locations"
  ON locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- USER_ORGANIZATION_ROLES TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Admins can manage all user organization roles" ON user_organization_roles;
DROP POLICY IF EXISTS "Users can read their own organization roles" ON user_organization_roles;

CREATE POLICY "Users can read organization roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage organization roles"
  ON user_organization_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ORGANIZATION_PRICING TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Admins can manage organization pricing" ON organization_pricing;
DROP POLICY IF EXISTS "Users can read pricing for their organizations" ON organization_pricing;

CREATE POLICY "Users can read organization pricing"
  ON organization_pricing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = organization_pricing.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage organization pricing"
  ON organization_pricing FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- LOCATION_PRICING TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Admins can manage location pricing" ON location_pricing;
DROP POLICY IF EXISTS "Users can read pricing for their locations" ON location_pricing;

CREATE POLICY "Users can read location pricing"
  ON location_pricing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      JOIN user_organization_roles ON user_organization_roles.organization_id = locations.organization_id
      WHERE locations.id = location_pricing.location_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage location pricing"
  ON location_pricing FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- CONTRACT_PRICING TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Users can read own individual pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can manage all contract pricing" ON contract_pricing;

CREATE POLICY "Users can read contract pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage contract pricing"
  ON contract_pricing FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ORDERS TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;
DROP POLICY IF EXISTS "Organization members can view organization orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

CREATE POLICY "Users can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organization_roles
        WHERE user_organization_roles.organization_id = orders.organization_id
        AND user_organization_roles.user_id = (select auth.uid())
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own pending orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- CHECKOUT_SESSIONS TABLE - Consolidate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Users can read own checkout sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "Users can create own checkout sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "Users can update own checkout sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "Admins can read all checkout sessions" ON checkout_sessions;

CREATE POLICY "Users can read checkout sessions"
  ON checkout_sessions FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create own checkout sessions"
  ON checkout_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own checkout sessions"
  ON checkout_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can manage checkout sessions"
  ON checkout_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Recreate update_checkout_session_updated_at with secure search_path
CREATE OR REPLACE FUNCTION update_checkout_session_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate handle_new_user with secure search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$;

-- Recreate update_updated_at_column with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate is_admin with secure search_path
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;
