# Security Definer - Quick Reference

## What Changed?

| Old (Insecure) | New (Secure) | Who Can Access |
|----------------|--------------|----------------|
| `order_profit_analysis` view | `get_order_profit_analysis()` function | Cost admins only |
| `product_vendor_details` view | `get_product_vendor_details()` function | Admins only |
| `is_cost_admin()` with DEFINER | `is_cost_admin()` with INVOKER | Anyone (returns true/false) |

## Function Usage

### 1. Get Order Profit Analysis
```sql
-- All parameters are optional
SELECT * FROM get_order_profit_analysis(
  p_order_id := 'uuid-here',           -- Optional: specific order
  p_organization_id := 'uuid-here',    -- Optional: filter by org
  p_date_from := '2024-01-01'::timestamptz,  -- Optional: start date
  p_date_to := '2024-12-31'::timestamptz     -- Optional: end date
);
```

**Returns:**
- order_id
- organization_id
- order_total
- total_cost
- profit_margin
- profit_percentage
- order_date

**Access:** Cost admins only (admin with `can_view_secret_cost = true`)

### 2. Get Product Vendor Details
```sql
SELECT * FROM get_product_vendor_details(123);  -- product_id
```

**Returns:**
- product_id
- vendor_name
- cost_per_unit
- is_preferred
- lead_time_days
- minimum_order_quantity
- last_price_update

**Access:** Admins only

### 3. Check If User Is Cost Admin
```sql
SELECT is_cost_admin();  -- Returns true or false
```

**Returns:** boolean

**Access:** Anyone (but only returns true for cost admins)

## TypeScript/JavaScript Usage

### From Supabase Client

```typescript
// Get profit analysis
const { data, error } = await supabase
  .rpc('get_order_profit_analysis', {
    p_organization_id: orgId,
    p_date_from: '2024-01-01',
    p_date_to: '2024-12-31'
  });

// Get vendor details
const { data, error } = await supabase
  .rpc('get_product_vendor_details', {
    p_product_id: 123
  });

// Check if cost admin
const { data, error } = await supabase
  .rpc('is_cost_admin');
```

## Security Rules

### ✅ DO
- Use the new RPC functions
- Handle "Access denied" errors gracefully
- Validate user roles in your application

### ❌ DON'T
- Try to access the old views (they don't exist)
- Assume everyone can see profit data
- Bypass the authorization checks

## Error Handling

```typescript
const { data, error } = await supabase
  .rpc('get_order_profit_analysis', params);

if (error) {
  if (error.message.includes('Access denied')) {
    // User doesn't have permission
    console.log('You need cost admin privileges');
  } else {
    // Other error
    console.error('Error:', error.message);
  }
}
```

## Common Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| "Access denied: Only cost admins can view profit analysis" | User is not a cost admin | Ensure user has `role = 'admin'` AND `can_view_secret_cost = true` |
| "Access denied: Only admins can view vendor details" | User is not an admin | Ensure user has `role = 'admin'` |
| "function does not exist" | Using old view name | Use new function name instead |

## Migration Status

- ✅ Migration file created: `20260224000000_fix_security_definer_views.sql`
- ✅ Build passing
- ✅ No application code changes needed
- ✅ All functionality preserved

## Audit Command

```sql
-- Verify no SECURITY DEFINER views
SELECT count(*) as insecure_views
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%SECURITY DEFINER%';
-- Should return 0
```

## Who to Ask

- **Security questions:** Review `SECURITY_DEFINER_FIX.md`
- **Technical details:** See migration file
- **Executive summary:** Read `SECURITY_FIX_SUMMARY.md`
