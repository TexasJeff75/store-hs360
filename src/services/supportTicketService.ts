import { supabase } from './supabase';
import { emailService } from './emailService';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  organization_id: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  order_id: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  profiles?: { email: string; role: string } | null;
}

interface CreateTicketData {
  user_id: string;
  organization_id?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  order_id?: string;
}

export const supportTicketService = {
  async createTicket(data: CreateTicketData): Promise<SupportTicket | null> {
    try {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: data.user_id,
          organization_id: data.organization_id || null,
          subject: data.subject,
          description: data.description,
          category: data.category,
          priority: data.priority,
          order_id: data.order_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket:', error);
        return null;
      }

      // Send ticket created email (fire-and-forget)
      if (ticket) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', data.user_id)
          .maybeSingle();

        if (profile?.email) {
          emailService.sendNotification({
            to: profile.email,
            email_type: 'support_ticket_created',
            subject: `Support Ticket Created — ${ticket.ticket_number}`,
            template_data: { ticket_number: ticket.ticket_number, subject: data.subject },
            user_id: data.user_id,
          }).catch(err => console.warn('Failed to send ticket created email:', err));
        }
      }

      return ticket;
    } catch (error) {
      console.error('Error in createTicket:', error);
      return null;
    }
  },

  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user tickets:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getUserTickets:', error);
      return [];
    }
  },

  async getAllTickets(): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all tickets:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getAllTickets:', error);
      return [];
    }
  },

  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching ticket:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in getTicketById:', error);
      return null;
    }
  },

  async getTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*, profiles:user_id(email, role)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getTicketMessages:', error);
      return [];
    }
  },

  async addMessage(ticketId: string, userId: string, message: string, isInternalNote = false): Promise<SupportTicketMessage | null> {
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          message,
          is_internal_note: isInternalNote,
        })
        .select('*, profiles:user_id(email, role)')
        .single();

      if (error) {
        console.error('Error adding message:', error);
        return null;
      }

      // Send reply notification email (fire-and-forget, skip internal notes)
      if (data && !isInternalNote) {
        const ticket = await this.getTicketById(ticketId);
        if (ticket && ticket.user_id !== userId) {
          // Reply is from someone other than the ticket owner — notify the owner
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', ticket.user_id)
            .maybeSingle();

          if (ownerProfile?.email) {
            emailService.sendNotification({
              to: ownerProfile.email,
              email_type: 'support_ticket_reply',
              subject: `New Reply on Ticket ${ticket.ticket_number}`,
              template_data: { ticket_number: ticket.ticket_number, message },
              user_id: ticket.user_id,
            }).catch(err => console.warn('Failed to send ticket reply email:', err));
          }
        }
      }

      return data;
    } catch (error) {
      console.error('Error in addMessage:', error);
      return null;
    }
  },

  async updateTicketStatus(ticketId: string, status: string): Promise<boolean> {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (status === 'closed') updates.closed_at = new Date().toISOString();

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) {
        console.error('Error updating ticket status:', error);
        return false;
      }

      // Send resolved notification email (fire-and-forget)
      if (status === 'resolved') {
        const ticket = await this.getTicketById(ticketId);
        if (ticket) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', ticket.user_id)
            .maybeSingle();

          if (ownerProfile?.email) {
            emailService.sendNotification({
              to: ownerProfile.email,
              email_type: 'support_ticket_resolved',
              subject: `Ticket ${ticket.ticket_number} Resolved`,
              template_data: { ticket_number: ticket.ticket_number },
              user_id: ticket.user_id,
            }).catch(err => console.warn('Failed to send ticket resolved email:', err));
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error in updateTicketStatus:', error);
      return false;
    }
  },

  async assignTicket(ticketId: string, assigneeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ assigned_to: assigneeId, status: 'in_progress' })
        .eq('id', ticketId);

      if (error) {
        console.error('Error assigning ticket:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in assignTicket:', error);
      return false;
    }
  },

  async getTicketStats(): Promise<{ open: number; in_progress: number; waiting: number; resolved: number }> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('status');

      if (error) {
        console.error('Error fetching ticket stats:', error);
        return { open: 0, in_progress: 0, waiting: 0, resolved: 0 };
      }

      const tickets = data || [];
      return {
        open: tickets.filter(t => t.status === 'open').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        waiting: tickets.filter(t => t.status === 'waiting_on_customer').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
      };
    } catch (error) {
      console.error('Error in getTicketStats:', error);
      return { open: 0, in_progress: 0, waiting: 0, resolved: 0 };
    }
  },

  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      general: 'General',
      order_issue: 'Order Issue',
      billing: 'Billing',
      product: 'Product',
      shipping: 'Shipping',
      account: 'Account',
      technical: 'Technical',
      other: 'Other',
    };
    return map[category] || category;
  },

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    };
    return map[priority] || priority;
  },

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      open: 'Open',
      in_progress: 'In Progress',
      waiting_on_customer: 'Waiting on Customer',
      resolved: 'Resolved',
      closed: 'Closed',
    };
    return map[status] || status;
  },
};
