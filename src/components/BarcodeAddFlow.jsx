'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import { Barcode, Package, Boxes, Plus, Search } from 'lucide-react';

/**
 * "Barcode not recognised" flow, shared by the real Stock page and the demo.
 *
 * Lets the user add a scanned code as a Single item, or a Box of items — and
 * for a box, either create a New item or add the units to an Existing one.
 *
 * Callbacks:
 *   onSingle(code, name?)          — add a single new item
 *   onBoxNew(code, unitsPerBox, name?) — create a new item for the box
 *   onBoxExisting(item, code, unitsPerBox) — link box to an existing item + add units
 *
 * `collectName` shows an inline name field for the new-item paths (used by the
 * demo, which has no separate add form). In the real app it's false because the
 * name is captured by the existing Add-Item modal.
 */
export default function BarcodeAddFlow({ code, items = [], onClose, onSingle, onBoxNew, onBoxExisting, collectName = false }) {
  const [step, setStep] = useState('choose'); // choose | single-name | box | box-name
  const [units, setUnits] = useState('');
  const [name, setName] = useState('');
  const [boxMode, setBoxMode] = useState(null); // null | 'existing'
  const [search, setSearch] = useState('');

  const n = Number(units);
  const validUnits = Number.isFinite(n) && n > 0;
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const chooseSingle = () => { if (collectName) setStep('single-name'); else onSingle(code); };
  const chooseBoxNew = () => { if (collectName) setStep('box-name'); else onBoxNew(code, n); };

  return (
    <Modal open onClose={onClose} title="Barcode not recognised">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-50 border border-surface-200 p-3 flex items-center gap-2">
          <Barcode className="w-4 h-4 text-surface-500 flex-shrink-0" />
          <span className="text-sm font-mono text-surface-700 truncate">{code}</span>
        </div>

        {step === 'choose' && (
          <>
            <p className="text-sm text-surface-500">This barcode isn’t linked to an item yet. What did you scan?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={chooseSingle} className="rounded-xl border border-surface-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-all">
                <Package className="w-6 h-6 text-brand-600 mb-2" />
                <p className="text-sm font-semibold text-surface-900">Single item</p>
                <p className="text-xs text-surface-500 mt-0.5">One product per barcode. Add it as a new item.</p>
              </button>
              <button onClick={() => setStep('box')} className="rounded-xl border border-surface-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-all">
                <Boxes className="w-6 h-6 text-purple-600 mb-2" />
                <p className="text-sm font-semibold text-surface-900">Box of items</p>
                <p className="text-xs text-surface-500 mt-0.5">A case that holds several units.</p>
              </button>
            </div>
          </>
        )}

        {step === 'single-name' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Item name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full" placeholder="e.g. Oat Milk 1L" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('choose')} className="btn-secondary flex-1">Back</button>
              <button disabled={!name.trim()} onClick={() => onSingle(code, name.trim())} className="btn-primary flex-1 disabled:opacity-50">Add item</button>
            </div>
          </div>
        )}

        {step === 'box' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Units per box *</label>
              <input type="number" min="1" value={units} onChange={e => setUnits(e.target.value)} className="input-field w-full" placeholder="e.g. 24" autoFocus />
            </div>

            {!boxMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button disabled={!validUnits} onClick={chooseBoxNew} className="rounded-xl border border-surface-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus className="w-6 h-6 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-surface-900">New item</p>
                  <p className="text-xs text-surface-500 mt-0.5">Create a new product for this box.</p>
                </button>
                <button disabled={!validUnits} onClick={() => setBoxMode('existing')} className="rounded-xl border border-surface-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Package className="w-6 h-6 text-brand-600 mb-2" />
                  <p className="text-sm font-semibold text-surface-900">Existing item</p>
                  <p className="text-xs text-surface-500 mt-0.5">Add these units to an item you already have.</p>
                </button>
              </div>
            )}

            {boxMode === 'existing' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="input-field pl-9 w-full" autoFocus />
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-surface-100 border border-surface-200 rounded-xl">
                  {filtered.length === 0 && <p className="p-3 text-sm text-surface-400 text-center">No items found</p>}
                  {filtered.map(it => (
                    <button key={it.id} onClick={() => onBoxExisting(it, code, n)} className="w-full text-left px-3 py-2.5 hover:bg-surface-50 flex items-center justify-between gap-2">
                      <span className="text-sm text-surface-700 truncate">{it.name}</span>
                      <span className="text-xs text-surface-400 flex-shrink-0">{it.quantity} {it.unit} → +{n}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setBoxMode(null)} className="text-xs text-surface-500 hover:text-surface-700">← Back to options</button>
              </div>
            )}

            {!boxMode && (
              <button onClick={() => setStep('choose')} className="text-xs text-surface-500 hover:text-surface-700">← Back</button>
            )}
          </div>
        )}

        {step === 'box-name' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">New item name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full" placeholder="e.g. Paper Cups (12oz)" autoFocus />
              <p className="text-[11px] text-surface-400 mt-1">Adds one box = {n} unit{n === 1 ? '' : 's'} to start.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('box')} className="btn-secondary flex-1">Back</button>
              <button disabled={!name.trim()} onClick={() => onBoxNew(code, n, name.trim())} className="btn-primary flex-1 disabled:opacity-50">Add item</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
