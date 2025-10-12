require('dotenv').config();

const storeHash = process.env.VITE_BC_STORE_HASH;
const accessToken = process.env.VITE_BC_ACCESS_TOKEN;

if (!storeHash || !accessToken) {
  console.log('Missing BigCommerce credentials');
  process.exit(1);
}

async function getProduct(productId) {
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}`;
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.log(`Error fetching product ${productId}:`, response.status, response.statusText);
    return null;
  }

  const data = await response.json();
  return data.data;
}

(async () => {
  const products = [114, 221];
  const results = {};

  for (const pid of products) {
    const product = await getProduct(pid);
    if (product) {
      results[pid] = {
        name: product.name,
        price: product.price,
        cost_price: product.cost_price,
        retail_price: product.retail_price,
        sale_price: product.sale_price
      };
      console.log(`Product ${pid} (${product.name}):`);
      console.log(`  Price: $${product.price}`);
      console.log(`  Cost: $${product.cost_price || 'N/A'}`);
      console.log(`  Retail: $${product.retail_price || 'N/A'}`);
      console.log(`  Sale: $${product.sale_price || 'N/A'}`);
      console.log('');
    }
  }

  console.log('\nResults:', JSON.stringify(results, null, 2));
})();
