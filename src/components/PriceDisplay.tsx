import React from 'react';
import { Tag, Loader2 } from 'lucide-react';
import { useContractPricing } from '../hooks/useContractPricing';
import { useAuth } from '../contexts/AuthContext';

interface PriceDisplayProps {
  productId: number;
  regularPrice: number;
  originalPrice?: number;
  className?: string;
  showSavings?: boolean;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  productId,
  regularPrice,
  originalPrice,
  className = '',
  showSavings = true
}) => {
  const { user, profile } = useAuth();
  const { price, isContractPrice, savings, loading } = useContractPricing(productId, regularPrice);

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-gray-500">Loading price...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <span className="text-lg font-bold text-gray-900">${price.toFixed(2)}</span>
        
        {/* Contract Price Badge */}
        {isContractPrice && (
          <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            <Tag className="h-3 w-3" />
            <span>Contract Price</span>
          </div>
        )}
        
        {/* Original/Regular Price Strikethrough */}
        {(originalPrice || isContractPrice) && (
          <span className="text-sm text-gray-500 line-through">
            ${(originalPrice || regularPrice).toFixed(2)}
          </span>
        )}
      </div>

      {/* Savings Display */}
      {showSavings && savings && savings > 0 && (
        <div className="text-sm text-green-600 font-medium">
          Save ${savings.toFixed(2)}
        </div>
      )}

      {/* Login Prompt for Better Pricing */}
      {!user && (
        <div className="text-xs text-blue-600">
          Sign in for contract pricing
        </div>
      )}

      {/* Approval Pending Message */}
      {user && profile?.role === 'pending' && (
        <div className="text-xs text-yellow-600">
          Account approval pending for contract pricing
        </div>
      )}
    </div>
  );
};

export default PriceDisplay;