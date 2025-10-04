import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contractPricingService } from '../services/contractPricing';

interface ContractPricingResult {
  price: number;
  source: 'regular' | 'individual' | 'organization' | 'location';
  savings: number;
  loading: boolean;
  error: string | null;
}

export function useContractPricing(productId: number, regularPrice: number, quantity?: number, organizationId?: string): ContractPricingResult {
  const { user, profile } = useAuth();
  const [price, setPrice] = useState(regularPrice);
  const [source, setSource] = useState<'regular' | 'individual' | 'organization' | 'location'>('regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEffectivePrice = async () => {
      // For sales rep mode, use organization pricing even without user profile
      if (!user || (!profile && !organizationId)) {
        setPrice(regularPrice);
        setSource('regular');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        let effectivePrice;
        
        if (organizationId) {
          // Sales rep mode - get organization pricing directly
          const orgPricing = await contractPricingService.getOrganizationPricing(organizationId);
          const productPricing = orgPricing.find(p => p.product_id === productId);
          
          if (productPricing && 
              (!quantity || (quantity >= (productPricing.min_quantity || 1) && 
               (!productPricing.max_quantity || quantity <= productPricing.max_quantity)))) {
            effectivePrice = {
              price: productPricing.contract_price,
              source: 'organization' as const
            };
          }
        } else {
          // Regular user mode
          effectivePrice = await contractPricingService.getEffectivePrice(
            user.id,
            productId,
            profile?.role || 'pending',
            quantity
          );
        }
        
        if (effectivePrice) {
          setPrice(effectivePrice.price);
          setSource(effectivePrice.source);
        } else {
          setPrice(regularPrice);
          setSource('regular');
        }
      } catch (err) {
        console.error('Error fetching effective price:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pricing');
        setPrice(regularPrice);
        setSource('regular');
      } finally {
        setLoading(false);
      }
    };

    fetchEffectivePrice();
  }, [user, profile, productId, regularPrice, quantity, organizationId]);

  const savings = regularPrice - price;

  return {
    price,
    source,
    savings,
    loading,
    error
  };
}