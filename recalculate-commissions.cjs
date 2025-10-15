require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

const headers = {
  'X-Auth-Token': BC_ACCESS_TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function getProductCost(productId) {
  try {
    const response = await fetch(
      `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/catalog/products/${productId}?include=variants`,
      { method: 'GET', headers }
    );

    if (response.ok) {
      const result = await response.json();
      const product = result.data;

      let costPrice = product.cost_price;
      if (product.variants && product.variants.length > 0) {
        const variant = product.variants[0];
        if (variant.cost_price !== undefined && variant.cost_price !== null) {
          costPrice = variant.cost_price;
        }
      }

      return costPrice !== undefined && costPrice !== null ? costPrice : 0;
    }
  } catch (error) {
    console.error(`Error fetching cost for product ${productId}:`, error.message);
  }
  return 0;
}

async function recalculateCommission(commission) {
  console.log(`\n🔄 Recalculating commission ${commission.id}`);

  const marginDetails = commission.margin_details;
  if (!marginDetails || marginDetails.length === 0) {
    console.log('  ⚠️  No margin details, skipping');
    return;
  }

  const productIds = [...new Set(marginDetails.map(item => parseInt(item.productId)))];
  console.log(`  📦 Fetching costs for products: ${productIds.join(', ')}`);

  const productCosts = {};
  for (const productId of productIds) {
    const cost = await getProductCost(productId);
    productCosts[productId] = cost;
    console.log(`    Product ${productId}: cost = $${cost}`);
  }

  let totalProductMargin = 0;
  let totalCommission = 0;
  const commissionRate = parseFloat(commission.commission_rate);

  const updatedMarginDetails = marginDetails.map(item => {
    const productId = parseInt(item.productId);
    const correctCost = productCosts[productId] || 0;
    const price = parseFloat(item.price);
    const retailPrice = parseFloat(item.retailPrice || item.price);
    const quantity = parseInt(item.quantity);
    const hasMarkup = item.hasMarkup || false;

    const baseMargin = (retailPrice - correctCost) * quantity;
    const baseCommission = baseMargin * (commissionRate / 100);

    let markupAmount = 0;
    let markupCommission = 0;
    let totalItemCommission = baseCommission;

    if (hasMarkup) {
      markupAmount = (price - retailPrice) * quantity;
      markupCommission = markupAmount;
      totalItemCommission = baseCommission + markupCommission;
    }

    const itemMargin = baseMargin + markupAmount;
    totalProductMargin += itemMargin;
    totalCommission += totalItemCommission;

    return {
      productId: item.productId,
      name: item.name,
      price,
      retailPrice,
      cost: correctCost,
      quantity,
      hasMarkup,
      baseMargin: parseFloat(baseMargin.toFixed(2)),
      markupAmount: parseFloat(markupAmount.toFixed(2)),
      baseCommission: parseFloat(baseCommission.toFixed(2)),
      markupCommission: parseFloat(markupCommission.toFixed(2)),
      totalCommission: parseFloat(totalItemCommission.toFixed(2)),
      margin: parseFloat(itemMargin.toFixed(2))
    };
  });

  console.log(`  💰 Old margin: $${commission.product_margin}, New margin: $${totalProductMargin.toFixed(2)}`);
  console.log(`  💵 Old commission: $${commission.commission_amount}, New commission: $${totalCommission.toFixed(2)}`);

  const { error } = await supabase
    .from('commissions')
    .update({
      product_margin: totalProductMargin.toFixed(2),
      commission_amount: totalCommission.toFixed(2),
      margin_details: updatedMarginDetails
    })
    .eq('id', commission.id);

  if (error) {
    console.error(`  ❌ Error updating commission:`, error.message);
  } else {
    console.log(`  ✅ Commission updated successfully`);
  }
}

async function main() {
  console.log('🚀 Starting commission recalculation...\n');

  const { data: commissions, error } = await supabase
    .from('commissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching commissions:', error);
    return;
  }

  console.log(`📊 Found ${commissions.length} commission records\n`);

  for (const commission of commissions) {
    await recalculateCommission(commission);
  }

  console.log('\n✨ Recalculation complete!');
}

main().catch(console.error);
