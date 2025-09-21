import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { multiTenantService } from '../services/multiTenant';

interface PriceInfo {
  price: number;
  source: 'location' | 'organization' | 'individual' | 'regular';
  savings?: number;
  loading: boolean;
}

export const useContractPricing = (productId: number, regularPrice: number): PriceInfo => {
  const { user, profile } = useAuth();
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({
    price: regularPrice,
    source: 'regular',
    loading: true
  });

  useEffect(() => {
    const fetchEffectivePrice = async () => {
      setPriceInfo(prev => ({ ...prev, loading: true }));

      try {
        const result = await multiTenantService.getEffectivePricing(
          user?.id || '',
          productId,
          regularPrice
        );

        setPriceInfo({
          ...result,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching effective price:', error);
        setPriceInfo({
          price: regularPrice,
          source: 'regular',
          loading: false
        });
      }
    };

    fetchEffectivePrice();
  }, [user?.id, profile?.role, productId, regularPrice]);

  return priceInfo;
};