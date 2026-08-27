'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/Modal';
import { cn } from '@/utils/helpers';
import { Camera, Keyboard, Sparkles, Loader2, ScanLine } from 'lucide-react';

/**
 * Reusable barcode scanner.
 *
 * Decoding strategy:
 *   1. Native `BarcodeDetector` when available (fast, no download) — Android
 *      Chrome, some desktops.
 *   2. Otherwise a lazy-loaded ZXing reader (`@zxing/browser`) — covers iOS
 *      Safari, Firefox, etc. Only downloaded when the scanner actually opens.
 *
 * Always offers manual entry. With `allowSimulate` + `simulateCodes` it also
 * shows a "Simulate scan" button so the public homepage demo is fully tryable
 * without granting camera access.
 *
 * Props: open, onClose, onDetected(code), allowSimulate?, simulateCodes?, title?
 */
export default function BarcodeScanner({ open, onClose, onDetected, allowSimulate = false, simulateCodes = [], title = 'Scan a barcode' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null); // ZXing controls
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const activeRef = useRef(false);
  const simIdxRef = useRef(0);

  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [errMsg, setErrMsg] = useState('');
  const [manual, setManual] = useState('');

  const stop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (controlsRef.current) { try { controlsRef.current.stop(); } catch {} controlsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) { try { videoRef.current.srcObject = null; } catch {} }
  }, []);

  const finish = useCallback((code) => {
    const c = String(code || '').trim();
    if (!c) return;
    stop();
    onDetected?.(c);
  }, [onDetected, stop]);

  const tick = useCallback(async () => {
    if (!activeRef.current || !videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length) { finish(codes[0].rawValue); return; }
    } catch {}
    if (activeRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [finish]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    activeRef.current = true;
    setErrMsg('');
    setStatus('starting');
    setManual('');

    (async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrMsg('Camera isn’t available here — enter the code manually below.');
        return;
      }
      try {
        if ('BarcodeDetector' in window) {
          let formats;
          try { formats = await window.BarcodeDetector.getSupportedFormats(); } catch {}
          try { detectorRef.current = new window.BarcodeDetector(formats?.length ? { formats } : undefined); }
          catch { detectorRef.current = new window.BarcodeDetector(); }
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
          setStatus('scanning');
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          controlsRef.current = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            videoRef.current,
            (result) => { if (result) finish(result.getText()); }
          );
          if (cancelled) { stop(); return; }
          setStatus('scanning');
        }
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrMsg('Camera access was blocked. Allow camera in your browser, or enter the code manually.');
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [open, tick, finish, stop]);

  const simulate = () => {
    const list = simulateCodes.length ? simulateCodes : ['0000000000000'];
    const code = list[simIdxRef.current % list.length];
    simIdxRef.current += 1;
    finish(code);
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (manual.trim()) finish(manual);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={() => { stop(); onClose?.(); }} title={title}>
      <div className="space-y-4">
        {/* Camera viewport */}
        <div className="relative bg-surface-900 rounded-2xl overflow-hidden aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
          {/* scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2/3 h-1/2 border-2 border-white/40 rounded-2xl relative">
              <span className="absolute -top-px -left-px w-6 h-6 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
              <span className="absolute -top-px -right-px w-6 h-6 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
              <span className="absolute -bottom-px -left-px w-6 h-6 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
              <span className="absolute -bottom-px -right-px w-6 h-6 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />
              {status === 'scanning' && <span className="absolute left-2 right-2 top-1/2 h-0.5 bg-brand-400/80 animate-pulse" />}
            </div>
          </div>
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-surface-900/70">
              {status === 'starting'
                ? <><Loader2 className="w-7 h-7 text-white/70 animate-spin" /><p className="text-sm text-white/70">Starting camera…</p></>
                : <><Camera className="w-7 h-7 text-white/60" /><p className="text-sm text-white/70 max-w-xs">{errMsg}</p></>}
            </div>
          )}
          {status === 'scanning' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-[11px] text-white">
              <ScanLine className="w-3.5 h-3.5" /> Point at a barcode
            </div>
          )}
        </div>

        {/* Simulate (demo only) */}
        {allowSimulate && (
          <button type="button" onClick={simulate} className="btn-primary w-full">
            <Sparkles className="w-4 h-4" /> Simulate scan
          </button>
        )}

        {/* Manual entry */}
        <form onSubmit={submitManual}>
          <label className="block text-xs font-medium text-surface-500 mb-1.5 flex items-center gap-1.5"><Keyboard className="w-3.5 h-3.5" /> Or enter the barcode number</label>
          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="e.g. 5012345678900"
              className="input-field flex-1" />
            <button type="submit" disabled={!manual.trim()} className="btn-secondary flex-shrink-0 disabled:opacity-50">Enter</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
