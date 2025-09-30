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

export function useContractPricing(productId: number, regularPrice: number, quantity?: number): ContractPricingResult {
  const { user, profile } = useAuth();
  const [price, setPrice] = useState(regularPrice);
  const [source, setSource] = useState<'regular' | 'individual' | 'organization' | 'location'>('regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEffectivePrice = async () => {
      if (!user || !profile) {
        setPrice(regularPrice);
        setSource('regular');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const effectivePrice = await contractPricingService.getEffectivePrice(
          user.id,
          productId,
          profile?.role || 'pending',
          quantity
        );
        
        if (effectivePrice) {
          setPrice(effectivePrice.price);
          setSource(effectivePrice.source);
        } else {
          setPrice(regularPrice);
          setSource('regular');
        }
      } catch (err) {
        console.log('Pricing fetch failed (using regular price):', err instanceof Error ? err.message : 'Unknown error');
        // Don't set error state for pricing failures - just use regular price
        setPrice(regularPrice);
        setSource('regular');
      } finally {
        setLoading(false);
      }
    };

    fetchEffectivePrice();
  }, [user, profile, productId, regularPrice, quantity]);

  const savings = regularPrice - price;

  return {
    price,
    source,
    savings,
    loading,
    error
  };
}