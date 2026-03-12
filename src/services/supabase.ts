import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error(`Invalid Supabase URL format: must start with https://`);
}

const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');

export const supabase = createClient(cleanSupabaseUrl, supabaseAnonKey);

// Lazy singleton for signup operations that shouldn't replace the current user's session
let _signUpClient: ReturnType<typeof createClient> | null = null;

export function getSignUpClient() {
  if (!_signUpClient) {
    _signUpClient = createClient(cleanSupabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return _signUpClient;
}

// Database types
type ApprovalStatus = 'pending' | 'approved' | 'denied';

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
  contact_name?: string;
  description?: string;
  billing_address?: any;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_active: boolean;
  org_type?: 'customer' | 'distributor';
  is_house_account?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserOrganizationRole {
  id: string;
  user_id: string;
  organization_id: string;
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

interface OrganizationPricing {
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

interface LocationPricing {
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