'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CheckCircle2, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function AddGroupPage() {
  const router = useRouter();
  const { hasPermission, activeUsername } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Active');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  if (!hasPermission('groups.create')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">groups.create</code> permission.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Use the role switcher in the header to switch to an Administrator or Field Officer.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);

    if (!name.trim()) {
      setError('Group Name is required.');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      };

      if (useCustomCode && customCode.trim()) {
        payload.code = customCode.trim().toUpperCase();
      }

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create group');
      }

      setSuccessData(data);
      setName('');
      setDescription('');
      setCustomCode('');
      setUseCustomCode(false);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      <div className="flex items-center gap-3">
        <Link
          href="/groups/manage"
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">Add New Group</h1>
          <p className="text-xs text-muted-foreground">Register a new foundation community group in PostgreSQL.</p>
        </div>
      </div>

      {successData && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 sm:gap-3 w-full min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs min-w-0">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">Group Created Successfully!</span>
            <p className="text-emerald-700 dark:text-emerald-400 mt-0.5 break-words">
              Group <strong>{successData.name}</strong> was registered with code <strong>{successData.code}</strong>.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={() => router.push('/groups/manage')}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 text-xs"
              >
                Go to Manage Groups
              </button>
              <button
                onClick={() => setSuccessData(null)}
                className="px-3 py-1.5 rounded border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 text-xs hover:bg-emerald-500/10"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 sm:gap-3 w-full min-w-0">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="text-xs text-destructive font-medium min-w-0 break-words">
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs space-y-4 sm:space-y-5 w-full min-w-0">
        {/* Group Name */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Group Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Northern Rangpur Agricultural Circle"
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Group Code Strategy */}
        <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-border/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Group Code Generation</span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomCode}
                onChange={(e) => setUseCustomCode(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>Specify Custom Code</span>
            </label>
          </div>

          {!useCustomCode ? (
            <p className="text-[11px] text-muted-foreground">
              A unique, sequential code (e.g., <code className="font-mono font-semibold text-foreground">G-XXXX</code>) will be generated atomically by the backend upon creation.
            </p>
          ) : (
            <div>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="e.g. G-CUSTOM-99"
                className="w-full px-3 py-1.5 text-xs rounded-md bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Must be globally unique. Duplicate group codes will be rejected by database constraints.
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Description <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mission, geographic scope, or objectives of this group..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Creation Date
            </label>
            <input
              type="text"
              disabled
              value={new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/groups/manage')}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 text-center"
          >
            {loading ? 'Creating Group in PostgreSQL...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
