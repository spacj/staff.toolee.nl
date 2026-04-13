'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getStockItems, createStockItem, updateStockItem, deleteStockItem, adjustStockQuantity,
  getStockRequests, createStockRequest, reviewStockRequest,
  notifyManagers, notifyWorker, getWorkers, getStockLogsRealtime,
  getStockCategories, addStockCategory,
} from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import {
  Package, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Minus, ClipboardList, Bell, Search, Filter, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'box', 'pack', 'roll', 'pair', 'set'];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:  { label: 'Approved',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700 border-red-200' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function stockStatus(item) {
  if (item.minimumQuantity > 0) {
    if (item.quantity === 0) return 'out';
    if (item.quantity < item.minimumQuantity) return 'low';
  }
  return 'ok';
}

function StockBadge({ item }) {
  const s = stockStatus(item);
  if (s === 'out') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Out of stock</span>;
  if (s === 'low') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Low stock</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />In stock</span>;
}

const emptyItemForm = { name: '', description: '', category: '', unit: 'pcs', quantity: 0, minimumQuantity: 0, sku: '' };
const emptyRequestForm = { itemId: '', itemName: '', quantity: 1, reason: '', urgent: false };

export default function StockPage() {
  const { orgId, user, userProfile, isManager, isAdmin } = useAuth();

  const [tab, setTab] = useState('items');
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [logFilter, setLogFilter] = useState('all');

  // Item modal
  const [itemModal, setItemModal] = useState(null); // null | 'add' | item object (edit)
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [savingItem, setSavingItem] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Adjust quantity modal
  const [adjustModal, setAdjustModal] = useState(null); // item object
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustMode, setAdjustMode] = useState('set'); // 'set' | 'add' | 'subtract'
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Request modal (worker creates request)
  const [requestModal, setRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [savingRequest, setSavingRequest] = useState(false);

  // Review modal (manager reviews request)
  const [reviewModal, setReviewModal] = useState(null); // request object
  const [reviewNotes, setReviewNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // item object

  const canManage = isAdmin || isManager;

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [itemsData, requestsData, workersData, categoriesData] = await Promise.all([
        getStockItems({ orgId }),
        getStockRequests({ orgId }),
        canManage ? getWorkers({ orgId }) : Promise.resolve([]),
        getStockCategories(orgId),
      ]);
      setItems(itemsData);
      setRequests(requestsData);
      setWorkers(workersData);
      setCategories(categoriesData);
    } catch (e) {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orgId]);

  useEffect(() => {
    if (!orgId || !canManage) return;
    const unsubscribe = getStockLogsRealtime(orgId, setLogs);
    return () => unsubscribe();
  }, [orgId, canManage]);

  // ─── Derived data ────────────────────────────────────
  const alertItems = items.filter(i => stockStatus(i) === 'low' || stockStatus(i) === 'out');
  const myRequests = requests.filter(r => r.requestedBy === user?.uid);
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const filteredItems = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const filteredRequests = (canManage ? requests : myRequests).filter(r =>
    requestStatusFilter === 'all' || r.status === requestStatusFilter
  );

  const workerName = (id) => {
    const w = workers.find(x => x.userId === id || x.id === id);
    return w ? `${w.firstName} ${w.lastName}` : (userProfile?.displayName || 'Unknown');
  };

  // ─── Item CRUD ───────────────────────────────────────
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const trimmed = newCategory.trim();
    if (categories.includes(trimmed)) {
      toast.error('Category already exists');
      return;
    }
    try {
      await addStockCategory(orgId, trimmed);
      setCategories([...categories, trimmed]);
      setItemForm(f => ({ ...f, category: trimmed }));
      setNewCategory('');
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    }
  };

  const openAddItem = () => {
    setItemForm(emptyItemForm);
    setNewCategory('');
    setItemModal('add');
  };

  const openEditItem = (item) => {
    setItemForm({ name: item.name, description: item.description || '', category: item.category || '', unit: item.unit || 'pcs', quantity: item.quantity, minimumQuantity: item.minimumQuantity || 0, sku: item.sku || '' });
    setNewCategory('');
    setItemModal(item);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Item name is required');
    setSavingItem(true);
    try {
      const data = {
        orgId,
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        category: itemForm.category,
        unit: itemForm.unit,
        quantity: Number(itemForm.quantity) || 0,
        minimumQuantity: Number(itemForm.minimumQuantity) || 0,
        sku: itemForm.sku.trim(),
        createdBy: user?.uid,
        createdByName: userProfile?.displayName || '',
      };
      if (itemModal === 'add') {
        await createStockItem(data, userProfile);
        toast.success('Item added');
      } else {
        await updateStockItem(itemModal.id, { name: data.name, description: data.description, category: data.category, unit: data.unit, quantity: data.quantity, minimumQuantity: data.minimumQuantity, sku: data.sku }, userProfile);
        toast.success('Item updated');
      }
      setItemModal(null);
      load();
    } catch {
      toast.error('Failed to save item');
    } finally {
      setSavingItem(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteStockItem(deleteConfirm.id, userProfile);
      toast.success('Item removed');
      setDeleteConfirm(null);
      load();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  // ─── Adjust Quantity ─────────────────────────────────
  const openAdjust = (item) => {
    setAdjustModal(item);
    setAdjustQty(item.quantity);
    setAdjustMode(canManage ? 'set' : 'subtract');
  };

  const saveAdjust = async () => {
    if (!adjustModal) return;
    setSavingAdjust(true);
    try {
      let newQty;
      if (adjustMode === 'set') newQty = Number(adjustQty);
      else if (adjustMode === 'add') newQty = adjustModal.quantity + Number(adjustQty);
      else newQty = Math.max(0, adjustModal.quantity - Number(adjustQty));

      await adjustStockQuantity(adjustModal.id, newQty, userProfile);
      toast.success('Stock updated');
      setAdjustModal(null);
      load();
    } catch {
      toast.error('Failed to update stock');
    } finally {
      setSavingAdjust(false);
    }
  };

  // ─── Stock Requests ──────────────────────────────────
  const openRequest = (item = null) => {
    setRequestForm(item
      ? { itemId: item.id, itemName: item.name, quantity: 1, reason: '', urgent: stockStatus(item) !== 'ok' }
      : emptyRequestForm
    );
    setRequestModal(true);
  };

  const submitRequest = async () => {
    if (!requestForm.itemName.trim()) return toast.error('Please specify an item');
    if (!requestForm.reason.trim()) return toast.error('Please provide a reason');
    setSavingRequest(true);
    try {
      const data = {
        orgId,
        itemId: requestForm.itemId || null,
        itemName: requestForm.itemName.trim(),
        quantity: Number(requestForm.quantity) || 1,
        reason: requestForm.reason.trim(),
        urgent: requestForm.urgent,
        requestedBy: user?.uid,
        requestedByName: userProfile?.displayName || '',
        requestedByRole: userProfile?.role || 'worker',
        workerId: userProfile?.workerId || null,
      };
      await createStockRequest(data);
      await notifyManagers(orgId, {
        type: 'stock_request',
        title: `Stock Request: ${data.itemName}`,
        message: `${data.requestedByName} requested ${data.quantity} ${data.itemName}${data.urgent ? ' (URGENT)' : ''}: ${data.reason}`,
        link: '/stock',
      });
      toast.success('Request submitted');
      setRequestModal(false);
      load();
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setSavingRequest(false);
    }
  };

  const handleReview = async (status) => {
    if (!reviewModal) return;
    setSavingReview(true);
    try {
      await reviewStockRequest(reviewModal.id, status, userProfile?.displayName || user?.uid, reviewNotes);
      // Notify the requester
      if (reviewModal.workerId) {
        await notifyWorker(reviewModal.workerId, orgId, {
          type: 'stock_request_response',
          title: `Stock Request ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Fulfilled'}`,
          message: `Your request for ${reviewModal.itemName} has been ${status}${reviewNotes ? `: ${reviewNotes}` : '.'}`,
          link: '/stock',
        });
      }
      toast.success(`Request ${status}`);
      setReviewModal(null);
      setReviewNotes('');
      load();
    } catch {
      toast.error('Failed to update request');
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Stock Management</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              {canManage ? 'Manage inventory, track stock changes, and review requests' : 'Track stock levels, update quantities, and request items'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-ghost p-2 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={openAddItem} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {canManage ? 'Add Item' : 'Add Item'}
            </button>
            {!canManage && (
              <button onClick={() => openRequest()} className="btn-secondary flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Request Item
              </button>
            )}
          </div>
        </div>

        {/* Alert banner — low/out of stock items */}
        {alertItems.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {alertItems.filter(i => stockStatus(i) === 'out').length > 0
                  ? `${alertItems.filter(i => stockStatus(i) === 'out').length} item(s) out of stock · `
                  : ''}
                {alertItems.filter(i => stockStatus(i) === 'low').length > 0
                  ? `${alertItems.filter(i => stockStatus(i) === 'low').length} item(s) below minimum`
                  : ''}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 truncate">
                {alertItems.map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {[
            { id: 'items', label: 'Items', count: items.length },
            { id: 'requests', label: canManage ? 'Requests' : 'My Requests', count: canManage ? pendingRequests.length : myRequests.filter(r => r.status === 'pending').length },
            ...(canManage ? [{ id: 'logs', label: 'Activity', count: 0 }] : []),
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                tab === t.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-semibold', tab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-600')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Items Tab ── */}
        {tab === 'items' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  className="input-field pl-9 w-full"
                  placeholder="Search items or SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="select-field sm:w-48" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {filteredItems.length === 0 ? (
              <div className="card text-center py-16">
                <Package className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                <p className="text-surface-500 font-medium">{items.length === 0 ? 'No stock items yet' : 'No items match your filters'}</p>
                {items.length === 0 && (
                  <button onClick={openAddItem} className="btn-primary mt-4 inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add your first item
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(item => {
                  const s = stockStatus(item);
                  return (
                    <div key={item.id} className={cn('card p-4 flex flex-col gap-3', s === 'out' && 'border-red-200 bg-red-50/30', s === 'low' && 'border-amber-200 bg-amber-50/20')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-surface-900 truncate">{item.name}</p>
                          {item.sku && <p className="text-xs text-surface-400 mt-0.5">SKU: {item.sku}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 whitespace-nowrap flex-shrink-0">{item.category || 'Other'}</span>
                      </div>

                      {item.description && <p className="text-sm text-surface-500 line-clamp-2">{item.description}</p>}

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-surface-900">{item.quantity} <span className="text-sm font-normal text-surface-500">{item.unit}</span></p>
                          {item.minimumQuantity > 0 && (
                            <p className="text-xs text-surface-400">Min: {item.minimumQuantity} {item.unit}</p>
                          )}
                        </div>
                        <StockBadge item={item} />
                      </div>

                      {/* Stock bar */}
                      {item.minimumQuantity > 0 && (
                        <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', s === 'out' ? 'bg-red-500' : s === 'low' ? 'bg-amber-500' : 'bg-emerald-500')}
                            style={{ width: `${Math.min(100, (item.quantity / (item.minimumQuantity * 2)) * 100)}%` }}
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => openAdjust(item)} className="btn-secondary text-xs px-3 py-1.5 flex-1 flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5" /> Update Stock
                        </button>
                        {canManage && (
                          <>
                            <button onClick={() => openEditItem(item)} className="btn-icon" title="Edit item">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(item)} className="btn-icon text-red-500 hover:bg-red-50" title="Delete item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {!canManage && (
                          <button onClick={() => openRequest(item)} className="btn-icon" title="Request item">
                            <ClipboardList className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Requests Tab ── */}
        {tab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <select className="select-field w-44" value={requestStatusFilter} onChange={e => setRequestStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="fulfilled">Fulfilled</option>
              </select>
              {!canManage && (
                <button onClick={() => openRequest()} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> New Request
                </button>
              )}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="card text-center py-16">
                <ClipboardList className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                <p className="text-surface-500 font-medium">No requests found</p>
                {!canManage && (
                  <button onClick={() => openRequest()} className="btn-primary mt-4 inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Submit a request
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(req => (
                  <div key={req.id} className={cn('card p-4', req.urgent && req.status === 'pending' && 'border-orange-200 bg-orange-50/20')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-surface-900">{req.itemName}</p>
                          {req.urgent && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">URGENT</span>}
                          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', STATUS_CONFIG[req.status]?.color)}>
                            {STATUS_CONFIG[req.status]?.label}
                          </span>
                        </div>
                        <p className="text-sm text-surface-500 mt-1">
                          Qty: <strong>{req.quantity}</strong> · {canManage ? `By: ${req.requestedByName}` : ''} · {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-surface-600 mt-1">"{req.reason}"</p>
                        {req.adminNotes && (
                          <p className="text-sm text-surface-500 mt-1 italic">Note: {req.adminNotes}</p>
                        )}
                      </div>
                      {canManage && req.status === 'pending' && (
                        <button
                          onClick={() => { setReviewModal(req); setReviewNotes(''); }}
                          className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
                        >
                          Review
                        </button>
                      )}
                      {canManage && req.status === 'approved' && (
                        <button
                          onClick={() => { setReviewModal(req); setReviewNotes(''); }}
                          className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          Mark Fulfilled
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Activity Tab ── */}
        {tab === 'logs' && canManage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <select className="select-field w-44" value={logFilter} onChange={e => setLogFilter(e.target.value)}>
                <option value="all">All actions</option>
                <option value="add">Added stock</option>
                <option value="remove">Removed stock</option>
                <option value="edited">Edited</option>
                <option value="created">Created</option>
                <option value="deleted">Deleted</option>
              </select>
              <span className="text-xs text-surface-400">Updates in real-time</span>
            </div>

            {logs.length === 0 ? (
              <div className="card text-center py-16">
                <RefreshCw className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                <p className="text-surface-500 font-medium">No activity recorded yet</p>
                <p className="text-sm text-surface-400 mt-1">Stock changes will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(logFilter === 'all' ? logs : logs.filter(l => l.type === logFilter)).map(log => (
                  <div key={log.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                          log.type === 'add' ? 'bg-emerald-100 text-emerald-600' :
                          log.type === 'remove' ? 'bg-red-100 text-red-600' :
                          log.type === 'edited' ? 'bg-blue-100 text-blue-600' :
                          log.type === 'created' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {log.type === 'add' ? '+' : log.type === 'remove' ? '−' : log.type === 'edited' ? '✎' : log.type === 'created' ? '★' : '×'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-surface-900">
                            <span className="truncate">{log.itemName}</span>
                            <span className={cn(
                              'ml-2 text-sm font-semibold',
                              log.change > 0 ? 'text-emerald-600' : log.change < 0 ? 'text-red-600' : 'text-surface-500'
                            )}>
                              {log.change > 0 ? `+${log.change}` : log.change}
                            </span>
                          </p>
                          <p className="text-xs text-surface-500">
                            {log.type === 'add' ? 'Added stock' : log.type === 'remove' ? 'Removed stock' : log.type === 'edited' ? 'Edited item' : log.type === 'created' ? 'Created item' : 'Deleted item'}
                            {' · '}{log.updatedByName || 'Unknown'}
                            {' · '}{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now'}
                          </p>
                          {log.previousQuantity !== undefined && (
                            <p className="text-xs text-surface-400">
                              {log.previousQuantity} → {log.newQuantity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Item Modal ── */}
      {itemModal !== null && (
        <Modal open={true} onClose={() => setItemModal(null)} title={itemModal === 'add' ? 'Add Stock Item' : 'Edit Stock Item'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1">Item Name *</label>
                <input className="input-field w-full" placeholder="e.g. Printer Paper" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Category</label>
                <div className="flex gap-2">
                  <select className="select-field flex-1" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <input
                      className="input-field w-28"
                      placeholder="New..."
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                    />
                    <button type="button" onClick={addCategory} className="btn-secondary px-3" title="Add category">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Unit</label>
                <select className="select-field w-full" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Current Quantity</label>
                <input type="number" min="0" className="input-field w-full" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Minimum Quantity
                  <span className="ml-1.5 text-xs text-surface-400 font-normal">(triggers alert)</span>
                </label>
                <input type="number" min="0" className="input-field w-full" value={itemForm.minimumQuantity} onChange={e => setItemForm(f => ({ ...f, minimumQuantity: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1">SKU / Code <span className="text-surface-400 font-normal">(optional)</span></label>
                <input className="input-field w-full" placeholder="e.g. PPR-A4-80G" value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1">Description <span className="text-surface-400 font-normal">(optional)</span></label>
                <textarea className="textarea-field w-full" rows={2} placeholder="Brief description..." value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
              <button onClick={() => setItemModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveItem} disabled={savingItem} className="btn-primary">
                {savingItem ? 'Saving...' : itemModal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Adjust Quantity Modal ── */}
      {adjustModal && (
        <Modal open={true} onClose={() => setAdjustModal(null)} title={`Update Stock: ${adjustModal.name}`}>
          <div className="space-y-4">
            <p className="text-sm text-surface-500">Current stock: <strong>{adjustModal.quantity} {adjustModal.unit}</strong>{adjustModal.minimumQuantity > 0 ? ` · Minimum: ${adjustModal.minimumQuantity} ${adjustModal.unit}` : ''}</p>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Adjustment type</label>
              <div className="flex gap-2">
                {(canManage ? [
                  { id: 'set', label: 'Set to exact value' },
                  { id: 'add', label: 'Add stock' },
                  { id: 'subtract', label: 'Remove stock' },
                ] : [
                  { id: 'add', label: 'Add stock' },
                  { id: 'subtract', label: 'Remove stock' },
                ]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setAdjustMode(m.id); setAdjustQty(m.id === 'set' ? adjustModal.quantity : 0); }}
                    className={cn('flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors', adjustMode === m.id ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                {adjustMode === 'set' ? 'New quantity' : adjustMode === 'add' ? 'Quantity to add' : 'Quantity to remove'}
              </label>
              <input
                type="number" min="0" className="input-field w-full text-lg"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
              />
              {adjustMode !== 'set' && (
                <p className="text-xs text-surface-400 mt-1">
                  Result: {adjustMode === 'add' ? adjustModal.quantity + Number(adjustQty) : Math.max(0, adjustModal.quantity - Number(adjustQty))} {adjustModal.unit}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveAdjust} disabled={savingAdjust} className="btn-primary">
                {savingAdjust ? 'Saving...' : 'Update Stock'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Request Item Modal ── */}
      {requestModal && (
        <Modal open={true} onClose={() => setRequestModal(false)} title="Request Item">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Item Name *</label>
              {requestForm.itemId ? (
                <div className="flex items-center gap-2">
                  <input className="input-field flex-1" value={requestForm.itemName} readOnly />
                  <button onClick={() => setRequestForm(f => ({ ...f, itemId: '', itemName: '' }))} className="btn-ghost p-2 rounded-lg text-surface-400">×</button>
                </div>
              ) : (
                <>
                  <input className="input-field w-full" placeholder="Type item name..." value={requestForm.itemName} onChange={e => setRequestForm(f => ({ ...f, itemName: e.target.value }))} />
                  {items.length > 0 && requestForm.itemName && (
                    <div className="mt-1 border border-surface-200 rounded-lg overflow-hidden shadow-sm max-h-36 overflow-y-auto">
                      {items.filter(i => i.name.toLowerCase().includes(requestForm.itemName.toLowerCase())).slice(0, 5).map(i => (
                        <button key={i.id} onClick={() => setRequestForm(f => ({ ...f, itemId: i.id, itemName: i.name }))} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 flex items-center justify-between">
                          <span>{i.name}</span>
                          <StockBadge item={i} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Quantity *</label>
              <input type="number" min="1" className="input-field w-full" value={requestForm.quantity} onChange={e => setRequestForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Reason *</label>
              <textarea className="textarea-field w-full" rows={3} placeholder="Why is this item needed?" value={requestForm.reason} onChange={e => setRequestForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setRequestForm(f => ({ ...f, urgent: !f.urgent }))}
                className={cn('w-10 h-6 rounded-full transition-colors flex items-center px-0.5', requestForm.urgent ? 'bg-orange-500' : 'bg-surface-200')}
              >
                <div className={cn('w-5 h-5 rounded-full bg-white shadow transition-transform', requestForm.urgent ? 'translate-x-4' : 'translate-x-0')} />
              </div>
              <span className="text-sm font-medium text-surface-700">Mark as urgent</span>
            </label>
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
              <button onClick={() => setRequestModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={submitRequest} disabled={savingRequest} className="btn-primary">
                {savingRequest ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Review Request Modal ── */}
      {reviewModal && (
        <Modal open={true} onClose={() => setReviewModal(null)} title="Review Stock Request">
          <div className="space-y-4">
            <div className="bg-surface-50 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-surface-900">{reviewModal.itemName}</p>
                {reviewModal.urgent && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">URGENT</span>}
              </div>
              <p className="text-sm text-surface-600">Qty: <strong>{reviewModal.quantity}</strong> · Requested by: <strong>{reviewModal.requestedByName}</strong></p>
              <p className="text-sm text-surface-600">"{reviewModal.reason}"</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Notes <span className="text-surface-400 font-normal">(optional)</span></label>
              <textarea className="textarea-field w-full" rows={2} placeholder="Add a note for the requester..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
              <button onClick={() => setReviewModal(null)} className="btn-secondary">Cancel</button>
              {reviewModal.status === 'pending' && (
                <>
                  <button onClick={() => handleReview('rejected')} disabled={savingReview} className="btn-danger flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => handleReview('approved')} disabled={savingReview} className="btn-primary flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </>
              )}
              {reviewModal.status === 'approved' && (
                <button onClick={() => handleReview('fulfilled')} disabled={savingReview} className="btn-primary flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="w-4 h-4" /> Mark as Fulfilled
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <Modal open={true} onClose={() => setDeleteConfirm(null)} title="Delete Item">
          <div className="space-y-4">
            <p className="text-surface-600">Are you sure you want to remove <strong>{deleteConfirm.name}</strong> from stock? This cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} className="btn-danger">Delete Item</button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
