'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAllSupportTickets, updateSupportTicket, addSupportTicketReply } from '@/lib/firestore';
import { cn, formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { 
  DollarSign, Search, User, Mail, Phone, Building2, Users as UsersIcon, 
  Loader2, Check, Clock, AlertCircle, X, Send, MessageCircle, Plus,
  TrendingUp, Filter, Download, Star, CheckCircle, XCircle
} from 'lucide-react';

const STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-700' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
  { value: 'proposal', label: 'Proposal Sent', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'won', label: 'Won', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'lost', label: 'Lost', color: 'bg-surface-100 text-surface-500' },
];

export default function WebmasterSalesPage() {
  const { user, userProfile, isWebmaster } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadTickets = async () => {
    try {
      const data = await getAllSupportTickets();
      const salesTickets = (data || []).filter(t => t.category === 'sales');
      setTickets(salesTickets);
    } catch (err) {
      console.error('Failed to load sales tickets:', err);
      toast.error('Failed to load leads');
    }
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, []);

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.senderName || '').toLowerCase().includes(q) ||
        (t.senderEmail || '').toLowerCase().includes(q) ||
        (t.orgName || '').toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: tickets.length,
    new: tickets.filter(t => t.status === 'new').length,
    contacted: tickets.filter(t => t.status === 'contacted').length,
    qualified: tickets.filter(t => t.status === 'qualified').length,
    proposal: tickets.filter(t => t.status === 'proposal').length,
    won: tickets.filter(t => t.status === 'won').length,
  };

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      await updateSupportTicket(ticketId, { status });
      toast.success('Status updated');
      loadTickets();
      if (selectedLead?.id === ticketId) {
        const updated = tickets.find(t => t.id === ticketId);
        if (updated) setSelectedLead({ ...updated, status });
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedLead) return;
    setSendingReply(true);
    try {
      await addSupportTicketReply(selectedLead.id, {
        message: reply.trim(),
        senderName: userProfile?.displayName || 'Webmaster',
        senderRole: 'webmaster',
      });
      toast.success('Reply sent!');
      setReply('');
      loadTickets();
      const updated = tickets.find(t => t.id === selectedLead.id);
      if (updated) setSelectedLead(updated);
    } catch (err) {
      toast.error('Failed to send reply');
    }
    setSendingReply(false);
  };

  const getStatusBadge = (status) => {
    const s = STATUSES.find(st => st.value === status) || STATUSES[0];
    return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', s.color)}>{s.label}</span>;
  };

  const parseMessage = (message) => {
    if (!message) return { company: '', name: '', email: '', phone: '', employees: '', body: '' };
    const lines = message.split('\n');
    let company = '', name = '', email = '', phone = '', employees = '', body = '';
    let bodyStart = false;
    lines.forEach(line => {
      if (line.startsWith('Company:')) company = line.replace('Company:', '').trim();
      else if (line.startsWith('Name:')) name = line.replace('Name:', '').trim();
      else if (line.startsWith('Email:')) email = line.replace('Email:', '').trim();
      else if (line.startsWith('Phone:')) phone = line.replace('Phone:', '').trim();
      else if (line.startsWith('Employees:')) employees = line.replace('Employees:', '').trim();
      else if (line.startsWith('Message:')) bodyStart = true;
      else if (bodyStart) body += line + '\n';
    });
    return { company, name, email, phone, employees, body: body.trim() };
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
          <DollarSign className="w-16 h-16 text-surface-300" />
          <h1 className="text-2xl font-display font-bold text-surface-800">Access Restricted</h1>
          <p className="text-surface-500">This page is only available to webmaster accounts.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900">Sales Leads</h1>
            <p className="text-surface-500 mt-1">Manage enterprise sales inquiries</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.total}</p>
                <p className="text-xs text-surface-500">Total Leads</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.new}</p>
                <p className="text-xs text-surface-500">New</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.contacted}</p>
                <p className="text-xs text-surface-500">Contacted</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.qualified}</p>
                <p className="text-xs text-surface-500">Qualified</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.won}</p>
                <p className="text-xs text-surface-500">Won</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-surface-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-surface-800">{stats.total - stats.won - stats.qualified - stats.contacted - stats.new}</p>
                <p className="text-xs text-surface-500">Other</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads..."
                className="input-field !pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select-field !w-auto"
            >
              <option value="all">All Status</option>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 card divide-y divide-surface-100">
            <div className="p-4">
              <h3 className="font-semibold text-surface-800">Leads ({filteredTickets.length})</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-surface-400" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-surface-400">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No leads found</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const info = parseMessage(ticket.message);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedLead(ticket)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-surface-50 transition-colors",
                        selectedLead?.id === ticket.id && 'bg-brand-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm text-surface-800 truncate">{info.company || ticket.orgName || 'Unknown'}</p>
                          </div>
                          <p className="text-xs text-surface-500 truncate mb-1">{info.name || ticket.senderName}</p>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(ticket.status)}
                            <span className="text-[10px] text-surface-400">{formatTime(ticket.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2 card p-6">
            {selectedLead ? (() => {
              const info = parseMessage(selectedLead.message);
              return (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-surface-800">{info.company || selectedLead.orgName}</h3>
                      <p className="text-sm text-surface-500">Lead since {formatDate(selectedLead.createdAt)}</p>
                    </div>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => handleUpdateStatus(selectedLead.id, e.target.value)}
                      className="select-field !w-auto"
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-surface-500" />
                        <span className="text-xs font-semibold text-surface-500 uppercase">Contact</span>
                      </div>
                      <p className="text-sm font-medium text-surface-800">{info.name || selectedLead.senderName}</p>
                    </div>
                    <div className="p-4 bg-surface-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="w-4 h-4 text-surface-500" />
                        <span className="text-xs font-semibold text-surface-500 uppercase">Email</span>
                      </div>
                      <p className="text-sm font-medium text-surface-800">{info.email || selectedLead.senderEmail}</p>
                    </div>
                    {info.phone && (
                      <div className="p-4 bg-surface-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-4 h-4 text-surface-500" />
                          <span className="text-xs font-semibold text-surface-500 uppercase">Phone</span>
                        </div>
                        <p className="text-sm font-medium text-surface-800">{info.phone}</p>
                      </div>
                    )}
                    {info.employees && (
                      <div className="p-4 bg-surface-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <UsersIcon className="w-4 h-4 text-surface-500" />
                          <span className="text-xs font-semibold text-surface-500 uppercase">Size</span>
                        </div>
                        <p className="text-sm font-medium text-surface-800">{info.employees} employees</p>
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {info.body && (
                    <div>
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Message</p>
                      <div className="p-4 bg-surface-50 rounded-xl">
                        <p className="text-sm text-surface-700 whitespace-pre-wrap">{info.body}</p>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {selectedLead.replies && selectedLead.replies.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">History ({selectedLead.replies.length})</p>
                      <div className="space-y-2">
                        {selectedLead.replies.map((reply, idx) => (
                          <div key={idx} className={cn("p-3 rounded-xl", reply.senderRole === 'webmaster' ? 'bg-brand-50 ml-8' : 'bg-surface-50 mr-8')}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-surface-700">{reply.senderName}</span>
                              <span className="text-[10px] text-surface-400">{formatTime(reply.createdAt)}</span>
                            </div>
                            <p className="text-sm text-surface-700 whitespace-pre-wrap">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply */}
                  {selectedLead.status !== 'won' && selectedLead.status !== 'lost' && (
                    <div>
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Send Reply</p>
                      <div className="flex gap-2">
                        <textarea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Type your reply..."
                          className="input-field flex-1 min-h-[80px] resize-none"
                        />
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleSendReply}
                          disabled={sendingReply || !reply.trim()}
                          className="btn-primary !py-2"
                        >
                          {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send <Send className="w-4 h-4 ml-2" /></>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center h-full text-surface-400 py-16">
                <DollarSign className="w-12 h-12 mb-3 opacity-30" />
                <p>Select a lead to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
