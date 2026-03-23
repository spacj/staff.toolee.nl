'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import { getChecklistAssignments, updateChecklistAssignment, getChecklistTemplates } from '@/lib/firestore';
import {
  ClipboardCheck, CheckCircle2, Circle, AlertCircle, ChevronDown,
  Loader2, MessageSquare, Building, MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function ShopChecklistsPage() {
  return (
    <Layout>
      <ShopChecklistsContent />
    </Layout>
  );
}

function ShopChecklistsContent() {
  const params = useParams();
  const shopId = params.shopId;
  const { orgId, userProfile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [workerName, setWorkerName] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (userProfile) {
      setWorkerName(userProfile.displayName || 'Unknown');
    }
  }, [userProfile]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [assigns, tmpls] = await Promise.all([
        getChecklistAssignments({ orgId }),
        getChecklistTemplates(orgId),
      ]);
      const shopAssignments = assigns.filter(a =>
        a.date === todayStr &&
        (a.shopId === shopId || !a.shopId) &&
        (a.scope === 'shop' || a.scope === 'public')
      );
      setAssignments(shopAssignments);
      setTemplates(tmpls);
    } catch {
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, [orgId, shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleItem(assignment, itemIndex) {
    try {
      const updatedItems = [...assignment.items];
      const item = updatedItems[itemIndex];
      const wasChecked = !!item.checked;
      item.checked = !wasChecked;
      item.checkedAt = !wasChecked ? new Date().toISOString() : null;
      item.checkedBy = !wasChecked ? workerName : '';

      const allDone = updatedItems.every(i => i.checked);
      const anyChecked = updatedItems.some(i => i.checked);
      let status = allDone ? 'completed' : anyChecked ? 'in-progress' : 'pending';

      await updateChecklistAssignment(assignment.id, {
        items: updatedItems,
        status,
        ...(allDone ? { completedAt: new Date().toISOString(), completedBy: workerName } : {}),
      });

      setAssignments(prev => prev.map(a =>
        a.id === assignment.id ? { ...a, items: updatedItems, status } : a
      ));

      if (allDone) toast.success('All tasks completed!');
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleAddNote(assignment, itemIndex, note) {
    try {
      const updatedItems = [...assignment.items];
      updatedItems[itemIndex].note = note;
      await updateChecklistAssignment(assignment.id, { items: updatedItems });
      setAssignments(prev => prev.map(a =>
        a.id === assignment.id ? { ...a, items: updatedItems } : a
      ));
    } catch { toast.error('Failed to save note'); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const completed = assignments.filter(a => a.status === 'completed').length;
  const inProgress = assignments.filter(a => a.status === 'in-progress').length;
  const pending = assignments.filter(a => a.status === 'pending').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Today's Checklists</h1>
          <p className="text-sm text-surface-500 mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {completed > 0 && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> {completed} done</span>}
          {inProgress > 0 && <span className="flex items-center gap-1 text-brand-600"><AlertCircle className="w-3.5 h-3.5" /> {inProgress} in progress</span>}
          {pending > 0 && <span className="flex items-center gap-1 text-surface-400"><Circle className="w-3.5 h-3.5" /> {pending} pending</span>}
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="text-lg font-display font-semibold text-surface-700">No checklists today</h3>
          <p className="text-sm text-surface-500 mt-1">No checklists are due for this location today.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const isExpanded = expandedId === a.id;
            const checked = (a.items || []).filter(i => i.checked).length;
            const total = (a.items || []).length;
            const pct = total ? Math.round(checked / total * 100) : 0;
            const isComplete = a.status === 'completed';
            const isOverdue = a.status !== 'completed' && a.dueDate < today;

            return (
              <motion.div key={a.id} layout className={cn('card overflow-hidden',
                isComplete && 'opacity-70',
                isOverdue && 'border-danger-200 bg-danger-50/30'
              )}>
                <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full text-left p-4 flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    isComplete ? 'bg-emerald-100 text-emerald-600'
                      : isOverdue ? 'bg-danger-100 text-danger-600'
                      : a.status === 'in-progress' ? 'bg-brand-100 text-brand-600'
                      : 'bg-surface-100 text-surface-500'
                  )}>
                    {isComplete ? <CheckCircle2 className="w-5 h-5" />
                      : isOverdue ? <AlertCircle className="w-5 h-5" />
                      : <ClipboardCheck className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn('font-semibold text-surface-800 truncate', isComplete && 'line-through text-surface-500')}>
                        {a.templateTitle}
                      </h3>
                      {a.scope === 'shop' && (
                        <span className="badge bg-emerald-100 text-emerald-700 text-[10px]">
                          <Building className="w-2.5 h-2.5 mr-0.5" /> Shop
                        </span>
                      )}
                      {a.scope === 'public' && (
                        <span className="badge bg-emerald-50 text-emerald-600 text-[10px]">Public</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-20 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all',
                          pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-brand-500' : 'bg-surface-200'
                        )} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-surface-500">{checked}/{total}</span>
                      {a.completedBy && (
                        <span className="text-[10px] text-emerald-600">{a.completedBy}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={cn('w-5 h-5 text-surface-300 transition-transform flex-shrink-0', isExpanded && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-surface-100 pt-3">
                        <div className="space-y-1">
                          {(a.items || []).map((item, i) => (
                            <ShopChecklistItem
                              key={item.id || i}
                              item={item}
                              disabled={isComplete}
                              isShopWide={a.scope === 'shop'}
                              onToggle={() => handleToggleItem(a, i)}
                              onNote={(note) => handleAddNote(a, i, note)}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ShopChecklistItem({ item, disabled, isShopWide, onToggle, onNote }) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || '');

  return (
    <div className="group">
      <div className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-surface-50">
        <button onClick={onToggle} disabled={disabled} className="mt-0.5 flex-shrink-0">
          {item.checked ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className={cn('w-5 h-5', item.required ? 'text-danger-300' : 'text-surface-300')} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <span className={cn('text-sm text-surface-700', item.checked && 'line-through text-surface-400')}>{item.text}</span>
          {item.required && !item.checked && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-danger-50 text-danger-600 font-medium">Required</span>
          )}
          {item.note && !showNote && (
            <p className="text-xs text-surface-400 mt-0.5 italic">{item.note}</p>
          )}
          {item.checkedAt && (
            <p className="text-[10px] text-surface-300 mt-0.5">
              {isShopWide && item.checkedBy ? `${item.checkedBy} · ` : ''}
              {new Date(item.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {!disabled && (
          <button onClick={() => setShowNote(!showNote)} className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-surface-500 flex-shrink-0">
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
      {showNote && (
        <div className="ml-7 mb-1">
          <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
            onBlur={() => { if (noteText !== item.note) onNote(noteText); }}
            onKeyDown={e => { if (e.key === 'Enter') { onNote(noteText); setShowNote(false); } }}
            className="input-field text-xs py-1.5" placeholder="Add a note..." autoFocus />
        </div>
      )}
    </div>
  );
}
