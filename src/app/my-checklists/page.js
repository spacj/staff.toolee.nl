'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import {
  getChecklistAssignments, updateChecklistAssignment, getWorkers,
} from '@/lib/firestore';
import {
  ClipboardCheck, CheckCircle2, Circle, Clock, AlertCircle, ChevronDown,
  ChevronRight, MessageSquare, QrCode, Calendar, Filter, Building, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function MyChecklistsPage() {
  const { orgId, user, userProfile, isManager } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterTab, setFilterTab] = useState('today'); // 'today' | 'pending' | 'completed' | 'all'
  const [workerId, setWorkerId] = useState(null);
  const [workerName, setWorkerName] = useState('');

  // Resolve worker ID and name (same pattern as time page)
  const resolveWorker = useCallback(async () => {
    if (userProfile?.workerId) {
      setWorkerName(userProfile.displayName || 'Unknown');
      return userProfile.workerId;
    }
    if (!orgId) {
      setWorkerName(userProfile?.displayName || user?.email || 'Unknown');
      return user?.uid;
    }
    try {
      const allWorkers = await getWorkers({ orgId });
      const match = allWorkers.find(w => w.email === user?.email);
      if (match) {
        setWorkerName(`${match.firstName} ${match.lastName}`);
        return match.id;
      }
    } catch {}
    setWorkerName(userProfile?.displayName || user?.email || 'Unknown');
    return user?.uid;
  }, [userProfile, orgId, user]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const wId = await resolveWorker();
      setWorkerId(wId);
      const all = await getChecklistAssignments({ orgId, workerId: wId });
      setAssignments(all);
    } catch (err) {
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, [orgId, resolveWorker]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Check/uncheck item ──────────────────────────────
  async function handleToggleItem(assignment, itemIndex) {
    try {
      const updatedItems = [...assignment.items];
      const item = updatedItems[itemIndex];
      const wasChecked = !!item.checked;
      item.checked = !wasChecked;
      item.checkedAt = !wasChecked ? new Date().toISOString() : null;
      // Track who checked it (for shop-wide)
      item.checkedBy = !wasChecked ? workerName : '';

      const allDone = updatedItems.every(i => i.checked);
      const anyChecked = updatedItems.some(i => i.checked);
      let status = assignment.status;
      if (allDone) status = 'completed';
      else if (anyChecked) status = 'in-progress';
      else status = 'pending';

      const updates = {
        items: updatedItems,
        status,
        ...(allDone ? { completedAt: new Date().toISOString(), completedBy: workerName } : { completedAt: null }),
      };

      await updateChecklistAssignment(assignment.id, updates);

      setAssignments(prev => prev.map(a =>
        a.id === assignment.id
          ? { ...a, items: updatedItems, status, completedAt: allDone ? new Date().toISOString() : null }
          : a
      ));

      if (allDone) toast.success('Checklist completed!');
    } catch (err) {
      toast.error('Failed to update');
    }
  }

  // ─── Add note to item ────────────────────────────────
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

  // ─── Filtering ───────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const filtered = assignments.filter(a => {
    if (filterTab === 'today') return a.date === today;
    if (filterTab === 'pending') return a.status !== 'completed';
    if (filterTab === 'completed') return a.status === 'completed';
    return true;
  });

  // Sort: pending/in-progress first, then by date desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return (b.date || '') > (a.date || '') ? 1 : -1;
  });

  const todayPending = assignments.filter(a => a.date === today && a.status !== 'completed').length;
  const todayCompleted = assignments.filter(a => a.date === today && a.status === 'completed').length;
  const overdueCount = assignments.filter(a => a.status !== 'completed' && a.dueDate < today).length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Checklists</h1>
          <p className="text-sm text-surface-500 mt-0.5">Complete your assigned tasks</p>
        </div>
        <Link href="/checklist/scan" className="btn-secondary text-xs sm:text-sm">
          <QrCode className="w-4 h-4" /> Scan QR
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">To Do Today</span>
          <span className={cn('text-2xl font-display font-bold', todayPending > 0 ? 'text-brand-600' : 'text-surface-300')}>{todayPending}</span>
        </div>
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Done Today</span>
          <span className="text-2xl font-display font-bold text-emerald-600">{todayCompleted}</span>
        </div>
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Overdue</span>
          <span className={cn('text-2xl font-display font-bold', overdueCount > 0 ? 'text-danger-600' : 'text-surface-300')}>{overdueCount}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl mb-5 overflow-x-auto">
        {[
          { key: 'today', label: `Today (${assignments.filter(a => a.date === today).length})` },
          { key: 'pending', label: `Pending (${assignments.filter(a => a.status !== 'completed').length})` },
          { key: 'completed', label: `Done (${assignments.filter(a => a.status === 'completed').length})` },
          { key: 'all', label: `All (${assignments.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilterTab(t.key)}
            className={cn('px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0',
              filterTab === t.key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Checklist List ─────────────────────────── */}
      {sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="text-lg font-display font-semibold text-surface-700">
            {filterTab === 'today' ? 'Nothing due today' : filterTab === 'completed' ? 'No completed checklists' : 'No checklists assigned'}
          </h3>
          <p className="text-sm text-surface-500 mt-1">
            {filterTab === 'today' ? 'You\'re all caught up!' : 'Check back later for new assignments.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(assignment => {
            const isExpanded = expandedId === assignment.id;
            const checkedCount = (assignment.items || []).filter(i => i.checked).length;
            const totalItems = (assignment.items || []).length;
            const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;
            const isOverdue = assignment.status !== 'completed' && assignment.dueDate < today;
            const isComplete = assignment.status === 'completed';

            return (
              <motion.div key={assignment.id} layout
                className={cn('card overflow-hidden transition-all',
                  isComplete && 'opacity-70',
                  isOverdue && 'border-danger-200 bg-danger-50/30'
                )}>
                {/* Header - always visible, clickable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                  className="w-full text-left p-4 sm:p-5 flex items-center gap-3">
                  {/* Status icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    isComplete ? 'bg-emerald-100 text-emerald-600'
                      : isOverdue ? 'bg-danger-100 text-danger-600'
                      : assignment.status === 'in-progress' ? 'bg-brand-100 text-brand-600'
                      : 'bg-surface-100 text-surface-500'
                  )}>
                    {isComplete ? <CheckCircle2 className="w-5 h-5" />
                      : isOverdue ? <AlertCircle className="w-5 h-5" />
                      : <ClipboardCheck className="w-5 h-5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn('font-display font-semibold text-surface-800 truncate', isComplete && 'line-through text-surface-500')}>
                        {assignment.templateTitle}
                      </h3>
                      {assignment.scope === 'shop' ? (
                        <span className="badge bg-emerald-100 text-emerald-700 text-[10px]">
                          <Building className="w-2.5 h-2.5 mr-0.5" /> Shop
                        </span>
                      ) : (
                        assignment.triggeredBy === 'qr' && (
                          <QrCode className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="w-20 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all',
                            pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-brand-500' : 'bg-surface-200'
                          )} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-surface-500">{checkedCount}/{totalItems}</span>
                      </div>
                      <span className="text-[11px] text-surface-400">
                        {assignment.date ? new Date(assignment.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <ChevronDown className={cn('w-5 h-5 text-surface-300 transition-transform flex-shrink-0', isExpanded && 'rotate-180')} />
                </button>

                {/* Expanded: checklist items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-surface-100 pt-3">
                        <div className="space-y-1">
                          {(assignment.items || []).map((item, i) => (
                            <ChecklistItem
                              key={item.id || i}
                              item={item}
                              index={i}
                              isShopWide={assignment.scope === 'shop'}
                              disabled={isComplete}
                              onToggle={() => handleToggleItem(assignment, i)}
                              onNote={(note) => handleAddNote(assignment, i, note)}
                            />
                          ))}
                        </div>

                        {/* Completion info */}
                        {isComplete && assignment.completedAt && (
                          <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed{assignment.completedBy ? ` by ${assignment.completedBy}` : ''} {new Date(assignment.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

// ─── Individual Checklist Item ─────────────────────────
function ChecklistItem({ item, index, disabled, isShopWide, onToggle, onNote }) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || '');

  return (
    <div className="group">
      <div className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-surface-50 transition-colors">
        <button
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            'mt-0.5 flex-shrink-0 transition-all',
            disabled && 'cursor-not-allowed'
          )}>
          {item.checked ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className={cn('w-5 h-5', item.required ? 'text-danger-300' : 'text-surface-300')} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <span className={cn('text-sm text-surface-700', item.checked && 'line-through text-surface-400')}>
            {item.text}
          </span>
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
          <button onClick={() => setShowNote(!showNote)}
            className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-surface-500 transition-all flex-shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Note input */}
      {showNote && (
        <div className="ml-7 mb-1 flex items-center gap-2">
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onBlur={() => { if (noteText !== item.note) onNote(noteText); }}
            onKeyDown={e => { if (e.key === 'Enter') { onNote(noteText); setShowNote(false); } }}
            className="input-field text-xs py-1.5"
            placeholder="Add a note..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
