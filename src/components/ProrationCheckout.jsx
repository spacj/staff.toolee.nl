'use client';
import { useState, useRef, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { formatCurrency } from '@/lib/pricing';
import { AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * One-time PayPal capture for a prorated plan change. Charges `amount` now (for
 * the remainder of the current billing period) and hands the capture back via
 * onPaid so the caller can revise the subscription for future cycles.
 *
 * Props:
 *  - amount: number (EUR, immediate charge)
 *  - description: string shown to PayPal
 *  - onPaid: (details) => Promise<void> | void   // apply the change after payment
 */
export default function ProrationCheckout({ amount, description, orgId, onPaid }) {
  const [status, setStatus] = useState('idle'); // idle | working | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const amt = Math.max(0, Number(amount || 0));
  const amtStr = amt.toFixed(2);

  if (!clientId) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">PayPal isn&apos;t configured, so the change can&apos;t be charged right now.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="p-6 text-center">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-display font-bold text-surface-900">Plan updated</h3>
        <p className="text-sm text-surface-500 mt-1.5">You were charged {formatCurrency(amt)} for the rest of this period. Your renewal price is now updated too.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        You&apos;re charged {formatCurrency(amt)} now for the remainder of the current period. From your next renewal, the new price applies automatically.
      </div>

      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {errorMsg}</p>
        </div>
      )}

      <PayPalScriptProvider options={{ 'client-id': clientId, currency: 'EUR', intent: 'capture' }}>
        <PayPalButtons
          style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 46 }}
          createOrder={(data, actions) => actions.order.create({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: { value: amtStr, currency_code: 'EUR' },
              description: (description || 'Staff2 plan change').slice(0, 127),
              custom_id: `${orgId || 'org'}:proration`,
            }],
          })}
          onApprove={async (data, actions) => {
            try {
              setStatus('working');
              const details = await actions.order.capture();
              await onPaid?.(details);
              if (mountedRef.current) setStatus('success');
              toast.success('Plan updated — difference charged.');
            } catch (err) {
              console.error('Proration capture error:', err);
              if (mountedRef.current) {
                setStatus('error');
                setErrorMsg('We couldn\'t complete the change. If you were charged, contact support and we\'ll fix it.');
              }
            }
          }}
          onError={(err) => {
            console.error('PayPal error:', err);
            if (mountedRef.current) { setStatus('error'); setErrorMsg('PayPal encountered an error. Please try again.'); }
          }}
          onCancel={() => { if (mountedRef.current) toast('Change cancelled — no charge.'); }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
