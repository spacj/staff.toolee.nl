'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import {
  getChecklistTemplates, createChecklistTemplate, updateChecklistTemplate, deleteChecklistTemplate,
  getChecklistAssignments, generateChecklistAssignments, deleteChecklistAssignment,
  getWorkers, getShops,
} from '@/lib/firestore';
import {
  ClipboardCheck, Plus, Trash2, Edit3, Copy, MoreVertical, Users, Store,
  Calendar, QrCode, Clock, CheckCircle2, Circle, AlertCircle, ChevronDown,
  ChevronRight, Play, Pause, BarChart3, Eye, X, GripVertical, RotateCcw,
  Download, Send, Filter, Globe, Building,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily', desc: 'Every day', icon: Clock },
  { value: 'weekly', label: 'Weekly', desc: 'Specific day each week', icon: Calendar },
  { value: 'monthly', label: 'Monthly', desc: 'Specific day each month', icon: Calendar },
  { value: 'specific-days', label: 'Days', desc: 'Selected days each week', icon: Calendar },
  { value: 'specific-dates', label: 'Dates', desc: 'Specific dates', icon: Calendar },
  { value: 'one-time', label: 'One-time', desc: 'Assign once manually', icon: Send },
  { value: 'qr', label: 'QR Code', desc: 'Triggered by scanning', icon: QrCode },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ChecklistsPage() {
  const { orgId, isManager, isAdmin, user, userProfile } = useAuth();
  const canEdit = isManager || isAdmin;

  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [tab, setTab] = useState('templates'); // 'templates' | 'assignments' | 'calendar'
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null); // template to assign
  const [showQRModal, setShowQRModal] = useState(null); // template for QR
  const [showShopQRModal, setShowShopQRModal] = useState(null); // shop for shop QR
  const [viewDate, setViewDate] = useState(new Date()); // calendar view date
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [tmpls, assigns, wrks, shps] = await Promise.all([
        getChecklistTemplates(orgId),
        getChecklistAssignments({ orgId }),
        getWorkers({ orgId, status: 'active' }),
        getShops(orgId),
      ]);
      setTemplates(tmpls);
      setAssignments(assigns);
      setWorkers(wrks);
      setShops(shps);
    } catch (err) {
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Template CRUD ──────────────────────────────────
  async function handleSaveTemplate(data) {
    try {
      if (editingTemplate) {
        await updateChecklistTemplate(editingTemplate.id, data);
        toast.success('Checklist updated');
      } else {
        const newTemplate = await createChecklistTemplate({
          ...data, orgId, createdBy: user.uid,
          createdByName: userProfile?.displayName || 'Unknown',
        });
        toast.success('Checklist created');

        // Auto-generate today's assignment if applicable
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dow = today.toLocaleDateString('en-US', { weekday: 'long' });
        const dom = today.getDate();
        const todayStr2 = today.toISOString().split('T')[0];

        const applicable =
          data.frequency === 'daily' ||
          (data.frequency === 'weekly' && data.dayOfWeek === dow) ||
          (data.frequency === 'monthly' && data.dayOfMonth === dom) ||
          (data.frequency === 'specific-days' && data.specificDays?.includes(dow)) ||
          (data.frequency === 'specific-dates' && data.specificDates?.includes(todayStr2));

        console.log('[handleSaveTemplate] applicable:', applicable, 'scope:', data.scope, 'frequency:', data.frequency, 'assignedTo:', data.assignedTo, 'workers.length:', workers.length);
        if (applicable && data.frequency !== 'qr') {
          console.log('[handleSaveTemplate] generating assignment, workers:', workers.length);
          const templateWithId = { ...data, id: newTemplate };
          const ids = await generateChecklistAssignments(templateWithId, workers, todayStr);
          console.log('[handleSaveTemplate] generated ids:', ids);
          if (ids.length > 0) {
            toast.success('Assignment generated for today');
          } else {
            toast('Assignment for today already exists');
          }
        }
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save checklist');
    }
  }

  async function handleDeleteTemplate(id) {
    try {
      // Delete all assignments for this template
      const related = assignments.filter(a => a.templateId === id);
      for (const a of related) await deleteChecklistAssignment(a.id);
      await deleteChecklistTemplate(id);
      toast.success('Checklist deleted');
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  }

  async function handleToggleActive(template) {
    try {
      const activating = !template.active;
      await updateChecklistTemplate(template.id, { active: !template.active });
      toast.success(template.active ? 'Checklist paused' : 'Checklist activated');

      // Auto-generate when reactivating a scheduled template
      if (activating && template.frequency !== 'qr' && template.frequency !== 'one-time' && template.scope !== 'public') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dow = today.toLocaleDateString('en-US', { weekday: 'long' });
        const dom = today.getDate();

        const applicable =
          template.frequency === 'daily' ||
          (template.frequency === 'weekly' && template.dayOfWeek === dow) ||
          (template.frequency === 'monthly' && template.dayOfMonth === dom) ||
          (template.frequency === 'specific-days' && template.specificDays?.includes(dow)) ||
          (template.frequency === 'specific-dates' && template.specificDates?.includes(todayStr));

        if (applicable) {
          const ids = await generateChecklistAssignments(template, workers, todayStr);
          if (ids.length > 0) {
            toast.success('Assignment generated for today');
          } else {
            toast('Assignment for today already exists');
          }
        }
      }
      loadData();
    } catch { toast.error('Failed to update'); }
  }

  async function handleDuplicate(template) {
    try {
      const { id, createdAt, updatedAt, ...rest } = template;
      await createChecklistTemplate({
        ...rest, title: `${template.title} (copy)`,
        createdBy: user.uid, createdByName: userProfile?.displayName || 'Unknown',
      });
      toast.success('Checklist duplicated');
      setOpenDropdown(null);
      loadData();
    } catch { toast.error('Failed to duplicate'); }
  }

  // ─── Manual assignment ──────────────────────────────
  async function handleManualAssign(template, selectedWorkerIds, date) {
    try {
      const targetWorkers = workers.filter(w => selectedWorkerIds.includes(w.id));
      const created = await generateChecklistAssignments(
        { ...template, assignedTo: selectedWorkerIds },
        targetWorkers,
        date
      );
      toast.success(`Assigned to ${created.length} worker${created.length !== 1 ? 's' : ''}`);
      setShowAssignModal(null);
      loadData();
    } catch (err) {
      toast.error('Failed to assign');
    }
  }

  // ─── Generate today's assignments ───────────────────
  async function handleGenerateToday() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dow = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const dom = new Date().getDate();
      let count = 0;
      for (const t of templates.filter(t => t.active)) {
        if (t.frequency === 'daily') {
          const ids = await generateChecklistAssignments(t, workers, today);
          count += ids.length;
        } else if (t.frequency === 'weekly' && t.dayOfWeek === dow) {
          const ids = await generateChecklistAssignments(t, workers, today);
          count += ids.length;
        } else if (t.frequency === 'monthly' && t.dayOfMonth === dom) {
          const ids = await generateChecklistAssignments(t, workers, today);
          count += ids.length;
        }
      }
      toast.success(`Generated ${count} assignment${count !== 1 ? 's' : ''} for today`);
      loadData();
    } catch (err) {
      toast.error('Failed to generate assignments');
    }
  }

  // ─── Stats ──────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const todayAssignments = assignments.filter(a => a.date === today);
  const completedToday = todayAssignments.filter(a => a.status === 'completed').length;
  const pendingToday = todayAssignments.filter(a => a.status === 'pending' || a.status === 'in-progress').length;
  const overdueCount = assignments.filter(a => a.status !== 'completed' && a.dueDate < today).length;

  // ─── Filtered assignments ───────────────────────────
  const filteredAssignments = assignments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterFrequency !== 'all' && a.frequency !== filterFrequency) return false;
    return true;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!canEdit) {
    return (
      <Layout>
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="text-lg font-display font-semibold text-surface-700">Access Restricted</h3>
          <p className="text-sm text-surface-500 mt-1">Only managers and admins can manage checklists.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Checklists</h1>
          <p className="text-sm text-surface-500 mt-0.5">Create and manage operational checklists for your team</p>
        </div>
        <div className="flex items-center gap-2">
          {shops.length > 0 && (
            <button onClick={() => setShowShopQRModal(shops[0])} className="btn-secondary text-xs sm:text-sm">
              <Building className="w-4 h-4" /> Shop QR
            </button>
          )}
          <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
            className="btn-primary text-xs sm:text-sm">
            <Plus className="w-4 h-4" /> New Checklist
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Templates</span>
          <span className="text-2xl font-display font-bold text-surface-900">{templates.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Due Today</span>
          <span className="text-2xl font-display font-bold text-brand-600">{todayAssignments.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Completed Today</span>
          <span className="text-2xl font-display font-bold text-emerald-600">{completedToday}</span>
        </div>
        <div className="stat-card">
          <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Overdue</span>
          <span className={cn('text-2xl font-display font-bold', overdueCount > 0 ? 'text-danger-600' : 'text-surface-300')}>{overdueCount}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('templates')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'templates' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
          Templates ({templates.length})
        </button>
        <button onClick={() => setTab('assignments')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'assignments' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
          Assignments ({assignments.length})
        </button>
        <button onClick={() => setTab('calendar')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'calendar' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
          <span className="hidden sm:inline">Calendar</span>
          <span className="sm:hidden">Cal</span>
        </button>
      </div>

      {/* ─── Templates Tab ──────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="card p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-surface-300 mx-auto mb-3" />
              <h3 className="text-lg font-display font-semibold text-surface-700">No checklists yet</h3>
              <p className="text-sm text-surface-500 mt-1 mb-4">Create your first operational checklist for your team.</p>
              <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
                className="btn-primary">
                <Plus className="w-4 h-4" /> Create Checklist
              </button>
            </div>
          ) : (
            templates.map((template) => {
              const FreqIcon = FREQUENCIES.find(f => f.value === template.frequency)?.icon || Clock;
              const isShopWide = template.scope === 'shop';
              const templateAssignments = assignments.filter(a => a.templateId === template.id);
              // Shop-wide: count unique dates (one assignment per day)
              const uniqueDates = new Set(templateAssignments.map(a => a.date)).size;
              const assignCount = isShopWide ? uniqueDates : templateAssignments.length;
              const completedCount = templateAssignments.filter(a => a.status === 'completed').length;
              const isExpanded = expandedTemplate === template.id;
              const shop = shops.find(s => s.id === template.shopId);
              const assignedWorkers = template.assignedTo === 'all'
                ? workers
                : workers.filter(w => (template.assignedTo || []).includes(w.id));

              return (
                <motion.div key={template.id} layout className={cn('card overflow-hidden', !template.active && 'opacity-60')}>
                  {/* Template header */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        template.frequency === 'qr' ? 'bg-purple-100 text-purple-600'
                          : template.frequency === 'daily' ? 'bg-brand-100 text-brand-600'
                          : template.frequency === 'weekly' ? 'bg-amber-100 text-amber-600'
                          : template.frequency === 'monthly' ? 'bg-teal-100 text-teal-600'
                          : 'bg-surface-100 text-surface-600'
                      )}>
                        <FreqIcon className="w-5 h-5" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-semibold text-surface-800">{template.title}</h3>
                          {!template.active && (
                            <span className="badge bg-surface-100 text-surface-500">Paused</span>
                          )}
                          <span className={cn('badge',
                            template.frequency === 'daily' ? 'bg-brand-100 text-brand-700'
                              : template.frequency === 'weekly' ? 'bg-amber-100 text-amber-700'
                              : template.frequency === 'monthly' ? 'bg-teal-100 text-teal-700'
                              : template.frequency === 'qr' ? 'bg-purple-100 text-purple-700'
                              : 'bg-surface-100 text-surface-600'
                          )}>
                            {template.frequency === 'one-time' ? 'One-time' : template.frequency}
                          </span>
                          {template.scope === 'public' && (
                            <span className="badge bg-emerald-100 text-emerald-700">
                              <Globe className="w-3 h-3 mr-0.5" /> Public
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-surface-500 mt-0.5 line-clamp-1">{template.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-surface-400">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {template.items?.length || 0} items
                          </span>
                          {template.scope === 'public' ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <Globe className="w-3.5 h-3.5" /> Anyone (public)
                            </span>
                          ) : isShopWide ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Building className="w-3.5 h-3.5" /> Shop (any staff)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Users className="w-3.5 h-3.5" /> Per worker
                              {template.assignedTo !== 'all' && template.assignedTo ? ` (${template.assignedTo.length})` : ''}
                            </span>
                          )}
                          {shop && (
                            <span className="flex items-center gap-1">
                              <Store className="w-3.5 h-3.5" /> {shop.name}
                            </span>
                          )}
                          {template.frequency === 'weekly' && template.dayOfWeek && (
                            <span>Every {template.dayOfWeek}</span>
                          )}
                          {template.frequency === 'monthly' && template.dayOfMonth && (
                            <span>Day {template.dayOfMonth}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3.5 h-3.5" /> {completedCount}/{assignCount}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setShowQRModal(template)}
                          className="btn-icon" title="Show QR Code">
                          <QrCode className="w-4 h-4" />
                        </button>
                        {template.scope !== 'public' && (
                          <button onClick={() => setShowAssignModal(template)}
                            className="btn-icon" title="Manual Assign">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                          className="btn-icon" title="Details">
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                        <div className="relative">
                          <button onClick={() => setOpenDropdown(openDropdown === template.id ? null : template.id)}
                            className="btn-icon">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openDropdown === template.id && (
                            <>
                              <div className="fixed inset-0 z-[55]" onClick={() => setOpenDropdown(null)} />
                              <div className="dropdown-menu z-[60]">
                                <button onClick={() => { setEditingTemplate(template); setShowTemplateModal(true); setOpenDropdown(null); }}
                                  className="dropdown-item"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                                <button onClick={() => handleDuplicate(template)} className="dropdown-item">
                                  <Copy className="w-3.5 h-3.5" /> Duplicate</button>
                                <button onClick={() => { handleToggleActive(template); setOpenDropdown(null); }}
                                  className="dropdown-item">
                                  {template.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                  {template.active ? 'Pause' : 'Activate'}
                                </button>
                                <button onClick={() => { setShowDeleteConfirm({ id: template.id, name: template.title }); setOpenDropdown(null); }}
                                  className="dropdown-item-danger"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded items preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-surface-100 pt-3">
                          <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">Checklist Items</p>
                          <div className="space-y-1.5">
                            {(template.items || []).map((item, i) => (
                              <div key={item.id || i} className="flex items-center gap-2 text-sm">
                                <Circle className="w-4 h-4 text-surface-300 flex-shrink-0" />
                                <span className="text-surface-700">{item.text}</span>
                                {item.required && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger-50 text-danger-600 font-medium">Required</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Assignments Tab ────────────────────────── */}
      {tab === 'assignments' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-surface-400" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field py-1.5 text-xs w-auto">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <select value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)} className="select-field py-1.5 text-xs w-auto">
              <option value="all">All Types</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="one-time">One-time</option>
              <option value="qr">QR Triggered</option>
            </select>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="card p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-surface-300 mx-auto mb-3" />
              <h3 className="text-lg font-display font-semibold text-surface-700">No assignments</h3>
              <p className="text-sm text-surface-500 mt-1">
                {assignments.length === 0 ? 'Generate today\'s assignments or manually assign checklists to workers.' : 'No assignments match current filters.'}
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Checklist</th>
                    <th>Worker</th>
                    <th>Completed By</th>
                    <th>Date</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.slice(0, 50).map(a => {
                    const checkedCount = (a.items || []).filter(i => i.checked).length;
                    const totalItems = (a.items || []).length;
                    const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;
                    const isOverdue = a.status !== 'completed' && a.dueDate < today;
                    return (
                      <tr key={a.id}>
                        <td className="font-medium text-surface-800">{a.templateTitle}</td>
                        <td>
                          {a.workerId === 'shop' ? (
                            <span className="font-medium text-purple-700 text-sm">Shop</span>
                          ) : (
                            a.workerName
                          )}
                        </td>
                        <td className="text-xs text-surface-500">
                          {a.workerId === 'shop' && a.completedBy ? a.completedBy : '—'}
                        </td>
                        <td className="text-surface-500 text-xs">
                          {a.date ? new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all',
                                pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-brand-500' : 'bg-surface-200'
                              )} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-surface-500">{checkedCount}/{totalItems}</span>
                          </div>
                        </td>
                        <td>
                          <span className={cn('badge',
                            a.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                              : isOverdue ? 'bg-danger-50 text-danger-600'
                              : a.status === 'in-progress' ? 'bg-brand-100 text-brand-700'
                              : 'bg-surface-100 text-surface-600'
                          )}>
                            {isOverdue ? 'Overdue' : a.status}
                          </span>
                        </td>
                        <td>
                          <span className={cn('text-xs',
                            a.triggeredBy === 'qr' ? 'text-purple-600' : 'text-surface-400'
                          )}>
                            {a.triggeredBy === 'qr' ? 'QR' : a.frequency}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Calendar Tab ──────────────────────────────── */}
      {tab === 'calendar' && (
        <CalendarView assignments={assignments} templates={templates} viewDate={viewDate} setViewDate={setViewDate} />
      )}

      {/* ─── Template Modal ───────────────────────────── */}
      <TemplateModal
        open={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
        onSave={handleSaveTemplate}
        editing={editingTemplate}
        workers={workers}
        shops={shops}
      />

      {/* ─── Manual Assign Modal ──────────────────────── */}
      <AssignModal
        open={!!showAssignModal}
        onClose={() => setShowAssignModal(null)}
        template={showAssignModal}
        workers={workers}
        onAssign={handleManualAssign}
      />

      {/* ─── Shop QR Modal ────────────────────────────── */}
      <ShopQRModal open={!!showShopQRModal} onClose={() => setShowShopQRModal(null)} shop={showShopQRModal} />

      {/* ─── QR Code Modal ────────────────────────────── */}
      <QRModal
        open={!!showQRModal}
        onClose={() => setShowQRModal(null)}
        template={showQRModal}
      />

      {/* ─── Delete Confirm ───────────────────────────── */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Checklist" size="sm">
        {showDeleteConfirm && (
          <div>
            <p className="text-sm text-surface-600 mb-1">
              Delete <strong>{showDeleteConfirm.name}</strong> and all its assignments?
            </p>
            <p className="text-xs text-danger-600 mb-4">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteTemplate(showDeleteConfirm.id)} className="btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

// ─── Template Create/Edit Modal ─────────────────────────
function TemplateModal({ open, onClose, onSave, editing, workers, shops }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [specificDays, setSpecificDays] = useState([]);
  const [specificDates, setSpecificDates] = useState([]);
  const [shopId, setShopId] = useState('');
  const [assignMode, setAssignMode] = useState('all');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [scope, setScope] = useState('shop'); // 'shop' | 'public'
  const [items, setItems] = useState([{ id: '1', text: '', required: false }]);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || '');
      setDescription(editing.description || '');
      setFrequency(editing.frequency || 'daily');
      setDayOfWeek(editing.dayOfWeek || 'Monday');
      setDayOfMonth(editing.dayOfMonth || 1);
      setSpecificDays(editing.specificDays || []);
      setSpecificDates(editing.specificDates || []);
      setShopId(editing.shopId || '');
      setAssignMode(editing.assignedTo === 'all' ? 'all' : 'specific');
      setSelectedWorkers(editing.assignedTo === 'all' ? [] : (editing.assignedTo || []));
      setScope(editing.scope || 'shop');
      setItems(editing.items?.length ? editing.items : [{ id: '1', text: '', required: false }]);
    } else {
      setTitle(''); setDescription(''); setFrequency('daily'); setDayOfWeek('Monday');
      setDayOfMonth(1); setSpecificDays([]); setSpecificDates([]); setShopId(''); setAssignMode('all'); setSelectedWorkers([]);
      setScope('shop');
      setItems([{ id: '1', text: '', required: false }]);
    }
  }, [editing, open]);

  function addItem() {
    setItems([...items, { id: String(Date.now()), text: '', required: false }]);
  }
  function removeItem(id) {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
  }
  function updateItem(id, field, value) {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function toggleWorker(id) {
    setSelectedWorkers(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    const validItems = items.filter(i => i.text.trim());
    if (validItems.length === 0) { toast.error('Add at least one checklist item'); return; }
    if (frequency === 'specific-days' && specificDays.length === 0) {
      toast.error('Select at least one day'); return;
    }
    if (frequency === 'specific-dates' && specificDates.length === 0) {
      toast.error('Add at least one date'); return;
    }
    // Derive scope: 'public' stays public; 'shop' = shared assignment (all staff); 'worker' = per-worker
    const effectiveScope = scope === 'public' ? 'public' : (assignMode === 'all' ? 'shop' : 'worker');
    onSave({
      title: title.trim(),
      description: description.trim(),
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
      specificDays: frequency === 'specific-days' ? specificDays : null,
      specificDates: frequency === 'specific-dates' ? specificDates : null,
      shopId: shopId || null,
      assignedTo: effectiveScope === 'public' ? 'all' : (assignMode === 'all' ? 'all' : selectedWorkers),
      scope: effectiveScope,
      items: validItems.map((i) => ({ id: i.id, text: i.text.trim(), required: i.required })),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Checklist' : 'New Checklist'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title & description */}
        <div>
          <label className="label">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="input-field" placeholder="e.g. Opening Procedures, End of Day Cleanup" autoFocus />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            className="input-field" placeholder="Brief description of this checklist" />
        </div>

        {/* Scope */}
        <div>
          <label className="label">Who can complete this?</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setScope('shop')}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
                scope === 'shop'
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/20'
                  : 'border-surface-200 bg-white hover:border-surface-300'
              )}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                scope === 'shop' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-500')}>
                <Building className="w-4 h-4" />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', scope === 'shop' ? 'text-brand-700' : 'text-surface-700')}>Staff only</p>
                <p className="text-xs text-surface-400">For your team members</p>
              </div>
            </button>
            <button type="button" onClick={() => setScope('public')}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
                scope === 'public'
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20'
                  : 'border-surface-200 bg-white hover:border-surface-300'
              )}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                scope === 'public' ? 'bg-emerald-100 text-emerald-600' : 'bg-surface-100 text-surface-500')}>
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', scope === 'public' ? 'text-emerald-700' : 'text-surface-700')}>Public</p>
                <p className="text-xs text-surface-400">Anyone can scan & complete</p>
              </div>
            </button>
          </div>
          {scope === 'public' && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Public checklists show a QR code anyone can scan. Users enter their name to start.
            </p>
          )}
        </div>

        {/* Frequency */}
        <div>
          <label className="label">Frequency</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {FREQUENCIES.map(f => (
              <button key={f.value} type="button" onClick={() => setFrequency(f.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all',
                  frequency === f.value
                    ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                    : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                )}>
                <f.icon className="w-4 h-4" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency-specific options */}
        {frequency === 'weekly' && (
          <div>
            <label className="label">Day of Week</label>
            <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="select-field">
              {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {frequency === 'monthly' && (
          <div>
            <label className="label">Day of Month</label>
            <select value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} className="select-field">
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {frequency === 'specific-days' && (
          <div>
            <label className="label">Days of Week</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(d => (
                <button key={d} type="button" onClick={() => setSpecificDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    specificDays.includes(d) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                  )}>
                  {d.slice(0, 2)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-surface-400 mt-1">{specificDays.length > 0 ? `${specificDays.length} day${specificDays.length !== 1 ? 's' : ''} selected` : 'Select days above'}</p>
          </div>
        )}
        {frequency === 'specific-dates' && (
          <div>
            <label className="label">Specific Dates</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {specificDates.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-700">
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  <button type="button" onClick={() => setSpecificDates(prev => prev.filter(x => x !== d))} className="text-brand-400 hover:text-brand-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input type="date" onChange={e => {
              const val = e.target.value;
              if (val && !specificDates.includes(val)) {
                setSpecificDates(prev => [...prev, val].sort());
              }
              e.target.value = '';
            }} className="input-field text-sm" />
            <p className="text-[11px] text-surface-400 mt-1">{specificDates.length} date{specificDates.length !== 1 ? 's' : ''} selected</p>
          </div>
        )}

        {/* Shop (optional) */}
        {shops.length > 0 && (
          <div>
            <label className="label">Shop / Location (optional)</label>
            <select value={shopId} onChange={e => setShopId(e.target.value)} className="select-field">
              <option value="">All locations</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Assignment */}
        {frequency !== 'qr' && scope === 'shop' && (
          <div>
            <label className="label">Assign To</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setAssignMode('all')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  assignMode === 'all' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                All staff
              </button>
              <button type="button" onClick={() => setAssignMode('specific')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  assignMode === 'specific' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                Specific workers
              </button>
            </div>
            {assignMode === 'all' ? (
              <p className="text-xs text-surface-500 bg-surface-50 rounded-lg px-3 py-2">
                <span className="font-medium text-brand-600">Shared checklist</span> — one assignment shared by all staff, visible in Shop QR. Any worker can complete it.
              </p>
            ) : (
              <div>
                <p className="text-xs text-surface-500 bg-surface-50 rounded-lg px-3 py-2 mb-2">
                  <span className="font-medium text-blue-600">Per-worker checklist</span> — each selected worker gets their own assignment, visible only in their "My Checklists".
                </p>
                <div className="max-h-40 overflow-y-auto border border-surface-200 rounded-xl p-2 space-y-1">
                  {workers.map(w => (
                    <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 cursor-pointer">
                      <input type="checkbox" checked={selectedWorkers.includes(w.id)}
                        onChange={() => toggleWorker(w.id)}
                        className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                      <span className="text-sm text-surface-700">{w.firstName} {w.lastName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checklist Items */}
        <div>
          <label className="label">Checklist Items</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-xs text-surface-400 w-5 text-center flex-shrink-0">{i + 1}</span>
                <input type="text" value={item.text} onChange={e => updateItem(item.id, 'text', e.target.value)}
                  className="input-field flex-1" placeholder="Task description..." />
                <label className="flex items-center gap-1 text-[11px] text-surface-500 cursor-pointer flex-shrink-0 whitespace-nowrap">
                  <input type="checkbox" checked={item.required} onChange={e => updateItem(item.id, 'required', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-surface-300 text-danger-500 focus:ring-danger-400" />
                  Req.
                </label>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="text-surface-300 hover:text-danger-500 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem}
            className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create Checklist'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Manual Assign Modal ─────────────────────────────────
function AssignModal({ open, onClose, template, workers, onAssign }) {
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (open && template) {
      setSelected(template.assignedTo === 'all' ? workers.map(w => w.id) : (template.assignedTo || []));
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [open, template, workers]);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  }

  if (!template) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Assign: ${template.title}`} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Workers</label>
            <button type="button" onClick={() => setSelected(selected.length === workers.length ? [] : workers.map(w => w.id))}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              {selected.length === workers.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto border border-surface-200 rounded-xl p-2 space-y-1">
            {workers.map(w => (
              <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(w.id)} onChange={() => toggle(w.id)}
                  className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm text-surface-700">{w.firstName} {w.lastName}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { if (selected.length === 0) { toast.error('Select at least one worker'); return; } onAssign(template, selected, date); }}
            className="btn-primary">
            <Send className="w-4 h-4" /> Assign ({selected.length})
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── QR Code Modal ──────────────────────────────────────
function QRModal({ open, onClose, template }) {
  if (!template) return null;

  const isPublic = template.scope === 'public';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = isPublic
    ? `${baseUrl}/checklist/start?t=${template.id}`
    : `${baseUrl}/checklist/scan?t=${template.id}`;

  return (
    <Modal open={open} onClose={onClose} title="QR Code" size="sm">
      <div className="text-center space-y-4">
        <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-surface-200 inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
            alt="QR Code"
            width={200}
            height={200}
            className="w-[200px] h-[200px]"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-surface-700 mb-1">{template.title}</p>
          <div className="flex items-center justify-center gap-1.5">
            {isPublic ? (
              <span className="badge bg-emerald-100 text-emerald-700">
                <Globe className="w-3 h-3 mr-1" /> Public — anyone can scan
              </span>
            ) : (
              <span className="text-xs text-surface-400">Workers scan this QR to start the checklist</span>
            )}
          </div>
        </div>
        <div className="bg-surface-50 rounded-xl p-3">
          <p className="text-[11px] text-surface-400 mb-1">Direct URL</p>
          <p className="text-xs text-surface-600 font-mono break-all">{qrUrl}</p>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('URL copied!'); }}
            className="btn-secondary text-sm">
            <Copy className="w-4 h-4" /> Copy URL
          </button>
          <button onClick={() => {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<html><head><title>QR - ${template.title}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif}h2{margin-bottom:8px}p{color:#666;font-size:14px}img{margin:16px 0}</style></head><body><h2>${template.title}</h2><p>${isPublic ? 'Scan with your phone camera' : 'Scan to start checklist'}</p><img src="${qrImageUrl}" width="300" height="300" /><p style="font-size:12px;color:#999;margin-top:8px">${qrUrl}</p></body></html>`);
            printWindow.document.close();
          }} className="btn-primary text-sm">
            <Download className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Shop QR Modal ──────────────────────────────────────
function ShopQRModal({ open, onClose, shop }) {
  if (!shop) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${baseUrl}/shop-checklists/${shop.id}`;

  return (
    <Modal open={!!open} onClose={onClose} title="Shop QR Code" size="sm">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-surface-700">{shop.name}</p>
        <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-surface-200 inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
            alt="Shop QR Code"
            width={200}
            height={200}
            className="w-[200px] h-[200px]"
          />
        </div>
        <p className="text-xs text-surface-500">Scan to see today's checklists for this location</p>
        <div className="bg-surface-50 rounded-xl p-3">
          <p className="text-[11px] text-surface-400 mb-1">Direct URL</p>
          <p className="text-xs text-surface-600 font-mono break-all">{qrUrl}</p>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('URL copied!'); }}
            className="btn-secondary text-sm">
            <Copy className="w-4 h-4" /> Copy URL
          </button>
          <button onClick={() => {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<html><head><title>QR - ${shop.name}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif}h2{margin-bottom:8px}p{color:#666;font-size:14px}img{margin:16px 0}</style></head><body><h2>${shop.name}</h2><p>Scan to see today's checklists</p><img src="${qrImageUrl}" width="300" height="300" /><p style="font-size:12px;color:#999;margin-top:8px">${qrUrl}</p></body></html>`);
            printWindow.document.close();
          }} className="btn-primary text-sm">
            <Download className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Calendar View ──────────────────────────────────────
function CalendarView({ assignments, templates, viewDate, setViewDate }) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  function getAssignmentsForDate(dateStr) {
    return assignments.filter(a => a.date === dateStr);
  }

  function isToday(day) {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  }

  function isSelected(day) {
    if (!selectedDate) return false;
    const d = new Date(year, month, day);
    return d.toISOString().split('T')[0] === selectedDate;
  }

  const selectedDateStr = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const selectedAssignments = selectedDate ? getAssignmentsForDate(selectedDate) : [];

  const weeks = [];
  let day = 1 - adjustedFirstDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      if (day < 1 || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
      }
      day++;
    }
    if (day > daysInMonth && week.every(d => d === null)) break;
    weeks.push(week);
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn-icon">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <h2 className="text-base font-display font-semibold text-surface-800 capitalize">
          {viewDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} className="btn-icon">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-surface-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {weeks.flat().map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const dateStr = new Date(year, month, day).toISOString().split('T')[0];
          const dayAssignments = getAssignmentsForDate(dateStr);
          const completed = dayAssignments.filter(a => a.status === 'completed').length;
          const total = dayAssignments.length;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(selectedDate === dateStr ? null : dateStr)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-xl py-2 text-xs transition-all min-h-[52px]',
                isToday(day) ? 'ring-2 ring-brand-400' : '',
                isSelected(day) ? 'bg-brand-50 border border-brand-300' : 'hover:bg-surface-50 border border-transparent',
                total === 0 ? 'text-surface-300' : 'text-surface-700 font-medium'
              )}>
              <span className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full',
                isToday(day) && 'bg-brand-500 text-white'
              )}>
                {day}
              </span>
              {total > 0 && (
                <div className={cn('mt-0.5 w-1.5 h-1.5 rounded-full',
                  completed === total ? 'bg-emerald-500' : completed > 0 ? 'bg-amber-400' : 'bg-surface-300'
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day details */}
      {selectedDate && (
        <div>
          <h3 className="text-sm font-semibold text-surface-700 mb-3">{selectedDateStr}</h3>
          {selectedAssignments.length === 0 ? (
            <p className="text-sm text-surface-400">No checklists for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedAssignments.map(a => {
                const checked = (a.items || []).filter(i => i.checked).length;
                const total = (a.items || []).length;
                const pct = total ? Math.round(checked / total * 100) : 0;
                const template = templates.find(t => t.id === a.templateId);

                return (
                  <div key={a.id} className="card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {a.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : a.status === 'in-progress' ? (
                          <AlertCircle className="w-4 h-4 text-brand-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-surface-300" />
                        )}
                        <span className="text-sm font-medium text-surface-700">{a.templateTitle}</span>
                        {a.scope === 'shop' && (
                          <span className="badge bg-emerald-100 text-emerald-700 text-[10px]">Shop</span>
                        )}
                        {a.triggeredBy === 'qr_public' && (
                          <span className="badge bg-emerald-50 text-emerald-600 text-[10px]">Public</span>
                        )}
                      </div>
                      <span className="text-xs text-surface-400">
                        {a.workerId === 'shop' ? 'Shop' : a.workerName || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-surface-400">{checked}/{total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedDate && (
        <p className="text-xs text-surface-400 text-center mt-2">Tap a date to see its checklists</p>
      )}
    </div>
  );
}
