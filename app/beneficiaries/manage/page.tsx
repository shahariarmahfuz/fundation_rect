'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  UsersRound, 
  Search, 
  Plus, 
  Edit2, 
  Power, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  BookOpenText,
  X,
  Eye,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ManageBeneficiariesPage() {
  const { hasPermission } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // View Details Modal State
  const [viewBeneficiary, setViewBeneficiary] = useState<any | null>(null);

  // Edit Modal State
  const [editBeneficiary, setEditBeneficiary] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRegistrationDate, setEditRegistrationDate] = useState('');
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
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing beneficiaries.view permission.');
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load beneficiaries.');
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
  }, [page, limit, search, statusFilter]);

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
      setError(`Access Denied: Missing ${requiredPerm} permission.`);
      return;
    }

    const confirmMsg = isActivating
      ? `Activate beneficiary ${b.name} (${b.beneficiary_id})?`
      : `Deactivate beneficiary ${b.name} (${b.beneficiary_id})? Historical ledger records will be preserved.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setError(null);
      setActionSuccess(null);
      const endpoint = isActivating ? `/api/beneficiaries/${b.id}/activate` : `/api/beneficiaries/${b.id}/deactivate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to update beneficiary status.');
      }
      setActionSuccess(`Beneficiary ${b.beneficiary_id} successfully marked as ${isActivating ? 'Active' : 'Inactive'}.`);
      await fetchBeneficiaries();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleOpenEdit = (b: any) => {
    setEditBeneficiary(b);
    setEditName(b.name || '');
    setEditPhone(b.phone || '');
    setEditAddress(b.address || '');
    setEditRegistrationDate(b.registration_date ? b.registration_date.substring(0, 10) : '');
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          registration_date: editRegistrationDate || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update beneficiary.');

      setEditBeneficiary(null);
      setActionSuccess(`Beneficiary ${data.beneficiary_id} updated successfully.`);
      await fetchBeneficiaries();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-primary" /> Manage Beneficiary
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search, filter, view details, update profiles, and manage status for registered beneficiaries.
          </p>
        </div>
        {hasPermission('beneficiaries.create') && (
          <Link
            href="/beneficiaries/add"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Beneficiary
          </Link>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3 sm:p-3.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between gap-2 border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-2 border border-destructive/20 w-full min-w-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Beneficiary ID (B-0001) or Name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Beneficiaries Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Beneficiary ID</th>
                <th className="py-3 px-3 sm:px-4">Name</th>
                <th className="py-3 px-3 sm:px-4">Phone</th>
                <th className="py-3 px-3 sm:px-4">Registration Date</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
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
                    <UsersRound className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">No beneficiaries found</p>
                    <p className="text-[11px] mt-0.5">Register a new beneficiary to start tracking.</p>
                  </td>
                </tr>
              ) : (
                beneficiaries.map((b) => (
                  <tr key={b.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-primary">
                      {b.beneficiary_id}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                      {b.name}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                      {b.phone || '—'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                      {b.registration_date ? new Date(b.registration_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
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
                    <td className="py-3 px-3 sm:px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewBeneficiary(b)}
                          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="View Details"
                          aria-label="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {hasPermission('beneficiary_ledger.view') && (
                          <Link
                            href="/beneficiaries/ledger"
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            title="View Beneficiary Ledger"
                            aria-label="View Beneficiary Ledger"
                          >
                            <BookOpenText className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        {hasPermission('beneficiaries.update') && (
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Edit Beneficiary"
                            aria-label="Edit Beneficiary"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(hasPermission('beneficiaries.activate') || hasPermission('beneficiaries.deactivate')) && (
                          <button
                            onClick={() => handleToggleStatus(b)}
                            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                              b.status === 'Active'
                                ? 'text-zinc-400 hover:text-destructive'
                                : 'text-zinc-400 hover:text-emerald-600'
                            }`}
                            title={b.status === 'Active' ? 'Deactivate' : 'Activate'}
                            aria-label={b.status === 'Active' ? 'Deactivate' : 'Activate'}
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
        <div className="py-3 px-3 sm:px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-muted-foreground w-full">
          <span className="text-center sm:text-left">
            Showing {beneficiaries.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} beneficiaries
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Beneficiary Details Modal */}
      {viewBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Beneficiary Details</h3>
                <span className="font-mono text-xs text-primary font-bold">
                  {viewBeneficiary.beneficiary_id}
                </span>
              </div>
              <button
                onClick={() => setViewBeneficiary(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Full Name</span>
                <span className="font-semibold text-foreground mt-0.5 block">{viewBeneficiary.name}</span>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                  viewBeneficiary.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                }`}>
                  {viewBeneficiary.status}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </span>
                <span className="text-foreground mt-0.5 block">{viewBeneficiary.phone || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Registration Date
                </span>
                <span className="text-foreground mt-0.5 block">
                  {viewBeneficiary.registration_date ? new Date(viewBeneficiary.registration_date).toLocaleDateString() : 'Not provided'}
                </span>
              </div>
              <div className="sm:col-span-2 p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </span>
                <span className="text-foreground mt-0.5 block">{viewBeneficiary.address || 'Not provided'}</span>
              </div>
              {viewBeneficiary.notes && (
                <div className="sm:col-span-2 p-3 rounded-lg bg-background border border-border/50">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Notes
                  </span>
                  <span className="text-foreground mt-0.5 block">{viewBeneficiary.notes}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
              {hasPermission('beneficiary_ledger.view') && (
                <Link
                  href="/beneficiaries/ledger"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                >
                  <BookOpenText className="w-3.5 h-3.5" /> Open Ledger
                </Link>
              )}
              <button
                type="button"
                onClick={() => setViewBeneficiary(null)}
                className="px-3.5 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Beneficiary Modal */}
      {editBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Beneficiary</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  Beneficiary ID: <strong className="text-primary font-bold">{editBeneficiary.beneficiary_id}</strong> (Read-only)
                </span>
              </div>
              <button
                onClick={() => setEditBeneficiary(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
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
                  Beneficiary ID
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={editBeneficiary.beneficiary_id}
                  className="w-full px-3 py-1.5 rounded bg-muted/60 border border-border/70 text-muted-foreground font-mono font-semibold cursor-not-allowed"
                />
              </div>

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
                <label className="block text-xs font-semibold text-foreground mb-1">Registration Date</label>
                <input
                  type="date"
                  value={editRegistrationDate}
                  onChange={(e) => setEditRegistrationDate(e.target.value)}
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
                  className="px-3 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
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
