import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, ArrowLeft, Send, Clock, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supportTicketService, SupportTicket, SupportTicketMessage } from '../services/supportTicketService';

const SupportTickets: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user?.id) loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await supportTicketService.getUserTickets(user.id);
    setTickets(data);
    setLoading(false);
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setView('detail');
    const msgs = await supportTicketService.getTicketMessages(ticket.id);
    setMessages(msgs);
  };

  const handleSendMessage = async () => {
    if (!user?.id || !selectedTicket || !newMessage.trim()) return;
    setSendingMessage(true);
    const msg = await supportTicketService.addMessage(selectedTicket.id, user.id, newMessage.trim());
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    }
    setSendingMessage(false);
  };

  const handleCreateTicket = async () => {
    if (!user?.id || !newSubject.trim() || !newDescription.trim()) return;
    setCreating(true);
    const ticket = await supportTicketService.createTicket({
      user_id: user.id,
      subject: newSubject.trim(),
      description: newDescription.trim(),
      category: newCategory,
      priority: newPriority,
    });
    if (ticket) {
      setNewSubject('');
      setNewDescription('');
      setNewCategory('general');
      setNewPriority('medium');
      setView('list');
      await loadTickets();
    }
    setCreating(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; icon: React.ReactNode }> = {
      open: { bg: 'bg-blue-100 text-blue-800', icon: <AlertCircle className="h-3 w-3" /> },
      in_progress: { bg: 'bg-amber-100 text-amber-800', icon: <Clock className="h-3 w-3" /> },
      waiting_on_customer: { bg: 'bg-orange-100 text-orange-800', icon: <Clock className="h-3 w-3" /> },
      resolved: { bg: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> },
      closed: { bg: 'bg-gray-100 text-gray-600', icon: <X className="h-3 w-3" /> },
    };
    const c = config[status] || { bg: 'bg-gray-100 text-gray-800', icon: null };
    return (
      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${c.bg}`}>
        {c.icon}
        {supportTicketService.getStatusLabel(status)}
      </span>
    );
  };

  const getPriorityDot = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-400',
      medium: 'bg-blue-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    };
    return <span className={`w-2 h-2 rounded-full inline-block ${colors[priority] || 'bg-gray-400'}`} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="p-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">New Support Ticket</h2>
        <div className="max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief summary of your issue"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="general">General</option>
                <option value="order_issue">Order Issue</option>
                <option value="billing">Billing</option>
                <option value="product">Product</option>
                <option value="shipping">Shipping</option>
                <option value="account">Account</option>
                <option value="technical">Technical</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Describe your issue in detail..."
            />
          </div>
          <button
            onClick={handleCreateTicket}
            disabled={creating || !newSubject.trim() || !newDescription.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Ticket
          </button>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedTicket) {
    return (
      <div className="p-6">
        <button onClick={() => { setView('list'); setSelectedTicket(null); setMessages([]); }}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h2>
              {getStatusBadge(selectedTicket.status)}
            </div>
            <p className="text-sm text-gray-500">
              {selectedTicket.ticket_number} &middot; {supportTicketService.getCategoryLabel(selectedTicket.category)} &middot; {supportTicketService.getPriorityLabel(selectedTicket.priority)} priority
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
          <p className="text-xs text-gray-400 mt-2">{new Date(selectedTicket.created_at).toLocaleString()}</p>
        </div>

        <div className="space-y-4 mb-6">
          {messages.map(msg => {
            const isStaff = msg.profiles?.role === 'admin' || msg.profiles?.role === 'sales_rep';
            return (
              <div key={msg.id} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${isStaff ? 'bg-white border border-gray-200' : 'bg-blue-600 text-white'}`}>
                  <p className={`text-xs mb-1 ${isStaff ? 'text-gray-500' : 'text-blue-200'}`}>
                    {isStaff ? 'Support Team' : 'You'} &middot; {new Date(msg.created_at).toLocaleString()}
                  </p>
                  <p className={`text-sm whitespace-pre-wrap ${isStaff ? 'text-gray-800' : 'text-white'}`}>{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedTicket.status !== 'closed' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type a reply..."
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Support Tickets</h2>
          <p className="text-gray-600">Get help with orders, billing, and more</p>
        </div>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Support Tickets</h3>
          <p className="text-gray-600 mb-4">You haven't created any support tickets yet.</p>
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Create Your First Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => openTicket(ticket)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">{ticket.ticket_number}</span>
                    {getPriorityDot(ticket.priority)}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{ticket.subject}</h3>
                </div>
                {getStatusBadge(ticket.status)}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{supportTicketService.getCategoryLabel(ticket.category)}</span>
                <span>&middot;</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportTickets;
