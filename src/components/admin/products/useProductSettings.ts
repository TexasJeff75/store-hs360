import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Product } from '@/services/bigcommerce';

export function useProductSettings() {
  const [productSettings, setProductSettings] = useState<Map<number, { allowMarkup: boolean }>>(new Map());
  const [savingMarkupSetting, setSavingMarkupSetting] = useState(false);

  useEffect(() => {
    fetchProductSettings();
  }, []);

  const fetchProductSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('product_settings')
        .select('product_id, allow_markup');

      if (error) throw error;

      const settingsMap = new Map();
      data?.forEach((setting: any) => {
        settingsMap.set(setting.product_id, { allowMarkup: setting.allow_markup });
      });
      setProductSettings(settingsMap);
    } catch (err) {
      console.error('Error fetching product settings:', err);
    }
  };

  const handleToggleMarkupAllowance = async (
    productId: number,
    currentValue: boolean,
    selectedProduct: Product | null
  ) => {
    try {
      setSavingMarkupSetting(true);

      const { error } = await supabase
        .from('product_settings')
        .upsert({
          product_id: productId,
          allow_markup: !currentValue,
          product_name: selectedProduct?.name
        });

      if (error) throw error;

      const newSettings = new Map(productSettings);
      newSettings.set(productId, { allowMarkup: !currentValue });
      setProductSettings(newSettings);

    } catch (err) {
      console.error('Error updating markup setting:', err);
      alert('Failed to update markup setting');
    } finally {
      setSavingMarkupSetting(false);
    }
  };

  return {
    productSettings,
    savingMarkupSetting,
    handleToggleMarkupAllowance,
  };
}
