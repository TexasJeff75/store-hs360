import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
  });
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('VITE_SUPABASE_URL must be a valid HTTPS URL (e.g., https://your-project.supabase.co)');
}

// Clean the URL by removing trailing slashes but preserve the base domain
const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');

if (!cleanSupabaseUrl.match(/^https:\/\/[a-z0-9-]+\.supabase\.co$/)) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('VITE_SUPABASE_URL must be in format: https://your-project-ref.supabase.co (without any paths)');
}

// Create Supabase client
export const supabase = createClient(cleanSupabaseUrl, supabaseAnonKey);

// Database types
export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export interface Profile {
  id: string;
  email: string;
  approved: boolean;
  approval_status: ApprovalStatus;
  role: 'admin' | 'distributor' | 'sales_rep' | 'customer' | null;
  can_view_secret_cost?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string;
  billing_address?: any;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address?: any;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserOrganizationRole {
  id: string;
  user_id: string;
  organization_id: string;
  location_id?: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractPricing {
  id: string;
  user_id: string;
  product_id: number;
  contract_price: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationPricing {
  id: string;
  organization_id: string;
  product_id: number;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  effective_date: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationPricing {
  id: string;
  location_id: string;
  product_id: number;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  effective_date: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}