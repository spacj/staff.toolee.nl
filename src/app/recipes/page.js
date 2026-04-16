'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe, executeRecipe, getStockItems, getOrganization } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import {
  CookingPot, Plus, Pencil, Trash2, Search, Calculator, ChevronDown,
  Package, Check, X, AlertTriangle, Scale, Play,
} from 'lucide-react';
import toast from 'react-hot-toast';

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cups', 'oz', 'lb'];

function convertUnit(qty, fromUnit, toUnit) {
  if (fromUnit === toUnit) return qty;
  const key = `${fromUnit}->${toUnit}`;
  const conversions = {
    'g->kg': 0.001, 'kg->g': 1000,
    'ml->L': 0.001, 'L->ml': 1000,
    'oz->g': 28.3495, 'g->oz': 1 / 28.3495,
    'oz->kg': 0.0283495, 'kg->oz': 35.274,
    'lb->g': 453.592, 'g->lb': 1 / 453.592,
    'lb->kg': 0.453592, 'kg->lb': 2.20462,
    'oz->lb': 1 / 16, 'lb->oz': 16,
    'ml->cups': 1 / 236.588, 'cups->ml': 236.588,
    'L->cups': 1000 / 236.588, 'cups->L': 236.588 / 1000,
    'tsp->ml': 4.929, 'ml->tsp': 1 / 4.929,
    'tbsp->ml': 14.787, 'ml->tbsp': 1 / 14.787,
    'tsp->tbsp': 1 / 3, 'tbsp->tsp': 3,
  };
  if (conversions[key]) return qty * conversions[key];
  return null;
}

function smartRound(value, unit) {
  if (['pcs', 'cups'].includes(unit)) {
    if (value < 1 && value > 0) return Math.round(value * 4) / 4;
    return Math.round(value);
  }
  if (['tsp', 'tbsp'].includes(unit)) return Math.round(value * 4) / 4;
  if (['g', 'ml'].includes(unit)) return Math.round(value);
  if (['kg', 'L', 'oz', 'lb'].includes(unit)) return Math.round(value * 10) / 10;
  return Math.round(value * 10) / 10;
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<Layout><div className="p-6">Loading...</div></Layout>}>
      <RecipesPageInner />
    </Suspense>
  );
}

