require('dotenv').config();

const express = require("express");
const app = express();
app.use(express.json());

const ENDPOINT = `https://store-${process.env.BC_STORE_HASH}.mybigcommerce.com/graphql`;
const JWT = process.env.BC_STOREFRONT_TOKEN;

// Validate environment variables
if (!process.env.BC_STORE_HASH) {
  console.error('❌ BC_STORE_HASH is missing from .env file');
  process.exit(1);
}

if (!JWT) {
  console.error('❌ BC_STOREFRONT_TOKEN is missing from .env file');
  process.exit(1);
}

if (!JWT.startsWith('eyJ')) {
  console.error('❌ BC_STOREFRONT_TOKEN does not appear to be a valid JWT (should start with "eyJ")');
  console.error('Current token:', JWT.substring(0, 20) + '...');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log('   Store Hash:', process.env.BC_STORE_HASH);
console.log('   JWT Token:', JWT.substring(0, 20) + '...');
console.log('   Endpoint:', ENDPOINT);
app.post("/api/gql", async (req, res) => {
  try {
    console.log('Proxy request received:', {
      query: req.body.query?.substring(0, 100) + '...',
      variables: req.body.variables
    });
    
    const r = await fetch(ENDPOINT, { 
      method: "POST",
      headers: { 
        "content-type": "application/json", 
        "authorization": `Bearer ${JWT}` 
      },
      body: JSON.stringify(req.body) 
    });
    
    console.log('BigCommerce response:', {
      status: r.status,
      statusText: r.statusText
    });
    
    const responseText = await r.text();
    console.log('Response text length:', responseText.length);
    
    res.status(r.status).type("application/json").send(responseText);
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    res.status(500).json({ errors: [{ message: 'Internal server error' }] });
  }
});

app.listen(4000, () => console.log("GQL proxy on http://localhost:4000"));