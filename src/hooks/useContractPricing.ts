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

          // Filter pricing entries for this product
          const productPricingTiers = orgPricing.filter(p => p.product_id === productId);

          // Find the best matching tier for the quantity
          let bestTier = null;
          const currentQuantity = quantity || 1;

          for (const tier of productPricingTiers) {
            const minQty = tier.min_quantity || 1;
            const maxQty = tier.max_quantity || Infinity;

            if (currentQuantity >= minQty && currentQuantity <= maxQty) {
              // This tier matches the quantity range
              if (!bestTier || minQty > (bestTier.min_quantity || 1)) {
                // Use the tier with the highest min_quantity that still matches
                bestTier = tier;
              }
            }
          }

          if (bestTier) {
            // Use markup_price if available, otherwise contract_price, otherwise null
            const finalPrice = bestTier.markup_price || bestTier.contract_price;

            if (finalPrice !== null && finalPrice !== undefined) {
              effectivePrice = {
                price: finalPrice,
                source: 'organization' as const
              };
            }
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