# Soft-Delete & Admin-Only Delete Implementation Plan

## Overview

Add soft-delete (archive) functionality for orders, customers/users, sales reps, distributors, and commissions. When a parent entity is deleted, child records are marked as orphaned. Only admins can delete and restore records.

## Current State

- `UserManagement.tsx` line 389: Hard-deletes from `profiles`
- `DistributorManagement.tsx` line 632: Hard-deletes from `distributors` (CASCADE removes children)
- `OrderManagement.tsx`: No delete functionality
- `CommissionManagement.tsx`: No delete functionality (commissions can be cancelled)
- Several tables already have `is_active` columns — `deleted_at` is separate (archived vs paused)

## Phase 1: Database Migration

**New file: `supabase/migrations/20260317000000_soft_delete_and_orphan_tracking.sql`**

### 1a. Add soft-delete columns to parent entities

```
orders:          deleted_at timestamptz, deleted_by uuid
profiles:        deleted_at timestamptz, deleted_by uuid
distributors:    deleted_at timestamptz, deleted_by uuid
commissions:     deleted_at timestamptz, deleted_by uuid
organizations:   deleted_at timestamptz, deleted_by uuid
```

### 1b. Add orphan columns to child entities

```
organization_sales_reps:      is_orphaned boolean DEFAULT false, orphaned_reason text
distributor_sales_reps:       is_orphaned boolean DEFAULT false, orphaned_reason text
distributor_commission_rules:  is_orphaned boolean DEFAULT false, orphaned_reason text
distributor_product_pricing:   is_orphaned boolean DEFAULT false, orphaned_reason text
distributor_customers:         is_orphaned boolean DEFAULT false, orphaned_reason text
commission_line_items:         is_orphaned boolean DEFAULT false, orphaned_reason text
contract_pricing:              is_orphaned boolean DEFAULT false, orphaned_reason text
organization_pricing:          is_orphaned boolean DEFAULT false, orphaned_reason text
location_pricing:              is_orphaned boolean DEFAULT false, orphaned_reason text
```

### 1c. Partial indexes for query performance

Partial indexes on `deleted_at` WHERE `deleted_at IS NULL` for all parent tables.

### 1d. Change FK ON DELETE from CASCADE to RESTRICT

Prevents accidental hard-deletes from cascading. Forces all deletions through the soft-delete service.

### 1e. Database trigger: `handle_soft_delete_cascade()`

Fires AFTER UPDATE when `deleted_at` transitions from NULL to non-NULL:
- **profiles deleted** → orphans `organization_sales_reps`, `distributor_sales_reps`, `contract_pricing`; cascades soft-delete to `orders` and `commissions`
- **distributors deleted** → orphans `distributor_sales_reps`, `distributor_commission_rules`, `distributor_product_pricing`, `distributor_customers`
- **orders deleted** → cascades soft-delete to `commissions`; orphans `commission_line_items`
- **organizations deleted** → orphans `organization_pricing`, `distributor_customers`, `organization_sales_reps`
- **commissions deleted** → orphans `commission_line_items`

### 1f. RLS policy updates

- Non-admin SELECT policies: add `AND deleted_at IS NULL`
- Admin policies: can see all records (to support "Show Archived" toggle)

---

## Phase 2: Service Layer

**New file: `src/services/softDeleteService.ts`**

Following existing `{ success, error }` return pattern:

- `deleteOrder(orderId, deletedBy)` — soft-deletes order, trigger cascades
- `deleteProfile(profileId, deletedBy)` — soft-deletes profile, sets `is_approved = false` to block login, trigger cascades
- `deleteDistributor(distributorId, deletedBy)` — soft-deletes distributor, trigger orphans children
- `deleteCommission(commissionId, deletedBy)` — soft-deletes commission, trigger orphans line items
- `deleteOrganization(orgId, deletedBy)` — soft-deletes org, trigger orphans children
- `restoreOrder/Profile/Distributor/Commission/Organization` — clears `deleted_at`, un-orphans children
- `getDeletedRecords(table)` — admin-only, fetches archived records
- `getOrphanedRecords(table)` — admin-only, fetches orphaned children

Safety checks:
- Cannot delete self
- Cannot delete last admin
- Warns on paid commissions / captured orders

### Query filter updates

Add `.is('deleted_at', null)` to existing queries in:
- `OrderManagement.tsx` `fetchOrders()`
- `UserManagement.tsx` `fetchUsers()`
- `DistributorManagement.tsx` `fetchData()`
- `CommissionManagement.tsx` `fetchCommissions()`
- `OrganizationManagement.tsx` `fetchOrganizations()`
- `commissionService.ts`, `multiTenant.ts`, `orderService.ts`

---

## Phase 3: Admin UI

### 3a. Reusable `ConfirmDeleteModal` component

Two-step confirmation dialog showing entity name and cascade warnings (list of affected child records).

### 3b. Delete buttons in each admin component

- **UserManagement**: Replace hard-delete with soft-delete, Trash2 icon
- **DistributorManagement**: Replace hard-delete with soft-delete
- **OrderManagement**: Add new delete button in order detail (admin-only)
- **CommissionManagement**: Add delete button (admin-only)
- **OrganizationManagement**: Add archive button alongside edit

### 3c. "Show Archived" toggle

Each admin list gets a toggle to view deleted records:
- Deleted rows render with muted styling (`opacity-50 bg-red-50`)
- Red "Archived" badge
- "Restore" button (RotateCcw icon) replaces normal actions
- Shows who deleted and when

### 3d. Orphan indicators

Child entity views show orphaned records with:
- `AlertTriangle` icon in amber
- Tooltip: "Orphaned: [reason]" (e.g., "distributor_deleted")
- Excluded from calculations (totals, pricing)

---

## Implementation Order

1. Database migration (columns, indexes, FK changes, trigger, RLS)
2. `softDeleteService.ts`
3. `ConfirmDeleteModal` component
4. Update `UserManagement.tsx` (replace hard-delete)
5. Update `DistributorManagement.tsx` (replace hard-delete)
6. Update `OrderManagement.tsx` (add delete)
7. Update `CommissionManagement.tsx` (add delete)
8. Update `OrganizationManagement.tsx` (add delete)
9. Add "Show Archived" toggles and orphan indicators
10. Update existing queries to filter soft-deleted records
