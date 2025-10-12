require('dotenv').config();

const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

const headers = {
  'X-Auth-Token': BC_ACCESS_TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function testGetProductCosts() {
  const productIds = [203, 221, 114];
  const productCosts = {};

  for (const productId of productIds) {
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

      productCosts[productId] = {
        id: product.id,
        name: product.name,
        cost_price: costPrice !== undefined && costPrice !== null ? costPrice : 0,
        price: product.price || 0,
      };

      console.log(`Product ${productId} (${product.name}):`);
      console.log(`  Cost Price: ${costPrice}`);
    }
  }

  console.log('\nFinal result:', JSON.stringify(productCosts, null, 2));
}

testGetProductCosts();
