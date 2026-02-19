'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getMessages, createMessage, markMessageRead, getWorkers, getConversations } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { MessageCircle, Send, Plus, Search, ArrowLeft, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { orgId, user, userProfile, isManager } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  const resolveWorkerId = async () => {
    if (userProfile?.workerId) return userProfile.workerId;
    const allWorkers = await getWorkers({ orgId });
    const match = allWorkers.find(w => w.email === userProfile?.email && w.status === 'active');
    return match?.id || user.uid;
  };

  const loadConversations = async () => {
    if (!orgId) return;
    const w = await getWorkers({ orgId });
    setWorkers(w);
    const workerId = await resolveWorkerId();
    const convs = await getConversations(workerId, orgId, isManager ? 'manager' : 'worker', w);
    setConversations(convs);
  };

  const loadMessages = async (partnerId) => {
    if (!orgId || !partnerId) return;
    const workerId = await resolveWorkerId();
    const all = await getMessages({ orgId, limit: 100 });
    // Filter to messages between current user and partner
    const between = all
      .filter(m => 
        (m.senderId === workerId && m.recipientId === partnerId) ||
        (m.senderId === partnerId && m.recipientId === workerId)
      )
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    setMessages(between);
    
    // Mark unread as read
    between.filter(m => m.recipientId === workerId && !m.read).forEach(m => {
      markMessageRead(m.id).catch(() => {});
    });
  };

  useEffect(() => { loadConversations(); }, [orgId]);

  useEffect(() => {
    if (selectedConv?.partnerId) {
      loadMessages(selectedConv.partnerId);
    }
  }, [selectedConv]);

  useEffect(() => {
    const container = document.getElementById('messages-container');
    if (container) container.scrollTop = 0;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || sending) return;
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

  const filteredWorkers = workers.filter(w => 
    w.id !== user.uid &&
    `${w.firstName} ${w.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const currentWorkerId = user?.uid;

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex bg-white rounded-2xl overflow-hidden border border-surface-200 shadow-sm">
        {/* Conversations List */}
        <div className={cn("w-full md:w-80 border-r border-surface-100 flex flex-col", selectedConv ? 'hidden md:flex' : 'flex')}>
          <div className="p-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-surface-800">Messages</h2>
              <button onClick={() => setShowNewChat(true)} className="p-2 rounded-lg bg-brand-100 text-brand-600 hover:bg-brand-200">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-surface-400 text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations yet.<br />Start a new chat!
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.partnerId}
                  onClick={() => setSelectedConv(conv)}
                  className={cn("w-full p-4 flex items-start gap-3 hover:bg-surface-50 transition-colors border-b border-surface-50 text-left",
                    selectedConv?.partnerId === conv.partnerId && 'bg-brand-50'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-surface-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("font-medium text-sm truncate", conv.unreadCount > 0 ? 'text-surface-900' : 'text-surface-700')}>
                        {conv.partnerName}
                      </p>
                      <span className="text-xs text-surface-400">{formatTime(conv.lastMessage?.createdAt)}</span>
                    </div>
                    <p className="text-xs text-surface-400 truncate">{conv.lastMessage?.body}</p>
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
              <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center">
                <User className="w-5 h-5 text-surface-500" />
              </div>
              <div>
                <p className="font-medium text-surface-800">{selectedConv.partnerName}</p>
                <p className="text-xs text-surface-400 capitalize">{selectedConv.partnerRole}</p>
              </div>
            </div>

            {/* Messages */}
            <div id="messages-container" className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => {
                const isMe = m.senderId === currentWorkerId || m.senderId === userProfile?.workerId;
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
              })}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-surface-100">
              <div className="flex gap-2">
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
            {filteredWorkers.length === 0 ? (
              <p className="text-center text-surface-400 py-4">No people found</p>
            ) : (
              filteredWorkers.map(w => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedConv({ partnerId: w.id, partnerName: `${w.firstName} ${w.lastName}`, partnerRole: w.role || 'worker' });
                    setShowNewChat(false);
                    setSearchQuery('');
                  }}
                  className="w-full p-3 flex items-center gap-3 hover:bg-surface-50 rounded-xl text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-surface-500" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-800">{w.firstName} {w.lastName}</p>
                    <p className="text-xs text-surface-400 capitalize">{w.role || 'worker'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
