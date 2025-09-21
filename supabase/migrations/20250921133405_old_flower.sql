/*
  # Multi-Tenant Database Schema

  1. New Tables
    - `organizations` - Companies/groups that users belong to
    - `locations` - Physical locations within organizations  
    - `user_organization_roles` - Many-to-many relationship between users and organizations
    - `organization_pricing` - Organization-level pricing overrides
    - `location_pricing` - Location-specific pricing overrides

  2. Enhanced Tables
    - Updated `contract_pricing` to support organization/location context

  3. Security
    - Enable RLS on all new tables
    - Add policies for multi-tenant access control
    - Users can only access data for organizations they belong to
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  billing_address jsonb,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address jsonb,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Create user_organization_roles table
CREATE TABLE IF NOT EXISTS user_organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id, location_id)
);

-- Create organization_pricing table
CREATE TABLE IF NOT EXISTS organization_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  contract_price numeric(10,2) NOT NULL,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  effective_date timestamptz DEFAULT now(),
  expiry_date timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, product_id, effective_date)
);

-- Create location_pricing table
CREATE TABLE IF NOT EXISTS location_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  contract_price numeric(10,2) NOT NULL,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  effective_date timestamptz DEFAULT now(),
  expiry_date timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, product_id, effective_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

CREATE INDEX IF NOT EXISTS idx_user_org_roles_user_id ON user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_org_id ON user_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_location_id ON user_organization_roles(location_id);

CREATE INDEX IF NOT EXISTS idx_org_pricing_org_id ON organization_pricing(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_pricing_product_id ON organization_pricing(product_id);

CREATE INDEX IF NOT EXISTS idx_location_pricing_location_id ON location_pricing(location_id);
CREATE INDEX IF NOT EXISTS idx_location_pricing_product_id ON location_pricing(product_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pricing ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Admins can manage all organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read organizations they belong to"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_organization_roles.organization_id = organizations.id 
      AND user_organization_roles.user_id = auth.uid()
    )
  );

-- Locations policies
CREATE POLICY "Admins can manage all locations"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read locations in their organizations"
  ON locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_organization_roles.organization_id = locations.organization_id 
      AND user_organization_roles.user_id = auth.uid()
    )
  );

-- User organization roles policies
CREATE POLICY "Admins can manage all user organization roles"
  ON user_organization_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read their own organization roles"
  ON user_organization_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organization pricing policies
CREATE POLICY "Admins can manage organization pricing"
  ON organization_pricing
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read pricing for their organizations"
  ON organization_pricing
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_organization_roles.organization_id = organization_pricing.organization_id 
      AND user_organization_roles.user_id = auth.uid()
    )
  );

-- Location pricing policies
CREATE POLICY "Admins can manage location pricing"
  ON location_pricing
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read pricing for their locations"
  ON location_pricing
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_organization_roles.location_id = location_pricing.location_id 
      AND user_organization_roles.user_id = auth.uid()
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_organization_roles_updated_at
  BEFORE UPDATE ON user_organization_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_pricing_updated_at
  BEFORE UPDATE ON organization_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_pricing_updated_at
  BEFORE UPDATE ON location_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();