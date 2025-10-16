import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Star, Tag, Plus, Minus, Heart, Repeat } from 'lucide-react';
import { Product } from '../services/bigcommerce';
import PriceDisplay from './PriceDisplay';
import { contractPricingService, ContractPrice } from '../services/contractPricing';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';
import RecurringOrderModal from './RecurringOrderModal';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: number, quantity: number) => void;
  organizationId?: string;
}

const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  organizationId
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [contractPrices, setContractPrices] = useState<ContractPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showRecurringOrderModal, setShowRecurringOrderModal] = useState(false);
  const { user, profile } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const fetchContractPrices = async () => {
      if (!product || !user) {
        setContractPrices([]);
        return;
      }

      setLoadingPrices(true);
      try {
        let prices: ContractPrice[] = [];

        if (organizationId) {
          prices = await contractPricingService.getOrganizationPricing(organizationId);
          prices = prices.filter(p => p.product_id === product.id);
        } else if (user.id) {
          const userPrices = await contractPricingService.getEntityContractPrices(user.id, 'individual');
          const orgPrice = await contractPricingService.getOrganizationPrice(user.id, product.id);
          const locPrice = await contractPricingService.getLocationPrice(user.id, product.id);

          prices = [
            ...userPrices.filter(p => p.product_id === product.id),
            ...(orgPrice ? [orgPrice] : []),
            ...(locPrice ? [locPrice] : [])
          ];
        }

        prices.sort((a, b) => a.contract_price - b.contract_price);
        setContractPrices(prices);
      } catch (error) {
        console.error('Error fetching contract prices:', error);
        setContractPrices([]);
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchContractPrices();
  }, [product, user, organizationId]);

  if (!isOpen || !product) return null;

  try {
    console.log('Rendering ProductModal for product:', product.name, 'ID:', product.id);

    const favorited = user ? isFavorite(product.id) : false;

    const getSafeDescription = () => {
      try {
        if (product.plainTextDescription) {
          return product.plainTextDescription;
        }
        if (product.description) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = product.description;
          const scripts = tempDiv.querySelectorAll('script');
          scripts.forEach(script => script.remove());
          return tempDiv.innerHTML;
        }
        return '';
      } catch (error) {
        console.error('Error processing product description:', error);
        return 'Description not available';
      }
    };

    const handleFavoriteClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!user) {
        return;
      }

      try {
        await toggleFavorite(product.id);
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    };

    const handleAddToCart = () => {
      onAddToCart(product.id, quantity);
      setTimeout(() => {
        onClose();
      }, 500);
    };

    const incrementQuantity = () => {
      setQuantity(prev => prev + 1);
    };

    const decrementQuantity = () => {
      setQuantity(prev => Math.max(1, prev - 1));
    };

    // Mock additional images - in real implementation, these would come from BigCommerce
    const productImages = [
      product.image,
      // Add more images here when available from BigCommerce
    ];
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          {/* Background overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={onClose}
          ></div>
        
        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 truncate pr-4">
              {product.name}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Images */}
              <div className="space-y-4">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={productImages[selectedImageIndex]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Thumbnail images (if multiple images available) */}
                {productImages.length > 1 && (
                  <div className="flex space-x-2 overflow-x-auto">
                    {productImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedImageIndex === index 
                            ? 'border-pink-500' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img 
                          src={image} 
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="space-y-6">
                {/* Category and Rating */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-pink-100 to-orange-100 text-pink-800">
                    <Tag className="h-4 w-4 mr-1" />
                    {product.category}
                  </span>
                  
                  {product.rating && product.rating > 0 && (
                    <div className="flex items-center space-x-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(product.rating || 0)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {product.rating.toFixed(1)} ({product.reviews || 0} reviews)
                      </span>
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <PriceDisplay
                    productId={product.id}
                    regularPrice={product.price}
                    originalPrice={product.originalPrice}
                    showSavings={true}
                    quantity={quantity}
                    organizationId={organizationId}
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-2">+ tax</p>
                </div>

                {/* Contract Pricing Options */}
                {contractPrices.length > 0 && (
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      Available Contract Pricing
                    </h3>
                    <div className="space-y-2">
                      {contractPrices.map((price, index) => {
                        const quantityValid = quantity >= (price.min_quantity || 1) &&
                                             (!price.max_quantity || quantity <= price.max_quantity);
                        return (
                          <div
                            key={index}
                            className={`text-sm p-2 rounded ${
                              quantityValid
                                ? 'bg-green-100 border border-green-300'
                                : 'bg-white border border-blue-200 opacity-60'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-gray-900">
                                  ${price.contract_price.toFixed(2)}
                                  {quantityValid && (
                                    <span className="ml-2 text-xs text-green-700 font-semibold">
                                      ✓ Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {price.pricing_type === 'individual' && 'Individual Pricing'}
                                  {price.pricing_type === 'organization' && 'Organization Pricing'}
                                  {price.pricing_type === 'location' && 'Location Pricing'}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600">
                                Qty: {price.min_quantity || 1}
                                {price.max_quantity ? `-${price.max_quantity}` : '+'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {contractPrices.length > 1 && (
                      <p className="text-xs text-blue-700 mt-2">
                        Change quantity to see different pricing tiers
                      </p>
                    )}
                  </div>
                )}

                {loadingPrices && (
                  <div className="text-sm text-gray-600 text-center">
                    Loading pricing options...
                  </div>
                )}

                {/* Benefits */}
                {product.benefits && Array.isArray(product.benefits) && product.benefits.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Benefits</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.benefits.map((benefit, index) => (
                        <span
                          key={index}
                          className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800"
                        >
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Description */}
                {(product.description || product.plainTextDescription) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                    <div className="prose prose-sm text-gray-600">
                      {product.plainTextDescription ? (
                        <p>{product.plainTextDescription}</p>
                      ) : product.description ? (
                        <div dangerouslySetInnerHTML={{ __html: getSafeDescription() }} />
                      ) : (
                        <p>{product.plainTextDescription}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Quantity and Add to Cart */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={decrementQuantity}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-16 text-center text-lg font-medium">
                        {quantity}
                      </span>
                      <button
                        onClick={incrementQuantity}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleFavoriteClick}
                        className="p-3 border-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                        style={{
                          borderColor: favorited ? '#ef4444' : '#e5e7eb',
                          backgroundColor: favorited ? '#fef2f2' : 'white'
                        }}
                        type="button"
                        aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart
                          className={`h-6 w-6 transition-colors ${
                            favorited
                              ? 'text-red-500 fill-red-500'
                              : 'text-gray-400 hover:text-red-400'
                          }`}
                        />
                      </button>
                      <button
                        onClick={handleAddToCart}
                        className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center space-x-2 text-lg font-semibold"
                      >
                        <ShoppingCart className="h-5 w-5" />
                        <span>Add {quantity} to Cart</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setShowRecurringOrderModal(true)}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 flex items-center justify-center space-x-2 text-lg font-semibold border-2 border-transparent"
                    >
                      <Repeat className="h-5 w-5" />
                      <span>Create Recurring Order</span>
                    </button>
                  </div>
                </div>

                {/* Additional Product Info */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">Product ID:</span>
                      <span className="ml-2 text-gray-600">#{product.id}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Category:</span>
                      <span className="ml-2 text-gray-600">{product.category}</span>
                    </div>
                  </div>
                </div>

                {/* Trust Indicators */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-800">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Science-backed formula</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-800 mt-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Third-party tested for purity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {product && (
          <RecurringOrderModal
            isOpen={showRecurringOrderModal}
            onClose={() => setShowRecurringOrderModal(false)}
            productId={product.id}
            productName={product.name}
            productPrice={product.price}
          />
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering ProductModal:', error, 'Product:', product);
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={onClose}
          ></div>
          <div className="relative bg-white rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to display product</h3>
            <p className="text-gray-600 mb-4">There was an error loading this product's details.</p>
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default ProductModal;