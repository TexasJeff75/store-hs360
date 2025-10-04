const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());

const BC_STORE_HASH = process.env.VITE_BC_STORE_HASH;
const BC_STOREFRONT_TOKEN = process.env.VITE_BC_STOREFRONT_TOKEN;

if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
  console.error('❌ Missing environment variables:');
  if (!BC_STORE_HASH) console.error('   - VITE_BC_STORE_HASH');
  if (!BC_STOREFRONT_TOKEN) console.error('   - VITE_BC_STOREFRONT_TOKEN');
  process.exit(1);
}

const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`;

console.log('✅ GraphQL Proxy Server Configuration:');
console.log('   Store Hash:', BC_STORE_HASH);
console.log('   Token:', BC_STOREFRONT_TOKEN.substring(0, 20) + '...');
console.log('   Endpoint:', ENDPOINT);

app.post('/gql', async (req, res) => {
  try {
    console.log('📡 Proxying GraphQL request...');

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BC_STOREFRONT_TOKEN}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors);
    } else {
      console.log('✅ GraphQL request successful');
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      errors: [{ message: 'Failed to proxy GraphQL request' }],
    });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🚀 GraphQL Proxy running on http://localhost:${PORT}`);
  console.log(`   Endpoint: POST http://localhost:${PORT}/gql\n`);
});
