import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ContractPricingInfo {
  organization_name: string;
  location_name?: string;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  pricing_type: 'individual' | 'organization' | 'location';
}

export function useContractPricing() {
  const { user, profile } = useAuth();
  const [contractPricingCounts, setContractPricingCounts] = useState<Record<number, number>>({});
  const [contractPricingDetails, setContractPricingDetails] = useState<ContractPricingInfo[]>([]);
  const [loadingPricingDetails, setLoadingPricingDetails] = useState(false);

  const fetchContractPricingCounts = async () => {
    if (!user || !profile) return;

    try {
      const counts: Record<number, number> = {};

      if (profile.role === 'admin') {
        const [individualRes, orgRes, locationRes] = await Promise.all([
          supabase.from('contract_pricing').select('product_id').not('user_id', 'is', null),
          supabase.from('organization_pricing').select('product_id'),
          supabase.from('location_pricing').select('product_id')
        ]);

        individualRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

        orgRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

        locationRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

      } else if (profile.role === 'sales_rep') {
        const { data: userOrgs } = await supabase
          .from('user_organization_roles')
          .select('organization_id')
          .eq('user_id', user.id);

        if (userOrgs && userOrgs.length > 0) {
          const orgIds = userOrgs.map(o => o.organization_id);

          const { data: orgPricing } = await supabase
            .from('organization_pricing')
            .select('product_id')
            .in('organization_id', orgIds);

          orgPricing?.forEach(item => {
            counts[item.product_id] = (counts[item.product_id] || 0) + 1;
          });

          const { data: locations } = await supabase
            .from('locations')
            .select('id')
            .in('organization_id', orgIds);

          if (locations && locations.length > 0) {
            const locationIds = locations.map(l => l.id);
            const { data: locationPricing } = await supabase
              .from('location_pricing')
              .select('product_id')
              .in('location_id', locationIds);

            locationPricing?.forEach(item => {
              counts[item.product_id] = (counts[item.product_id] || 0) + 1;
            });
          }
        }
      } else if (profile.role === 'customer') {
        const { data } = await supabase
          .from('contract_pricing')
          .select('product_id')
          .eq('user_id', user.id);

        data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });
      }

      setContractPricingCounts(counts);
    } catch (err) {
      console.error('Error fetching contract pricing counts:', err);
    }
  };

  const fetchContractPricingDetails = async (productId: number) => {
    if (!user || !profile) return;

    setLoadingPricingDetails(true);
    try {
      const allPricing: ContractPricingInfo[] = [];

      if (profile.role === 'admin') {
        const [individualRes, orgRes, locationRes] = await Promise.all([
          supabase
            .from('contract_pricing')
            .select(`
              contract_price,
              min_quantity,
              max_quantity,
              profiles!inner(full_name)
            `)
            .eq('product_id', productId)
            .not('user_id', 'is', null),
          supabase
            .from('organization_pricing')
            .select(`
              contract_price,
              min_quantity,
              max_quantity,
              organizations!inner(name)
            `)
            .eq('product_id', productId),
          supabase
            .from('location_pricing')
            .select(`
              contract_price,
              min_quantity,
              max_quantity,
              locations!inner(name, organization_id, organizations!inner(name))
            `)
            .eq('product_id', productId)
        ]);

        individualRes.data?.forEach((item: any) => {
          allPricing.push({
            organization_name: item.profiles.full_name,
            contract_price: item.contract_price,
            min_quantity: item.min_quantity,
            max_quantity: item.max_quantity,
            pricing_type: 'individual'
          });
        });

        orgRes.data?.forEach((item: any) => {
          allPricing.push({
            organization_name: item.organizations.name,
            contract_price: item.contract_price,
            min_quantity: item.min_quantity,
            max_quantity: item.max_quantity,
            pricing_type: 'organization'
          });
        });

        locationRes.data?.forEach((item: any) => {
          allPricing.push({
            organization_name: item.locations.organizations.name,
            location_name: item.locations.name,
            contract_price: item.contract_price,
            min_quantity: item.min_quantity,
            max_quantity: item.max_quantity,
            pricing_type: 'location'
          });
        });
      }

      setContractPricingDetails(allPricing);
    } catch (err) {
      console.error('Error fetching contract pricing details:', err);
    } finally {
      setLoadingPricingDetails(false);
    }
  };

  useEffect(() => {
    fetchContractPricingCounts();
  }, [user, profile]);

  return {
    contractPricingCounts,
    contractPricingDetails,
    loadingPricingDetails,
    fetchContractPricingDetails,
  };
}
