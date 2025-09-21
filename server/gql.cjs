require('dotenv').config();
const express = require("express");
const app = express();
app.use(express.json());

const ENDPOINT = `https://store-${process.env.BC_STORE_HASH}.mybigcommerce.com/graphql`;
app.post("/api/gql", async (req, res) => {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.BC_STOREFRONT_TOKEN}`,
      },
      body: JSON.stringify(req.body || {})
    });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "GQL_PROXY_FAILED", detail: String(e) });
  }
});
app.listen(4000, () => console.log("GQL proxy :4000 ->", ENDPOINT));
