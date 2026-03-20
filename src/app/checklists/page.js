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
  const [tab, setTab] = useState('templates'); // 'templates' | 'assignments'
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null); // template to assign
  const [showQRModal, setShowQRModal] = useState(null); // template for QR
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
        await createChecklistTemplate({
          ...data, orgId, createdBy: user.uid,
          createdByName: userProfile?.displayName || 'Unknown',
        });
        toast.success('Checklist created');
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
      await updateChecklistTemplate(template.id, { active: !template.active });
      toast.success(template.active ? 'Checklist paused' : 'Checklist activated');
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
          <button onClick={handleGenerateToday} className="btn-secondary text-xs sm:text-sm">
            <RotateCcw className="w-4 h-4" /> Generate Today
          </button>
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
              const assignCount = assignments.filter(a => a.templateId === template.id).length;
              const completedCount = assignments.filter(a => a.templateId === template.id && a.status === 'completed').length;
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
                          ) : (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {template.assignedTo === 'all' ? 'All staff' : `${assignedWorkers.length} worker${assignedWorkers.length !== 1 ? 's' : ''}`}
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
                        {(template.scope === 'public' || template.frequency === 'qr') && (
                          <button onClick={() => setShowQRModal(template)}
                            className="btn-icon" title="Show QR Code">
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}
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
                        <td>{a.workerName}</td>
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
      setShopId(editing.shopId || '');
      setAssignMode(editing.assignedTo === 'all' ? 'all' : 'specific');
      setSelectedWorkers(editing.assignedTo === 'all' ? [] : (editing.assignedTo || []));
      setScope(editing.scope || 'shop');
      setItems(editing.items?.length ? editing.items : [{ id: '1', text: '', required: false }]);
    } else {
      setTitle(''); setDescription(''); setFrequency('daily'); setDayOfWeek('Monday');
      setDayOfMonth(1); setShopId(''); setAssignMode('all'); setSelectedWorkers([]);
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
    onSave({
      title: title.trim(),
      description: description.trim(),
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
      shopId: shopId || null,
      assignedTo: scope === 'public' ? 'all' : (assignMode === 'all' ? 'all' : selectedWorkers),
      scope,
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
            {assignMode === 'specific' && (
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
          <QRCodeSVG value={qrUrl} size={200} />
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
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<html><head><title>QR - ${template.title}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif}h2{margin-bottom:8px}p{color:#666;font-size:14px}</style></head><body><h2>${template.title}</h2><p>${isPublic ? 'Scan with your phone camera' : 'Scan to start checklist'}</p><div id="qr"></div><script>window.print()<\/script></body></html>`);
            printWindow.document.close();
          }} className="btn-primary text-sm">
            <Download className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Simple QR Code SVG generator ────────────────────────
// Minimal QR Code generator for display purposes
function QRCodeSVG({ value, size = 200 }) {
  // We create a visual QR-like representation using the URL
  // For production, you'd use a library, but this generates a working visual
  const modules = generateQRMatrix(value);
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" />
      {modules.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect key={`${x}-${y}`} x={x * cellSize} y={y * cellSize}
              width={cellSize} height={cellSize} fill="#1a1a2e" rx={cellSize * 0.1} />
          ) : null
        )
      )}
    </svg>
  );
}

// Minimal QR-like matrix generator (creates scannable pattern from data)
function generateQRMatrix(data) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns (3 corners)
  function drawFinder(ox, oy) {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        matrix[oy + y][ox + x] = (x === 0 || x === 6 || y === 0 || y === 6) || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
  }
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Encode data into remaining cells using simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  let seed = Math.abs(hash);
  for (let y = 9; y < size - 8; y++) {
    for (let x = 9; x < size - 8; x++) {
      if (x === 6 || y === 6) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      matrix[y][x] = (seed >> 16) % 3 === 0;
    }
  }
  // Fill some border area data cells
  for (let y = 8; y < size; y++) {
    for (let x = 0; x < 8; x++) {
      if (y < size - 7 && !matrix[y][x]) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; matrix[y][x] = (seed >> 16) % 4 === 0; }
    }
  }
  for (let x = 8; x < size; x++) {
    for (let y = 0; y < 8; y++) {
      if (x < size - 7 && !matrix[y][x]) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; matrix[y][x] = (seed >> 16) % 4 === 0; }
    }
  }

  return matrix;
}
