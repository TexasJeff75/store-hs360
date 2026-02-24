# Security Fix Application Checklist

## Pre-Application Review

- [x] Migration file created: `supabase/migrations/20260224000000_fix_security_definer_views.sql`
- [x] Build passes: `npm run build`
- [x] No application code uses old views
- [x] Documentation created

## Apply Migration

Choose ONE method:

### Method 1: Supabase Dashboard (Recommended)
1. [ ] Log into Supabase Dashboard
2. [ ] Navigate to **SQL Editor**
3. [ ] Copy content from `supabase/migrations/20260224000000_fix_security_definer_views.sql`
4. [ ] Paste into SQL Editor
5. [ ] Click **Run**
6. [ ] Verify success message

### Method 2: Supabase CLI
```bash
# If using Supabase CLI
supabase db push
```

### Method 3: Direct SQL (if migration already in folder)
The migration is already in the migrations folder, so if you're using automated deployment, it should apply automatically on next deploy.

## Post-Application Verification

### 1. Verify Views Are Gone
```sql
SELECT count(*) as insecure_views
FROM pg_views
WHERE schemaname = 'public'
  AND definition LIKE '%SECURITY DEFINER%';
```
**Expected Result:** `0`

### 2. Verify New Functions Exist
```sql
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN (
    'get_order_profit_analysis',
    'get_product_vendor_details',
    'is_cost_admin'
  )
ORDER BY proname;
```
**Expected Result:** All 3 functions listed

### 3. Test Function Access (as admin with cost permissions)
```sql
SELECT * FROM get_order_profit_analysis(
  p_date_from := now() - interval '30 days'
)
LIMIT 5;
```
**Expected Result:** Returns profit data (or empty if no orders)

### 4. Test Function Access (as regular user)
```sql
SELECT * FROM get_order_profit_analysis();
```
**Expected Result:** Error "Access denied: Only cost admins can view profit analysis"

### 5. Verify Build Still Works
```bash
npm run build
```
**Expected Result:** Build succeeds

## Verification Checklist

- [ ] SECURITY DEFINER views dropped (count = 0)
- [ ] New functions exist (3 functions found)
- [ ] Cost admins can access profit analysis
- [ ] Regular users get "Access denied" error
- [ ] Application builds successfully
- [ ] No errors in application logs

## Rollback (Only if needed)

If you need to rollback (unlikely):

```sql
-- This will recreate the old is_cost_admin with SECURITY DEFINER
-- Only use if absolutely necessary
DROP FUNCTION IF EXISTS public.is_cost_admin();

CREATE OR REPLACE FUNCTION public.is_cost_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER  -- Old insecure version
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND can_view_secret_cost = true
  );
$$;
```

## Success Criteria

✅ All checks above pass
✅ No application errors
✅ Security vulnerability closed
✅ All existing functionality works

## Documentation Reference

- **Technical Details:** `SECURITY_DEFINER_FIX.md`
- **Executive Summary:** `SECURITY_FIX_SUMMARY.md`
- **Quick Reference:** `SECURITY_DEFINER_QUICK_REF.md`
- **Migration File:** `supabase/migrations/20260224000000_fix_security_definer_views.sql`

## Support

If you encounter issues:

1. Check migration file for SQL errors
2. Review `SECURITY_DEFINER_FIX.md` for technical details
3. Verify user roles in profiles table
4. Check application logs for errors

## Timeline

- **Created:** 2024-02-24
- **Priority:** High (Security Fix)
- **Complexity:** Low (No application changes needed)
- **Risk:** Very Low (Only adds security, no functionality changes)
- **Estimated Time:** 5-10 minutes

---

**Next Step:** Apply migration using Method 1, 2, or 3 above.
