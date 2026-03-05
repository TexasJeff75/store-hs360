import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft, Send, Clock, CheckCircle, AlertCircle, Search, Lock, Loader2, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supportTicketService, SupportTicket, SupportTicketMessage } from '../../services/supportTicketService';

const SupportTicketManagement: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, waiting: 0, resolved: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ticketData, statsData] = await Promise.all([
      supportTicketService.getAllTickets(),
      supportTicketService.getTicketStats(),
    ]);
    setTickets(ticketData);
    setStats(statsData);
    setLoading(false);
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    const msgs = await supportTicketService.getTicketMessages(ticket.id);
    setMessages(msgs);
  };

  const handleSendMessage = async () => {
    if (!user?.id || !selectedTicket || !newMessage.trim()) return;
    setSendingMessage(true);
    const msg = await supportTicketService.addMessage(selectedTicket.id, user.id, newMessage.trim(), isInternalNote);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    }
    setSendingMessage(false);
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    await supportTicketService.updateTicketStatus(ticketId, status);
    await loadData();
    if (selectedTicket?.id === ticketId) {
      const updated = await supportTicketService.getTicketById(ticketId);
      setSelectedTicket(updated);
    }
  };

  const handleAssignToMe = async () => {
    if (!user?.id || !selectedTicket) return;
    await supportTicketService.assignTicket(selectedTicket.id, user.id);
    await loadData();
    const updated = await supportTicketService.getTicketById(selectedTicket.id);
    setSelectedTicket(updated);
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = !searchTerm ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-50 text-blue-700',
      high: 'bg-orange-50 text-orange-700',
      urgent: 'bg-red-50 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded font-medium ${styles[priority] || 'bg-gray-100'}`}>
        {supportTicketService.getPriorityLabel(priority)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div className="p-6">
        <button onClick={() => { setSelectedTicket(null); setMessages([]); }}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to all tickets
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h2>
              {getStatusBadge(selectedTicket.status)}
              {getPriorityBadge(selectedTicket.priority)}
            </div>
            <p className="text-sm text-gray-500">
              {selectedTicket.ticket_number} &middot; {supportTicketService.getCategoryLabel(selectedTicket.category)} &middot; Created {new Date(selectedTicket.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTicket.status}
              onChange={e => handleStatusChange(selectedTicket.id, e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_customer">Waiting on Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            {!selectedTicket.assigned_to && (
              <button onClick={handleAssignToMe}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <User className="h-3.5 w-3.5" /> Assign to Me
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
        </div>

        <div className="space-y-4 mb-6">
          {messages.map(msg => {
            const isStaff = msg.profiles?.role === 'admin' || msg.profiles?.role === 'sales_rep';
            if (msg.is_internal_note) {
              return (
                <div key={msg.id} className="border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-600 flex items-center gap-1 mb-1">
                    <Lock className="h-3 w-3" /> Internal Note &middot; {msg.profiles?.email || 'Staff'} &middot; {new Date(msg.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{msg.message}</p>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${isStaff ? 'bg-white border border-gray-200' : 'bg-blue-600 text-white'}`}>
                  <p className={`text-xs mb-1 ${isStaff ? 'text-gray-500' : 'text-blue-200'}`}>
                    {isStaff ? (msg.profiles?.email || 'Support') : 'Customer'} &middot; {new Date(msg.created_at).toLocaleString()}
                  </p>
                  <p className={`text-sm whitespace-pre-wrap ${isStaff ? 'text-gray-800' : 'text-white'}`}>{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedTicket.status !== 'closed' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={e => setIsInternalNote(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-700 font-medium">Internal note</span>
              </label>
            </div>
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                rows={2}
                className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 resize-none ${isInternalNote ? 'border-amber-300 bg-amber-50 focus:ring-amber-500' : 'border-gray-300 focus:ring-blue-500'}`}
                placeholder={isInternalNote ? 'Add an internal note (not visible to customer)...' : 'Reply to customer...'}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !newMessage.trim()}
                className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 transition-colors self-end ${isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Support Tickets</h2>
        <p className="text-gray-600">Manage customer support requests</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open', value: stats.open, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'In Progress', value: stats.in_progress, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Waiting', value: stats.waiting, color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'Resolved', value: stats.resolved, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(stat => (
          <div key={stat.label} className={`border rounded-xl p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search tickets..."
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_customer">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tickets Found</h3>
          <p className="text-gray-600">No tickets match your search criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTickets.map(ticket => (
                <tr
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{ticket.ticket_number}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{ticket.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{supportTicketService.getCategoryLabel(ticket.category)}</td>
                  <td className="px-4 py-3">{getPriorityBadge(ticket.priority)}</td>
                  <td className="px-4 py-3">{getStatusBadge(ticket.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(ticket.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SupportTicketManagement;
