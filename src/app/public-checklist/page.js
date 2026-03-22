'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/utils/helpers';
import { getPublicAssignment, getPublicAssignments, updatePublicAssignment } from '@/lib/firestore';
import {
  CheckCircle2, Circle, ClipboardCheck, MessageSquare, Shield,
  Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

function PublicChecklistContent() {
  const searchParams = useSearchParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const sessionId = searchParams.get('s');
  const assignmentId = searchParams.get('id');

  useEffect(() => {
    if (!assignmentId && !sessionId) {
      setError('Invalid link. Please scan the QR code again.');
      setLoading(false);
      return;
    }
    loadAssignment();
  }, [assignmentId, sessionId]);

  async function loadAssignment() {
    setLoading(true);
    try {
      if (assignmentId) {
        const data = await getPublicAssignment(assignmentId);
        if (!data) { setError('Checklist not found. It may have been removed.'); }
        else setAssignment(data);
      } else if (sessionId) {
        const list = await getPublicAssignments({ sessionId });
        if (list.length === 0) { setError('No checklist found for this session.'); }
        else setAssignment(list[0]);
      }
    } catch {
      setError('Failed to load checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleItem(itemIndex) {
    if (!assignment) return;
    try {
      const updatedItems = [...assignment.items];
      const item = updatedItems[itemIndex];
      item.checked = !item.checked;
      item.checkedAt = item.checked ? new Date().toISOString() : null;

      const allDone = updatedItems.every(i => i.checked);
      let status = allDone ? 'completed' : updatedItems.some(i => i.checked) ? 'in-progress' : 'pending';

      await updatePublicAssignment(assignment.id, {
        items: updatedItems,
        status,
        ...(allDone ? { completedAt: new Date().toISOString() } : { completedAt: null }),
        updatedAt: new Date().toISOString(),
      });

      setAssignment(prev => ({
        ...prev,
        items: updatedItems,
        status,
        completedAt: allDone ? new Date().toISOString() : null,
      }));

      if (allDone) { setDone(true); toast.success('All done! Checklist submitted.'); }
    } catch {
      toast.error('Failed to save');
    }
  }

  async function handleAddNote(itemIndex, note) {
    if (!assignment) return;
    try {
      const updatedItems = [...assignment.items];
      updatedItems[itemIndex].note = note;
      await updatePublicAssignment(assignment.id, {
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      });
      setAssignment(prev => ({ ...prev, items: updatedItems }));
    } catch { toast.error('Failed to save note'); }
  }

  const checkedCount = (assignment?.items || []).filter(i => i.checked).length;
  const totalItems = (assignment?.items || []).length;
  const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;
  const isDone = done || assignment?.status === 'completed';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-surface-500 text-sm">Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-danger-400 mx-auto mb-3" />
          <h2 className="text-lg font-display font-bold text-surface-800 mb-1">Oops</h2>
          <p className="text-sm text-surface-500 mb-5">{error}</p>
          <p className="text-xs text-surface-400">Scan the QR code again or ask staff for help.</p>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-sm w-full card p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-display font-bold text-surface-900 mb-1">All Done!</h2>
          <p className="text-sm text-surface-500 mb-1">{assignment.templateTitle}</p>
          <p className="text-xs text-surface-400 mb-6">
            Completed by {assignment.publicName}
            {assignment.completedAt && ` · ${new Date(assignment.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
          <div className="bg-emerald-50 rounded-xl p-4 mb-5">
            <p className="text-sm text-emerald-700 font-medium">
              {checkedCount} of {totalItems} tasks completed
            </p>
          </div>
          <p className="text-xs text-surface-400">Thank you for completing the checklist!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Minimal header */}
      <div className="bg-white border-b border-surface-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold text-surface-900 truncate">{assignment.templateTitle}</h1>
            <p className="text-xs text-surface-400">
              {assignment.shopName ? `${assignment.shopName} · ` : ''}{assignment.publicName}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-lg font-bold text-brand-600">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-surface-400 mt-1 text-right">{checkedCount} of {totalItems} completed</p>
        </div>
      </div>

      {/* Checklist items */}
      <div className="px-4 pb-8">
        <div className="max-w-lg mx-auto card">
          <div className="divide-y divide-surface-100">
            {(assignment.items || []).map((item, i) => (
              <PublicItem
                key={item.id || i}
                item={item}
                index={i}
                onToggle={() => handleToggleItem(i)}
                onNote={(note) => handleAddNote(i, note)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicItem({ item, index, onToggle, onNote }) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || '');

  return (
    <div>
      <div className="flex items-start gap-3 p-4 group">
        <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
          {item.checked ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </motion.div>
          ) : (
            <Circle className={cn('w-6 h-6', item.required ? 'text-danger-300' : 'text-surface-300')} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <span className={cn('text-sm', item.checked ? 'line-through text-surface-400' : 'text-surface-700')}>
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
              {new Date(item.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button onClick={() => setShowNote(!showNote)}
          className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-surface-500 transition-all flex-shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
      {showNote && (
        <div className="px-4 pb-3 pl-11">
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onBlur={() => { if (noteText !== item.note) onNote(noteText); }}
            onKeyDown={e => { if (e.key === 'Enter') { onNote(noteText); setShowNote(false); } }}
            className="w-full px-3 py-1.5 bg-surface-50 border border-surface-200 rounded-lg text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            placeholder="Add a note..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

export default function PublicChecklistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PublicChecklistContent />
    </Suspense>
  );
}
