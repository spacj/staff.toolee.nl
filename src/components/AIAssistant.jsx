'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, X, Send, Loader2, Calendar, BarChart3, MessageCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/helpers';

const FEATURES = [
  { id: 'assistant', icon: MessageCircle, label: 'Chat', color: 'text-brand-600 bg-brand-100', desc: 'Ask anything about scheduling & management' },
  { id: 'schedule', icon: Calendar, label: 'Schedule AI', color: 'text-emerald-600 bg-emerald-100', desc: 'Optimize your weekly schedule' },
  { id: 'insights', icon: BarChart3, label: 'Insights', color: 'text-amber-600 bg-amber-100', desc: 'AI analysis of team performance' },
  { id: 'support', icon: HelpCircle, label: 'Support', color: 'text-purple-600 bg-purple-100', desc: 'Contact support or view tickets' },
];

export default function AIAssistant({ contextData }) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState('assistant');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current && window.innerWidth >= 640) {
      inputRef.current.focus();
    }
  }, [open, feature]);

  const switchFeature = (f) => {
    setFeature(f);
    setMessages([]);
    setInput('');
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg && feature === 'assistant') return;

    let userMessage = msg;
    if (!msg && feature === 'schedule' && contextData) {
      userMessage = `Analyze this schedule data and suggest optimizations:\n\n${JSON.stringify(contextData.schedule || {}, null, 2)}\n\nWorkers: ${contextData.workerCount || 0}, Shops: ${contextData.shopCount || 0}`;
    }
    if (!msg && feature === 'insights' && contextData) {
      userMessage = `Analyze this team data and provide insights:\n\n${JSON.stringify(contextData.insights || {}, null, 2)}`;
    }
    if (!userMessage) { setInput(''); return; }

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.slice(-6), feature }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.content }]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Connection error. Please try again.` }]);
    }
    setLoading(false);
  };

  const featureInfo = FEATURES.find(f => f.id === feature);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed right-6 z-50 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105',
          'bottom-20 sm:bottom-6',
          open ? 'bg-surface-800 rotate-0' : 'bg-gradient-to-br from-brand-500 to-brand-700 hover:shadow-brand-500/30 hover:shadow-xl'
        )}
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl border border-surface-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4"
          style={{ bottom: 'calc(80px + 5rem)', maxHeight: 'calc(100vh - 200px)' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-display font-bold text-surface-900">StaffHub AI</h3>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FEATURES.map(f => (
                <button key={f.id} onClick={() => switchFeature(f.id)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                    feature === f.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                  )}>
                  <f.icon className="w-3 h-3" />{f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content - Support Feature */}
          {feature === 'support' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <HelpCircle className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-surface-700">Need Help?</p>
                <p className="text-xs text-surface-400 mt-1 max-w-[260px] mx-auto">Contact our support team or view your existing tickets.</p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <Link
                  href="/chat"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between p-3 bg-surface-50 hover:bg-surface-100 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-surface-700">Go to Chat</p>
                      <p className="text-xs text-surface-400">View & reply to support tickets</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-surface-400" />
                </Link>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-xs text-purple-700 font-medium mb-2">💬 How to contact support:</p>
                  <ul className="text-xs text-purple-600 space-y-1">
                    <li>1. Go to <strong>Chat</strong> page</li>
                    <li>2. Click the <strong>purple help icon</strong> 🔷</li>
                    <li>3. Fill in your issue details</li>
                    <li>4. Submit and we'll respond within 24h</li>
                  </ul>
                </div>

                <div className="p-3 bg-surface-50 rounded-xl">
                  <p className="text-xs text-surface-500">
                    <strong>Tip:</strong> You can also submit the homepage contact form if tickets from you're not logged in.
                  </p>
                </div>
              </div>

              {/* FAQ Quick Links */}
              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Common Questions</p>
                <div className="space-y-2">
                  {[
                    'How do I add workers to my organization?',
                    'How does the billing work?',
                    'Can I export my schedule?',
                  ].map(q => (
                    <button key={q} onClick={() => { switchFeature('assistant'); setInput(q); }}
                      className="w-full text-left text-xs text-surface-500 bg-surface-50 hover:bg-surface-100 rounded-lg px-3 py-2 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3', featureInfo?.color)}>
                      {featureInfo && <featureInfo.icon className="w-6 h-6" />}
                    </div>
                    <p className="text-sm font-semibold text-surface-700">{featureInfo?.label}</p>
                    <p className="text-xs text-surface-400 mt-1 max-w-[260px] mx-auto">{featureInfo?.desc}</p>
                    {feature !== 'assistant' && contextData && (
                      <button onClick={() => send()} className="btn-primary !py-2 !px-4 !text-xs mt-4">
                        <Sparkles className="w-3 h-3" /> Analyze Now
                      </button>
                    )}
                    {feature === 'assistant' && (
                      <div className="mt-4 space-y-2">
                        {['How should I handle scheduling for weekends?', 'Tips for managing part-time workers', 'How to reduce overtime costs?'].map(q => (
                          <button key={q} onClick={() => { setInput(q); send(q); }}
                            className="w-full text-left text-xs text-surface-500 bg-surface-50 hover:bg-surface-100 rounded-lg px-3 py-2 transition-colors">
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                      m.role === 'user' ? 'bg-brand-600 text-white rounded-br-md' : 'bg-surface-100 text-surface-700 rounded-bl-md'
                    )}>
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none [&>*]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:text-surface-800 text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
                      ) : (
                        <p className="text-xs leading-relaxed">{m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-surface-100 bg-white">
                <div className="flex gap-2">
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loading && send()}
                    placeholder={feature === 'assistant' ? 'Ask anything...' : 'Ask a follow-up...'}
                    className="flex-1 px-3.5 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    disabled={loading} />
                  <button onClick={() => send()} disabled={loading || (!input.trim() && feature === 'assistant')}
                    className="btn-primary !p-2.5 !rounded-xl"><Send className="w-4 h-4" /></button>
                </div>
                <p className="text-[10px] text-surface-300 mt-1.5 text-center">AI responses may be inaccurate. Verify important decisions.</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^### (.*)/gm, '<h4 class="font-semibold text-surface-800">$1</h4>')
    .replace(/^## (.*)/gm, '<h3 class="font-semibold text-surface-800">$1</h3>')
    .replace(/\n/g, '<br/>');
}
