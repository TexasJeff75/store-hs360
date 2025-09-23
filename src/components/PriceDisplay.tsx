import React from 'react';
import { Tag, Loader2, Building2, MapPin, User } from 'lucide-react';
import { useContractPricing } from '../hooks/useContractPricing';
import { useAuth } from '../contexts/AuthContext';

interface PriceDisplayProps {
  productId: number;
  regularPrice: number;
  originalPrice?: number;
  className?: string;
  showSavings?: boolean;
  quantity?: number;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  productId,
  regularPrice,
  originalPrice,
  className = '',
  showSavings = true,
  quantity
}) => {
  const { user, profile } = useAuth();
  const { price, source, savings, loading } = useContractPricing(productId, regularPrice, quantity);

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-gray-500">Loading price...</span>
      </div>
    );
  }

  const isContractPrice = source !== 'regular';
  
  const getSourceIcon = () => {
    switch (source) {
      case 'location': return <MapPin className="h-3 w-3" />;
      case 'organization': return <Building2 className="h-3 w-3" />;
      case 'individual': return <User className="h-3 w-3" />;
      default: return <Tag className="h-3 w-3" />;
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'location': return 'Location Price';
      case 'organization': return 'Organization Price';
      case 'individual': return 'Contract Price';
      default: return 'Contract Price';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <span className="text-lg font-bold text-gray-900">${price.toFixed(2)}</span>
        
        {/* Contract Price Badge */}
        {isContractPrice && (
          <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            {getSourceIcon()}
            <span>
              {getSourceLabel()}
              {quantity && quantity > 1 && ` (${quantity}+ units)`}
            </span>
          </div>
        )}
        
        {/* Original/Regular Price Strikethrough */}
        {(originalPrice && originalPrice !== price) || (isContractPrice && regularPrice !== price) && (
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
          Sign in for special pricing
        </div>
      )}

      {/* Approval Pending Message */}
      {user && profile?.role === 'pending' && (
        <div className="text-xs text-yellow-600">
          Account approval pending for special pricing
        </div>
      )}
    </div>
  );
};

export default PriceDisplay;