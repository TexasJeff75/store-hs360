require('dotenv').config();
const express = require("express");
const app = express();
app.use(express.json());

// Check for required environment variables
if (!process.env.VITE_BC_STORE_HASH || !process.env.VITE_BC_STOREFRONT_TOKEN) {
  console.error('Missing required environment variables: BC_STORE_HASH and/or BC_STOREFRONT_TOKEN');
}

const ENDPOINT = `https://store-${process.env.VITE_BC_STORE_HASH}.mybigcommerce.com/graphql`;
app.post("/api/gql", async (req, res) => {
  // Check for required environment variables
  if (!process.env.VITE_BC_STORE_HASH || !process.env.VITE_BC_STOREFRONT_TOKEN) {
    return res.status(500).json({ 
      error: "MISSING_CREDENTIALS", 
      detail: "BigCommerce store hash or storefront token not configured" 
    });
  }

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.VITE_BC_STOREFRONT_TOKEN}`,
      },
      body: JSON.stringify(req.body || {})
    });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "GQL_PROXY_FAILED", detail: String(e) });
  }
});
app.listen(4000, () => console.log("GQL proxy :4000 ->", ENDPOINT));
