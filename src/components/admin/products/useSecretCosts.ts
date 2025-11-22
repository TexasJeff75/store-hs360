import { useState, useEffect } from 'react';
import { secretCostService, SecretCostMap } from '@/services/secretCostService';
import { Product } from '@/services/bigcommerce';

export function useSecretCosts(products: Product[]) {
  const [isCostAdmin, setIsCostAdmin] = useState(false);
  const [secretCosts, setSecretCosts] = useState<SecretCostMap>({});
  const [editingSecretCost, setEditingSecretCost] = useState<number | null>(null);
  const [editSecretCostValue, setEditSecretCostValue] = useState<string>('');
  const [savingSecretCost, setSavingSecretCost] = useState(false);

  useEffect(() => {
    checkCostAdmin();
  }, []);

  useEffect(() => {
    if (isCostAdmin && products.length > 0) {
      fetchSecretCosts();
    }
  }, [isCostAdmin, products]);

  const checkCostAdmin = async () => {
    const isAdmin = await secretCostService.checkIsCostAdmin();
    setIsCostAdmin(isAdmin);
  };

  const fetchSecretCosts = async () => {
    try {
      const costs = await secretCostService.getAllSecretCosts();
      setSecretCosts(costs);
    } catch (err) {
      console.error('Error fetching secret costs:', err);
    }
  };

  const handleEditSecretCost = (productId: number, currentCost?: number) => {
    setEditingSecretCost(productId);
    setEditSecretCostValue(currentCost?.toString() || '');
  };

  const handleCancelEditSecretCost = () => {
    setEditingSecretCost(null);
    setEditSecretCostValue('');
  };

  const handleSaveSecretCost = async (productId: number) => {
    try {
      setSavingSecretCost(true);
      const cost = parseFloat(editSecretCostValue);

      if (isNaN(cost) || cost < 0) {
        alert('Please enter a valid cost');
        return;
      }

      const result = await secretCostService.updateSecretCost(productId, cost);

      if (result.success) {
        await fetchSecretCosts();
        setEditingSecretCost(null);
        setEditSecretCostValue('');
      } else {
        alert(result.error || 'Failed to update secret cost');
      }
    } catch (err) {
      console.error('Error saving secret cost:', err);
      alert('Failed to save secret cost');
    } finally {
      setSavingSecretCost(false);
    }
  };

  return {
    isCostAdmin,
    secretCosts,
    editingSecretCost,
    editSecretCostValue,
    savingSecretCost,
    setEditSecretCostValue,
    handleEditSecretCost,
    handleCancelEditSecretCost,
    handleSaveSecretCost,
  };
}
