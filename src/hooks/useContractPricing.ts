import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contractPricingService } from '../services/contractPricing';

interface PriceInfo {
  price: number;
  isContractPrice: boolean;
  savings?: number;
  loading: boolean;
}

export const useContractPricing = (productId: number, regularPrice: number): PriceInfo => {
  const { user, profile } = useAuth();
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({
    price: regularPrice,
    isContractPrice: false,
    loading: true
  });

  useEffect(() => {
    const fetchEffectivePrice = async () => {
      setPriceInfo(prev => ({ ...prev, loading: true }));

      try {
        const result = await contractPricingService.getEffectivePrice(
          user?.id || null,
          productId,
          regularPrice,
          profile?.role
        );

        setPriceInfo({
          ...result,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching effective price:', error);
        setPriceInfo({
          price: regularPrice,
          isContractPrice: false,
          loading: false
        });
      }
    };

    fetchEffectivePrice();
  }, [user?.id, profile?.role, productId, regularPrice]);

  return priceInfo;
};