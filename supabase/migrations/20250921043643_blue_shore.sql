/*
  # Multi-Tenant Structure with Organizations and Locations

  1. New Tables
    - `organizations` - Companies/groups that users belong to
    - `locations` - Physical locations within organizations
    - `user_organization_roles` - Many-to-many relationship between users and organizations
    - `location_pricing` - Location-specific pricing overrides
    - `organization_pricing` - Organization-level pricing

  2. Updated Tables
    - Enhanced contract_pricing to support organization/location context

  3. Security
    - Enable RLS on all new tables
    - Add policies for multi-tenant access control
*/

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL, -- Short code for organization (e.g., "ACME", "HEALTH1")
  description text,
  billing_address jsonb, -- Store billing address as JSON
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL, -- Short code for location (e.g., "NYC", "LA", "CHI")
  address jsonb, -- Store full address as JSON
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- User-Organization-Role relationships (many-to-many)
CREATE TABLE IF NOT EXISTS user_organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE, -- Optional: user can be assigned to specific location
  role text NOT NULL DEFAULT 'member', -- 'admin', 'manager', 'member', 'viewer'
  is_primary boolean DEFAULT false, -- One primary org per user
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id, location_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'member', 'viewer'))
);

-- Organization-level pricing
CREATE TABLE IF NOT EXISTS organization_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  contract_price numeric(10,2) NOT NULL,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  effective_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, product_id, effective_date)
);

-- Location-specific pricing (overrides organization pricing)
CREATE TABLE IF NOT EXISTS location_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  contract_price numeric(10,2) NOT NULL,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  effective_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, product_id, effective_date)
);

-- Add organization context to existing contract_pricing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN location_id uuid REFERENCES locations(id);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_user ON user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_org ON user_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_location ON user_organization_roles(location_id);
CREATE INDEX IF NOT EXISTS idx_org_pricing_org_product ON organization_pricing(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_location_pricing_location_product ON location_pricing(location_id, product_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "System admins can manage all organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Locations
CREATE POLICY "System admins can manage all locations"
  ON locations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their organization locations"
  ON locations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for User Organization Roles
CREATE POLICY "System admins can manage all user org roles"
  ON user_organization_roles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their own org roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage their org users"
  ON user_organization_roles FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Organization Pricing
CREATE POLICY "System admins can manage all org pricing"
  ON organization_pricing FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their org pricing"
  ON organization_pricing FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Location Pricing
CREATE POLICY "System admins can manage all location pricing"
  ON location_pricing FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their location pricing"
  ON location_pricing FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT l.id 
      FROM locations l
      JOIN user_organization_roles uor ON l.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

-- Update triggers
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_organization_roles_updated_at
  BEFORE UPDATE ON user_organization_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_pricing_updated_at
  BEFORE UPDATE ON organization_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_pricing_updated_at
  BEFORE UPDATE ON location_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO organizations (name, code, description, contact_email) VALUES
  ('HealthSpan360 Corporate', 'HS360', 'Main corporate organization', 'admin@hs360.com'),
  ('Wellness Partners Group', 'WPG', 'Partner organization for wellness centers', 'contact@wellnesspartners.com'),
  ('Medical Associates Network', 'MAN', 'Network of medical practices', 'info@medassociates.com')
ON CONFLICT (code) DO NOTHING;

-- Insert sample locations
INSERT INTO locations (organization_id, name, code, contact_email)
SELECT 
  o.id,
  'New York Office',
  'NYC',
  'nyc@hs360.com'
FROM organizations o WHERE o.code = 'HS360'
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO locations (organization_id, name, code, contact_email)
SELECT 
  o.id,
  'Los Angeles Office',
  'LAX',
  'la@hs360.com'
FROM organizations o WHERE o.code = 'HS360'
ON CONFLICT (organization_id, code) DO NOTHING;

-- Assign admin user to main organization
INSERT INTO user_organization_roles (user_id, organization_id, role, is_primary)
SELECT 
  p.id,
  o.id,
  'admin',
  true
FROM profiles p, organizations o
WHERE p.email = 'jeff.lutz@hs360.co' AND o.code = 'HS360'
ON CONFLICT (user_id, organization_id, location_id) DO NOTHING;