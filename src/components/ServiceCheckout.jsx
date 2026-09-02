'use client';
import { useState, useRef, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '@/contexts/AuthContext';
import { createPayment, createSupportTicket } from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * One-time, fixed-price service checkout (PayPal Orders API — capture intent).
 * Use for things that have a set price and can be bought on the spot, e.g. the
 * €50 Staff Setup service. On payment we record the payment and open a
 * fulfilment ticket so the team knows to deliver the service.
 *
 * Props:
 *  - service: { key, label, amount, description }
 *  - onSuccess?: () => void
 */
export default function ServiceCheckout({ service, onSuccess }) {
  const { orgId, user, userProfile, organization } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const amount = Number(service?.amount || 0);
  const amountStr = amount.toFixed(2);

  if (!clientId) {
    return (
      <div className="p-5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">PayPal is not configured. Add <code className="bg-red-100 px-1 rounded">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> to enable checkout.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-display font-bold text-surface-900">Payment received!</h3>
        <p className="text-sm text-surface-500 mt-2">
          We&apos;ve got your {service.label}. Our team will reach out to schedule it — check Chat &amp; email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-surface-500">Service</span>
          <span className="font-semibold text-surface-800">{service.label}</span>
        </div>
        {service.description && (
          <p className="text-xs text-surface-500">{service.description}</p>
        )}
        <div className="flex justify-between pt-2 border-t border-surface-200">
          <span className="font-semibold text-surface-800">One-time total</span>
          <span className="text-lg font-display font-bold text-surface-900">{formatCurrency(amount)}</span>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        One-time charge — no subscription. After payment we open a job and get in touch to schedule.
      </div>

      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {errorMsg}</p>
        </div>
      )}

      <PayPalScriptProvider options={{
        'client-id': clientId,
        currency: 'EUR',
        intent: 'capture',
      }}>
        <PayPalButtons
          style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 48 }}
          createOrder={(data, actions) => actions.order.create({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: { value: amountStr, currency_code: 'EUR' },
              description: `Staff2 — ${service.label}`,
              custom_id: `${orgId || 'org'}:${service.key}`,
            }],
          })}
          onApprove={async (data, actions) => {
            try {
              const details = await actions.order.capture();
              const captureId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id || details?.id;
              await createPayment({
                orgId,
                amount,
                currency: 'EUR',
                service: service.key,
                serviceLabel: service.label,
                paypalOrderId: details?.id || data.orderID,
                paypalCaptureId: captureId || null,
                period: new Date().toISOString().slice(0, 7),
                method: 'paypal_order',
                status: 'COMPLETED',
                createdAt: new Date().toISOString(),
              });
              await createSupportTicket({
                subject: `[${service.label}] ${organization?.name || 'Org'} — paid`,
                message: `${service.label} purchased and paid (${formatCurrency(amount)}).\nOrg: ${organization?.name || orgId}\nBy: ${userProfile?.displayName || user?.email || 'admin'}\nOrder: ${details?.id || data.orderID}\n\nSchedule the service and follow up with the customer.`,
                category: service.key,
                priority: 'high',
                source: 'app',
                orgId: orgId || null,
                orgName: organization?.name || '',
                senderName: userProfile?.displayName || '',
                senderEmail: user?.email || '',
                senderRole: 'customer',
                paid: true,
                amount,
              }).catch(() => {});
              if (mountedRef.current) setStatus('success');
              toast.success('Payment received — we\'ll be in touch!');
              setTimeout(() => onSuccess?.(), 2000);
            } catch (err) {
              console.error('Service capture error:', err);
              if (mountedRef.current) {
                setStatus('error');
                setErrorMsg('We could not confirm the payment. If you were charged, contact support and we\'ll sort it out.');
              }
            }
          }}
          onError={(err) => {
            console.error('PayPal error:', err);
            if (mountedRef.current) {
              setStatus('error');
              setErrorMsg('PayPal encountered an error. Please try again.');
            }
          }}
          onCancel={() => { if (mountedRef.current) toast('Checkout cancelled — no charge.'); }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
