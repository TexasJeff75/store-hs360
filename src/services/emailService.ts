import { supabase } from './supabase';
import { ENV } from '../config/env';

export interface EmailNotification {
  id: string;
  user_id: string | null;
  email_to: string;
  email_type: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface SendEmailParams {
  to: string;
  email_type: string;
  subject: string;
  template_data: Record<string, unknown>;
  user_id?: string;
}

export const emailService = {
  async sendNotification(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
      const supabaseUrl = ENV.SUPABASE_URL;
      const anonKey = ENV.SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to send email' };
      }

      return { success: result.success, error: result.warning };
    } catch (error) {
      console.error('Error sending email notification:', error);
      return { success: false, error: 'Network error sending email' };
    }
  },

  async getEmailLogs(limit = 50): Promise<EmailNotification[]> {
    try {
      const { data, error } = await supabase
        .from('email_notifications')
        .select('id, user_id, email_to, email_type, subject, status, error_message, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching email logs:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getEmailLogs:', error);
      return [];
    }
  },

  async getEmailStats(): Promise<{ sent: number; failed: number; pending: number }> {
    try {
      const { data, error } = await supabase
        .from('email_notifications')
        .select('status');

      if (error) {
        console.error('Error fetching email stats:', error);
        return { sent: 0, failed: 0, pending: 0 };
      }

      const emails = data || [];
      return {
        sent: emails.filter(e => e.status === 'sent').length,
        failed: emails.filter(e => e.status === 'failed').length,
        pending: emails.filter(e => e.status === 'pending').length,
      };
    } catch (error) {
      console.error('Error in getEmailStats:', error);
      return { sent: 0, failed: 0, pending: 0 };
    }
  },

  getTypeLabel(emailType: string): string {
    const map: Record<string, string> = {
      order_confirmation: 'Order Confirmation',
      recurring_order_processed: 'Recurring Order Processed',
      recurring_order_failed: 'Recurring Order Failed',
      account_approved: 'Account Approved',
      account_denied: 'Account Denied',
      support_ticket_created: 'Ticket Created',
      support_ticket_reply: 'Ticket Reply',
      support_ticket_resolved: 'Ticket Resolved',
    };
    return map[emailType] || emailType;
  },
};