function RecipesPageInner() {
  const { orgId: authOrgId, user, userProfile, isManager, isAdmin, isInventory } = useAuth();
  const searchParams = useSearchParams();
  const orgIdOverride = searchParams?.get('orgId') || '';
  const orgId = isInventory && orgIdOverride ? orgIdOverride : authOrgId;
  const canManage = isAdmin || isManager || isInventory;

  const [recipes, setRecipes] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgName, setOrgName] = useState('');

  // Recipe editor
  const [editModal, setEditModal] = useState(null); // null | 'add' | recipe obj
  const [form, setForm] = useState({ name: '', description: '', category: '', servings: 1, ingredients: [], scaleIndex: 0 });
  const [saving, setSaving] = useState(false);

  // Calculator
  const [calcRecipe, setCalcRecipe] = useState(null);
  const [scaleQty, setScaleQty] = useState('');
  const [scaledIngredients, setScaledIngredients] = useState([]);

  // Execution confirmation modal
  const [execModal, setExecModal] = useState(false);
  const [execIngredients, setExecIngredients] = useState([]);
  const [executing, setExecuting] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    if (!orgId && !isInventory) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        getRecipes({ orgId: orgId || undefined }),
        orgId ? getStockItems({ orgId }) : Promise.resolve([]),
      ]);
      setRecipes(r);
      setStockItems(s);
      if (isInventory && orgIdOverride) {
        const org = await getOrganization(orgIdOverride);
        setOrgName(org?.name || 'Unknown Organization');
      } else {
        setOrgName('');
      }
    } catch { toast.error('Failed to load recipes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(r =>
      r.name?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    );
  }, [recipes, search]);

  // ─── Recipe CRUD ───────────────────────────────
  const openAdd = () => {
    setForm({ name: '', description: '', category: '', servings: 1, ingredients: [{ name: '', quantity: '', unit: 'g', stockItemId: '' }], scaleIndex: 0 });
    setEditModal('add');
  };

  const openEdit = (r) => {
    setForm({
      name: r.name, description: r.description || '', category: r.category || '',
      servings: r.servings || 1,
      ingredients: r.baseIngredients?.map(i => ({ ...i, quantity: String(i.quantity) })) || [],
      scaleIndex: r.scaleIngredientIndex || 0,
    });
    setEditModal(r);
  };

  const addIngredientRow = () => setForm(f => ({
    ...f, ingredients: [...f.ingredients, { name: '', quantity: '', unit: 'g', stockItemId: '' }]
  }));

  const updateIngredient = (idx, field, val) => setForm(f => {
    const ings = [...f.ingredients];
    ings[idx] = { ...ings[idx], [field]: val };
    return { ...f, ingredients: ings };
  });

  const removeIngredient = (idx) => setForm(f => {
    const ings = f.ingredients.filter((_, i) => i !== idx);
    return { ...f, ingredients: ings, scaleIndex: f.scaleIndex >= ings.length ? 0 : f.scaleIndex };
  });

  const saveRecipe = async () => {
    if (!form.name.trim()) return toast.error('Recipe name is required');
    if (form.ingredients.filter(i => i.name.trim()).length === 0) return toast.error('Add at least one ingredient');
    setSaving(true);
    try {
      const base = form.ingredients
        .filter(i => i.name.trim())
        .map(i => ({ name: i.name.trim(), quantity: Number(i.quantity) || 0, unit: i.unit, stockItemId: i.stockItemId || '' }));
      const data = {
        orgId, name: form.name.trim(), description: form.description.trim(),
        category: form.category.trim(), servings: Number(form.servings) || 1,
        baseIngredients: base, scaleIngredientIndex: form.scaleIndex,
        createdBy: user?.uid, createdByName: userProfile?.displayName || '',
      };
      if (editModal === 'add') {
        await createRecipe(data);
        toast.success('Recipe created');
      } else {
        await updateRecipe(editModal.id, data);
        toast.success('Recipe updated');
      }
      setEditModal(null);
      load();
    } catch { toast.error('Failed to save recipe'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteRecipe(deleteConfirm.id);
      toast.success('Recipe deleted');
      setDeleteConfirm(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  // ─── Calculator ────────────────────────────────
  const openCalc = (r) => {
    setCalcRecipe(r);
    const anchor = r.baseIngredients?.[r.scaleIngredientIndex || 0];
    setScaleQty(anchor ? String(anchor.quantity) : '');
    setScaledIngredients(r.baseIngredients?.map(i => ({ ...i })) || []);
  };

  useEffect(() => {
    if (!calcRecipe) return;
    const base = calcRecipe.baseIngredients || [];
    const anchorIdx = calcRecipe.scaleIngredientIndex || 0;
    const originalQty = base[anchorIdx]?.quantity || 1;
    const newQty = Number(scaleQty) || originalQty;
    const ratio = newQty / originalQty;
    setScaledIngredients(base.map((ing, i) => ({
      ...ing,
      quantity: i === anchorIdx ? newQty : smartRound(ing.quantity * ratio, ing.unit),
    })));
  }, [scaleQty, calcRecipe]);

  // ─── Execute recipe (deduct from stock) ────────
  const openExecModal = () => {
    const ings = scaledIngredients.map(ing => {
      const linked = ing.stockItemId ? stockItems.find(s => s.id === ing.stockItemId) : null;
      const recipeQty = ing.quantity;
      const recipeUnit = ing.unit;
      const stockUnit = linked?.unit || recipeUnit;
      const openUnits = Array.isArray(linked?.inUseOpenedAt) ? linked.inUseOpenedAt : [];
      const openTotal = openUnits.reduce((sum, e) => sum + (e.currentLevel || 0), 0);
      const openTotalInRecipeUnit = openUnits.length > 0 ? convertUnit(openTotal, openUnits[0].levelUnit || stockUnit, recipeUnit) : 0;
      const sealedQtyInRecipeUnit = linked ? convertUnit(linked.quantity || 0, stockUnit, recipeUnit) ?? (linked.quantity || 0) : 0;
      const totalAvailableInRecipeUnit = openTotalInRecipeUnit + sealedQtyInRecipeUnit;
      const converted = linked ? convertUnit(ing.quantity, ing.unit, linked.unit) : null;
      const deductInStockUnit = converted !== null ? smartRound(converted, linked.unit) : ing.quantity;
      return {
        ...ing,
        deductQty: deductInStockUnit,
        deductUnit: converted !== null ? linked?.unit : ing.unit,
        stockName: linked?.name || '',
        stockAvailable: totalAvailableInRecipeUnit,
        stockUnit: recipeUnit,
        recipeQty: ing.quantity,
        recipeUnit: ing.unit,
      };
    });
    setExecIngredients(ings);
    setExecModal(true);
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const toDeduct = execIngredients.filter(i => i.stockItemId && i.deductQty > 0);
      await executeRecipe(toDeduct, { uid: user?.uid, displayName: userProfile?.displayName || '' });
      toast.success(`Deducted ${toDeduct.length} item${toDeduct.length !== 1 ? 's' : ''} from stock`);
      setExecModal(false);
      setCalcRecipe(null);
      load();
    } catch { toast.error('Failed to execute recipe'); }
    finally { setExecuting(false); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900 flex items-center gap-2">
              <CookingPot className="w-7 h-7 text-brand-500" /> Recipes
              {isInventory && orgName && <span className="text-lg font-normal text-surface-500">/ {orgName}</span>}
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">Scale recipes, link ingredients to stock, and deduct on execution.</p>
          </div>
          {canManage && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Recipe
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input-field pl-9 w-full" placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Recipe list */}
        {loading ? (
          <div className="card p-8 text-center text-surface-500">Loading recipes…</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <CookingPot className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 font-medium">{recipes.length === 0 ? 'No recipes yet' : 'No recipes match your search'}</p>
            {recipes.length === 0 && canManage && (
              <button onClick={openAdd} className="btn-primary mt-4 inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Create your first recipe</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => {
              const ingCount = r.baseIngredients?.length || 0;
              const linkedCount = r.baseIngredients?.filter(i => i.stockItemId).length || 0;
              return (
                <div key={r.id} className="card p-4 flex flex-col gap-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 truncate">{r.name}</p>
                      {r.category && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">{r.category}</span>}
                    </div>
                  </div>
                  {r.description && <p className="text-sm text-surface-500 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-surface-500">
                    <span>{ingCount} ingredient{ingCount !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{r.servings || 1} serving{(r.servings || 1) !== 1 ? 's' : ''}</span>
                    {linkedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-brand-600 font-medium flex items-center gap-1"><Package className="w-3 h-3" />{linkedCount} linked</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => openCalc(r)} className="btn-secondary text-xs px-3 py-1.5 flex-1 flex items-center justify-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" /> Scale & Use
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(r)} className="btn-icon" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(r)} className="btn-icon text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Recipe Editor Modal ─── */}
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal === 'add' ? 'New Recipe' : 'Edit Recipe'} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input className="input-field w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input-field w-full" placeholder="e.g. Pasta, Dessert" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Description</label>
                <input className="input-field w-full" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Servings</label>
                <input type="number" min="1" className="input-field w-full" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Ingredients</label>
                <button type="button" onClick={addIngredientRow} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {form.ingredients.map((ing, idx) => (
                  <div key={idx} className={cn(
                    'p-2.5 rounded-lg border space-y-2',
                    form.scaleIndex === idx ? 'border-brand-300 bg-brand-50/50' : 'border-surface-200'
                  )}>
                    {/* Row 1: Name + actions */}
                    <div className="flex items-center gap-2">
                      <input className="input-field text-sm flex-1 min-w-0" placeholder="Ingredient name" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)} />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, scaleIndex: idx }))}
                        className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs transition-colors', form.scaleIndex === idx ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-400 hover:bg-brand-100 hover:text-brand-600')}
                        title="Set as scale anchor"
                      >
                        <Scale className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => removeIngredient(idx)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-red-400 hover:bg-red-50 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Row 2: Qty + Unit + Stock link */}
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-field text-sm w-20 flex-shrink-0" placeholder="Qty" value={ing.quantity} onChange={e => updateIngredient(idx, 'quantity', e.target.value)} />
                      <select className="select-field text-sm !py-1.5 w-16 flex-shrink-0" value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <select className="select-field text-sm !py-1.5 flex-1 min-w-0" value={ing.stockItemId || ''} onChange={e => updateIngredient(idx, 'stockItemId', e.target.value)}>
                        <option value="">No stock link</option>
                        {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.quantity} {s.unit})</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {form.ingredients.length > 0 && (
                <p className="text-[11px] text-surface-400 mt-1">
                  <Scale className="w-3 h-3 inline" /> marks the scale anchor — changing its quantity scales all others proportionally.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-surface-100">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveRecipe} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Recipe'}</button>
            </div>
          </div>
        </Modal>

        {/* ─── Calculator Modal ─── */}
        <Modal open={!!calcRecipe} onClose={() => setCalcRecipe(null)} title={calcRecipe ? `Scale: ${calcRecipe.name}` : ''} size="lg">
          {calcRecipe && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 p-3 rounded-xl bg-brand-50 border border-brand-200">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-700 mb-1">Scale anchor: {calcRecipe.baseIngredients?.[calcRecipe.scaleIngredientIndex || 0]?.name}</p>
                  <p className="text-[11px] text-brand-600">Original: {calcRecipe.baseIngredients?.[calcRecipe.scaleIngredientIndex || 0]?.quantity} {calcRecipe.baseIngredients?.[calcRecipe.scaleIngredientIndex || 0]?.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-brand-700">New qty:</label>
                  <input
                    type="number" min="0" step="any"
                    className="input-field w-24 text-sm"
                    value={scaleQty}
                    onChange={e => setScaleQty(e.target.value)}
                  />
                  <span className="text-xs text-brand-600">{calcRecipe.baseIngredients?.[calcRecipe.scaleIngredientIndex || 0]?.unit}</span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                {scaledIngredients.map((ing, idx) => {
                  const isAnchor = idx === (calcRecipe.scaleIngredientIndex || 0);
                  const linked = ing.stockItemId ? stockItems.find(s => s.id === ing.stockItemId) : null;
                  const recipeQty = ing.quantity;
                  const recipeUnit = ing.unit;
                  const stockUnit = linked?.unit || recipeUnit;
                  const openUnits = Array.isArray(linked?.inUseOpenedAt) ? linked.inUseOpenedAt : [];
                  const openTotal = openUnits.reduce((sum, e) => sum + (e.currentLevel || 0), 0);
                  const openTotalInRecipeUnit = openUnits.length > 0 ? convertUnit(openTotal, openUnits[0].levelUnit || stockUnit, recipeUnit) : 0;
                  const sealedQtyInRecipeUnit = linked ? convertUnit(linked.quantity || 0, stockUnit, recipeUnit) ?? (linked.quantity || 0) : 0;
                  const totalAvailableInRecipeUnit = openTotalInRecipeUnit + sealedQtyInRecipeUnit;
                  const insufficient = linked && recipeQty > totalAvailableInRecipeUnit;
                  return (
                    <div key={idx} className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border',
                      isAnchor ? 'border-brand-300 bg-brand-50/40' : 'border-surface-200 bg-white',
                      insufficient && 'border-red-200 bg-red-50/30'
                    )}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate flex items-center gap-1.5">
                          {ing.name}
                          {isAnchor && <Scale className="w-3 h-3 text-brand-500" />}
                        </p>
                        {linked && (
                          <p className="text-[11px] text-surface-400 flex items-center gap-1 flex-wrap">
                            <Package className="w-3 h-3" /> {linked.name}: {smartRound(totalAvailableInRecipeUnit, recipeUnit)} {recipeUnit} available
                            {openUnits.length > 0 && <span className="text-brand-600">(+{openUnits.length} open)</span>}
                            {recipeUnit !== stockUnit && <span className="text-brand-600">(stock: {linked.quantity} {stockUnit})</span>}
                            {insufficient && <span className="text-red-600 font-semibold ml-1">insufficient</span>}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-surface-900">{ing.quantity}</p>
                        <p className="text-[11px] text-surface-500">{ing.unit}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {scaledIngredients.some(i => i.stockItemId) && (
                <div className="flex gap-2 pt-2 border-t border-surface-100">
                  <button onClick={() => setCalcRecipe(null)} className="btn-secondary flex-1">Close</button>
                  <button onClick={openExecModal} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" /> Execute & Deduct Stock
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ─── Execution Confirmation Modal ─── */}
        <Modal open={execModal} onClose={() => setExecModal(false)} title="Confirm stock deduction" size="lg">
          <div className="space-y-4">
            <p className="text-sm text-surface-500">Review and adjust the exact quantities to deduct from stock. Amounts are converted to stock units. Only linked items are shown.</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {execIngredients.filter(i => i.stockItemId).map((ing, idx) => {
                const insufficient = ing.stockAvailable !== null && ing.deductQty > ing.stockAvailable;
                const unitsDiffer = ing.recipeUnit && ing.deductUnit && ing.recipeUnit !== ing.deductUnit;
                return (
                  <div key={idx} className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    insufficient ? 'border-red-200 bg-red-50/30' : 'border-surface-200 bg-white'
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">{ing.name}</p>
                      <p className="text-[11px] text-surface-400">
                        Stock: <span className="font-medium text-surface-600">{ing.stockName}</span> — {ing.stockAvailable ?? '?'} {ing.stockUnit} available
                      </p>
                      {unitsDiffer && (
                        <p className="text-[11px] text-brand-600 mt-0.5">Recipe: {ing.recipeQty} {ing.recipeUnit} → {ing.deductQty} {ing.deductUnit}</p>
                      )}
                      {insufficient && (
                        <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> Not enough in stock
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-surface-500">-</span>
                      <input
                        type="number" min="0" step="any"
                        value={ing.deductQty}
                        onChange={e => {
                          const val = Number(e.target.value) || 0;
                          setExecIngredients(prev => prev.map((x, i) => i === idx ? { ...x, deductQty: val } : x));
                        }}
                        className="w-20 px-2 py-1.5 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-xs text-surface-500">{ing.deductUnit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2 border-t border-surface-100">
              <button onClick={() => setExecModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleExecute} disabled={executing} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {executing ? 'Deducting…' : 'Confirm & Deduct'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ─── Delete Confirmation ─── */}
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete recipe?" size="sm">
          <p className="text-sm text-surface-600 mb-4">Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleDelete} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">Delete</button>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
