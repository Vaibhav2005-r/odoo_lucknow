import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { X, CreditCard, Calendar, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';

const paymentSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER']),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  note: z.string().trim().max(255).optional(),
});

export default function RecordPaymentModal({ invoice, isOpen, onClose, onSuccess }) {
  if (!isOpen || !invoice) return null;

  const dueAmount = Number(invoice.amountTotal) - Number(invoice.amountPaid);
  const todayStr = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'UPI',
      amount: dueAmount > 0 ? dueAmount : '',
      paymentDate: todayStr,
      note: '',
    },
  });

  const onSubmit = async (values) => {
    if (values.amount > dueAmount) {
      setError('amount', {
        message: `Amount cannot exceed the balance due of ${inr(dueAmount)}`,
      });
      return;
    }

    try {
      await api.post(`/invoices/${invoice.id}/payments`, values);
      toast.success(`Payment of ${inr(values.amount)} recorded successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="p-3 bg-brand-50/50 border border-brand-100 rounded-lg text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Invoice:</span>
              <span className="font-mono font-semibold text-slate-900">{invoice.number}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Invoice Amount:</span>
              <span className="font-semibold text-slate-900">{inr(invoice.amountTotal)}</span>
            </div>
            <div className="flex justify-between text-brand-700 font-bold text-sm pt-1 border-t border-brand-100">
              <span>Remaining Balance Due:</span>
              <span>{inr(dueAmount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              {...register('method')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="UPI">UPI / QR Code</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              max={dueAmount}
              {...register('amount')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('paymentDate')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.paymentDate && <p className="text-xs text-red-500 mt-1">{errors.paymentDate.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes / Transaction ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UTR 42890123910, Cash receipt #89"
              {...register('note')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
