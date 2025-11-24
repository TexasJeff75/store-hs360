import React from 'react';
import { Eye, DollarSign, CheckCircle2, XCircle, Edit2, Save, X as XIcon } from 'lucide-react';
import { Product } from '@/services/bigcommerce';
import { SecretCostMap } from '@/services/secretCostService';

interface ProductTableRowProps {
  product: Product;
  isCostAdmin: boolean;
  secretCosts: SecretCostMap;
  editingSecretCost: number | null;
  editSecretCostValue: string;
  savingSecretCost: boolean;
  contractPricingCount: number;
  onViewProduct: (product: Product) => void;
  onEditSecretCost: (productId: number, currentCost?: number) => void;
  onSaveSecretCost: (productId: number) => void;
  onCancelEditSecretCost: () => void;
  setEditSecretCostValue: (value: string) => void;
}

export const ProductTableRow: React.FC<ProductTableRowProps> = ({
  product,
  isCostAdmin,
  secretCosts,
  editingSecretCost,
  editSecretCostValue,
  savingSecretCost,
  contractPricingCount,
  onViewProduct,
  onEditSecretCost,
  onSaveSecretCost,
  onCancelEditSecretCost,
  setEditSecretCostValue,
}) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
        {product.name}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 text-center">
        {product.sku}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
        {product.brand}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
        ${product.price.toFixed(2)}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
        {product.cost !== undefined && product.cost !== null && product.cost > 0 ? (
          `$${product.cost.toFixed(2)}`
        ) : (
          <span className="text-gray-400 italic">Not set</span>
        )}
      </td>
      {isCostAdmin && (
        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
          {editingSecretCost === product.id ? (
            <div className="flex items-center justify-end space-x-1">
              <input
                id={`secret-cost-${product.id}`}
                name={`secret-cost-${product.id}`}
                type="number"
                step="0.01"
                value={editSecretCostValue}
                onChange={(e) => setEditSecretCostValue(e.target.value)}
                className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                disabled={savingSecretCost}
              />
              <button
                onClick={() => onSaveSecretCost(product.id)}
                disabled={savingSecretCost}
                className="p-0.5 text-green-600 hover:text-green-800 disabled:opacity-50"
                title="Save"
              >
                <Save className="h-3 w-3" />
              </button>
              <button
                onClick={onCancelEditSecretCost}
                disabled={savingSecretCost}
                className="p-0.5 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                title="Cancel"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end space-x-1">
              {secretCosts[product.id] ? (
                <span className="font-bold text-red-900">
                  ${secretCosts[product.id].secret_cost.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400 italic text-xs">-</span>
              )}
              <button
                onClick={() => onEditSecretCost(product.id, secretCosts[product.id]?.secret_cost)}
                className="p-0.5 text-blue-600 hover:text-blue-800"
                title="Edit Secret Cost"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </td>
      )}
      <td className="px-2 py-2 whitespace-nowrap text-center">
        {product.hasImage ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 mx-auto" />
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-center">
        {product.hasDescription ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 mx-auto" />
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-center">
        {product.isInStock ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 mx-auto" />
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-center">
        {contractPricingCount > 0 ? (
          <div className="flex items-center justify-center">
            <DollarSign className="h-3 w-3 text-green-600 mr-0.5" />
            <span className="font-medium text-green-700">
              {contractPricingCount}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-center">
        <button
          onClick={() => onViewProduct(product)}
          className="text-blue-600 hover:text-blue-900 p-0.5 rounded"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};
