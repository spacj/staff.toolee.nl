'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import {
  getChecklistTemplate, createQRChecklistAssignment, getWorkers,
  updateChecklistAssignment, getChecklistAssignment,
} from '@/lib/firestore';
import {
  QrCode, Camera, CheckCircle2, Circle, ClipboardCheck, AlertCircle,
  ArrowLeft, Loader2, MessageSquare, ScanLine, XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ChecklistScanPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    }>
      <ChecklistScanContent />
    </Suspense>
  );
}

function ChecklistScanContent() {
  const { orgId, user, userProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState('loading'); // 'loading' | 'scan' | 'checklist' | 'error' | 'done'
  const [template, setTemplate] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [error, setError] = useState('');
  const [workerId, setWorkerId] = useState(null);
  const [workerName, setWorkerName] = useState('');

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Resolve worker ID
  const resolveWorker = useCallback(async () => {
    if (userProfile?.workerId) {
      setWorkerId(userProfile.workerId);
      setWorkerName(userProfile.displayName || 'Unknown');
      return { id: userProfile.workerId, name: userProfile.displayName || 'Unknown' };
    }
    if (!orgId) {
      setWorkerId(user?.uid);
      setWorkerName(userProfile?.displayName || 'Unknown');
      return { id: user?.uid, name: userProfile?.displayName || 'Unknown' };
    }
    try {
      const allWorkers = await getWorkers({ orgId });
      const match = allWorkers.find(w => w.email === user?.email);
      if (match) {
        setWorkerId(match.id);
        setWorkerName(`${match.firstName} ${match.lastName}`);
        return { id: match.id, name: `${match.firstName} ${match.lastName}` };
      }
    } catch {}
    setWorkerId(user?.uid);
    setWorkerName(userProfile?.displayName || 'Unknown');
    return { id: user?.uid, name: userProfile?.displayName || 'Unknown' };
  }, [userProfile, orgId, user]);

  // Check if template ID is in URL params
  useEffect(() => {
    const templateId = searchParams.get('t');
    if (templateId) {
      handleTemplateId(templateId);
    } else {
      setMode('scan');
    }
  }, [searchParams]);

  async function handleTemplateId(templateId) {
    setMode('loading');
    try {
      const worker = await resolveWorker();
      const tmpl = await getChecklistTemplate(templateId);
      if (!tmpl) {
        setError('Checklist not found or has been deleted.');
        setMode('error');
        return;
      }
      if (!tmpl.active) {
        setError('This checklist is currently paused.');
        setMode('error');
        return;
      }
      setTemplate(tmpl);

      // Create or get existing assignment
      const result = await createQRChecklistAssignment(tmpl, worker.id, worker.name);
      const assignData = await getChecklistAssignment(result.id);
      setAssignment(assignData);

      if (result.existing) {
        toast('You already have this checklist for today', { icon: 'ℹ️' });
      } else {
        toast.success('Checklist started!');
      }
      setMode('checklist');
    } catch (err) {
      setError('Failed to load checklist. Please try again.');
      setMode('error');
    }
  }

  // ─── Camera QR Scanning ─────────────────────────────
  async function startScanning() {
    setCameraError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Scan frames for QR URL pattern
      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Try to detect URL in captured image data
        // Since we can't decode QR without a library, we provide a manual URL input as fallback
      }, 500);
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera access or enter the code manually.');
      setScanning(false);
    }
  }

  function stopScanning() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => stopScanning();
  }, []);

  // Manual code input
  const [manualCode, setManualCode] = useState('');

  function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    // Try to extract template ID from URL or raw ID
    let templateId = code;
    try {
      const url = new URL(code);
      templateId = url.searchParams.get('t') || code;
    } catch {
      // Might be just the ID
    }

    stopScanning();
    handleTemplateId(templateId);
  }

  // ─── Check/uncheck item ──────────────────────────────
  async function handleToggleItem(itemIndex) {
    if (!assignment) return;
    try {
      const updatedItems = [...assignment.items];
      const item = updatedItems[itemIndex];
      item.checked = !item.checked;
      item.checkedAt = item.checked ? new Date().toISOString() : null;

      const allDone = updatedItems.every(i => i.checked);
      const anyChecked = updatedItems.some(i => i.checked);
      let status = allDone ? 'completed' : anyChecked ? 'in-progress' : 'pending';

      await updateChecklistAssignment(assignment.id, {
        items: updatedItems,
        status,
        ...(allDone ? { completedAt: new Date().toISOString() } : { completedAt: null }),
      });

      setAssignment(prev => ({ ...prev, items: updatedItems, status, completedAt: allDone ? new Date().toISOString() : null }));

      if (allDone) {
        setMode('done');
        toast.success('All tasks completed!');
      }
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleAddNote(itemIndex, note) {
    if (!assignment) return;
    try {
      const updatedItems = [...assignment.items];
      updatedItems[itemIndex].note = note;
      await updateChecklistAssignment(assignment.id, { items: updatedItems });
      setAssignment(prev => ({ ...prev, items: updatedItems }));
    } catch { toast.error('Failed to save note'); }
  }

  // ─── Render ──────────────────────────────────────────

  // Loading
  if (mode === 'loading') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-surface-500">Loading checklist...</p>
        </div>
      </Layout>
    );
  }

  // Error
  if (mode === 'error') {
    return (
      <Layout>
        <div className="card p-8 sm:p-12 text-center max-w-md mx-auto">
          <XCircle className="w-12 h-12 text-danger-400 mx-auto mb-3" />
          <h3 className="text-lg font-display font-semibold text-surface-700 mb-1">Oops</h3>
          <p className="text-sm text-surface-500 mb-5">{error}</p>
          <div className="flex justify-center gap-2">
            <Link href="/my-checklists" className="btn-secondary">My Checklists</Link>
            <button onClick={() => { setMode('scan'); setError(''); }} className="btn-primary">
              <QrCode className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Scan mode
  if (mode === 'scan') {
    return (
      <Layout>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link href="/my-checklists" className="btn-icon -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="page-title">Scan QR Code</h1>
              <p className="text-sm text-surface-500 mt-0.5">Scan a checklist QR code or enter the code manually</p>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-5">
          {/* Camera view */}
          <div className="card overflow-hidden">
            <div className="relative bg-surface-900 aspect-square rounded-t-2xl overflow-hidden">
              {scanning ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Scan overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/50 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />
                      {/* Scanning line animation */}
                      <div className="absolute left-2 right-2 h-0.5 bg-brand-400/80 animate-bounce" style={{ top: '50%' }} />
                    </div>
                  </div>
                  <button onClick={stopScanning}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-black/50 text-white text-xs rounded-lg backdrop-blur-sm">
                    Stop
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white/60" />
                  </div>
                  <p className="text-sm text-white/60 text-center">
                    {cameraError || 'Tap the button below to start scanning'}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 text-center">
              {!scanning && (
                <button onClick={startScanning} className="btn-primary w-full">
                  <Camera className="w-4 h-4" /> Open Camera
                </button>
              )}
            </div>
          </div>

          {/* Manual input */}
          <div className="card p-5">
            <p className="text-sm font-medium text-surface-700 mb-3">Or enter the checklist code manually</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="input-field flex-1"
                placeholder="Paste URL or checklist ID..."
              />
              <button type="submit" className="btn-primary flex-shrink-0">Go</button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // Done mode
  if (mode === 'done') {
    return (
      <Layout>
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card p-8 sm:p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-display font-bold text-surface-900 mb-1">All Done!</h2>
            <p className="text-sm text-surface-500 mb-2">{template?.title || 'Checklist'} completed</p>
            {assignment?.completedAt && (
              <p className="text-xs text-surface-400 mb-5">
                {new Date(assignment.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Link href="/my-checklists" className="btn-secondary">My Checklists</Link>
              <button onClick={() => setMode('scan')} className="btn-primary">
                <QrCode className="w-4 h-4" /> Scan Another
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Checklist mode (filling out)
  const checkedCount = (assignment?.items || []).filter(i => i.checked).length;
  const totalItems = (assignment?.items || []).length;
  const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href="/my-checklists" className="btn-icon -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-display font-bold text-surface-900 truncate">{template?.title}</h1>
            {template?.description && (
              <p className="text-sm text-surface-500 truncate">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg flex-shrink-0">
            <span className="text-sm font-bold text-brand-700">{pct}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-surface-400 mt-1.5">{checkedCount} of {totalItems} items completed</p>
        </div>

        {/* Items */}
        <div className="card">
          <div className="divide-y divide-surface-100">
            {(assignment?.items || []).map((item, i) => (
              <ScanChecklistItem
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
    </Layout>
  );
}

// ─── Scan Checklist Item ─────────────────────────────────
function ScanChecklistItem({ item, index, onToggle, onNote }) {
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
        <div className="px-4 pb-3 pl-13">
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
