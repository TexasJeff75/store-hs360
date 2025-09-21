require('dotenv').config();

const express = require("express");
const app = express();
app.use(express.json());

const ENDPOINT = `https://store-${process.env.BC_STORE_HASH}.mybigcommerce.com/graphql`;
const JWT = process.env.BC_STOREFRONT_TOKEN;

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