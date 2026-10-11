'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HandHeart, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AddBeneficiaryPage() {
  const router = useRouter();
  const { hasPermission, activeUsername } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [regDate, setRegDate] = useState('');
  const [status, setStatus] = useState('Active');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBeneficiary, setCreatedBeneficiary] = useState<any | null>(null);

  if (!hasPermission('beneficiaries.create')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">beneficiaries.create</code> permission.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedBeneficiary(null);

    if (!name.trim()) {
      setError('Beneficiary Name is required.');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        registration_date: regDate || undefined,
        status,
        notes: notes.trim() || undefined,
      };

      const res = await fetch('/api/beneficiaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to register beneficiary');
      }

      setCreatedBeneficiary(data);
      setName('');
      setPhone('');
      setAddress('');
      setRegDate('');
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      <div className="flex items-center gap-3">
        <Link
          href="/beneficiaries/ledger"
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">Add New Beneficiary</h1>
          <p className="text-xs text-muted-foreground">
            Register a foundation beneficiary with automatic sequential ID allocation.
          </p>
        </div>
      </div>

      {createdBeneficiary && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 sm:gap-3 w-full min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs min-w-0">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Beneficiary Registered Successfully!
            </span>
            <p className="text-emerald-700 dark:text-emerald-400 mt-1 break-words">
              Assigned Beneficiary ID:{' '}
              <strong className="font-mono text-sm px-1.5 py-0.5 rounded bg-emerald-500/20">
                {createdBeneficiary.beneficiary_id}
              </strong>
            </p>
            <p className="text-emerald-700 dark:text-emerald-400 mt-0.5 break-words">
              Name: <strong>{createdBeneficiary.name}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/beneficiaries/ledger`)}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 text-xs"
              >
                Go to Beneficiary Ledger
              </button>
              <button
                onClick={() => setCreatedBeneficiary(null)}
                className="px-3 py-1.5 rounded border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 text-xs hover:bg-emerald-500/10"
              >
                Register Another
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 sm:gap-3 text-xs text-destructive w-full min-w-0">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0 break-words">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs space-y-4 sm:space-y-5 w-full min-w-0">
        {/* Notice on Beneficiary ID */}
        <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-border/50 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-1.5">
          <span>Automatic Beneficiary ID Allocation:</span>
          <span className="font-mono font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded">
            Auto Generated (B-XXXX)
          </span>
        </div>

        {/* Beneficiary Name (Mandatory) */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Beneficiary Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Begum Rokeya"
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        {/* Contact Info (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1912 345678"
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Registration Date <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="date"
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Address / Location <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Village/Road, Union/Ward, District"
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Deactivating a beneficiary will strictly preserve all their historical ledger entries.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Notes / Case Background <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Socioeconomic background, family assistance needs..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/beneficiaries/ledger')}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-center"
          >
            {loading ? 'Allocating Beneficiary ID...' : 'Register Beneficiary'}
          </button>
        </div>
      </form>
    </div>
  );
}
