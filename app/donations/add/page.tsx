'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  PlusCircle, 
  HandCoins, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  User, 
  FileText, 
  ArrowLeft,
  List
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Mobile Money',
  'Cheque',
];

export default function AddDonationPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const todayStr = new Date().toISOString().substring(0, 10);
  const [donationDate, setDonationDate] = useState(todayStr);
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);

  if (!hasPermission('donations.create')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">donations.create</code> permission.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Donation amount must be a positive number greater than zero.');
      return;
    }

    if (!donorName.trim()) {
      setError('Donor name is required.');
      return;
    }

    if (!donationDate) {
      setError('Donation date is required.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          donation_date: donationDate,
          donor_name: donorName.trim(),
          amount: parsedAmount.toFixed(2),
          payment_method: paymentMethod,
          transaction_reference: transactionReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to record donation.');
      }

      setSuccess(data);
      // Reset form
      setDonorName('');
      setAmount('');
      setTransactionReference('');
      setNotes('');
      setDonationDate(todayStr);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-3xl mx-auto min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/donations/manage"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Donations
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <HandCoins className="w-5 h-5 text-primary" /> Record New Donation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record monetary funds received by the foundation. The sequential Donation ID is generated automatically.
          </p>
        </div>

        {hasPermission('donations.view') && (
          <Link
            href="/donations/manage"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground shrink-0"
          >
            <List className="w-3.5 h-3.5" /> Manage Donations
          </Link>
        )}
      </div>

      {/* Success Notification */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Donation Recorded Successfully!</span>
          </div>
          <p className="text-xs leading-relaxed">
            Sequential ID <strong className="font-mono text-emerald-950 dark:text-emerald-100">{success.donation_id}</strong> has been created in PostgreSQL for donor <strong className="text-foreground">{success.donor_name}</strong> in the amount of <strong className="font-mono">${Number(success.amount).toFixed(2)}</strong>.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <Link
              href="/donations/manage"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline hover:opacity-80"
            >
              View in Manage Donations &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Record Another
            </button>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2 border border-destructive/20 w-full min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs p-4 sm:p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 text-xs">
          {/* Read-only ID & Recorded By Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Donation ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  readOnly
                  value="Auto-generated (e.g. D-0001)"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-muted/60 border border-border/60 font-mono text-muted-foreground cursor-not-allowed italic"
                />
              </div>
              <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                Generated sequentially and concurrency-safely on the server.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Recorded By
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  readOnly
                  value={user?.full_name ? `${user.full_name} (${user.role_name || 'Staff'})` : 'Authenticated User'}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-muted/60 border border-border/60 text-muted-foreground cursor-not-allowed"
                />
              </div>
              <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                Automatically bound to your verified session account.
              </span>
            </div>
          </div>

          {/* Date & Donor Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Donation Date <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={donationDate}
                  onChange={(e) => setDonationDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Donor Name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe / Global Charity Foundation"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Amount & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Amount ($ USD) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Must be a positive monetary value. Stored with full decimal precision.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Payment Method <span className="text-destructive">*</span>
              </label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transaction Reference & Notes */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Transaction Reference <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-984210, Bank Wire Ref, or Receipt Number"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">
              Unique financial identifier to prevent double-recording.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Notes / Purpose <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Add any specific context, earmarks, or donation purpose..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border/50">
            <Link
              href="/donations/manage"
              className="px-4 py-2 rounded-lg border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground cursor-pointer transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shadow-xs cursor-pointer transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? 'Recording...' : 'Record Donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
