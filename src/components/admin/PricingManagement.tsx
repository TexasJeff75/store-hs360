import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Plus, Edit, Trash2, Search, User, Building2, MapPin, AlertTriangle, Shield, Eye, Upload, Download, FileText } from 'lucide-react';
import { contractPricingService, type PricingType } from '@/services/contractPricing';
import { multiTenantService } from '@/services/multiTenant';
import { bigCommerceService } from '@/services/bigcommerce';
import { supabase } from '@/services/supabase';
import { productCostsService, type ProductCost } from '@/services/productCosts';
import type { Organization, Location, Profile } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PricingEntry {
  id: string;
  type: PricingType;
  entityId: string;
  entityName: string;
  productId: number;
  productName: string;
  contractPrice: number;
  markupPrice?: number;
  regularPrice: number;
  savings: number;
  minQuantity: number;
  maxQuantity?: number;
  effectiveDate: string;
  expiryDate?: string;
  createdAt: string;
}

interface PricingManagementProps {
  organizationId?: string;
}

const PricingManagement: React.FC<PricingManagementProps> = ({ organizationId }) => {
  const { profile } = useAuth();
  const [pricingEntries, setPricingEntries] = useState<PricingEntry[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Partial<PricingEntry> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newEntryData, setNewEntryData] = useState({
    type: 'individual' as PricingType,
    entityId: '',
    productId: 0,
    contractPrice: 0,
    markupPrice: undefined as number | undefined,
    minQuantity: 1,
    maxQuantity: undefined as number | undefined,
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: undefined as string | undefined,
    allowBelowCost: false,
    overrideReason: ''
  });
  const [productSettings, setProductSettings] = useState<Map<number, { allowMarkup: boolean }>>(new Map());
  const [productCosts, setProductCosts] = useState<Map<number, ProductCost>>(new Map());
  const [isCostAdmin, setIsCostAdmin] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportData, setBulkImportData] = useState<string>('');
  const [bulkImportResults, setBulkImportResults] = useState<{success: number; failed: number; errors: string[]}>({success: 0, failed: 0, errors: []});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMultiProductFormOpen, setIsMultiProductFormOpen] = useState(false);
  const [multiProductFormData, setMultiProductFormData] = useState<{
    type: PricingType;
    entityId: string;
    effectiveDate: string;
    expiryDate?: string;
    products: Array<{
      productId: number;
      contractPrice: string;
      markupPrice: string;
      minQuantity: string;
      maxQuantity: string;
    }>;
  }>({
    type: 'organization' as PricingType,
    entityId: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: undefined,
    products: []
  });

  useEffect(() => {
    checkCostAdmin();
    fetchData();
  }, []);

  const checkCostAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc('is_cost_admin');
      if (!error && data) {
        setIsCostAdmin(true);
      }
    } catch (err) {
      console.error('Error checking cost admin status:', err);
    }
  };

  const fetchPricingEntries = async () => {
    try {
      console.log('Fetching pricing entries...');
      
      let pricingData;
      if (organizationId) {
        // Fetch pricing for specific organization and its locations
        pricingData = await contractPricingService.getOrganizationPricingEntries(organizationId);
      } else {
        // Fetch all pricing entries
        pricingData = await contractPricingService.getAllPricingEntries();
      }
      
      console.log('Raw pricing data:', pricingData);
      
      // Transform the data into PricingEntry format
      const entries: PricingEntry[] = pricingData.map(price => {
        const product = products.find(p => p.id === price.product_id);
        
        // Get entity name based on pricing type
        let entityName = 'Unknown';
        if (price.pricing_type === 'individual' && price.profiles) {
          entityName = price.profiles.email;
        } else if (price.pricing_type === 'organization' && price.organizations) {
          entityName = price.organizations.name;
        } else if (price.pricing_type === 'location' && price.locations) {
          entityName = price.locations.name;
        }
        
        return {
          id: price.id,
          type: price.pricing_type,
          entityId: price.entity_id,
          entityName,
          productId: price.product_id,
          productName: product?.name || `Product ${price.product_id}`,
          contractPrice: price.contract_price,
          markupPrice: price.markup_price,
          regularPrice: product?.price || 0,
          savings: price.contract_price ? (product?.price || 0) - price.contract_price : 0,
          minQuantity: price.min_quantity || 1,
          maxQuantity: price.max_quantity,
          effectiveDate: price.effective_date || price.created_at,
          expiryDate: price.expiry_date,
          createdAt: price.created_at
        };
      }).filter(entry => entry.productName !== `Product ${entry.productId}`); // Filter out entries without valid products
      
      console.log('Processed entries:', entries);
      setPricingEntries(entries);
    } catch (err) {
      console.error('Error fetching pricing entries:', err);
      setError('Failed to load pricing entries: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Re-fetch pricing entries when products are loaded
  useEffect(() => {
    console.log('Products changed, refetching pricing entries. Products length:', products.length);
    if (products.length > 0) {
      fetchPricingEntries();
    }
  }, [products, organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all required data
      const [productsData, orgsData, settingsData] = await Promise.all([
        bigCommerceService.getProducts(),
        multiTenantService.getOrganizations(),
        supabase.from('product_settings').select('product_id, allow_markup')
      ]);

      const sortedProducts = [...productsData.products].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
      setProducts(sortedProducts);

      // Build product settings map
      const settingsMap = new Map();
      if (settingsData.data) {
        settingsData.data.forEach((setting: any) => {
          settingsMap.set(setting.product_id, { allowMarkup: setting.allow_markup });
        });
      }
      setProductSettings(settingsMap);

      // Fetch product costs
      const productIds = productsData.products.map((p: any) => p.id);
      const costsMap = await productCostsService.getProductCosts(productIds);
      setProductCosts(costsMap);
      
      if (organizationId) {
        // Filter organizations to only the selected one
        setOrganizations(orgsData.filter(org => org.id === organizationId));
        // Fetch locations for this organization only
        const locationsData = await multiTenantService.getLocations(organizationId);
        setLocations(locationsData);
      } else {
        setOrganizations(orgsData);
        const locationsData = await multiTenantService.getLocations();
        setLocations(locationsData);
        
        // Fetch users for individual pricing
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_approved', true)
          .order('email');
        
        if (!usersError) {
          setUsers(usersData || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePricing = () => {
    const defaultEntry = {
      type: organizationId ? 'organization' : 'individual',
      entityId: '',
      entityName: '',
      productId: products[0]?.id || 0,
      productName: products[0]?.name || '',
      contractPrice: 0,
      regularPrice: products[0]?.price || 0,
      savings: 0,
      minQuantity: 1,
      maxQuantity: undefined,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined,
    };
    setSelectedEntry(defaultEntry);
    setNewEntryData({
      type: defaultEntry.type as PricingType,
      entityId: '',
      productId: defaultEntry.productId,
      contractPrice: 0,
      minQuantity: 1,
      maxQuantity: undefined,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleBulkImport = () => {
    setIsBulkImportOpen(true);
    setBulkImportData('');
    setBulkImportResults({success: 0, failed: 0, errors: []});
  };

  const handleDownloadTemplate = () => {
    const headerColumns = ['Type', 'Entity Name/Email', 'Product Name', 'Retail Price', 'Cost Price'];

    if (isCostAdmin) {
      headerColumns.push('Secret Cost');
    }

    headerColumns.push('Contract Price', 'Markup Price', 'Min Quantity', 'Max Quantity', 'Effective Date', 'Expiry Date');

    const csvLines = [headerColumns.join(',')];

    if (organizationId) {
      const org = organizations.find(o => o.id === organizationId);
      const orgName = org?.name || 'Organization';

      products.forEach(product => {
        const cost = productCosts.get(product.id);
        const costPrice = cost?.cost_price || '';
        const secretCost = cost?.secret_cost || '';

        const row = ['organization', orgName, product.name, product.price, costPrice];
        if (isCostAdmin) {
          row.push(secretCost);
        }
        row.push(product.price, '', '1', '', new Date().toISOString().split('T')[0], '');

        csvLines.push(row.join(','));
      });

      locations.forEach(location => {
        products.slice(0, 5).forEach(product => {
          const cost = productCosts.get(product.id);
          const costPrice = cost?.cost_price || '';
          const secretCost = cost?.secret_cost || '';

          const row = ['location', location.name, product.name, product.price, costPrice];
          if (isCostAdmin) {
            row.push(secretCost);
          }
          row.push(product.price, '', '1', '', new Date().toISOString().split('T')[0], '');

          csvLines.push(row.join(','));
        });
      });
    } else {
      organizations.forEach(org => {
        products.slice(0, 5).forEach(product => {
          const cost = productCosts.get(product.id);
          const costPrice = cost?.cost_price || '';
          const secretCost = cost?.secret_cost || '';

          const row = ['organization', org.name, product.name, product.price, costPrice];
          if (isCostAdmin) {
            row.push(secretCost);
          }
          row.push(product.price, '', '1', '', new Date().toISOString().split('T')[0], '');

          csvLines.push(row.join(','));
        });
      });

      locations.slice(0, 3).forEach(location => {
        products.slice(0, 3).forEach(product => {
          const cost = productCosts.get(product.id);
          const costPrice = cost?.cost_price || '';
          const secretCost = cost?.secret_cost || '';

          const row = ['location', location.name, product.name, product.price, costPrice];
          if (isCostAdmin) {
            row.push(secretCost);
          }
          row.push(product.price, '', '1', '', new Date().toISOString().split('T')[0], '');

          csvLines.push(row.join(','));
        });
      });

      users.slice(0, 3).forEach(user => {
        products.slice(0, 3).forEach(product => {
          const cost = productCosts.get(product.id);
          const costPrice = cost?.cost_price || '';
          const secretCost = cost?.secret_cost || '';

          const row = ['individual', user.email, product.name, product.price, costPrice];
          if (isCostAdmin) {
            row.push(secretCost);
          }
          row.push(product.price, '', '1', '', new Date().toISOString().split('T')[0], '');

          csvLines.push(row.join(','));
        });
      });
    }

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = organizationId
      ? `pricing_template_${organizations.find(o => o.id === organizationId)?.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      : `pricing_template_${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setBulkImportData(text);
    };
    reader.readAsText(file);
  };

  const processBulkImport = async () => {
    if (!bulkImportData.trim()) {
      alert('Please paste CSV data or upload a file first.');
      return;
    }

    const lines = bulkImportData.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must contain at least a header row and one data row.');
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 7) {
          errors.push(`Line ${i + 1}: Invalid format - expected at least 7 columns`);
          failedCount++;
          continue;
        }

        let type, entityName, productName, contractPriceStr, markupPriceStr, minQtyStr, maxQtyStr, effectiveDateStr, expiryDateStr;

        if (isCostAdmin && parts.length >= 12) {
          [type, entityName, productName, , , , contractPriceStr, markupPriceStr, minQtyStr, maxQtyStr, effectiveDateStr, expiryDateStr] = parts;
        } else if (parts.length >= 11) {
          [type, entityName, productName, , , contractPriceStr, markupPriceStr, minQtyStr, maxQtyStr, effectiveDateStr, expiryDateStr] = parts;
        } else {
          errors.push(`Line ${i + 1}: Invalid format - incorrect number of columns`);
          failedCount++;
          continue;
        }

        if (!['individual', 'organization', 'location'].includes(type)) {
          errors.push(`Line ${i + 1}: Invalid type "${type}" - must be individual, organization, or location`);
          failedCount++;
          continue;
        }

        let entityId = '';
        if (type === 'individual') {
          const user = users.find(u => u.email.toLowerCase() === entityName.toLowerCase());
          if (!user) {
            errors.push(`Line ${i + 1}: User "${entityName}" not found`);
            failedCount++;
            continue;
          }
          entityId = user.id;
        } else if (type === 'organization') {
          const org = organizations.find(o => o.name.toLowerCase() === entityName.toLowerCase());
          if (!org) {
            errors.push(`Line ${i + 1}: Organization "${entityName}" not found`);
            failedCount++;
            continue;
          }
          entityId = org.id;
        } else if (type === 'location') {
          const location = locations.find(l => l.name.toLowerCase() === entityName.toLowerCase());
          if (!location) {
            errors.push(`Line ${i + 1}: Location "${entityName}" not found`);
            failedCount++;
            continue;
          }
          entityId = location.id;
        }

        const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
        if (!product) {
          errors.push(`Line ${i + 1}: Product "${productName}" not found`);
          failedCount++;
          continue;
        }

        const contractPrice = contractPriceStr ? parseFloat(contractPriceStr) : undefined;
        const markupPrice = markupPriceStr ? parseFloat(markupPriceStr) : undefined;
        const minQuantity = minQtyStr ? parseInt(minQtyStr) : 1;
        const maxQuantity = maxQtyStr ? parseInt(maxQtyStr) : undefined;
        const effectiveDate = effectiveDateStr || new Date().toISOString().split('T')[0];
        const expiryDate = expiryDateStr || undefined;

        if (!contractPrice && !markupPrice) {
          errors.push(`Line ${i + 1}: Must provide either contract price or markup price`);
          failedCount++;
          continue;
        }

        const result = await contractPricingService.setContractPrice(
          entityId,
          product.id,
          contractPrice,
          type as PricingType,
          minQuantity,
          maxQuantity,
          effectiveDate,
          expiryDate,
          markupPrice
        );

        if (result.success) {
          successCount++;
        } else {
          errors.push(`Line ${i + 1}: ${result.error || 'Failed to save pricing'}`);
          failedCount++;
        }
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        failedCount++;
      }
    }

    setBulkImportResults({ success: successCount, failed: failedCount, errors });

    if (successCount > 0) {
      await fetchPricingEntries();
    }
  };

  const handleOpenMultiProductForm = () => {
    setIsMultiProductFormOpen(true);

    // Pre-select organization if viewing org-specific pricing
    let defaultEntityId = '';
    let defaultType: PricingType = 'organization';

    if (organizationId) {
      defaultEntityId = organizationId;
      defaultType = 'organization';
    }

    // Initialize with all products and populate existing pricing
    const initialProducts = products.map(product => {
      // Find existing pricing for this product and entity
      const existingPricing = pricingEntries.find(entry =>
        entry.productId === product.id &&
        entry.entityId === defaultEntityId &&
        entry.type === defaultType
      );

      return {
        productId: product.id,
        contractPrice: existingPricing?.contractPrice?.toString() || '',
        markupPrice: existingPricing?.markupPrice?.toString() || '',
        minQuantity: existingPricing?.minQuantity?.toString() || '1',
        maxQuantity: existingPricing?.maxQuantity?.toString() || ''
      };
    });

    setMultiProductFormData({
      type: defaultType,
      entityId: defaultEntityId,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined,
      products: initialProducts
    });
  };

  const handleMultiProductFormSubmit = async () => {
    try {
      setError(null);

      if (!multiProductFormData.entityId) {
        setError('Please select an entity (organization, location, or user)');
        return;
      }

      // Filter products with pricing data
      const productsToSave = multiProductFormData.products.filter(p =>
        p.contractPrice || p.markupPrice
      );

      if (productsToSave.length === 0) {
        setError('Please enter pricing for at least one product');
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const productData of productsToSave) {
        try {
          const contractPrice = productData.contractPrice ? parseFloat(productData.contractPrice) : undefined;
          const markupPrice = productData.markupPrice ? parseFloat(productData.markupPrice) : undefined;
          const minQuantity = parseInt(productData.minQuantity) || 1;
          const maxQuantity = productData.maxQuantity ? parseInt(productData.maxQuantity) : undefined;

          const result = await contractPricingService.setContractPrice(
            multiProductFormData.entityId,
            productData.productId,
            contractPrice,
            multiProductFormData.type,
            minQuantity,
            maxQuantity,
            multiProductFormData.effectiveDate,
            multiProductFormData.expiryDate,
            markupPrice
          );

          if (result.success) {
            successCount++;
          } else {
            const product = products.find(p => p.id === productData.productId);
            errors.push(`${product?.name || productData.productId}: ${result.error || 'Failed to save'}`);
            failedCount++;
          }
        } catch (err) {
          const product = products.find(p => p.id === productData.productId);
          errors.push(`${product?.name || productData.productId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          failedCount++;
        }
      }

      if (successCount > 0) {
        setModalMessage({ type: 'success', text: `Successfully saved pricing for ${successCount} product(s)` });
        await fetchPricingEntries();

        if (failedCount === 0) {
          setTimeout(() => {
            setIsMultiProductFormOpen(false);
            setModalMessage(null);
          }, 2000);
        }
      }

      if (failedCount > 0) {
        setError(`Failed to save ${failedCount} product(s): ${errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    }
  };

  const handleEditPricing = (entry: PricingEntry) => {
    setSelectedEntry(entry);
    setNewEntryData({
      type: entry.type,
      entityId: entry.entityId,
      productId: entry.productId,
      contractPrice: entry.contractPrice,
      markupPrice: entry.markupPrice,
      minQuantity: entry.minQuantity,
      maxQuantity: entry.maxQuantity,
      effectiveDate: entry.effectiveDate.split('T')[0],
      expiryDate: entry.expiryDate?.split('T')[0]
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const checkForConflicts = () => {
    if (!selectedEntry) return null;

    const newMin = newEntryData.minQuantity;
    const newMax = newEntryData.maxQuantity || 999999999;

    // When editing, exclude the current entry from the list we're checking against
    const entriesToCheck = isEditing
      ? pricingEntries.filter(entry => String(entry.id) !== String(selectedEntry.id))
      : pricingEntries;

    const conflicts = entriesToCheck.filter(entry => {
      // Only check conflicts for same product, entity, and type
      if (entry.productId !== selectedEntry.productId) return false;
      if (entry.entityId !== selectedEntry.entityId) return false;
      if (entry.type !== selectedEntry.type) return false;

      const existingMin = entry.minQuantity;
      const existingMax = entry.maxQuantity || 999999999;

      // Check if ranges overlap
      return newMin <= existingMax && newMax >= existingMin;
    });

    return conflicts.length > 0 ? conflicts : null;
  };

  const handleSavePricing = async () => {
    if (!selectedEntry) return;

    try {
      setModalMessage(null);

      const conflicts = checkForConflicts();
      if (conflicts) {
        const conflictDetails = conflicts.map(c => {
          const price = c.contractPrice ? `$${c.contractPrice.toFixed(2)}` : c.markupPrice ? `$${c.markupPrice.toFixed(2)} (markup)` : 'N/A';
          return `${price} (qty ${c.minQuantity}${c.maxQuantity ? `-${c.maxQuantity}` : '+'})`;
        }).join(', ');

        const hasUnboundedConflict = conflicts.some(c => !c.maxQuantity);
        const suggestionText = hasUnboundedConflict
          ? ' The existing tier has no max quantity (unlimited). You need to either: 1) Set a max quantity on the existing tier, or 2) Delete the existing tier first.'
          : ' Please adjust min/max quantities to avoid overlap.';

        setModalMessage({
          type: 'error',
          text: `Quantity range conflict! This range (${newEntryData.minQuantity}${newEntryData.maxQuantity ? `-${newEntryData.maxQuantity}` : '+'}) overlaps with existing tiers: ${conflictDetails}.${suggestionText}`
        });
        return;
      }

      // Check if price is below cost
      const productCost = productCosts.get(selectedEntry.productId || 0);
      const priceToCheck = selectedEntry.contractPrice || selectedEntry.markupPrice;

      if (productCost?.cost_price && priceToCheck && priceToCheck < productCost.cost_price) {
        const lossPerUnit = productCost.cost_price - priceToCheck;

        // Show alert to admin
        const confirmed = window.confirm(
          `⚠️ BELOW-COST PRICING WARNING ⚠️\n\n` +
          `Product: ${productCost.product_name || 'Product ' + selectedEntry.productId}\n` +
          `Your Cost: $${productCost.cost_price.toFixed(2)}\n` +
          `Your Price: $${priceToCheck.toFixed(2)}\n` +
          `Loss Per Unit: $${lossPerUnit.toFixed(2)}\n\n` +
          `This pricing will result in a LOSS on every sale!\n\n` +
          `Are you sure you want to continue?\n\n` +
          `If you click OK, you MUST provide a business justification in the next step.`
        );

        if (!confirmed) {
          return;
        }

        // If confirmed but no override reason provided, prompt for it
        if (!newEntryData.overrideReason || newEntryData.overrideReason.trim() === '') {
          setModalMessage({
            type: 'error',
            text: 'Business justification is required for below-cost pricing. Please scroll down and provide a reason in the "Business Justification" field.'
          });

          // Automatically check the override checkbox and scroll to it
          setNewEntryData({
            ...newEntryData,
            allowBelowCost: true
          });
          return;
        }

        // Set the override flag since admin confirmed
        if (!newEntryData.allowBelowCost) {
          setNewEntryData({
            ...newEntryData,
            allowBelowCost: true
          });
        }
      }

      const result = await contractPricingService.setContractPrice(
        selectedEntry.entityId!,
        selectedEntry.productId!,
        selectedEntry.contractPrice,
        selectedEntry.type as PricingType,
        newEntryData.minQuantity,
        newEntryData.maxQuantity,
        newEntryData.effectiveDate,
        newEntryData.expiryDate,
        selectedEntry.markupPrice,
        isEditing ? selectedEntry.id : undefined,
        newEntryData.allowBelowCost,
        newEntryData.overrideReason
      );

      if (result.success) {
        // Log the below-cost approval if applicable
        if (newEntryData.allowBelowCost && productCost?.cost_price && priceToCheck && priceToCheck < productCost.cost_price) {
          try {
            const { data: profileData } = await supabase.auth.getUser();

            await supabase.from('below_cost_pricing_audit').insert({
              pricing_id: result.data?.id,
              product_id: selectedEntry.productId!,
              contract_price: priceToCheck,
              product_cost: productCost.cost_price,
              override_reason: newEntryData.overrideReason,
              approved_by: profileData.user?.id
            });
          } catch (auditError) {
            console.error('Failed to log below-cost pricing audit:', auditError);
          }
        }

        setModalMessage({ type: 'success', text: 'Pricing saved successfully!' });
        setIsModalOpen(false);
        setSelectedEntry(null);

        setTimeout(async () => {
          await fetchPricingEntries();
        }, 500);
      } else {
        setModalMessage({ type: 'error', text: result.error || 'Failed to save pricing' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save pricing';
      setModalMessage({ type: 'error', text: errorMessage });
      setError(errorMessage);
    }
  };

  const handleDeletePricing = async (entry: PricingEntry) => {
    if (!confirm('Are you sure you want to delete this pricing entry?')) {
      return;
    }

    try {
      const result = await contractPricingService.removeContractPriceById(entry.id);

      if (result.success) {
        // Refresh pricing data after a short delay
        setTimeout(async () => {
          await fetchPricingEntries();
        }, 500);
      } else {
        setError(result.error || 'Failed to delete pricing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pricing');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return User;
      case 'organization': return Building2;
      case 'location': return MapPin;
      default: return DollarSign;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'individual': return 'bg-blue-100 text-blue-800';
      case 'organization': return 'bg-green-100 text-green-800';
      case 'location': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEntries = pricingEntries.filter(entry => {
    const matchesSearch = 
      entry.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Pricing</h2>
          <p className="text-gray-600">
            {organizationId
              ? 'Manage contract pricing for this organization and its locations'
              : 'Manage contract pricing for users, organizations, and locations'
            }
          </p>
        </div>
        <div className="flex space-x-3">
          {profile?.role === 'admin' && (
            <button
              onClick={handleBulkImport}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Upload className="h-5 w-5" />
              <span>Bulk Import</span>
            </button>
          )}
          <button
            onClick={handleOpenMultiProductForm}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Multi-Product Form</span>
          </button>
          <button
            onClick={handleCreatePricing}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add Single Pricing</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by entity or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="individual">Individual</option>
          <option value="organization">Organization</option>
          <option value="location">Location</option>
        </select>
      </div>

      {/* Pricing Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regular Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Markup Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Savings/Markup
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => {
                const TypeIcon = getTypeIcon(entry.type);

                const hasConflict = pricingEntries.some(other => {
                  if (other.id === entry.id) return false;
                  if (other.productId !== entry.productId) return false;
                  if (other.entityId !== entry.entityId) return false;
                  if (other.type !== entry.type) return false;

                  const entryMin = entry.minQuantity;
                  const entryMax = entry.maxQuantity || 999999999;
                  const otherMin = other.minQuantity;
                  const otherMax = other.maxQuantity || 999999999;

                  return entryMin <= otherMax && entryMax >= otherMin;
                });

                return (
                  <tr key={entry.id} className={hasConflict ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditPricing(entry)}
                          className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                          title="Edit Pricing"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePricing(entry)}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete Pricing"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TypeIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{entry.entityName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{entry.productName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${entry.regularPrice.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.contractPrice ? (
                        <div className="text-sm font-medium text-green-600">${entry.contractPrice.toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.markupPrice ? (
                        <div className="text-sm font-medium text-blue-600">${entry.markupPrice.toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.contractPrice && entry.savings > 0 ? (
                        <div className="text-sm text-green-600">-${entry.savings.toFixed(2)}</div>
                      ) : entry.markupPrice && entry.markupPrice > entry.regularPrice ? (
                        <div className="text-sm text-blue-600">+${(entry.markupPrice - entry.regularPrice).toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm text-gray-900">
                          {entry.minQuantity}
                          {entry.maxQuantity ? ` - ${entry.maxQuantity}` : '+'}
                        </div>
                        {hasConflict && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Conflict
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(entry.effectiveDate).toLocaleDateString()}
                        {entry.expiryDate && (
                          <div className="text-xs text-gray-500">
                            Expires: {new Date(entry.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pricing entries found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || typeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first pricing entry.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? 'Edit Pricing' : 'Create Pricing'}
                    </h3>
                    
                    {/* Modal Message */}
                    {modalMessage && (
                      <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                        modalMessage.type === 'success' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <span className={`text-sm ${
                          modalMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {modalMessage.text}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {!organizationId && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pricing Type *
                          </label>
                          <select
                            value={selectedEntry.type}
                            onChange={(e) => {
                              const newType = e.target.value as PricingType;
                              setSelectedEntry({
                                ...selectedEntry, 
                                type: newType,
                                entityId: '',
                                entityName: ''
                              });
                              setNewEntryData({
                                ...newEntryData,
                                type: newType,
                                entityId: ''
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="individual">Individual User</option>
                            <option value="organization">Organization</option>
                            <option value="location">Location</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {selectedEntry.type === 'individual' ? 'User *' : 
                           selectedEntry.type === 'organization' ? 'Organization *' : 
                           'Location *'}
                        </label>
                        {selectedEntry.type === 'individual' ? (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const user = users.find(u => u.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: user?.email || ''
                              });
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a user...</option>
                            {users.map(user => (
                              <option key={user.id} value={user.id}>{user.email}</option>
                            ))}
                          </select>
                        ) : selectedEntry.type === 'organization' ? (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const org = organizations.find(o => o.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: org?.name || ''
                              });
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select an organization...</option>
                            {organizations.map(org => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const location = locations.find(l => l.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: location?.name || ''
                              });
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a location...</option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>{location.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product *
                        </label>
                        <select
                          value={selectedEntry.productId}
                          onChange={(e) => {
                            const productId = parseInt(e.target.value);
                            const product = products.find(p => p.id === productId);
                            setSelectedEntry({
                              ...selectedEntry, 
                              productId,
                              productName: product?.name || '',
                              regularPrice: product?.price || 0,
                              savings: (product?.price || 0) - selectedEntry.contractPrice
                            });
                            setNewEntryData({
                              ...newEntryData,
                              productId
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} - ${product.price}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Regular Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.regularPrice}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Cost {isCostAdmin && productCosts.get(selectedEntry.productId || 0)?.secret_cost && '(Public Cost)'}
                        </label>
                        {productCosts.get(selectedEntry.productId || 0)?.cost_price ? (
                          <div className="flex items-center space-x-2 mb-3">
                            <input
                              type="number"
                              step="0.01"
                              value={productCosts.get(selectedEntry.productId || 0)?.cost_price || 0}
                              readOnly
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 font-semibold"
                            />
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" title="Prices cannot be set below cost without admin override" />
                          </div>
                        ) : (
                          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-700">No cost data available for validation</p>
                          </div>
                        )}
                      </div>

                      {isCostAdmin && productCosts.get(selectedEntry.productId || 0)?.secret_cost && (
                        <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50 mb-3">
                          <div className="flex items-start space-x-2 mb-2">
                            <Eye className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-bold text-red-900">TRUE COST (Confidential)</h4>
                              <p className="text-xs text-red-700">Only visible to cost admins. This is your actual acquisition cost.</p>
                            </div>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={productCosts.get(selectedEntry.productId || 0)?.secret_cost || 0}
                            readOnly
                            className="w-full border border-red-400 rounded-lg px-3 py-2 bg-white font-bold text-red-900 text-lg"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract Price (Discounted) {!productSettings.get(selectedEntry.productId || 0)?.allowMarkup && '*'}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          {productSettings.get(selectedEntry.productId || 0)?.allowMarkup
                            ? 'Optional when markup price is set. Set a price BELOW retail for standard discounted pricing.'
                            : 'Required. Set a price BELOW retail. This is the standard discounted price.'
                          }
                        </p>
                        {productCosts.get(selectedEntry.productId || 0)?.cost_price &&
                         selectedEntry.contractPrice &&
                         selectedEntry.contractPrice < (productCosts.get(selectedEntry.productId || 0)?.cost_price || 0) && (
                          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">
                              Warning: Price is below cost! You will lose ${((productCosts.get(selectedEntry.productId || 0)?.cost_price || 0) - (selectedEntry.contractPrice || 0)).toFixed(2)} per unit.
                            </p>
                          </div>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.contractPrice || ''}
                          onChange={(e) => {
                            const contractPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                            setSelectedEntry({
                              ...selectedEntry,
                              contractPrice,
                              savings: contractPrice ? (selectedEntry.regularPrice || 0) - contractPrice : 0
                            });
                            setNewEntryData({
                              ...newEntryData,
                              contractPrice: contractPrice || 0
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={productSettings.get(selectedEntry.productId || 0)?.allowMarkup ? 'Optional if markup is set' : 'Required'}
                        />
                      </div>

                      {productCosts.get(selectedEntry.productId || 0)?.cost_price &&
                       selectedEntry.contractPrice &&
                       selectedEntry.contractPrice < (productCosts.get(selectedEntry.productId || 0)?.cost_price || 0) && (
                        <div className="border-2 border-amber-300 rounded-lg p-4 bg-amber-50">
                          <div className="flex items-start space-x-2 mb-3">
                            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-semibold text-amber-900 mb-1">Admin Override Required</h4>
                              <p className="text-xs text-amber-700">This price is below cost and requires admin approval with justification.</p>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newEntryData.allowBelowCost}
                                onChange={(e) => {
                                  setNewEntryData({
                                    ...newEntryData,
                                    allowBelowCost: e.target.checked
                                  });
                                }}
                                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="text-sm font-medium text-amber-900">I authorize below-cost pricing (Admin only)</span>
                            </label>
                          </div>

                          {newEntryData.allowBelowCost && (
                            <div>
                              <label className="block text-sm font-medium text-amber-900 mb-1">
                                Business Justification *
                              </label>
                              <textarea
                                value={newEntryData.overrideReason}
                                onChange={(e) => {
                                  setNewEntryData({
                                    ...newEntryData,
                                    overrideReason: e.target.value
                                  });
                                }}
                                className="w-full border border-amber-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                rows={3}
                                placeholder="Provide a business justification for below-cost pricing (e.g., promotional loss leader, contract obligation, inventory clearance)"
                                required
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {productSettings.get(selectedEntry.productId || 0)?.allowMarkup && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Markup Price (Optional)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                              Set a price ABOVE retail. Sales rep gets 100% of the markup.
                            </p>
                            <input
                              type="number"
                              step="0.01"
                              value={selectedEntry.markupPrice || ''}
                              onChange={(e) => {
                                const markupPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                                setSelectedEntry({
                                  ...selectedEntry,
                                  markupPrice
                                });
                                setNewEntryData({
                                  ...newEntryData,
                                  markupPrice
                                });
                              }}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="Leave empty for normal retail price"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Markup Amount (Rep keeps 100%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={selectedEntry.markupPrice ? (selectedEntry.markupPrice - (selectedEntry.regularPrice || 0)).toFixed(2) : '0.00'}
                              readOnly
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                            />
                          </div>
                        </>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Min Quantity *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newEntryData.minQuantity}
                            onChange={(e) => {
                              const minQuantity = parseInt(e.target.value) || 1;
                              setNewEntryData({
                                ...newEntryData,
                                minQuantity
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newEntryData.maxQuantity || ''}
                            onChange={(e) => {
                              const maxQuantity = e.target.value ? parseInt(e.target.value) : undefined;
                              setNewEntryData({
                                ...newEntryData,
                                maxQuantity
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Leave empty for unlimited"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Effective Date *
                          </label>
                          <input
                            type="date"
                            value={newEntryData.effectiveDate}
                            onChange={(e) => {
                              setNewEntryData({
                                ...newEntryData,
                                effectiveDate: e.target.value
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={newEntryData.expiryDate || ''}
                            onChange={(e) => {
                              setNewEntryData({
                                ...newEntryData,
                                expiryDate: e.target.value || undefined
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800 font-medium mb-1">Pricing Information</p>
                        <p className="text-xs text-blue-700">
                          This price will apply when ordering between {newEntryData.minQuantity} and {newEntryData.maxQuantity || '∞'} units
                          from {newEntryData.effectiveDate} {newEntryData.expiryDate ? `until ${newEntryData.expiryDate}` : 'indefinitely'}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSavePricing}
                  disabled={
                    (!selectedEntry.contractPrice && !selectedEntry.markupPrice) ||
                    !selectedEntry.productId ||
                    !selectedEntry.entityId ||
                    !newEntryData.minQuantity ||
                    !newEntryData.effectiveDate
                  }
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update' : 'Create'} Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsBulkImportOpen(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center space-x-2">
                      <Upload className="h-6 w-6 text-blue-600" />
                      <span>Bulk Import Contract Pricing</span>
                    </h3>

                    <div className="space-y-4">
                      {/* Instructions */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>How to use bulk import (Admin Only):</span>
                        </h4>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Download the CSV template pre-filled with products and organizations</li>
                          <li>Template includes retail prices, cost prices{isCostAdmin ? ', and secret costs' : ''}</li>
                          <li>Edit the "Contract Price" column to set discounted prices</li>
                          <li>Optionally add markup prices or adjust quantities</li>
                          <li>Upload the completed CSV or paste the data below</li>
                          <li>Click "Process Import" to import all entries</li>
                        </ol>
                        {isCostAdmin && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-xs text-red-700 font-medium">
                              <Shield className="inline w-3 h-3 mr-1" />
                              Secret Cost column is visible only to cost admins
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Template Download */}
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">CSV Template</h4>
                          <p className="text-xs text-gray-600">Download a pre-formatted template with examples</p>
                        </div>
                        <button
                          onClick={handleDownloadTemplate}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Template</span>
                        </button>
                      </div>

                      {/* File Upload */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                        >
                          <Upload className="h-5 w-5" />
                          <span>Upload CSV File</span>
                        </button>
                      </div>

                      {/* CSV Data Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Or Paste CSV Data Here:
                        </label>
                        <textarea
                          value={bulkImportData}
                          onChange={(e) => setBulkImportData(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                          rows={10}
                          placeholder={isCostAdmin
                            ? "Type,Entity Name/Email,Product Name,Retail Price,Cost Price,Secret Cost,Contract Price,Markup Price,Min Quantity,Max Quantity,Effective Date,Expiry Date\norganization,Example Org,Product A,150.00,75.00,60.00,99.99,149.99,1,100,2025-01-01,2025-12-31"
                            : "Type,Entity Name/Email,Product Name,Retail Price,Cost Price,Contract Price,Markup Price,Min Quantity,Max Quantity,Effective Date,Expiry Date\norganization,Example Org,Product A,150.00,75.00,99.99,149.99,1,100,2025-01-01,2025-12-31"
                          }
                        />
                      </div>

                      {/* Import Results */}
                      {(bulkImportResults.success > 0 || bulkImportResults.failed > 0) && (
                        <div className="border rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Import Results</h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-green-50 border border-green-200 rounded p-3">
                              <div className="text-2xl font-bold text-green-600">{bulkImportResults.success}</div>
                              <div className="text-xs text-green-700">Successful</div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                              <div className="text-2xl font-bold text-red-600">{bulkImportResults.failed}</div>
                              <div className="text-xs text-red-700">Failed</div>
                            </div>
                          </div>
                          {bulkImportResults.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <h5 className="text-xs font-semibold text-red-900 mb-2">Errors:</h5>
                              <ul className="text-xs text-red-700 space-y-1">
                                {bulkImportResults.errors.map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={processBulkImport}
                  disabled={!bulkImportData.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process Import
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Product Pricing Form Modal */}
      {isMultiProductFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsMultiProductFormOpen(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center space-x-2">
                      <DollarSign className="h-6 w-6 text-green-600" />
                      <span>Multi-Product Contract Pricing</span>
                    </h3>

                    {modalMessage && (
                      <div className={`mb-4 p-3 rounded-lg ${modalMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {modalMessage.text}
                      </div>
                    )}

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
                        {error}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Entity Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pricing Type
                          </label>
                          <select
                            value={multiProductFormData.type}
                            onChange={(e) => {
                              // Reset products to empty when changing type
                              const emptyProducts = products.map(product => ({
                                productId: product.id,
                                contractPrice: '',
                                markupPrice: '',
                                minQuantity: '1',
                                maxQuantity: ''
                              }));

                              setMultiProductFormData({
                                ...multiProductFormData,
                                type: e.target.value as PricingType,
                                entityId: '',
                                products: emptyProducts
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          >
                            <option value="organization">Organization</option>
                            <option value="location">Location</option>
                            <option value="individual">Individual User</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {multiProductFormData.type === 'organization' ? 'Organization' :
                             multiProductFormData.type === 'location' ? 'Location' : 'User'}
                          </label>
                          <select
                            value={multiProductFormData.entityId}
                            onChange={(e) => {
                              const newEntityId = e.target.value;

                              // Reload pricing for the newly selected entity
                              const updatedProducts = products.map(product => {
                                const existingPricing = pricingEntries.find(entry =>
                                  entry.productId === product.id &&
                                  entry.entityId === newEntityId &&
                                  entry.type === multiProductFormData.type
                                );

                                return {
                                  productId: product.id,
                                  contractPrice: existingPricing?.contractPrice?.toString() || '',
                                  markupPrice: existingPricing?.markupPrice?.toString() || '',
                                  minQuantity: existingPricing?.minQuantity?.toString() || '1',
                                  maxQuantity: existingPricing?.maxQuantity?.toString() || ''
                                };
                              });

                              setMultiProductFormData({
                                ...multiProductFormData,
                                entityId: newEntityId,
                                products: updatedProducts
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          >
                            <option value="">Select...</option>
                            {multiProductFormData.type === 'organization' && organizations.map(org => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                            {multiProductFormData.type === 'location' && locations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                            {multiProductFormData.type === 'individual' && users.map(user => (
                              <option key={user.id} value={user.id}>{user.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Date Range */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Effective Date
                          </label>
                          <input
                            type="date"
                            value={multiProductFormData.effectiveDate}
                            onChange={(e) => setMultiProductFormData({
                              ...multiProductFormData,
                              effectiveDate: e.target.value
                            })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiry Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={multiProductFormData.expiryDate || ''}
                            onChange={(e) => setMultiProductFormData({
                              ...multiProductFormData,
                              expiryDate: e.target.value || undefined
                            })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Products Table */}
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Product Pricing (enter prices for products you want to update)
                        </h4>
                        <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Retail Price</th>
                                {isCostAdmin && (
                                  <>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Secret Cost</th>
                                  </>
                                )}
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contract Price</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Markup Price</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min Qty</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Qty</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {multiProductFormData.products.map((productData, index) => {
                                const product = products.find(p => p.id === productData.productId);
                                if (!product) return null;
                                const cost = productCosts.get(product.id);

                                return (
                                  <tr key={productData.productId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-700">${product.price.toFixed(2)}</td>
                                    {isCostAdmin && (
                                      <>
                                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                                          {cost?.cost_price ? `$${cost.cost_price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-red-700 font-medium">
                                          {cost?.secret_cost ? `$${cost.secret_cost.toFixed(2)}` : '-'}
                                        </td>
                                      </>
                                    )}
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={productData.contractPrice}
                                        onChange={(e) => {
                                          const newProducts = [...multiProductFormData.products];
                                          newProducts[index].contractPrice = e.target.value;
                                          setMultiProductFormData({
                                            ...multiProductFormData,
                                            products: newProducts
                                          });
                                        }}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={productData.markupPrice}
                                        onChange={(e) => {
                                          const newProducts = [...multiProductFormData.products];
                                          newProducts[index].markupPrice = e.target.value;
                                          setMultiProductFormData({
                                            ...multiProductFormData,
                                            products: newProducts
                                          });
                                        }}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        value={productData.minQuantity}
                                        onChange={(e) => {
                                          const newProducts = [...multiProductFormData.products];
                                          newProducts[index].minQuantity = e.target.value;
                                          setMultiProductFormData({
                                            ...multiProductFormData,
                                            products: newProducts
                                          });
                                        }}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        value={productData.maxQuantity}
                                        onChange={(e) => {
                                          const newProducts = [...multiProductFormData.products];
                                          newProducts[index].maxQuantity = e.target.value;
                                          setMultiProductFormData({
                                            ...multiProductFormData,
                                            products: newProducts
                                          });
                                        }}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                        placeholder="∞"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Tip: Leave contract price empty for products you don't want to update. Enter either contract price (discount) or markup price (premium).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleMultiProductFormSubmit}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save All Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setIsMultiProductFormOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingManagement;