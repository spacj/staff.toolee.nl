'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getMessages, createMessage, markMessageRead, getWorkers, getConversations, getOrganization, getUsersByOrg, createSupportTicket, getSupportTicketsByOrg, updateSupportTicket, addSupportTicketReply } from '@/lib/firestore';
import { cn, formatDate } from '@/utils/helpers';
import { MessageCircle, Send, Plus, Search, ArrowLeft, User, Users, HelpCircle, Loader2, AlertCircle, Check, Shield, FileCheck, AlertTriangle, Package, ArrowLeftRight, ArrowRight } from 'lucide-react';

const REQUEST_META = {
  leave: { icon: FileCheck, label: 'Leave request', color: 'bg-blue-100 text-blue-700', accent: 'border-blue-200 bg-blue-50/50' },
  correction: { icon: AlertTriangle, label: 'Time correction', color: 'bg-amber-100 text-amber-700', accent: 'border-amber-200 bg-amber-50/50' },
  stock: { icon: Package, label: 'Stock request', color: 'bg-orange-100 text-orange-700', accent: 'border-orange-200 bg-orange-50/50' },
  swap: { icon: ArrowLeftRight, label: 'Shift swap', color: 'bg-purple-100 text-purple-700', accent: 'border-purple-200 bg-purple-50/50' },
};
import toast from 'react-hot-toast';

export default function ChatPage() {
  const router = useRouter();
  const { orgId, user, userProfile, isManager, isAdmin, organization } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [ticketConversations, setTicketConversations] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]); // owner/admins/managers from users collection
  const [selectedConv, setSelectedConv] = useState(null);
  const [isTicket, setIsTicket] = useState(false);
  const [messages, setMessages] = useState([]);
  const [ticketReplies, setTicketReplies] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Support ticket state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '', category: 'general' });
  const [sendingSupport, setSendingSupport] = useState(false);
  const [orgName, setOrgName] = useState('');

  const canCreateTickets = isManager || isAdmin;

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !orgId) {
      router.replace('/login');
    }
  }, [user, orgId, router]);

  useEffect(() => {
    if (orgId) {
      getOrganization(orgId).then(org => {
        if (org) setOrgName(org.name || '');
      }).catch(() => {});
    }
  }, [orgId]);

  const resolveWorkerId = async () => {
    if (userProfile?.workerId) return userProfile.workerId;
    if (!user) return null;
    const allWorkers = await getWorkers({ orgId });
    const match = allWorkers.find(w => w.email === userProfile?.email && w.status === 'active');
    return match?.id || user.uid;
  };

  const loadConversations = async () => {
    if (!orgId || !user) return;
    try {
      const w = await getWorkers({ orgId });
      setWorkers(w || []);
      getUsersByOrg(orgId).then(setOrgMembers).catch(() => setOrgMembers([]));
      const workerId = await resolveWorkerId();
      if (!workerId) return;
      const convs = await getConversations(workerId, orgId, isManager ? 'manager' : 'worker', w || []);
      setConversations(convs || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setWorkers([]);
      setConversations([]);
    }
  };

  const loadTickets = async () => {
    if (!orgId || !canCreateTickets) return;
    try {
      const tickets = await getSupportTicketsByOrg(orgId);
      setTicketConversations(tickets || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setTicketConversations([]);
    }
  };

  const loadMessages = async (partnerId, ticketId = null) => {
    if (!orgId || !partnerId && !ticketId) return;
    
    if (ticketId) {
      // Load ticket conversation
      try {
        const tickets = await getSupportTicketsByOrg(orgId);
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          setTicketReplies(ticket.replies || []);
          setIsTicket(true);
        }
      } catch (err) {
        console.error('Failed to load ticket:', err);
        setTicketReplies([]);
      }
      return;
    }
    
    // Load regular chat messages
    try {
      const workerId = await resolveWorkerId();
      const all = await getMessages({ orgId, limit: 200 });
      const between = (all || [])
        .filter(m => {
          if ((m.senderId === workerId && m.recipientId === partnerId) ||
              (m.senderId === partnerId && m.recipientId === workerId)) {
            return true;
          }
          if (isManager && m.senderId === partnerId && m.recipientType === 'management') {
            return true;
          }
          if (!isManager && m.senderRole === 'manager' && m.recipientType === 'management') {
            return true;
          }
          return false;
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(between);
      setIsTicket(false);
      
      between.filter(m => m.recipientId === workerId && !m.read).forEach(m => {
        markMessageRead(m.id).catch(() => {});
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  };

  useEffect(() => { loadConversations(); }, [orgId, isManager]);
  useEffect(() => { if (canCreateTickets) loadTickets(); }, [orgId, canCreateTickets]);

  useEffect(() => {
    if (selectedConv) {
      if (selectedConv.isTicket) {
        loadMessages(null, selectedConv.ticketId);
      } else {
        loadMessages(selectedConv.partnerId);
      }
    }
  }, [selectedConv]);

  useEffect(() => {
    const container = document.getElementById('messages-container');
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, ticketReplies]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || sending || isTicket) return;
    setSending(true);
    try {
      const workerId = await resolveWorkerId();
      const workerName = userProfile?.displayName || `${workers.find(w => w.id === workerId)?.firstName || ''} ${workers.find(w => w.id === workerId)?.lastName || ''}`.trim();
      const workerRole = isManager ? 'manager' : 'worker';
      
      await createMessage({
        senderId: workerId,
        senderName: workerName,
        senderRole: workerRole,
        recipientId: selectedConv.partnerId,
        recipientName: selectedConv.partnerName,
        recipientRole: selectedConv.partnerRole,
        body: newMessage.trim(),
        orgId,
      });
      
      setNewMessage('');
      loadMessages(selectedConv.partnerId);
      loadConversations();
    } catch (err) { toast.error(err.message); }
    setSending(false);
  };

  const handleTicketReply = async () => {
    if (!newMessage.trim() || !selectedConv || sendingReply) return;
    setSendingReply(true);
    try {
      await addSupportTicketReply(selectedConv.ticketId, {
        message: newMessage.trim(),
        senderName: userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
        senderRole: userProfile?.role || 'admin',
      });
      toast.success('Reply sent!');
      setNewMessage('');
      loadTickets();
      loadMessages(null, selectedConv.ticketId);
    } catch (err) {
      console.error('Failed to send reply:', err);
      toast.error('Failed to send reply');
    }
    setSendingReply(false);
  };

  const handleTicketStatusChange = async (ticketId, status) => {
    try {
      await updateSupportTicket(ticketId, { status });
      toast.success('Status updated');
      loadTickets();
      if (selectedConv?.ticketId === ticketId) {
        loadMessages(null, ticketId);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // People a user can start a chat with — management (owner/admins/managers)
  // first so staff can always reach the owner, then coworkers.
  const managementMembers = orgMembers.filter(m =>
    (m.role === 'admin' || m.role === 'manager') &&
    m.id !== user?.uid &&
    !workers.some(w => w.userId === m.id) // avoid duplicating someone already listed as a worker
  );
  const people = [
    ...managementMembers.map(m => ({
      id: m.id,
      name: (m.displayName || m.email || 'Management') + (organization?.ownerId === m.id ? ' · Owner' : ''),
      role: m.role,
      management: true,
    })),
    ...workers
      .filter(w => user && w.id !== user.uid && w.userId !== user?.uid)
      .map(w => ({ id: w.id, name: `${w.firstName} ${w.lastName}`, role: w.role || 'worker', management: false })),
  ];
  const filteredPeople = people.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-red-100 text-red-700',
      'in-progress': 'bg-amber-100 text-amber-700',
      resolved: 'bg-emerald-100 text-emerald-700',
      closed: 'bg-surface-100 text-surface-500',
    };
    return <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize', styles[status] || styles.open)}>{status}</span>;
  };

  const currentWorkerId = user?.uid;

  const allConversations = [
    ...conversations.map(c => ({ ...c, type: 'chat' })),
    ...ticketConversations.map(t => ({
      partnerId: t.id,
      partnerName: t.subject,
      partnerRole: 'support',
      type: 'ticket',
      isTicket: true,
      ticketId: t.id,
      ticketStatus: t.status,
      lastMessage: { body: t.message, createdAt: t.createdAt },
      unreadCount: 0,
    }))
  ].sort((a, b) => (b.lastMessage?.createdAt || '') > (a.lastMessage?.createdAt || '') ? 1 : -1);

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex bg-white rounded-2xl overflow-hidden border border-surface-200 shadow-sm md:pb-0">
        {/* Conversations List */}
        <div className={cn("w-full md:w-80 border-r border-surface-100 flex flex-col", selectedConv ? 'hidden md:flex' : 'flex')}>
          <div className="p-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-surface-800">Messages</h2>
              <div className="flex items-center gap-2">
                {canCreateTickets && (
                  <button onClick={() => setShowSupportModal(true)} className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200" title="Contact Support">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setShowNewChat(true)} className="p-2 rounded-lg bg-brand-100 text-brand-600 hover:bg-brand-200">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {!allConversations || allConversations.length === 0 ? (
              <div className="p-4 text-center text-surface-400 text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations yet.<br />Start a new chat!
              </div>
            ) : (
              allConversations.map(conv => (
                <button
                  key={conv.isTicket ? `ticket-${conv.ticketId}` : conv.partnerId}
                  onClick={() => setSelectedConv(conv)}
                  className={cn("w-full p-4 flex items-start gap-3 hover:bg-surface-50 transition-colors border-b border-surface-50 text-left",
                    selectedConv?.partnerId === conv.partnerId && 'bg-brand-50'
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", conv.isTicket ? 'bg-purple-100' : 'bg-surface-200')}>
                    {conv.isTicket ? <HelpCircle className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-surface-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("font-medium text-sm truncate", conv.unreadCount > 0 ? 'text-surface-900' : 'text-surface-700')}>
                        {conv.partnerName}
                      </p>
                      <span className="text-xs text-surface-400">{formatTime(conv.lastMessage?.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {conv.isTicket && getStatusBadge(conv.ticketStatus)}
                      <p className="text-xs text-surface-400 truncate">{conv.lastMessage?.body}</p>
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-surface-100 flex items-center gap-3">
              <button onClick={() => setSelectedConv(null)} className="md:hidden p-2 hover:bg-surface-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", selectedConv.isTicket ? 'bg-purple-100' : 'bg-surface-200')}>
                {selectedConv.isTicket ? <HelpCircle className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-surface-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-800 truncate">{selectedConv.partnerName}</p>
                <p className="text-xs text-surface-400 capitalize">{selectedConv.isTicket ? 'Support Ticket' : selectedConv.partnerRole}</p>
              </div>
              {selectedConv.isTicket && canCreateTickets && (
                <select
                  value={selectedConv.ticketStatus}
                  onChange={(e) => handleTicketStatusChange(selectedConv.ticketId, e.target.value)}
                  className="select-field !py-1 !text-xs"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              )}
            </div>

            {/* Messages / Ticket Thread */}
            <div id="messages-container" className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 md:pb-3">
              {isTicket ? (
                <>
                  {/* Original ticket message */}
                  <div className="bg-purple-50 rounded-2xl p-4 max-w-[85%]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-purple-700">Your Ticket</span>
                      <span className="text-[10px] text-purple-500">{formatDate(selectedConv.lastMessage?.createdAt)}</span>
                    </div>
                    <p className="text-sm text-purple-900 whitespace-pre-wrap">{selectedConv.lastMessage?.body}</p>
                  </div>

                  {/* Replies */}
                  {ticketReplies.map((reply, idx) => (
                    <div key={idx} className={cn("max-w-[85%] p-3 rounded-2xl", 
                      reply.senderRole === 'webmaster' 
                        ? 'bg-brand-500 text-white ml-auto' 
                        : 'bg-surface-100 text-surface-800'
                    )}>
                      <div className={cn("flex items-center justify-between mb-2", reply.senderRole === 'webmaster' && 'text-brand-100')}>
                        <span className="text-xs font-medium">{reply.senderName}</span>
                        <span className="text-[10px]">{formatTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </>
              ) : (
                messages.map(m => {
                  const isMe = m.senderId === currentWorkerId || m.senderId === userProfile?.workerId;
                  // Request card (leave / time-fix / stock / swap)
                  if (m.kind === 'request') {
                    const meta = REQUEST_META[m.requestType] || { icon: AlertCircle, label: 'Request', color: 'bg-surface-100 text-surface-600', accent: 'border-surface-200 bg-surface-50' };
                    return (
                      <div key={m.id} className="flex justify-start">
                        <div className={cn('max-w-[85%] w-full rounded-2xl border p-3', meta.accent)}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}><meta.icon className="w-4 h-4" /></span>
                            <span className="text-xs font-semibold text-surface-700">{meta.label}</span>
                            <span className="badge bg-amber-100 text-amber-700 !text-[10px] ml-auto">Pending</span>
                          </div>
                          <p className="text-sm font-medium text-surface-800">{m.title}</p>
                          {m.summary && <p className="text-xs text-surface-500 mt-0.5">{m.summary}</p>}
                          <p className="text-[10px] text-surface-400 mt-1.5">{m.senderName} · {formatTime(m.createdAt)}</p>
                          <Link href={m.link || '/chat'} className="mt-2 inline-flex items-center gap-1.5 bg-white border border-surface-200 rounded-lg px-3 py-1.5 text-xs font-medium text-surface-700 hover:border-brand-300 hover:text-brand-700 transition-colors">
                            {isManager ? 'Review' : 'View'} <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={cn("flex", isMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn("max-w-[75%] p-3 rounded-2xl",
                        isMe ? 'bg-brand-500 text-white rounded-br-md' : 'bg-surface-100 text-surface-800 rounded-bl-md'
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                        <p className={cn("text-[10px] mt-1", isMe ? 'text-brand-100' : 'text-surface-400')}>
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            {selectedConv.isTicket && selectedConv.ticketStatus !== 'closed' ? (
              <form onSubmit={(e) => { e.preventDefault(); handleTicketReply(); }} className="p-4 border-t border-surface-100 pb-28 md:pb-4">
                <div className="flex gap-2 items-end">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Reply to ticket..."
                    className="input-field flex-1"
                  />
                  <button type="button" onClick={handleTicketReply} disabled={sendingReply || !newMessage.trim()} className="btn-primary !p-3">
                    {sendingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </form>
            ) : !selectedConv.isTicket && (
              <form onSubmit={handleSend} className="p-4 border-t border-surface-100 pb-28 md:pb-4">
                <div className="flex gap-2 items-end">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input-field flex-1"
                  />
                  <button type="submit" disabled={sending || !newMessage.trim()} className="btn-primary !p-3">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-surface-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Modal open={showNewChat} onClose={() => setShowNewChat(false)} title="New Conversation">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="input-field !pl-10"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredPeople.length === 0 ? (
              <p className="text-center text-surface-400 py-4">No people found</p>
            ) : (
              filteredPeople.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedConv({ partnerId: p.id, partnerName: p.name, partnerRole: p.role });
                    setShowNewChat(false);
                    setSearchQuery('');
                  }}
                  className="w-full p-3 flex items-center gap-3 hover:bg-surface-50 rounded-xl text-left"
                >
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', p.management ? 'bg-brand-100' : 'bg-surface-200')}>
                    {p.management ? <Shield className="w-5 h-5 text-brand-600" /> : <User className="w-5 h-5 text-surface-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-surface-800">{p.name}</p>
                    <p className="text-xs text-surface-400 capitalize">{p.management ? 'Management' : (p.role || 'worker')}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Support Ticket Modal */}
      <Modal open={showSupportModal} onClose={() => setShowSupportModal(false)} title="Contact Support">
        <div className="space-y-4">
          <p className="text-sm text-surface-500">Having issues? Send a message to our support team. We'll get back to you within 24 hours.</p>
          <div>
            <label className="label">Subject *</label>
            <input
              type="text"
              value={supportForm.subject}
              onChange={e => setSupportForm({ ...supportForm, subject: e.target.value })}
              placeholder="Brief description of your issue"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              value={supportForm.category}
              onChange={e => setSupportForm({ ...supportForm, category: e.target.value })}
              className="select-field"
            >
              <option value="general">General Question</option>
              <option value="billing">Billing & Pricing</option>
              <option value="technical">Technical Support</option>
              <option value="feature">Feature Request</option>
              <option value="account">Account Help</option>
            </select>
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea
              value={supportForm.message}
              onChange={e => setSupportForm({ ...supportForm, message: e.target.value })}
              placeholder="Describe your issue in detail..."
              className="input-field min-h-[120px] resize-none"
            />
          </div>
          <button
            onClick={async () => {
              if (!supportForm.subject.trim() || !supportForm.message.trim()) {
                toast.error('Please fill in subject and message');
                return;
              }
              if (!user) {
                toast.error('Please log in to submit a ticket');
                return;
              }
              setSendingSupport(true);
              try {
                await createSupportTicket({
                  subject: supportForm.subject.trim(),
                  message: supportForm.message.trim(),
                  category: supportForm.category,
                  priority: 'medium',
                  source: 'app',
                  senderName: userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
                  senderEmail: user?.email,
                  senderRole: userProfile?.role || 'admin',
                  senderId: user?.uid,
                  orgId,
                  orgName,
                });
                toast.success('Ticket submitted!');
                setShowSupportModal(false);
                setSupportForm({ subject: '', message: '', category: 'general' });
                loadTickets();
              } catch (err) {
                console.error('Support ticket error:', err);
                toast.error('Failed to submit ticket');
              }
              setSendingSupport(false);
            }}
            disabled={sendingSupport}
            className="btn-primary w-full !py-3"
          >
            {sendingSupport ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Ticket'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
