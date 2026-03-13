'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAllSupportTickets, updateSupportTicket, addSupportTicketReply, createSupportTicket } from '@/lib/firestore';
import { cn, formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { 
  MessageCircle, Send, Search, ArrowLeft, User, HelpCircle, 
  Loader2, Check, AlertCircle, Clock, X, Plus, Inbox
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'feature', label: 'Feature' },
  { value: 'account', label: 'Account' },
];

const STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-red-100 text-red-700' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'closed', label: 'Closed', color: 'bg-surface-100 text-surface-500' },
];

export default function WebmasterTicketsPage() {
  const { user, userProfile, isWebmaster } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const loadTickets = async () => {
    try {
      const data = await getAllSupportTickets();
      setTickets(data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      toast.error('Failed to load tickets');
    }
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, []);

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.subject || '').toLowerCase().includes(q) ||
        (t.senderName || '').toLowerCase().includes(q) ||
        (t.senderEmail || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      await addSupportTicketReply(selectedTicket.id, {
        message: reply.trim(),
        senderName: userProfile?.displayName || 'Webmaster',
        senderRole: 'webmaster',
      });
      toast.success('Reply sent');
      setReply('');
      loadTickets();
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    } catch (err) {
      toast.error('Failed to send reply');
    }
    setSendingReply(false);
  };

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      await updateSupportTicket(ticketId, { status });
      toast.success('Status updated');
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        const updated = tickets.find(t => t.id === ticketId);
        if (updated) setSelectedTicket({ ...updated, status });
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const s = STATUSES.find(st => st.value === status) || STATUSES[0];
    return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', s.color)}>{s.label}</span>;
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-surface-100 text-surface-500',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize', colors[priority] || colors.medium)}>{priority}</span>;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!isWebmaster) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <HelpCircle className="w-16 h-16 text-surface-300" />
          <h1 className="text-2xl font-display font-bold text-surface-800">Access Restricted</h1>
          <p className="text-surface-500">This page is only available to webmaster accounts.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex bg-white rounded-2xl overflow-hidden border border-surface-200 shadow-sm">
        {/* Tickets List */}
        <div className={cn("w-full md:w-96 border-r border-surface-100 flex flex-col", selectedTicket ? 'hidden md:flex' : 'flex')}>
          <div className="p-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-surface-800 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-brand-500" />
                Support Tickets
              </h2>
              <span className="text-xs text-surface-400 bg-surface-100 px-2 py-1 rounded-full">{filteredTickets.length}</span>
            </div>
            
            {/* Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tickets..."
                  className="input-field !pl-9 !py-2 !text-sm"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="select-field !py-1.5 !text-xs flex-1"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="select-field !py-1.5 !text-xs flex-1"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-surface-400" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-surface-400">
                <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No tickets found</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-surface-50 transition-colors border-b border-surface-50",
                    selectedTicket?.id === ticket.id && 'bg-brand-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-surface-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn("font-medium text-sm truncate", ticket.status === 'open' ? 'text-surface-900' : 'text-surface-600')}>
                          {ticket.senderName}
                        </p>
                        <span className="text-[10px] text-surface-400">{formatTime(ticket.createdAt)}</span>
                      </div>
                      <p className="text-xs text-surface-500 truncate mb-2">{ticket.subject}</p>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", ticket.source === 'website' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600')}>
                          {ticket.source}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Ticket Detail / Chat */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-surface-100 flex items-center gap-3">
              <button onClick={() => setSelectedTicket(null)} className="md:hidden p-2 hover:bg-surface-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center">
                <User className="w-5 h-5 text-surface-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-800">{selectedTicket.senderName}</p>
                <p className="text-xs text-surface-400 truncate">{selectedTicket.senderEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedTicket.status)}
                {getPriorityBadge(selectedTicket.priority)}
              </div>
            </div>

            {/* Info Bar */}
            <div className="px-4 py-2 bg-surface-50 border-b border-surface-100 text-xs text-surface-600 flex flex-wrap gap-x-4 gap-y-1">
              {selectedTicket.orgName && <span><strong>Company:</strong> {selectedTicket.orgName}</span>}
              <span><strong>Category:</strong> {CATEGORIES.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}</span>
              <span><strong>Role:</strong> {selectedTicket.senderRole}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Original Message */}
              <div className="bg-surface-50 rounded-2xl p-4 max-w-[85%]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-surface-700">{selectedTicket.senderName}</span>
                  <span className="text-[10px] text-surface-400">{formatDate(selectedTicket.createdAt)}</span>
                </div>
                <p className="text-sm text-surface-700 whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Replies */}
              {(selectedTicket.replies || []).map((r, idx) => (
                <div key={idx} className={cn("max-w-[85%] p-4 rounded-2xl", 
                  r.senderRole === 'webmaster' 
                    ? 'bg-brand-500 text-white ml-auto' 
                    : 'bg-surface-50 text-surface-800'
                )}>
                  <div className={cn("flex items-center justify-between mb-2", r.senderRole === 'webmaster' && 'text-brand-100')}>
                    <span className="text-xs font-medium">{r.senderName}</span>
                    <span className="text-[10px]">{formatTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                </div>
              ))}
            </div>

            {/* Reply & Status */}
            {selectedTicket.status !== 'closed' && (
              <div className="p-4 border-t border-surface-100 space-y-3">
                {/* Quick Status Change */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-surface-500">Change status:</span>
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleUpdateStatus(selectedTicket.id, s.value)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        selectedTicket.status === s.value ? s.color : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Reply Input */}
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type a reply..."
                    className="input-field flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !reply.trim()}
                    className="btn-primary !p-3"
                  >
                    {sendingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-surface-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a ticket to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
