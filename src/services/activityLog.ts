/**
 * User Activity Log Service
 *
 * Tracks significant user actions beyond login/logout.
 *
 * Required database table (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS user_activity_log (
 *     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 *     session_id  TEXT,
 *     action      TEXT NOT NULL,
 *     resource_type TEXT,
 *     resource_id TEXT,
 *     details     JSONB,
 *     ip_address  TEXT,
 *     created_at  TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
 *
 *   -- Admins can read all; users can insert their own
 *   CREATE POLICY "admins_read_activity" ON user_activity_log
 *     FOR SELECT USING (
 *       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
 *     );
 *   CREATE POLICY "users_insert_activity" ON user_activity_log
 *     FOR INSERT WITH CHECK (user_id = auth.uid());
 */

import { supabase } from './supabase';
import { sessionTrackingService } from './sessionTracking';

export type ActivityAction =
  // Auth
  | 'login' | 'logout' | 'impersonation_started' | 'impersonation_stopped'
  // Orders
  | 'order_placed' | 'order_status_changed' | 'order_viewed'
  // Checkout errors
  | 'checkout_error' | 'checkout_session_failed' | 'checkout_payment_failed'
  | 'checkout_order_failed' | 'checkout_vault_failed'
  // Users (admin)
  | 'user_approved' | 'user_denied' | 'user_role_changed' | 'user_created' | 'user_deleted'
  // Navigation
  | 'dashboard_opened' | 'section_viewed'
  // Admin actions
  | 'product_created' | 'product_updated' | 'product_deleted'
  | 'organization_created' | 'organization_updated'
  | 'pricing_updated' | 'settings_updated';

export interface LogActionParams {
  userId: string;
  action: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

class ActivityLogService {
  private tableExists: boolean | null = null;

  async logAction(params: LogActionParams): Promise<void> {
    // Skip if we already know the table doesn't exist
    if (this.tableExists === false) return;

    try {
      const sessionId = sessionTrackingService.getCurrentSessionId();

      const { error } = await supabase.from('user_activity_log').insert({
        user_id: params.userId,
        session_id: sessionId,
        action: params.action,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        details: params.details ?? null,
      });

      if (error) {
        // Table doesn't exist yet — warn once and suppress future calls
        if (error.code === '42P01') {
          if (this.tableExists !== false) {
            console.warn(
              '[ActivityLog] user_activity_log table does not exist. ' +
              'See src/services/activityLog.ts for the CREATE TABLE statement.'
            );
          }
          this.tableExists = false;
          return;
        }
        console.error('[ActivityLog] Error logging action:', error.message);
      } else {
        this.tableExists = true;
      }
    } catch (err) {
      console.error('[ActivityLog] Unexpected error:', err);
    }
  }
}

export const activityLogService = new ActivityLogService();
