require('dotenv').config();
const express=require("express");
const app=express();
app.use(express.json());
const HASH=process.env.BC_STORE_HASH;
const JWT=process.env.BC_STOREFRONT_TOKEN;
if(!HASH||!JWT){console.error("Missing envs");process.exit(1)}
const ENDPOINT="https://store-"+HASH+".mybigcommerce.com/graphql";
app.post("/api/gql",async(req,res)=>{
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+JWT},body:JSON.stringify(req.body)});
  const body=await r.text();
  res.status(r.status).type("application/json").send(body);
});
app.listen(4000,()=>console.log("GQL proxy on http://localhost:4000 -> "+ENDPOINT));
