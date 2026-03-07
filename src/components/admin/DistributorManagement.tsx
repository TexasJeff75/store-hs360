import React, { useState, useEffect } from 'react';
import {
  Users, Building, Plus, CreditCard as Edit2, Trash2, X, Save,
  TrendingUp, DollarSign, Building2, Percent, Package,
  ChevronDown, UserPlus, Pencil, Upload,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

// ── Commission type config ───────────────────────────────────────────────────

export type CommissionType =
  | 'percent_gross_sales'
  | 'percent_margin'
  | 'percent_net_sales'
  | 'flat_per_order'
  | 'flat_per_unit';

const COMMISSION_TYPES: {
  value: CommissionType;
  label: string;
  description: string;
  rateLabel: string;
  rateUnit: string;
  isFlat: boolean;
}[] = [
  {
    value: 'percent_margin',
    label: '% of Margin',
    description: 'Percentage of (contracted price − product cost)',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'percent_gross_sales',
    label: '% of Gross Sales',
    description: 'Percentage of the total order value before any deductions',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'percent_net_sales',
    label: '% of Net Sales',
    description: 'Percentage of order value after discounts / credits',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'flat_per_order',
    label: 'Flat per Order',
    description: 'Fixed dollar amount earned for each order placed',
    rateLabel: 'Amount',
    rateUnit: '$',
    isFlat: true,
  },
  {
    value: 'flat_per_unit',
    label: 'Flat per Unit',
    description: 'Fixed dollar amount earned for each unit sold',
    rateLabel: 'Amount',
    rateUnit: '$',
    isFlat: true,
  },
];

function getCommissionTypeConfig(value: CommissionType) {
  return COMMISSION_TYPES.find((t) => t.value === value) ?? COMMISSION_TYPES[0];
}

function commissionRateLabel(type: CommissionType, rate: number) {
  const cfg = getCommissionTypeConfig(type);
  return cfg.isFlat ? `$${Number(rate).toFixed(2)}` : `${rate}%`;
}

function generateDistributorCode(name: string, existingCodes: string[]): string {
  if (!name.trim()) return '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  let base: string;
  if (words.length >= 2) {
    base = words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  } else {
    base = words[0].replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  }
  if (!base) return '';
  const codesSet = new Set(existingCodes.map((c) => c.toUpperCase()));
  if (!codesSet.has(base)) return base;
  let i = 2;
  while (codesSet.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface SimpleProduct {
  id: number;
  name: string;
  sku: string | null;
  category_id: string | null;
}

interface SimpleCategory {
  id: string;
  name: string;
}

interface CommissionRule {
  id: string;
  distributor_id: string;
  organization_id: string | null;
  scope: 'product' | 'category';
  product_id: number | null;
  category_id: string | null;
  commission_type: CommissionType;
  commission_rate: number;
  use_customer_price: boolean;
  is_active: boolean;
  notes: string | null;
}

interface Distributor {
  id: string;
  profile_id: string;
  name: string;
  code: string;
  commission_rate: number;
  commission_type: CommissionType;
  pricing_model: 'margin_split' | 'wholesale';
  use_customer_price: boolean;
  is_active: boolean;
  notes?: string;
  company_rep_id?: string | null;
  company_rep_rate: number;
  created_at: string;
  profiles?: { email: string };
}

interface DistributorProductPrice {
  id: string;
  distributor_id: string;
  product_id: number;
  wholesale_price: number;
  is_active: boolean;
  notes?: string;
}

interface DistributorCustomer {
  id: string;
  distributor_id: string;
  organization_id: string;
  is_active: boolean;
  notes?: string;
  organizations: { name: string; code: string };
}

interface SalesRep {
  id: string;
  email: string;
  role: string;
}

interface DistributorSalesRep {
  id: string;
  distributor_id: string;
  sales_rep_id: string;
  commission_split_type: 'percentage_of_distributor' | 'fixed_with_override';
  sales_rep_rate: number;
  distributor_override_rate?: number;
  is_active: boolean;
  notes?: string;
  profiles?: { email: string };
}

// ── Component ────────────────────────────────────────────────────────────────

const DistributorManagement: React.FC = () => {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [availableUsers, setAvailableUsers] = useState<SalesRep[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [distributorCustomers, setDistributorCustomers] = useState<DistributorCustomer[]>([]);
  const [distributorSalesReps, setDistributorSalesReps] = useState<DistributorSalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDistributor, setShowAddDistributor] = useState(false);
  const [showAddSalesRep, setShowAddSalesRep] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [showAddRule, setShowAddRule] = useState<string | null>(null); // distributor id
  const [newRule, setNewRule] = useState({
    scope: 'product' as 'product' | 'category',
    organization_id: '' as string, // empty = all customers
    product_id: '' as string,
    category_id: '' as string,
    commission_type: 'percent_margin' as CommissionType,
    commission_rate: 0,
    use_customer_price: false,
    notes: '',
  });

  const [newDistributor, setNewDistributor] = useState({
    profile_id: '',
    name: '',
    code: '',
    commission_rate: 45,
    commission_type: 'percent_margin' as CommissionType,
    pricing_model: 'margin_split' as 'margin_split' | 'wholesale',
    notes: '',
  });

  // Wholesale product pricing state
  const [distributorProductPricing, setDistributorProductPricing] = useState<DistributorProductPrice[]>([]);
  const [showAddPricing, setShowAddPricing] = useState<string | null>(null); // distributor id
  const [newPricing, setNewPricing] = useState({ product_id: '', wholesale_price: 0, notes: '' });

  // Inline user creation state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Auto-code and commission collapse
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [showCommissionFields, setShowCommissionFields] = useState(false);

  // Inline sales rep user creation state
  const [showCreateSalesRepUser, setShowCreateSalesRepUser] = useState(false);
  const [newSalesRepEmail, setNewSalesRepEmail] = useState('');
  const [newSalesRepPassword, setNewSalesRepPassword] = useState('');
  const [isCreatingSalesRepUser, setIsCreatingSalesRepUser] = useState(false);

  const [newDistributorSalesRep, setNewDistributorSalesRep] = useState({
    sales_rep_id: '',
    commission_split_type: 'percentage_of_distributor' as 'percentage_of_distributor' | 'fixed_with_override',
    sales_rep_rate: 50,
    distributor_override_rate: 0,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [distributorsRes, orgsRes, allUsersRes, salesRepsRes, distSalesRepsRes, distCustomersRes, productsRes, categoriesRes, rulesRes, pricingRes] = await Promise.all([
        supabase
          .from('distributors')
          .select('*, profiles!distributors_profile_id_fkey(email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, email, role')
          .eq('approved', true)
          .neq('role', 'admin')
          .order('email'),
        supabase
          .from('profiles')
          .select('id, email, role')
          .in('role', ['sales_rep', 'distributor'])
          .order('email'),
        supabase
          .from('distributor_sales_reps')
          .select('*, profiles!distributor_sales_reps_sales_rep_id_fkey(email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('distributor_customers')
          .select('*, organizations(name, code)')
          .eq('is_active', true),
        supabase
          .from('products')
          .select('id, name, sku, category_id')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('distributor_commission_rules')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('distributor_product_pricing')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      if (distributorsRes.error) throw distributorsRes.error;
      if (orgsRes.error) throw orgsRes.error;
      if (allUsersRes.error) throw allUsersRes.error;
      if (salesRepsRes.error) throw salesRepsRes.error;
      if (distSalesRepsRes.error) throw distSalesRepsRes.error;
      if (distCustomersRes.error) throw distCustomersRes.error;
      // Products/categories/rules/pricing may not exist yet — non-fatal
      if (!productsRes.error) setProducts(productsRes.data || []);
      if (!categoriesRes.error) setCategories(categoriesRes.data || []);
      if (!rulesRes.error) setCommissionRules((rulesRes.data as CommissionRule[]) || []);
      if (!pricingRes.error) setDistributorProductPricing((pricingRes.data as DistributorProductPrice[]) || []);

      const distData = (distributorsRes.data as Distributor[]) || [];
      setDistributors(distData);
      setOrganizations(orgsRes.data || []);
      setDistributorCustomers((distCustomersRes.data as DistributorCustomer[]) || []);

      // Filter out users who already have a distributor record
      const existingProfileIds = new Set(distData.map(d => d.profile_id));
      setAvailableUsers((allUsersRes.data || []).filter(u => !existingProfileIds.has(u.id)));

      setSalesReps(salesRepsRes.data || []);
      setDistributorSalesReps(distSalesRepsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const payload = {
        ...newDistributor,
        user_id: newDistributor.profile_id,
      };
      const { error: insertError } = await supabase.from('distributors').insert([payload]);
      if (insertError) throw insertError;

      setSuccess('Distributor created successfully');
      setShowAddDistributor(false);
      setNewDistributor({
        profile_id: '',
        name: '',
        code: '',
        commission_rate: 45,
        commission_type: 'percent_margin',
        pricing_model: 'margin_split',
        notes: '',
      });
      setCodeManuallyEdited(false);
      setShowCommissionFields(false);
      setShowCreateUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create distributor');
    }
  };

  const handleCreateDistributorUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setError('Email and password are required');
      return;
    }
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setIsCreatingUser(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            role: 'distributor',
            is_approved: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'User creation failed');

      // Refresh data and auto-select the new user
      const createdEmail = newUserEmail.trim().toLowerCase();
      setNewUserEmail('');
      setNewUserPassword('');
      setShowCreateUser(false);

      // Re-fetch to get the new user in availableUsers
      const [distributorsRes, allUsersRes] = await Promise.all([
        supabase
          .from('distributors')
          .select('*, profiles!distributors_profile_id_fkey(email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, email, role')
          .eq('approved', true)
          .neq('role', 'admin')
          .order('email'),
      ]);

      if (!distributorsRes.error && !allUsersRes.error) {
        const distData = (distributorsRes.data as Distributor[]) || [];
        setDistributors(distData);
        const existingProfileIds = new Set(distData.map(d => d.profile_id));
        const freshUsers = (allUsersRes.data || []).filter(u => !existingProfileIds.has(u.id));
        setAvailableUsers(freshUsers);

        const newUser = freshUsers.find(u => u.email.toLowerCase() === createdEmail);
        if (newUser) {
          setNewDistributor(prev => ({ ...prev, profile_id: newUser.id }));
        }
      }

      setSuccess('User created and selected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCreateSalesRepUser = async () => {
    if (!newSalesRepEmail.trim() || !newSalesRepPassword.trim()) {
      setError('Email and password are required');
      return;
    }
    if (newSalesRepPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setIsCreatingSalesRepUser(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newSalesRepEmail,
            password: newSalesRepPassword,
            role: 'sales_rep',
            is_approved: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'User creation failed');

      const createdEmail = newSalesRepEmail.trim().toLowerCase();
      setNewSalesRepEmail('');
      setNewSalesRepPassword('');
      setShowCreateSalesRepUser(false);

      // Re-fetch sales reps to include the new user
      const salesRepsRes = await supabase
        .from('profiles')
        .select('id, email, role')
        .in('role', ['sales_rep', 'distributor'])
        .order('email');

      if (!salesRepsRes.error) {
        setSalesReps(salesRepsRes.data || []);
        const newUser = (salesRepsRes.data || []).find(u => u.email.toLowerCase() === createdEmail);
        if (newUser) {
          setNewDistributorSalesRep(prev => ({ ...prev, sales_rep_id: newUser.id }));
        }
      }

      setSuccess('Sales rep user created and selected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsCreatingSalesRepUser(false);
    }
  };

  const handleUpdateDistributor = async () => {
    if (!editingDistributor) return;
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('distributors')
        .update({
          name: editingDistributor.name,
          code: editingDistributor.code,
          commission_rate: editingDistributor.commission_rate,
          commission_type: editingDistributor.commission_type,
          pricing_model: editingDistributor.pricing_model,
          use_customer_price: editingDistributor.use_customer_price,
          is_active: editingDistributor.is_active,
          notes: editingDistributor.notes,
          company_rep_id: editingDistributor.company_rep_id || null,
          company_rep_rate: editingDistributor.company_rep_rate || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDistributor.id);

      if (updateError) throw updateError;

      setSuccess('Distributor updated successfully');
      setEditingDistributor(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update distributor');
    }
  };

  const handleDeleteDistributor = async (id: string) => {
    if (!confirm('Delete this distributor? All associated sales rep relationships will also be removed.')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributors').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Distributor deleted');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete distributor');
    }
  };

  const handleAddSalesRepToDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributor) return;
    try {
      setError(null);
      const { error: insertError } = await supabase.from('distributor_sales_reps').insert([{
        distributor_id: selectedDistributor,
        ...newDistributorSalesRep,
        distributor_override_rate:
          newDistributorSalesRep.commission_split_type === 'fixed_with_override'
            ? newDistributorSalesRep.distributor_override_rate
            : null,
      }]);

      if (insertError) throw insertError;

      setSuccess('Sales rep added to distributor');
      setShowAddSalesRep(false);
      setNewDistributorSalesRep({
        sales_rep_id: '',
        commission_split_type: 'percentage_of_distributor',
        sales_rep_rate: 50,
        distributor_override_rate: 0,
        notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sales rep');
    }
  };

  const handleRemoveSalesRepFromDistributor = async (id: string) => {
    if (!confirm('Remove this sales rep from the distributor?')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributor_sales_reps').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Sales rep removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sales rep');
    }
  };

  // ── Commission rules handlers ──────────────────────────────────────────────

  const getDistributorRules = (distributorId: string) =>
    commissionRules.filter((r) => r.distributor_id === distributorId);

  const handleAddCommissionRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddRule) return;
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        distributor_id: showAddRule,
        organization_id: newRule.organization_id || null,
        scope: newRule.scope,
        commission_type: newRule.commission_type,
        commission_rate: newRule.commission_rate,
        use_customer_price: newRule.use_customer_price,
        notes: newRule.notes || null,
      };
      if (newRule.scope === 'product') {
        payload.product_id = parseInt(newRule.product_id, 10);
        payload.category_id = null;
      } else {
        payload.category_id = newRule.category_id;
        payload.product_id = null;
      }

      const { error: insertError } = await supabase.from('distributor_commission_rules').insert([payload]);
      if (insertError) throw insertError;

      setSuccess('Commission rule added');
      setShowAddRule(null);
      setNewRule({
        scope: 'product',
        organization_id: '',
        product_id: '',
        category_id: '',
        commission_type: 'percent_margin',
        commission_rate: 0,
        use_customer_price: false,
        notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add commission rule');
    }
  };

  const handleDeleteCommissionRule = async (id: string) => {
    if (!confirm('Remove this commission rule?')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributor_commission_rules').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Commission rule removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove commission rule');
    }
  };

  // ── Wholesale product pricing handlers ────────────────────────────────────
  const getDistributorPricing = (distributorId: string) =>
    distributorProductPricing.filter((p) => p.distributor_id === distributorId);

  const handleAddProductPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddPricing) return;
    try {
      setError(null);
      const { error: insertError } = await supabase.from('distributor_product_pricing').insert([{
        distributor_id: showAddPricing,
        product_id: parseInt(newPricing.product_id, 10),
        wholesale_price: newPricing.wholesale_price,
        notes: newPricing.notes || null,
      }]);
      if (insertError) throw insertError;
      setSuccess('Wholesale price added');
      setShowAddPricing(null);
      setNewPricing({ product_id: '', wholesale_price: 0, notes: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add wholesale price');
    }
  };

  const handleCsvUploadPricing = async (distributorId: string, file: File) => {
    try {
      setError(null);
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row');
        return;
      }

      // Parse header — look for product_id/sku and wholesale_price columns
      const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
      const skuIdx = header.findIndex((h) => ['sku', 'product_sku'].includes(h));
      const idIdx = header.findIndex((h) => ['product_id', 'id', 'productid'].includes(h));
      const priceIdx = header.findIndex((h) => ['wholesale_price', 'price', 'cost', 'wholesale_cost', 'wholesale'].includes(h));
      const notesIdx = header.findIndex((h) => ['notes', 'note'].includes(h));

      if (priceIdx === -1) {
        setError('CSV must have a "wholesale_price" (or "price"/"cost") column');
        return;
      }
      if (skuIdx === -1 && idIdx === -1) {
        setError('CSV must have a "sku" or "product_id" column to identify products');
        return;
      }

      const rows: { product_id: number; wholesale_price: number; notes: string | null }[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const price = parseFloat(cols[priceIdx]);
        if (isNaN(price) || price < 0) {
          errors.push(`Row ${i + 1}: invalid price "${cols[priceIdx]}"`);
          continue;
        }

        let productId: number | null = null;

        if (idIdx !== -1 && cols[idIdx]) {
          productId = parseInt(cols[idIdx], 10);
          if (isNaN(productId)) {
            errors.push(`Row ${i + 1}: invalid product_id "${cols[idIdx]}"`);
            continue;
          }
        } else if (skuIdx !== -1 && cols[skuIdx]) {
          const sku = cols[skuIdx];
          const product = products.find((p) => p.sku === sku);
          if (!product) {
            errors.push(`Row ${i + 1}: SKU "${sku}" not found`);
            continue;
          }
          productId = product.id;
        }

        if (productId === null) {
          errors.push(`Row ${i + 1}: no product identifier`);
          continue;
        }

        rows.push({
          product_id: productId,
          wholesale_price: price,
          notes: notesIdx !== -1 ? cols[notesIdx] || null : null,
        });
      }

      if (rows.length === 0) {
        setError(`No valid rows found. ${errors.join('; ')}`);
        return;
      }

      // Upsert rows (on conflict update wholesale_price)
      const payload = rows.map((r) => ({
        distributor_id: distributorId,
        product_id: r.product_id,
        wholesale_price: r.wholesale_price,
        notes: r.notes,
        is_active: true,
      }));

      const { error: upsertError } = await supabase
        .from('distributor_product_pricing')
        .upsert(payload, { onConflict: 'distributor_id,product_id' });

      if (upsertError) throw upsertError;

      const msg = `Uploaded ${rows.length} wholesale price(s)`;
      setSuccess(errors.length > 0 ? `${msg}. Skipped: ${errors.join('; ')}` : msg);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
    }
  };

  const handleDeleteProductPricing = async (id: string) => {
    if (!confirm('Remove this wholesale price?')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributor_product_pricing').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Wholesale price removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove wholesale price');
    }
  };

  const getDistributorSalesReps = (distributorId: string) =>
    distributorSalesReps.filter((dsr) => dsr.distributor_id === distributorId && dsr.is_active);

  const getDistributorCustomerOrgs = (distributorId: string) =>
    distributorCustomers.filter((dc) => dc.distributor_id === distributorId);

  const handleAddCustomerOrg = async (distributorId: string, organizationId: string) => {
    try {
      setError(null);
      const { error: insertError } = await supabase.from('distributor_customers').insert([{
        distributor_id: distributorId,
        organization_id: organizationId,
      }]);
      if (insertError) throw insertError;
      setSuccess('Customer organization added');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer organization');
    }
  };

  const handleRemoveCustomerOrg = async (id: string) => {
    if (!confirm('Remove this customer organization from the distributor?')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributor_customers').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Customer organization removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove customer organization');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Distributor Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage distributors, their customer accounts, commission structures, and sales rep hierarchies
          </p>
        </div>
        <button
          onClick={() => setShowAddDistributor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="h-5 w-5" />
          Add Distributor
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>
      )}

      {/* Empty state */}
      {distributors.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl py-16 text-center">
          <Building className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No distributors yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Distributor" to create one</p>
        </div>
      )}

      {/* Distributors list */}
      <div className="grid gap-6">
        {distributors.map((distributor) => {
          const typeConfig = getCommissionTypeConfig(distributor.commission_type ?? 'percent_margin');
          const rateDisplay = commissionRateLabel(distributor.commission_type ?? 'percent_margin', distributor.commission_rate);
          const reps = getDistributorSalesReps(distributor.id);

          return (
            <div key={distributor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {editingDistributor?.id === distributor.id ? (
                /* ── Edit mode ─────────────────────────────────────────── */
                <EditDistributorForm
                  distributor={editingDistributor}
                  onChange={setEditingDistributor}
                  onSave={handleUpdateDistributor}
                  onCancel={() => setEditingDistributor(null)}
                  salesReps={salesReps}
                />
              ) : (
                /* ── View mode ─────────────────────────────────────────── */
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg shrink-0">
                        <Building className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-gray-900">{distributor.name}</h3>
                        <p className="text-sm text-gray-500">Code: {distributor.code}</p>
                        <p className="text-sm text-gray-500">User: {distributor.profiles?.email ?? 'N/A'}</p>

                        {/* Customer organizations */}
                        {(() => {
                          const custOrgs = getDistributorCustomerOrgs(distributor.id);
                          const linkedOrgIds = new Set(custOrgs.map(dc => dc.organization_id));
                          const availableOrgs = organizations.filter(o => !linkedOrgIds.has(o.id));
                          return (
                            <div className="mt-2">
                              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-gray-500">
                                <Building2 className="h-3.5 w-3.5" />
                                Customers ({custOrgs.length})
                              </div>
                              {custOrgs.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {custOrgs.map((dc) => (
                                    <span key={dc.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                                      {dc.organizations.name}
                                      <span className="text-indigo-400">({dc.organizations.code})</span>
                                      <button
                                        onClick={() => handleRemoveCustomerOrg(dc.id)}
                                        className="ml-0.5 hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                                        title="Remove"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">No customers linked</p>
                              )}
                              {availableOrgs.length > 0 && (
                                <select
                                  className="mt-1.5 text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 bg-white"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) handleAddCustomerOrg(distributor.id, e.target.value);
                                  }}
                                >
                                  <option value="">+ Add customer...</option>
                                  {availableOrgs.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name} ({org.code})</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })()}

                        {distributor.notes && (
                          <p className="text-sm text-gray-500 mt-1">{distributor.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Right-side badges + actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        distributor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {distributor.is_active ? 'Active' : 'Inactive'}
                      </span>

                      {/* Pricing model badge */}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        (distributor.pricing_model) === 'wholesale'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {(distributor.pricing_model) === 'wholesale' ? 'Wholesale' : 'Margin Split'}
                      </span>

                      {/* Commission type badge (margin_split only) */}
                      {(distributor.pricing_model ?? 'margin_split') === 'margin_split' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                        {typeConfig.isFlat
                          ? <Package className="h-3.5 w-3.5" />
                          : <Percent className="h-3.5 w-3.5" />}
                        {typeConfig.label}
                      </span>
                      )}

                      {/* Rate badge (margin_split only) */}
                      {(distributor.pricing_model ?? 'margin_split') === 'margin_split' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {rateDisplay}
                      </span>
                      )}

                      <button
                        onClick={() => setEditingDistributor(distributor)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteDistributor(distributor.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Commission / pricing explanation */}
                  <div className="mb-4 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                    {(distributor.pricing_model) === 'wholesale' ? (
                      <>
                        <strong>Model:</strong> Wholesale — distributor buys at wholesale price, keeps spread to customer price.
                        {' '}Your margin = wholesale − cost.
                        {reps.length > 0 && (
                          <>
                            {' · '}
                            <strong>Sales person splits your margin:</strong>{' '}
                            {reps.map((dsr) =>
                              `${dsr.profiles?.email?.split('@')[0]} → ${dsr.sales_rep_rate}% of your margin`
                            ).join(', ')}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>Commission basis:</strong> {typeConfig.description}
                        {' · '}
                        <strong>Distributor earns:</strong> {rateDisplay}
                        {reps.length > 0 && (
                          <>
                            {' · '}
                            <strong>Sales rep splits:</strong>{' '}
                            {reps.map((dsr) => {
                              const repEarns =
                                dsr.commission_split_type === 'percentage_of_distributor'
                                  ? `${dsr.sales_rep_rate}% of dist. commission`
                                  : typeConfig.isFlat
                                    ? `$${dsr.sales_rep_rate} per ${distributor.commission_type === 'flat_per_unit' ? 'unit' : 'order'}`
                                    : `${dsr.sales_rep_rate}% rate`;
                              return `${dsr.profiles?.email?.split('@')[0]} → ${repEarns}`;
                            }).join(', ')}
                          </>
                        )}
                      </>
                    )}
                    {distributor.company_rep_id && (() => {
                      const companyRep = salesReps.find((r) => r.id === distributor.company_rep_id);
                      return (
                        <>
                          {' · '}
                          <strong>Company rep:</strong>{' '}
                          {companyRep?.email?.split('@')[0] ?? 'Unknown'} → {distributor.company_rep_rate ?? 0}% of your margin
                        </>
                      );
                    })()}
                  </div>

                  {/* Commission Rules — only for margin_split distributors */}
                  {(distributor.pricing_model ?? 'margin_split') === 'margin_split' && (
                  <div className="pt-4 border-t border-gray-200 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Commission Rules ({getDistributorRules(distributor.id).length})
                      </h4>
                      <button
                        onClick={() => setShowAddRule(distributor.id)}
                        className="text-sm px-3 py-1 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors"
                      >
                        Add Rule
                      </button>
                    </div>

                    {getDistributorRules(distributor.id).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">
                        No per-product or per-category rules — all items use the distributor default ({rateDisplay} {typeConfig.label})
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {getDistributorRules(distributor.id).map((rule) => {
                          const rCfg = getCommissionTypeConfig(rule.commission_type);
                          const productName = rule.product_id
                            ? products.find((p) => p.id === rule.product_id)?.name ?? `Product #${rule.product_id}`
                            : null;
                          const categoryName = rule.category_id
                            ? categories.find((c) => c.id === rule.category_id)?.name ?? 'Unknown Category'
                            : null;
                          const customerName = rule.organization_id
                            ? organizations.find((o) => o.id === rule.organization_id)?.name ?? 'Unknown Customer'
                            : null;
                          return (
                            <div key={rule.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {rule.scope === 'product' ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Package className="h-3.5 w-3.5 text-violet-500" />
                                      {productName}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 className="h-3.5 w-3.5 text-violet-500" />
                                      Category: {categoryName}
                                    </span>
                                  )}
                                  {customerName ? (
                                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                      {customerName}
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                      All customers
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="font-medium text-gray-700">
                                    {commissionRateLabel(rule.commission_type, rule.commission_rate)}
                                  </span>
                                  {' · '}{rCfg.label}
                                  {rule.use_customer_price && (
                                    <span className="ml-2 text-amber-600 font-medium">
                                      (uses customer price)
                                    </span>
                                  )}
                                  {rule.notes && <span className="ml-2 text-gray-400">{rule.notes}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteCommissionRule(rule.id)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Wholesale Product Pricing — only for wholesale distributors */}
                  {(distributor.pricing_model) === 'wholesale' && (
                  <div className="pt-4 border-t border-gray-200 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Wholesale Product Pricing ({getDistributorPricing(distributor.id).length})
                      </h4>
                      <div className="flex gap-2">
                        <label className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5" />
                          Upload CSV
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCsvUploadPricing(distributor.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          onClick={() => setShowAddPricing(distributor.id)}
                          className="text-sm px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Add Price
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-3">
                      CSV format: columns <code className="bg-gray-100 px-1 rounded">sku</code> (or <code className="bg-gray-100 px-1 rounded">product_id</code>) and <code className="bg-gray-100 px-1 rounded">wholesale_price</code>. Optional: <code className="bg-gray-100 px-1 rounded">notes</code>.
                    </p>

                    {getDistributorPricing(distributor.id).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">
                        No wholesale prices set — add per-product prices the distributor pays you
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {getDistributorPricing(distributor.id).map((pp) => {
                          const product = products.find((p) => p.id === pp.product_id);
                          return (
                            <div key={pp.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  <span className="inline-flex items-center gap-1">
                                    <Package className="h-3.5 w-3.5 text-emerald-500" />
                                    {product?.name ?? `Product #${pp.product_id}`}
                                  </span>
                                  {product?.sku && (
                                    <span className="ml-2 text-xs text-gray-400">{product.sku}</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Wholesale: <span className="font-medium text-emerald-700">${pp.wholesale_price.toFixed(2)}</span>
                                  {pp.notes && <span className="ml-2 text-gray-400">{pp.notes}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteProductPricing(pp.id)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Sales reps */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Sales Representatives ({reps.length})
                      </h4>
                      <button
                        onClick={() => { setSelectedDistributor(distributor.id); setShowAddSalesRep(true); }}
                        className="text-sm px-3 py-1 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                      >
                        Add Sales Rep
                      </button>
                    </div>

                    {reps.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No sales representatives assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {reps.map((dsr) => {
                          const splitLabel =
                            dsr.commission_split_type === 'percentage_of_distributor'
                              ? `${dsr.sales_rep_rate}% of distributor commission`
                              : `Fixed ${dsr.sales_rep_rate}${typeConfig.isFlat ? '$' : '%'} + ${dsr.distributor_override_rate ?? 0}${typeConfig.isFlat ? '$' : '%'} override`;
                          return (
                            <div key={dsr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{dsr.profiles?.email}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Split: <span className="font-medium text-gray-700">{splitLabel}</span>
                                  {dsr.notes && <span className="ml-2 text-gray-400">{dsr.notes}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveSalesRepFromDistributor(dsr.id)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Distributor Modal ────────────────────────────────────────────── */}
      {showAddDistributor && (
        <Modal title="Add New Distributor" onClose={() => {
          setShowAddDistributor(false);
          setShowCreateUser(false);
          setNewUserEmail('');
          setNewUserPassword('');
          setCodeManuallyEdited(false);
          setShowCommissionFields(false);
        }}>
          <form onSubmit={handleCreateDistributor}>
            <div className="space-y-4">
              {/* ── Distributor User: select or create inline ── */}
              <Field label="Distributor User *">
                {!showCreateUser ? (
                  <div className="flex gap-2">
                    <select
                      required
                      value={newDistributor.profile_id}
                      onChange={(e) => setNewDistributor({ ...newDistributor, profile_id: e.target.value })}
                      className={`${selectCls} flex-1`}
                    >
                      <option value="">Select a user</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.email} ({u.role || 'no role'})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(true)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg whitespace-nowrap"
                    >
                      <UserPlus className="h-4 w-4" />
                      New User
                    </button>
                  </div>
                ) : (
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-700">Create New User</span>
                      <button
                        type="button"
                        onClick={() => { setShowCreateUser(false); setNewUserEmail(''); setNewUserPassword(''); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className={inputCls}
                      placeholder="Email address"
                    />
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Password (min 6 characters)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateDistributorUser}
                        disabled={isCreatingUser}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                      >
                        {isCreatingUser ? 'Creating...' : 'Create & Select'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowCreateUser(false); setNewUserEmail(''); setNewUserPassword(''); }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      User will be created with the <strong>distributor</strong> role and auto-approved.
                    </p>
                  </div>
                )}
              </Field>

              {/* ── Distributor Name ── */}
              <Field label="Distributor Name *">
                <input
                  type="text"
                  required
                  value={newDistributor.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const updates: { name: string; code?: string } = { name };
                    if (!codeManuallyEdited) {
                      updates.code = generateDistributorCode(name, distributors.map(d => d.code));
                    }
                    setNewDistributor({ ...newDistributor, ...updates });
                  }}
                  className={inputCls}
                  placeholder="ABC Distribution"
                />
              </Field>

              {/* ── Auto-generated Code ── */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Code:</span>
                  {codeManuallyEdited ? (
                    <input
                      type="text"
                      required
                      value={newDistributor.code}
                      onChange={(e) => setNewDistributor({ ...newDistributor, code: e.target.value.toUpperCase() })}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase w-32"
                    />
                  ) : (
                    <span className="text-sm font-mono font-semibold text-indigo-600">
                      {newDistributor.code || '—'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (codeManuallyEdited) {
                        // Reset to auto-generated
                        const autoCode = generateDistributorCode(newDistributor.name, distributors.map(d => d.code));
                        setNewDistributor({ ...newDistributor, code: autoCode });
                      }
                      setCodeManuallyEdited(!codeManuallyEdited);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title={codeManuallyEdited ? 'Use auto-generated code' : 'Edit code manually'}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {codeManuallyEdited ? 'Manually editing code' : 'Auto-generated from name'}
                </p>
              </div>

              {/* ── Pricing Model ── */}
              <Field label="Pricing Model *">
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    newDistributor.pricing_model === 'margin_split'
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="pricing_model"
                      value="margin_split"
                      checked={newDistributor.pricing_model === 'margin_split'}
                      onChange={() => setNewDistributor({ ...newDistributor, pricing_model: 'margin_split' })}
                      className="text-pink-600 focus:ring-pink-500"
                    />
                    <div>
                      <div className="text-sm font-medium">Margin Split</div>
                      <div className="text-xs text-gray-500">Earns % of margin</div>
                    </div>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    newDistributor.pricing_model === 'wholesale'
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="pricing_model"
                      value="wholesale"
                      checked={newDistributor.pricing_model === 'wholesale'}
                      onChange={() => setNewDistributor({ ...newDistributor, pricing_model: 'wholesale' })}
                      className="text-pink-600 focus:ring-pink-500"
                    />
                    <div>
                      <div className="text-sm font-medium">Wholesale</div>
                      <div className="text-xs text-gray-500">Buys at wholesale, keeps spread</div>
                    </div>
                  </label>
                </div>
              </Field>

              {/* ── Notes ── */}
              <Field label="Notes">
                <textarea
                  value={newDistributor.notes}
                  onChange={(e) => setNewDistributor({ ...newDistributor, notes: e.target.value })}
                  className={inputCls}
                  rows={3}
                  placeholder="Optional notes..."
                />
              </Field>

              {/* ── Commission Settings (collapsible, hidden for wholesale) ── */}
              {newDistributor.pricing_model === 'margin_split' && (
              <div className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowCommissionFields(!showCommissionFields)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  <span>
                    <span className="font-medium">Commission Settings</span>
                    <span className="text-gray-400 ml-2">
                      Default: {commissionRateLabel(newDistributor.commission_type, newDistributor.commission_rate)} {getCommissionTypeConfig(newDistributor.commission_type).label}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showCommissionFields ? 'rotate-180' : ''}`} />
                </button>
                {showCommissionFields && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                    <Field label="Commission Basis">
                      <select
                        value={newDistributor.commission_type}
                        onChange={(e) =>
                          setNewDistributor({ ...newDistributor, commission_type: e.target.value as CommissionType })
                        }
                        className={selectCls}
                      >
                        {COMMISSION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        {getCommissionTypeConfig(newDistributor.commission_type).description}
                      </p>
                    </Field>

                    <Field
                      label={`${getCommissionTypeConfig(newDistributor.commission_type).rateLabel} (${getCommissionTypeConfig(newDistributor.commission_type).rateUnit})`}
                    >
                      <input
                        type="number"
                        min="0"
                        max={getCommissionTypeConfig(newDistributor.commission_type).isFlat ? undefined : 100}
                        step="0.01"
                        value={newDistributor.commission_rate}
                        onChange={(e) =>
                          setNewDistributor({ ...newDistributor, commission_rate: parseFloat(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddDistributor(false);
                  setShowCreateUser(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setCodeManuallyEdited(false);
                  setShowCommissionFields(false);
                }}
                className={cancelBtnCls}
              >
                Cancel
              </button>
              <button type="submit" className={primaryBtnCls}>
                Create Distributor
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Sales Rep Modal ──────────────────────────────────────────────── */}
      {/* ── Add Commission Rule Modal ──────────────────────────────────────── */}
      {showAddRule && (() => {
        const dist = distributors.find((d) => d.id === showAddRule);
        const ruleCfg = getCommissionTypeConfig(newRule.commission_type);
        const distCustOrgs = getDistributorCustomerOrgs(showAddRule);
        return (
          <Modal
            title={`Add Commission Rule — ${dist?.name ?? ''}`}
            onClose={() => setShowAddRule(null)}
          >
            <form onSubmit={handleAddCommissionRule}>
              <div className="space-y-4">
                <Field label="Customer (optional)">
                  <select
                    value={newRule.organization_id}
                    onChange={(e) => setNewRule({ ...newRule, organization_id: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">All customers (global rule)</option>
                    {distCustOrgs.map((dc) => (
                      <option key={dc.organization_id} value={dc.organization_id}>
                        {dc.organizations.name} ({dc.organizations.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank to apply to all customers; select one to create a customer-specific override.
                  </p>
                </Field>

                <Field label="Applies To *">
                  <select
                    required
                    value={newRule.scope}
                    onChange={(e) =>
                      setNewRule({ ...newRule, scope: e.target.value as 'product' | 'category', product_id: '', category_id: '' })
                    }
                    className={selectCls}
                  >
                    <option value="product">Specific Product</option>
                    <option value="category">Product Category</option>
                  </select>
                </Field>

                {newRule.scope === 'product' ? (
                  <Field label="Product *">
                    <select
                      required
                      value={newRule.product_id}
                      onChange={(e) => setNewRule({ ...newRule, product_id: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">Select a product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.sku ? ` (${p.sku})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Category *">
                    <select
                      required
                      value={newRule.category_id}
                      onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">Select a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Commission Basis *">
                  <select
                    required
                    value={newRule.commission_type}
                    onChange={(e) =>
                      setNewRule({ ...newRule, commission_type: e.target.value as CommissionType })
                    }
                    className={selectCls}
                  >
                    {COMMISSION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{ruleCfg.description}</p>
                </Field>

                <Field label={`${ruleCfg.rateLabel} (${ruleCfg.rateUnit}) *`}>
                  <input
                    type="number"
                    required
                    min="0"
                    max={ruleCfg.isFlat ? undefined : 100}
                    step="0.01"
                    value={newRule.commission_rate}
                    onChange={(e) =>
                      setNewRule({ ...newRule, commission_rate: parseFloat(e.target.value) || 0 })
                    }
                    className={inputCls}
                  />
                </Field>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use_customer_price"
                    checked={newRule.use_customer_price}
                    onChange={(e) =>
                      setNewRule({ ...newRule, use_customer_price: e.target.checked })
                    }
                    className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                  />
                  <label htmlFor="use_customer_price" className="text-sm text-gray-700">
                    Use customer's actual price for margin calculation
                  </label>
                </div>
                <p className="text-xs text-gray-400 -mt-2 ml-6">
                  When checked, if a customer has a special/discounted price, the commission is
                  calculated on that lower price instead of retail — reducing the commission proportionally.
                </p>

                <Field label="Notes">
                  <textarea
                    value={newRule.notes}
                    onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })}
                    className={inputCls}
                    rows={2}
                    placeholder="e.g. Genetics test: cost $199, sell $249, keep $50"
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowAddRule(null)} className={cancelBtnCls}>
                  Cancel
                </button>
                <button type="submit" className={primaryBtnCls}>
                  Add Rule
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* ── Add Wholesale Product Pricing Modal ───────────────────────────── */}
      {showAddPricing && (() => {
        const dist = distributors.find((d) => d.id === showAddPricing);
        const existingProductIds = new Set(
          getDistributorPricing(showAddPricing).map((p) => p.product_id)
        );
        const availableProducts = products.filter((p) => !existingProductIds.has(p.id));
        return (
          <Modal
            title={`Add Wholesale Price — ${dist?.name ?? ''}`}
            onClose={() => setShowAddPricing(null)}
          >
            <form onSubmit={handleAddProductPricing}>
              <div className="space-y-4">
                <Field label="Product *">
                  <select
                    required
                    value={newPricing.product_id}
                    onChange={(e) => setNewPricing({ ...newPricing, product_id: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select a product</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` (${p.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Wholesale Price ($) *">
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newPricing.wholesale_price}
                    onChange={(e) =>
                      setNewPricing({ ...newPricing, wholesale_price: parseFloat(e.target.value) || 0 })
                    }
                    className={inputCls}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The price the distributor pays you for this product
                  </p>
                </Field>

                <Field label="Notes">
                  <textarea
                    value={newPricing.notes}
                    onChange={(e) => setNewPricing({ ...newPricing, notes: e.target.value })}
                    className={inputCls}
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowAddPricing(null)} className={cancelBtnCls}>
                  Cancel
                </button>
                <button type="submit" className={primaryBtnCls}>
                  Add Price
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {showAddSalesRep && selectedDistributor && (() => {
        const dist = distributors.find((d) => d.id === selectedDistributor);
        const typeConfig = dist ? getCommissionTypeConfig(dist.commission_type ?? 'percent_margin') : COMMISSION_TYPES[0];
        return (
          <Modal
            title={`Add Sales Rep — ${dist?.name ?? ''}`}
            onClose={() => { setShowAddSalesRep(false); setShowCreateSalesRepUser(false); setNewSalesRepEmail(''); setNewSalesRepPassword(''); }}
          >
            {dist && (
              <div className="mb-4 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg text-xs text-violet-700">
                <strong>Distributor commission:</strong> {commissionRateLabel(dist.commission_type, dist.commission_rate)}
                {' · '}
                <strong>Basis:</strong> {typeConfig.label}
              </div>
            )}
            <form onSubmit={handleAddSalesRepToDistributor}>
              <div className="space-y-4">
                <Field label="Sales Representative *">
                  {!showCreateSalesRepUser ? (
                    <div className="flex gap-2">
                      <select
                        required
                        value={newDistributorSalesRep.sales_rep_id}
                        onChange={(e) =>
                          setNewDistributorSalesRep({ ...newDistributorSalesRep, sales_rep_id: e.target.value })
                        }
                        className={`${selectCls} flex-1`}
                      >
                        <option value="">Select a sales rep</option>
                        {salesReps
                          .filter(
                            (rep) =>
                              !getDistributorSalesReps(selectedDistributor).find(
                                (dsr) => dsr.sales_rep_id === rep.id,
                              ),
                          )
                          .map((rep) => (
                            <option key={rep.id} value={rep.id}>{rep.email}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreateSalesRepUser(true)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg whitespace-nowrap"
                      >
                        <UserPlus className="h-4 w-4" />
                        New User
                      </button>
                    </div>
                  ) : (
                    <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-700">Create New Sales Rep</span>
                        <button
                          type="button"
                          onClick={() => { setShowCreateSalesRepUser(false); setNewSalesRepEmail(''); setNewSalesRepPassword(''); }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="email"
                        value={newSalesRepEmail}
                        onChange={(e) => setNewSalesRepEmail(e.target.value)}
                        className={inputCls}
                        placeholder="Email address"
                      />
                      <input
                        type="password"
                        value={newSalesRepPassword}
                        onChange={(e) => setNewSalesRepPassword(e.target.value)}
                        className={inputCls}
                        placeholder="Password (min 6 characters)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCreateSalesRepUser}
                          disabled={isCreatingSalesRepUser}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                        >
                          {isCreatingSalesRepUser ? 'Creating...' : 'Create & Select'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowCreateSalesRepUser(false); setNewSalesRepEmail(''); setNewSalesRepPassword(''); }}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        User will be created with the <strong>sales_rep</strong> role and auto-approved.
                      </p>
                    </div>
                  )}
                </Field>

                <Field label="Commission Split Type *">
                  <select
                    required
                    value={newDistributorSalesRep.commission_split_type}
                    onChange={(e) =>
                      setNewDistributorSalesRep({
                        ...newDistributorSalesRep,
                        commission_split_type: e.target.value as 'percentage_of_distributor' | 'fixed_with_override',
                      })
                    }
                    className={selectCls}
                  >
                    <option value="percentage_of_distributor">% of Distributor Commission</option>
                    <option value="fixed_with_override">Fixed Rate with Distributor Override</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                      ? "Sales rep receives a percentage of the distributor's earned commission amount"
                      : "Sales rep earns their own fixed rate; distributor earns an additional override rate"}
                  </p>
                </Field>

                <Field
                  label={
                    newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                      ? "Rep's Share of Distributor Commission (%)"
                      : `Rep's Fixed ${typeConfig.rateLabel} (${typeConfig.rateUnit}) *`
                  }
                >
                  <input
                    type="number"
                    required
                    min="0"
                    max={
                      newDistributorSalesRep.commission_split_type === 'percentage_of_distributor' || !typeConfig.isFlat
                        ? 100
                        : undefined
                    }
                    step="0.01"
                    value={newDistributorSalesRep.sales_rep_rate}
                    onChange={(e) =>
                      setNewDistributorSalesRep({
                        ...newDistributorSalesRep,
                        sales_rep_rate: parseFloat(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                  {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor' && dist && (
                    <p className="text-xs text-gray-400 mt-1">
                      At {newDistributorSalesRep.sales_rep_rate}%: rep gets{' '}
                      {typeConfig.isFlat
                        ? `$${((dist.commission_rate * newDistributorSalesRep.sales_rep_rate) / 100).toFixed(2)}`
                        : `${((dist.commission_rate * newDistributorSalesRep.sales_rep_rate) / 100).toFixed(2)}%`}
                      {' '}of {typeConfig.label.toLowerCase()}
                    </p>
                  )}
                </Field>

                {newDistributorSalesRep.commission_split_type === 'fixed_with_override' && (
                  <Field label={`Distributor Override ${typeConfig.rateLabel} (${typeConfig.rateUnit})`}>
                    <input
                      type="number"
                      required
                      min="0"
                      max={typeConfig.isFlat ? undefined : 100}
                      step="0.01"
                      value={newDistributorSalesRep.distributor_override_rate}
                      onChange={(e) =>
                        setNewDistributorSalesRep({
                          ...newDistributorSalesRep,
                          distributor_override_rate: parseFloat(e.target.value),
                        })
                      }
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Additional commission the distributor earns on top of the rep's rate
                    </p>
                  </Field>
                )}

                <Field label="Notes">
                  <textarea
                    value={newDistributorSalesRep.notes}
                    onChange={(e) =>
                      setNewDistributorSalesRep({ ...newDistributorSalesRep, notes: e.target.value })
                    }
                    className={inputCls}
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddSalesRep(false); setShowCreateSalesRepUser(false); setNewSalesRepEmail(''); setNewSalesRepPassword(''); }}
                  className={cancelBtnCls}
                >
                  Cancel
                </button>
                <button type="submit" className={primaryBtnCls}>
                  Add Sales Rep
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface EditDistributorFormProps {
  distributor: Distributor;
  onChange: (d: Distributor) => void;
  onSave: () => void;
  onCancel: () => void;
  salesReps: SalesRep[];
}

const EditDistributorForm: React.FC<EditDistributorFormProps> = ({
  distributor, onChange, onSave, onCancel, salesReps,
}) => {
  const typeConfig = getCommissionTypeConfig(distributor.commission_type);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name">
          <input
            type="text"
            value={distributor.name}
            onChange={(e) => onChange({ ...distributor, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Code">
          <input
            type="text"
            value={distributor.code}
            onChange={(e) => onChange({ ...distributor, code: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Pricing Model">
        <div className="flex gap-3">
          <label className={`flex-1 flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
            distributor.pricing_model === 'margin_split'
              ? 'border-pink-500 bg-pink-50 text-pink-700'
              : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name={`edit_pricing_model_${distributor.id}`}
              value="margin_split"
              checked={distributor.pricing_model === 'margin_split'}
              onChange={() => onChange({ ...distributor, pricing_model: 'margin_split' })}
              className="text-pink-600 focus:ring-pink-500"
            />
            Margin Split
          </label>
          <label className={`flex-1 flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
            distributor.pricing_model === 'wholesale'
              ? 'border-pink-500 bg-pink-50 text-pink-700'
              : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name={`edit_pricing_model_${distributor.id}`}
              value="wholesale"
              checked={distributor.pricing_model === 'wholesale'}
              onChange={() => onChange({ ...distributor, pricing_model: 'wholesale' })}
              className="text-pink-600 focus:ring-pink-500"
            />
            Wholesale
          </label>
        </div>
      </Field>

      {distributor.pricing_model === 'margin_split' && (
      <div className="grid grid-cols-2 gap-4">
        <Field label="Commission Basis">
          <select
            value={distributor.commission_type}
            onChange={(e) => onChange({ ...distributor, commission_type: e.target.value as CommissionType })}
            className={selectCls}
          >
            {COMMISSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label={`${typeConfig.rateLabel} (${typeConfig.rateUnit})`}>
          <input
            type="number"
            min="0"
            max={typeConfig.isFlat ? undefined : 100}
            step="0.01"
            value={distributor.commission_rate}
            onChange={(e) => onChange({ ...distributor, commission_rate: parseFloat(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <select
            value={distributor.is_active ? 'active' : 'inactive'}
            onChange={(e) => onChange({ ...distributor, is_active: e.target.value === 'active' })}
            className={selectCls}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            type="text"
            value={distributor.notes ?? ''}
            onChange={(e) => onChange({ ...distributor, notes: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>

      {distributor.pricing_model === 'margin_split' && (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`edit_use_cust_price_${distributor.id}`}
          checked={distributor.use_customer_price ?? false}
          onChange={(e) => onChange({ ...distributor, use_customer_price: e.target.checked })}
          className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
        />
        <label htmlFor={`edit_use_cust_price_${distributor.id}`} className="text-sm text-gray-700">
          Default: use customer's actual price for margin calculation
        </label>
      </div>
      )}

      {/* Company Rep — your sales person who oversees this distributor */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Company Rep (Your Sales Person)</h4>
        <p className="text-xs text-gray-400">
          Assign one of your reps to oversee this distributor. They earn a % of your margin on every order.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Rep">
            <select
              value={distributor.company_rep_id ?? ''}
              onChange={(e) => onChange({ ...distributor, company_rep_id: e.target.value || null })}
              className={selectCls}
            >
              <option value="">None</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.email}</option>
              ))}
            </select>
          </Field>
          <Field label="% of Your Margin">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={distributor.company_rep_rate ?? 0}
              onChange={(e) => onChange({ ...distributor, company_rep_rate: parseFloat(e.target.value) || 0 })}
              className={inputCls}
              disabled={!distributor.company_rep_id}
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
          <Save className="h-4 w-4" /> Save
        </button>
        <button onClick={onCancel} className={cancelBtnCls}>Cancel</button>
      </div>
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title, onClose, children,
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

// Shared Tailwind class strings
const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent';
const selectCls = inputCls;
const primaryBtnCls =
  'px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg text-sm font-medium transition-all';
const cancelBtnCls =
  'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors';

export default DistributorManagement;
