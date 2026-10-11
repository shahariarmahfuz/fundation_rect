'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  HandCoins, 
  Search, 
  Plus, 
  Edit2, 
  Ban, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  BarChart3,
  X,
  Eye,
  CheckCircle2,
  Calendar,
  DollarSign,
  CreditCard,
  User,
  ArrowUpDown,
  Filter,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Mobile Money',
  'Cheque',
];

export default function ManageDonationsPage() {
  const { hasPermission } = useAuth();

  const [donations, setDonations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalFilteredAmount, setTotalFilteredAmount] = useState('0.00');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('donation_date');
  const [order, setOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // View Details Modal State
  const [viewDonation, setViewDonation] = useState<any | null>(null);

  // Edit Modal State
  const [editDonation, setEditDonation] = useState<any | null>(null);
  const [editDonorName, setEditDonorName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Cancel Modal State
  const [cancelDonation, setCancelDonation] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchDonations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        order: order,
      });
      if (search.trim()) params.append('q', search.trim());
      if (paymentMethodFilter) params.append('payment_method', paymentMethodFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/donations?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing donations.view permission.');
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load donations.');
      }
      const data = await res.json();
      setDonations(data.items || []);
      setTotal(data.total || 0);
      setTotalFilteredAmount(Number(data.total_amount || 0).toFixed(2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, [page, limit, search, paymentMethodFilter, statusFilter, startDate, endDate, sortBy, order]);

  if (!hasPermission('donations.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">donations.view</code> permission.
        </p>
      </div>
    );
  }

  const handleOpenEdit = (d: any) => {
    setEditDonation(d);
    setEditDonorName(d.donor_name || '');
    setEditAmount(d.amount ? Number(d.amount).toFixed(2) : '');
    setEditPaymentMethod(d.payment_method || 'Cash');
    setEditDate(d.donation_date ? d.donation_date.substring(0, 10) : '');
    setEditRef(d.transaction_reference || '');
    setEditNotes(d.notes || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDonation) return;
    try {
      setEditLoading(true);
      setEditError(null);
      const parsedAmount = parseFloat(editAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      const res = await fetch(`/api/donations/${editDonation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          donor_name: editDonorName.trim(),
          amount: parsedAmount.toFixed(2),
          payment_method: editPaymentMethod,
          donation_date: editDate,
          transaction_reference: editRef.trim() || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update donation.');

      setEditDonation(null);
      setActionSuccess(`Donation ${data.donation_id} updated successfully.`);
      await fetchDonations();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenCancel = (d: any) => {
    setCancelDonation(d);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelDonation) return;
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason.');
      return;
    }

    try {
      setCancelLoading(true);
      setCancelError(null);
      const res = await fetch(`/api/donations/${cancelDonation.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cancel_reason: cancelReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to cancel donation.');

      setCancelDonation(null);
      setActionSuccess(`Donation ${data.donation_id} cancelled. Audit history preserved.`);
      await fetchDonations();
    } catch (e: any) {
      setCancelError(e.message);
    } finally {
      setCancelLoading(false);
    }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-primary" /> Manage Donations
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit-ready database tracking of monetary funds received, donor records, and payment methods.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasPermission('donation_reports.view') && (
            <Link
              href="/donations/report"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground shadow-xs transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-primary" /> Reports
            </Link>
          )}

          {hasPermission('donations.create') && (
            <Link
              href="/donations/add"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" /> Add Donation
            </Link>
          )}
        </div>
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

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Filtered Amount</span>
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">${totalFilteredAmount}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Transactions</span>
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">{total}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Current View</span>
            <div className="text-xs text-foreground font-medium mt-0.5">
              {paymentMethodFilter || 'All Methods'} &bull; {statusFilter || 'All Statuses'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-500/10 text-muted-foreground flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search, Filter & Date Range Bar */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative w-full sm:flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ID (D-0001), Donor, or Reference..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={paymentMethodFilter}
              onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-2 border-t border-border/40 text-xs">
          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground text-xs w-full sm:w-auto"
            />
          </div>

          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground text-xs w-full sm:w-auto"
            />
          </div>

          {(startDate || endDate || paymentMethodFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPaymentMethodFilter('');
                setStatusFilter('');
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-primary hover:underline sm:ml-auto self-start sm:self-auto py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Donations Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('donation_id')}>
                  <div className="flex items-center gap-1">
                    Donation ID {sortBy === 'donation_id' && (order === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('donation_date')}>
                  <div className="flex items-center gap-1">
                    Date {sortBy === 'donation_date' && (order === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4">Donor Name</th>
                <th className="py-3 px-3 sm:px-4 cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-1">
                    Amount {sortBy === 'amount' && (order === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4">Payment Method</th>
                <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Reference</th>
                <th className="py-3 px-3 sm:px-4 hidden lg:table-cell">Recorded By</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading donation records...</p>
                  </td>
                </tr>
              ) : donations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <HandCoins className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">No donations recorded yet</p>
                    <p className="text-[11px] mt-0.5">Use &quot;Add Donation&quot; to register new contributions.</p>
                  </td>
                </tr>
              ) : (
                donations.map((d) => (
                  <tr key={d.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-primary">
                      {d.donation_id}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                      {d.donation_date ? new Date(d.donation_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                      {d.donor_name}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-foreground">
                      ${Number(d.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10 text-foreground">
                        {d.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell font-mono text-muted-foreground truncate max-w-[120px]">
                      {d.transaction_reference || '—'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 hidden lg:table-cell text-muted-foreground truncate max-w-[120px]">
                      {d.recorded_by_name || 'Staff'}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          d.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewDonation(d)}
                          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="View Details"
                          aria-label="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {d.status === 'COMPLETED' && hasPermission('donations.update') && (
                          <button
                            onClick={() => handleOpenEdit(d)}
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Edit Donation"
                            aria-label="Edit Donation"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {d.status === 'COMPLETED' && hasPermission('donations.cancel') && (
                          <button
                            onClick={() => handleOpenCancel(d)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Cancel Donation"
                            aria-label="Cancel Donation"
                          >
                            <Ban className="w-3.5 h-3.5" />
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
            Showing {donations.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} records
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

      {/* View Donation Details Modal */}
      {viewDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Donation Details</h3>
                <span className="font-mono text-xs text-primary font-bold">
                  {viewDonation.donation_id}
                </span>
              </div>
              <button
                onClick={() => setViewDonation(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Donor Name</span>
                <span className="font-semibold text-foreground mt-0.5 block">{viewDonation.donor_name}</span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Amount</span>
                <span className="font-bold text-base font-mono text-foreground mt-0.5 block">
                  ${Number(viewDonation.amount).toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Payment Method</span>
                <span className="font-medium text-foreground mt-0.5 block">{viewDonation.payment_method}</span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Donation Date</span>
                <span className="text-foreground mt-0.5 block">
                  {viewDonation.donation_date ? new Date(viewDonation.donation_date).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Transaction Reference</span>
                <span className="font-mono text-foreground mt-0.5 block">
                  {viewDonation.transaction_reference || 'None'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                  viewDonation.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {viewDonation.status}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Recorded By</span>
                <span className="text-foreground mt-0.5 block">{viewDonation.recorded_by_name || 'Staff User'}</span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Recorded At</span>
                <span className="text-foreground mt-0.5 block">
                  {viewDonation.created_at ? new Date(viewDonation.created_at).toLocaleString() : '—'}
                </span>
              </div>

              {viewDonation.notes && (
                <div className="sm:col-span-2 p-3 rounded-lg bg-background border border-border/50">
                  <span className="text-[11px] text-muted-foreground block">Notes</span>
                  <span className="text-foreground mt-0.5 block">{viewDonation.notes}</span>
                </div>
              )}

              {viewDonation.status === 'CANCELLED' && (
                <div className="sm:col-span-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                  <span className="text-[11px] font-semibold text-destructive block">Cancellation Audit Trail</span>
                  <p className="text-destructive text-[11px]">Reason: {viewDonation.cancel_reason}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Cancelled by: {viewDonation.cancelled_by_name || 'Admin'} at {viewDonation.cancelled_at ? new Date(viewDonation.cancelled_at).toLocaleString() : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setViewDonation(null)}
                className="px-3.5 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation Modal */}
      {editDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Donation</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: <strong className="text-primary font-bold">{editDonation.donation_id}</strong> (Read-only)
                </span>
              </div>
              <button
                onClick={() => setEditDonation(null)}
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
                  Donation ID
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={editDonation.donation_id}
                  className="w-full px-3 py-1.5 rounded bg-muted/60 border border-border/70 text-muted-foreground font-mono font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Donor Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDonorName}
                  onChange={(e) => setEditDonorName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Amount ($) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Payment Method <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Reference</label>
                  <input
                    type="text"
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    placeholder="Optional reference"
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                  />
                </div>
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
                  onClick={() => setEditDonation(null)}
                  className="px-3 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Donation Modal */}
      {cancelDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md bg-card border border-destructive/40 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <Ban className="w-4 h-4" /> Cancel Donation
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: <strong className="text-foreground">{cancelDonation.donation_id}</strong> &bull; Amount: ${Number(cancelDonation.amount).toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setCancelDonation(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cancelling will revoke this financial transaction and update reports while preserving the historical record and audit trail in PostgreSQL.
            </p>

            {cancelError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-xs text-destructive">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Cancellation <span className="text-destructive">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Chargeback, Donor requested refund, Duplicate entry error..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-destructive text-foreground"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setCancelDonation(null)}
                  className="px-3 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
