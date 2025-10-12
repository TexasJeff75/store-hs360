import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contractPricingService } from '../services/contractPricing';

interface ContractPricingResult {
  price: number;
  source: 'regular' | 'individual' | 'organization' | 'location';
  savings: number;
  loading: boolean;
  error: string | null;
}

// Cache for pricing data to prevent flickering
const pricingCache = new Map<string, { price: number; source: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useContractPricing(productId: number, regularPrice: number, quantity?: number, organizationId?: string): ContractPricingResult {
  const { user, profile } = useAuth();
  // regularPrice from BigCommerce is already the retail price, no markup needed
  const defaultRetailPrice = regularPrice;
  const [price, setPrice] = useState(defaultRetailPrice);
  const [source, setSource] = useState<'regular' | 'individual' | 'organization' | 'location'>('regular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchEffectivePrice = async () => {
      // For sales rep mode, use organization pricing even without user profile
      if (!user || (!profile && !organizationId)) {
        if (isMounted.current) {
          setPrice(defaultRetailPrice);
          setSource('regular');
          setLoading(false);
        }
        return;
      }

      // Create cache key
      const cacheKey = `${productId}-${organizationId || user.id}-${quantity || 1}`;
      const cached = pricingCache.get(cacheKey);

      // Use cached data if available and not expired
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        if (isMounted.current) {
          setPrice(cached.price);
          setSource(cached.source as any);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted.current) {
          setError(null);
        }
        
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
          // Cache the result
          pricingCache.set(cacheKey, {
            price: effectivePrice.price,
            source: effectivePrice.source,
            timestamp: Date.now()
          });

          if (isMounted.current) {
            setPrice(effectivePrice.price);
            setSource(effectivePrice.source);
          }
        } else {
          // Cache the default retail price result
          pricingCache.set(cacheKey, {
            price: defaultRetailPrice,
            source: 'regular',
            timestamp: Date.now()
          });

          if (isMounted.current) {
            setPrice(defaultRetailPrice);
            setSource('regular');
          }
        }
      } catch (err) {
        console.error('Error fetching effective price:', err);
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch pricing');
          setPrice(defaultRetailPrice);
          setSource('regular');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchEffectivePrice();
  }, [user, profile, productId, regularPrice, quantity, organizationId, defaultRetailPrice]);

  const savings = defaultRetailPrice - price;

  return {
    price,
    source,
    savings,
    loading,
    error
  };
}