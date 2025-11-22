import React from 'react';
import { Hash, Lock, Edit2, CheckCircle2, XCircle, Building2 } from 'lucide-react';
import { Product } from '@/services/bigcommerce';
import { SecretCostMap } from '@/services/secretCostService';
import { ContractPricingInfo } from './useContractPricing';

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  isCostAdmin: boolean;
  isAdmin: boolean;
  secretCosts: SecretCostMap;
  contractPricingDetails: ContractPricingInfo[];
  loadingPricingDetails: boolean;
  productSettings: Map<number, { allowMarkup: boolean }>;
  savingMarkupSetting: boolean;
  onClose: () => void;
  onEditSecretCost: (productId: number, currentCost?: number) => void;
  onToggleMarkupAllowance: (productId: number, currentValue: boolean) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  isOpen,
  isCostAdmin,
  isAdmin,
  secretCosts,
  contractPricingDetails,
  loadingPricingDetails,
  productSettings,
  savingMarkupSetting,
  onClose,
  onEditSecretCost,
  onToggleMarkupAllowance,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl leading-6 font-medium text-gray-900">
                    Product Details
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        {product.name}
                      </h4>
                      <div className="flex items-center space-x-4 mb-4">
                        <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                          {product.category}
                        </span>
                        <div className="flex items-center">
                          <Hash className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-600">ID: {product.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-500 mb-2">Pricing</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">Current Price:</span>
                          <span className="text-lg font-semibold text-gray-900">
                            ${product.price.toFixed(2)}
                          </span>
                        </div>
                        {product.originalPrice && product.originalPrice !== product.price && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Original Price:</span>
                            <span className="text-sm text-gray-500 line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isCostAdmin && (
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-medium text-red-700 mb-3 flex items-center">
                          <Lock className="h-4 w-4 mr-2" />
                          Secret Cost (Confidential)
                        </h5>
                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-gray-700">True Acquisition Cost:</span>
                              {secretCosts[product.id] ? (
                                <div className="mt-1">
                                  <span className="text-2xl font-bold text-red-900">
                                    ${secretCosts[product.id].secret_cost.toFixed(2)}
                                  </span>
                                  {secretCosts[product.id].notes && (
                                    <p className="mt-2 text-xs text-gray-600 italic">
                                      Note: {secretCosts[product.id].notes}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <span className="text-sm text-gray-500 italic">Not set</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => onEditSecretCost(product.id, secretCosts[product.id]?.secret_cost)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              <Edit2 className="h-4 w-4 inline mr-1" />
                              Edit
                            </button>
                          </div>
                          {product.cost && secretCosts[product.id] && (
                            <div className="mt-3 pt-3 border-t border-red-300">
                              <div className="text-xs text-gray-600">
                                <p>Public Cost: ${product.cost.toFixed(2)}</p>
                                <p>Secret Cost: ${secretCosts[product.id].secret_cost.toFixed(2)}</p>
                                <p className="font-semibold mt-1">
                                  Difference: ${Math.abs(product.cost - secretCosts[product.id].secret_cost).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Markup Pricing Settings</h5>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  id={`allow-markup-${product.id}`}
                                  name={`allow-markup-${product.id}`}
                                  type="checkbox"
                                  checked={productSettings.get(product.id)?.allowMarkup || false}
                                  onChange={() => onToggleMarkupAllowance(
                                    product.id,
                                    productSettings.get(product.id)?.allowMarkup || false
                                  )}
                                  disabled={savingMarkupSetting}
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm font-medium text-gray-900">
                                  Allow Markup Above Retail
                                </span>
                              </label>
                              <p className="mt-2 text-xs text-gray-600">
                                {productSettings.get(product.id)?.allowMarkup
                                  ? 'This product CAN be marked up above retail price (e.g., genetic testing, micronutrient testing).'
                                  : 'This product can ONLY be discounted below retail price (standard contract pricing).'
                                }
                              </p>
                            </div>
                            {savingMarkupSetting && (
                              <div className="ml-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h5 className="text-sm font-medium text-gray-500 mb-2">Product Information</h5>
                      <div className="space-y-2">
                        {product.sku && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">SKU:</span>
                            <span className="text-sm font-medium">{product.sku}</span>
                          </div>
                        )}
                        {product.cost !== undefined && product.cost > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Cost:</span>
                            <span className="text-sm font-medium">${product.cost.toFixed(2)}</span>
                          </div>
                        )}
                        {product.brand && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Brand:</span>
                            <span className="text-sm font-medium">{product.brand}</span>
                          </div>
                        )}
                        {product.condition && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Condition:</span>
                            <span className="text-sm font-medium">{product.condition}</span>
                          </div>
                        )}
                        {product.weight && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Weight:</span>
                            <span className="text-sm font-medium">
                              {product.weight} {product.weightUnit}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">In Stock:</span>
                          <span className="text-sm font-medium">
                            {product.isInStock ? (
                              <span className="text-green-600 flex items-center">
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Yes
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center">
                                <XCircle className="h-4 w-4 mr-1" /> No
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {product.benefits.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500 mb-2">Benefits</h5>
                        <div className="flex flex-wrap gap-2">
                          {product.benefits.map((benefit, index) => (
                            <span
                              key={index}
                              className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                            >
                              {benefit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {contractPricingDetails.length > 0 && (
                  <div className="mt-6 border-t pt-6">
                    <div className="flex items-center mb-4">
                      <Building2 className="h-5 w-5 text-gray-500 mr-2" />
                      <h5 className="text-sm font-medium text-gray-700">
                        Contract Pricing ({contractPricingDetails.length})
                      </h5>
                    </div>
                    {loadingPricingDetails ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer/Org</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Contract Price</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty Range</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {contractPricingDetails.map((pricing, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap text-xs">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    pricing.pricing_type === 'individual' ? 'bg-blue-100 text-blue-800' :
                                    pricing.pricing_type === 'organization' ? 'bg-green-100 text-green-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {pricing.pricing_type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {pricing.organization_name}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                  {pricing.location_name || '-'}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-semibold text-gray-900">
                                  ${pricing.contract_price.toFixed(2)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-xs text-center text-gray-500">
                                  {pricing.min_quantity && pricing.max_quantity
                                    ? `${pricing.min_quantity}-${pricing.max_quantity}`
                                    : pricing.min_quantity
                                    ? `${pricing.min_quantity}+`
                                    : '-'
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {product.description && (
                  <div className="mt-6 border-t pt-6">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Description</h5>
                    <div
                      className="text-sm text-gray-600 prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
