import React, { useState, useEffect } from 'react';
import { X, Save, Loader, Package } from 'lucide-react';
import { productService, Product, Category, Brand } from '@/services/productService';

interface ProductFormProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, isOpen, onClose, onSave }) => {
  const isEditing = !!product;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrandName, setNewBrandName] = useState('');
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    plain_text_description: '',
    price: '',
    cost: '',
    original_price: '',
    category_id: '',
    brand_id: '',
    condition: '',
    weight: '',
    weight_unit: 'lb',
    is_in_stock: true,
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadDropdowns();
      if (product) {
        setForm({
          name: product.name,
          sku: product.sku || '',
          description: product.description || '',
          plain_text_description: product.plainTextDescription || '',
          price: product.price?.toString() || '',
          cost: product.cost?.toString() || '',
          original_price: product.originalPrice?.toString() || '',
          category_id: product.categoryId || '',
          brand_id: product.brandId || '',
          condition: product.condition || '',
          weight: product.weight?.toString() || '',
          weight_unit: product.weightUnit || 'lb',
          is_in_stock: product.isInStock ?? true,
          is_active: product.isActive ?? true,
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, product]);

  const resetForm = () => {
    setForm({
      name: '',
      sku: '',
      description: '',
      plain_text_description: '',
      price: '',
      cost: '',
      original_price: '',
      category_id: '',
      brand_id: '',
      condition: '',
      weight: '',
      weight_unit: 'lb',
      is_in_stock: true,
      is_active: true,
    });
    setError(null);
  };

  const loadDropdowns = async () => {
    const [cats, brs] = await Promise.all([
      productService.getAllCategories(),
      productService.getAllBrands(),
    ]);
    setCategories(cats);
    setBrands(brs);
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;
    try {
      const brand = await productService.createBrand({
        name: newBrandName.trim(),
        slug: newBrandName.trim().toLowerCase().replace(/\s+/g, '-'),
      });
      if (brand) {
        setBrands([...brands, brand]);
        setForm({ ...form, brand_id: brand.id });
        setNewBrandName('');
        setShowNewBrand(false);
      }
    } catch (err) {
      setError('Failed to create brand');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const cat = await productService.createCategory({
        name: newCategoryName.trim(),
        slug: newCategoryName.trim().toLowerCase().replace(/\s+/g, '-'),
      });
      if (cat) {
        setCategories([...categories, cat]);
        setForm({ ...form, category_id: cat.id });
        setNewCategoryName('');
        setShowNewCategory(false);
      }
    } catch (err) {
      setError('Failed to create category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Product name is required');
      return;
    }
    if (!form.price || isNaN(Number(form.price))) {
      setError('Valid price is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        slug: form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: form.description,
        plain_text_description: form.plain_text_description,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : undefined,
        original_price: form.original_price ? parseFloat(form.original_price) : undefined,
        category_id: form.category_id || undefined,
        brand_id: form.brand_id || undefined,
        condition: form.condition || undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        weight_unit: form.weight_unit,
        is_in_stock: form.is_in_stock,
        is_active: form.is_active,
      };

      let savedProduct: Product | null;

      if (isEditing && product) {
        savedProduct = await productService.updateProduct(product.id, payload);
      } else {
        savedProduct = await productService.createProduct(payload);
      }

      if (!savedProduct) throw new Error('Failed to save product');

      onSave(savedProduct);
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-center min-h-screen pt-4 px-4 pb-20">
        <div className="fixed inset-0 bg-black/50" />

        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Product' : 'New Product'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    placeholder="Enter product name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU</label>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      placeholder="e.g. PROD-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Condition
                    </label>
                    <select
                      value={form.condition}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      <option value="New">New</option>
                      <option value="Refurbished">Refurbished</option>
                      <option value="Used">Used</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.cost}
                        onChange={(e) => setForm({ ...form, cost: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Compare At
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.original_price}
                        onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Category
                  </label>
                  {showNewCategory ? (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="New category name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewCategory(false)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <select
                        value={form.category_id}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-600"
                      >
                        + New
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand</label>
                  {showNewBrand ? (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="New brand name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateBrand}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewBrand(false)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <select
                        value={form.brand_id}
                        onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No brand</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewBrand(true)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-600"
                      >
                        + New
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Weight Unit
                    </label>
                    <select
                      value={form.weight_unit}
                      onChange={(e) => setForm({ ...form, weight_unit: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="lb">Pounds (lb)</option>
                      <option value="oz">Ounces (oz)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="g">Grams (g)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_in_stock}
                      onChange={(e) => setForm({ ...form, is_in_stock: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">In Stock</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Active (visible to customers)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={form.plain_text_description}
                    onChange={(e) =>
                      setForm({ ...form, plain_text_description: e.target.value })
                    }
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                    placeholder="Describe the product..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    HTML Description (optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none font-mono text-sm"
                    placeholder="<p>Rich HTML description...</p>"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{isEditing ? 'Update Product' : 'Create Product'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductForm;
