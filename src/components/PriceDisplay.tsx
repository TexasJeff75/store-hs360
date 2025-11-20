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
  organizationId?: string; // For sales rep pricing
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  productId,
  regularPrice,
  originalPrice,
  className = '',
  showSavings = true,
  quantity,
  organizationId
}) => {
  const { user, profile } = useAuth();
  const { price, source, savings, loading } = useContractPricing(productId, regularPrice, quantity, organizationId);

  // regularPrice is the wholesale/cost price from BigCommerce
  // price is the retail selling price (either contract or default markup)

  // Don't show loading state - just show the current price to prevent flickering
  // The price will update when loaded

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
      case 'location': return 'Location Retail Price';
      case 'organization': return 'Organization Retail Price';
      case 'individual': return 'Your Retail Price';
      default: return 'Retail Price';
    }
  };

  // Safety check for null price
  const displayPrice = price ?? regularPrice ?? 0;

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      {/* Show retail price with strikethrough if user has contract pricing */}
      {isContractPrice && savings > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 line-through">${regularPrice.toFixed(2)}</span>
          <span className="text-xs text-gray-500">Retail Price</span>
        </div>
      )}

      <div className="flex items-center space-x-2 flex-wrap">
        <span className="text-lg font-bold text-gray-900">${displayPrice.toFixed(2)}</span>

        {/* Contract Price Badge */}
        {isContractPrice && (
          <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
            {getSourceIcon()}
            <span>
              {getSourceLabel()}
              {quantity && quantity > 1 && ` (${quantity}+ units)`}
            </span>
          </div>
        )}
      </div>

      {/* Show savings amount if user has contract pricing */}
      {isContractPrice && savings > 0 && showSavings && (
        <div className="text-sm text-green-600 font-medium">
          ${savings.toFixed(2)} off retail
        </div>
      )}

      {/* Only show status messages if user doesn't have contract pricing */}
      {!isContractPrice && (
        <>
          {/* Login Prompt for Better Pricing */}
          {!user && (
            <div className="text-xs text-blue-600 mt-1">
              Sign in for special pricing
            </div>
          )}

          {/* Approval Pending Message */}
          {user && profile?.role === 'pending' && (
            <div className="text-xs text-yellow-600 mt-1">
              Account approval pending for special pricing
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PriceDisplay;