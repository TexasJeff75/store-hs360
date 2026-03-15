import React from 'react';
import { Filter, X, ChevronRight } from 'lucide-react';
import { Category } from '../services/productService';

interface ProductFilterProps {
  categories: string[];
  categoryTree?: Category[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  maxPrice?: number;
  isOpen: boolean;
  onToggle: () => void;
}

const ProductFilter: React.FC<ProductFilterProps> = ({
  categories,
  categoryTree,
  selectedCategory,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  maxPrice = 10000,
  isOpen,
  onToggle
}) => {
  // Build hierarchical display: group categories that have products
  const availableCategories = new Set(categories);

  const renderCategoryTree = () => {
    if (!categoryTree || categoryTree.length === 0) {
      // Fallback to flat list if no tree available
      return categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
            selectedCategory === category
              ? 'bg-pink-100 text-pink-800'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {category}
        </button>
      ));
    }

    return categoryTree
      .filter(parent => {
        // Show parent if it has products or any of its children have products
        const childNames = (parent.children || []).map(c => c.name);
        return availableCategories.has(parent.name) || childNames.some(n => availableCategories.has(n));
      })
      .map(parent => {
        const childrenWithProducts = (parent.children || []).filter(c => availableCategories.has(c.name));
        const parentHasProducts = availableCategories.has(parent.name);
        const hasChildren = childrenWithProducts.length > 0;
        const isParentSelected = selectedCategory === parent.name;
        const isChildSelected = childrenWithProducts.some(c => c.name === selectedCategory);

        return (
          <div key={parent.id} className="space-y-1">
            {/* Parent category */}
            <button
              onClick={() => onCategoryChange(parent.name)}
              className={`block w-full text-left px-3 py-2 rounded-lg transition-colors font-medium ${
                isParentSelected
                  ? 'bg-pink-100 text-pink-800'
                  : isChildSelected
                    ? 'text-pink-700'
                    : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center justify-between">
                {parent.name}
                {hasChildren && (
                  <ChevronRight className={`h-4 w-4 transition-transform ${isParentSelected || isChildSelected ? 'rotate-90' : ''}`} />
                )}
              </span>
            </button>

            {/* Child categories */}
            {hasChildren && (
              <div className="ml-3 border-l-2 border-gray-200 pl-2 space-y-1">
                {childrenWithProducts.map(child => (
                  <button
                    key={child.id}
                    onClick={() => onCategoryChange(child.name)}
                    className={`block w-full text-left px-3 py-1.5 rounded-lg transition-colors text-sm ${
                      selectedCategory === child.name
                        ? 'bg-pink-100 text-pink-800'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      });
  };

  return (
    <>
      {/* Mobile Filter Button */}
      <button
        onClick={onToggle}
        className="lg:hidden flex items-center space-x-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Filter className="h-5 w-5" />
        <span>Filters</span>
      </button>

      {/* Filter Panel */}
      <div className={`
        ${isOpen ? 'block' : 'hidden'} lg:block
        fixed lg:relative top-0 left-0 right-0 bottom-0 lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto
        z-50 lg:z-auto bg-white lg:bg-transparent
        p-6 lg:p-0 lg:w-64 overflow-y-auto lg:overflow-visible
      `}>
        {/* Mobile Close Button */}
        <button
          onClick={onToggle}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="space-y-6">
          {/* Categories */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
            <div className="space-y-2">
              <button
                onClick={() => onCategoryChange('all')}
                className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-pink-100 text-pink-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Products
              </button>
              {renderCategoryTree()}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Range</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">$</span>
                <input
                  type="number"
                  min="0"
                  max={maxPrice}
                  value={priceRange[0]}
                  onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <span className="text-gray-500">to</span>
                <span className="text-sm text-gray-600">$</span>
                <input
                  type="number"
                  min="0"
                  max={maxPrice}
                  value={priceRange[1]}
                  onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <input
                type="range"
                min="0"
                max={maxPrice}
                value={priceRange[1]}
                onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        ></div>
      )}
    </>
  );
};

export default ProductFilter;
