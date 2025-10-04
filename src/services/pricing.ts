import { supabase } from '../lib/supabase';

interface ContractPrice {
  id: string;
  user_id: string;
  product_id: number;
  contract_price: number;
  pricing_type: string;
  entity_id?: string;
  min_quantity?: number;
  max_quantity?: number;
  effective_date?: string;
  expiry_date?: string;
}

interface OrganizationPrice {
  id: string;
  organization_id: string;
  product_id: number;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  effective_date?: string;
  expiry_date?: string;
}

export async function getContractPrice(userId: string, productId: number, quantity: number = 1) {
  const { data, error } = await supabase
    .from('contract_pricing')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .lte('min_quantity', quantity)
    .or(`max_quantity.gte.${quantity},max_quantity.is.null`)
    .lte('effective_date', new Date().toISOString())
    .or(`expiry_date.gte.${new Date().toISOString()},expiry_date.is.null`)
    .order('contract_price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ContractPrice | null;
}

export async function getOrganizationPrice(organizationId: string, productId: number, quantity: number = 1) {
  const { data, error } = await supabase
    .from('organization_pricing')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .lte('min_quantity', quantity)
    .or(`max_quantity.gte.${quantity},max_quantity.is.null`)
    .lte('effective_date', new Date().toISOString())
    .or(`expiry_date.gte.${new Date().toISOString()},expiry_date.is.null`)
    .order('contract_price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as OrganizationPrice | null;
}

export async function getUserOrganizations(userId: string) {
  const { data, error } = await supabase
    .from('user_organization_roles')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return data;
}

export async function getBestPrice(userId: string, productId: number, quantity: number = 1, standardPrice: number) {
  const userOrgs = await getUserOrganizations(userId);

  let bestPrice = standardPrice;
  let priceSource = 'standard';

  const contractPrice = await getContractPrice(userId, productId, quantity);
  if (contractPrice && contractPrice.contract_price < bestPrice) {
    bestPrice = contractPrice.contract_price;
    priceSource = 'contract';
  }

  for (const userOrg of userOrgs || []) {
    if (userOrg.organization) {
      const orgPrice = await getOrganizationPrice(userOrg.organization.id, productId, quantity);
      if (orgPrice && orgPrice.contract_price < bestPrice) {
        bestPrice = orgPrice.contract_price;
        priceSource = 'organization';
      }
    }
  }

  return { price: bestPrice, source: priceSource };
}
