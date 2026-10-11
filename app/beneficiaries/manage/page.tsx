'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  HandHeart, 
  Search, 
  Plus, 
  Edit2, 
  Power, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  FileSpreadsheet,
  X,
  Eye
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ManageBeneficiariesPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit State
  const [editBeneficiary, setEditBeneficiary] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append('q', search.trim());
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/beneficiaries?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing beneficiaries.view permission.');
        throw new Error('Failed to load beneficiaries');
      }
      const data = await res.json();
      setBeneficiaries(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [page, limit, search, statusFilter, activeUsername]);

  if (!hasPermission('beneficiaries.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">beneficiaries.view</code> permission.
        </p>
      </div>
    );
  }

  const handleToggleStatus = async (b: any) => {
    const isActivating = b.status !== 'Active';
    const requiredPerm = isActivating ? 'beneficiaries.activate' : 'beneficiaries.deactivate';
    if (!hasPermission(requiredPerm)) {
      alert(`Forbidden: Missing ${requiredPerm} permission.`);
      return;
    }

    const confirmMsg = isActivating
      ? `Activate beneficiary ${b.name} (${b.beneficiary_id})?`
      : `Deactivate beneficiary ${b.name} (${b.beneficiary_id})? Historical ledger records will be strictly preserved.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = isActivating ? `/api/beneficiaries/${b.id}/activate` : `/api/beneficiaries/${b.id}/deactivate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to update beneficiary status');
      }
      await fetchBeneficiaries();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenEdit = (b: any) => {
    setEditBeneficiary(b);
    setEditName(b.name);
    setEditPhone(b.phone || '');
    setEditAddress(b.address || '');
    setEditNotes(b.notes || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBeneficiary) return;
    try {
      setEditLoading(true);
      setEditError(null);
      const res = await fetch(`/api/beneficiaries/${editBeneficiary.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update beneficiary');

      setEditBeneficiary(null);
      await fetchBeneficiaries();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Beneficiary Directory</h1>
          <p className="text-xs text-muted-foreground">
            Search, filter, edit, and access ledgers for registered foundation beneficiaries.
          </p>
        </div>
        {hasPermission('beneficiaries.create') && (
          <Link
            href="/beneficiaries/add"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Beneficiary
          </Link>
        )}
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Beneficiary ID (B-XXXX) or Name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          className="px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Beneficiaries Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-4">Beneficiary ID</th>
                <th className="py-3 px-4">Beneficiary Name</th>
                <th className="py-3 px-4 hidden sm:table-cell">Phone</th>
                <th className="py-3 px-4 hidden md:table-cell">Address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading beneficiaries...</p>
                  </td>
                </tr>
              ) : beneficiaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <HandHeart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No beneficiaries found</p>
                    <p className="text-[11px] mt-0.5">Register a new beneficiary to begin tracking.</p>
                  </td>
                </tr>
              ) : (
                beneficiaries.map((b) => (
                  <tr key={b.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {b.beneficiary_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {b.name}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                      {b.phone || '—'}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground max-w-xs truncate">
                      {b.address || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          b.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {hasPermission('beneficiary_ledger.view') && (
                          <Link
                            href="/beneficiaries/ledger"
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            title="View Financial Ledger"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        {hasPermission('beneficiaries.update') && (
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            title="Edit Beneficiary"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(hasPermission('beneficiaries.activate') || hasPermission('beneficiaries.deactivate')) && (
                          <button
                            onClick={() => handleToggleStatus(b)}
                            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                              b.status === 'Active'
                                ? 'text-zinc-400 hover:text-destructive'
                                : 'text-zinc-400 hover:text-emerald-600'
                            }`}
                            title={b.status === 'Active' ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3 px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {beneficiaries.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} beneficiaries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Beneficiary Modal */}
      {editBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border/60 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Beneficiary</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: <strong className="text-foreground">{editBeneficiary.beneficiary_id}</strong> (Read-only)
                </span>
              </div>
              <button
                onClick={() => setEditBeneficiary(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-xs text-destructive">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Beneficiary Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setEditBeneficiary(null)}
                  className="px-3 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Beneficiary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
