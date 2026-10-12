'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Receipt, 
  Search, 
  Plus, 
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
  Building2,
  Filter,
  FileText,
  Clock,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Mobile Money',
  'Cheque'
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function ManageContributionsContent() {
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();

  const [contributions, setContributions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalFilteredAmount, setTotalFilteredAmount] = useState('0.00');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [batchRefFilter, setBatchRefFilter] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // View Details Modal State
  const [viewContribution, setViewContribution] = useState<any | null>(null);

  // Cancel Modal State
  const [cancelContribution, setCancelContribution] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Check URL query parameters on initial load
  useEffect(() => {
    const qBatch = searchParams.get('batch');
    if (qBatch) {
      setBatchRefFilter(qBatch);
      setSearch(qBatch);
    }
  }, [searchParams]);

  // Load groups for filter dropdown
  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetch('/api/groups?status=Active&limit=100', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setGroups(data.items || []);
        }
      } catch (err) {
        console.error('Failed to load groups filter:', err);
      }
    }
    loadGroups();
  }, []);

  const fetchContributions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append('q', search.trim());
      if (groupFilter) params.append('group_id', groupFilter);
      if (yearFilter) params.append('year', yearFilter);
      if (monthFilter) params.append('month', monthFilter);
      if (paymentMethodFilter) params.append('payment_method', paymentMethodFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/contributions?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing contributions.view permission.');
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load contributions.');
      }
      const data = await res.json();
      setContributions(data.items || []);
      setTotal(data.total || 0);
      setTotalFilteredAmount(Number(data.total_amount || 0).toFixed(2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, groupFilter, yearFilter, monthFilter, paymentMethodFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handleOpenCancel = (c: any) => {
    setCancelContribution(c);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelContribution) return;
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancelling this contribution receipt.');
      return;
    }

    try {
      setCancelLoading(true);
      setCancelError(null);
      const res = await fetch(`/api/contributions/${cancelContribution.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancel_reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to cancel contribution.');
      }

      setActionSuccess(`Contribution receipt ${cancelContribution.receipt_id} was successfully cancelled and group fund reversed.`);
      setCancelContribution(null);
      fetchContributions();
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  if (!hasPermission('contributions.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">contributions.view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" /> Manage Monthly Contributions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit, verify, and inspect member monthly contributions and group fund credits.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasPermission('contributions.due_list.view') && (
            <Link
              href="/contributions/due-list"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <Calendar className="w-3.5 h-3.5" /> Due List
            </Link>
          )}
          {hasPermission('contribution_reports.view') && (
            <Link
              href="/contributions/report"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Report
            </Link>
          )}
          {hasPermission('contributions.create') && (
            <Link
              href="/contributions/add"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Contribution
            </Link>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between gap-2 border border-emerald-500/20">
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
        <div className="p-3.5 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-2 border border-destructive/20 w-full min-w-0">
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
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">৳{totalFilteredAmount} BDT</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Receipts</span>
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">{total}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Active Filter</span>
            <div className="text-xs text-foreground font-medium mt-0.5 truncate max-w-[200px]">
              {groupFilter ? `Group #${groupFilter}` : 'All Groups'} &bull; {yearFilter || 'All Years'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-500/10 text-muted-foreground flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative w-full sm:flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Receipt (MC-0001), Member, Group, or Batch Ref..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={groupFilter}
              onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

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

        {/* Date Filter Row */}
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

          {(startDate || endDate || paymentMethodFilter || groupFilter || yearFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPaymentMethodFilter('');
                setGroupFilter('');
                setYearFilter('');
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

      {/* Contributions Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[840px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Receipt ID</th>
                <th className="py-3 px-3 sm:px-4">Member</th>
                <th className="py-3 px-3 sm:px-4">Group</th>
                <th className="py-3 px-3 sm:px-4">Year & Months</th>
                <th className="py-3 px-3 sm:px-4">Amount</th>
                <th className="py-3 px-3 sm:px-4">Payment Date</th>
                <th className="py-3 px-3 sm:px-4">Method</th>
                <th className="py-3 px-3 sm:px-4 hidden lg:table-cell">Batch Ref</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading contribution records...</p>
                  </td>
                </tr>
              ) : contributions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">No contribution receipts found</p>
                    <p className="text-[11px] mt-0.5">Use &quot;Add Contribution&quot; to collect member contributions.</p>
                  </td>
                </tr>
              ) : (
                contributions.map((c) => {
                  const monthsText = c.paid_months && c.paid_months.length > 0
                    ? c.paid_months.map((m: number) => MONTH_NAMES[m - 1]?.substring(0, 3) || m).join(', ')
                    : 'None';

                  return (
                    <tr key={c.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 sm:px-4 font-mono font-bold text-primary">
                        {c.receipt_id}
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                        <div>{c.member_name}</div>
                        <span className="text-[10px] text-muted-foreground font-mono">{c.member_code}</span>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary" title={c.group_name}>
                          {c.group_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-foreground">{c.contribution_year}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={monthsText}>
                          {monthsText} ({c.paid_months?.length || 0} mos)
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-mono font-bold text-foreground">
                        ৳{Number(c.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                        {c.payment_date ? new Date(c.payment_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10 text-foreground">
                          {c.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 hidden lg:table-cell font-mono text-[11px] text-muted-foreground">
                        {c.batch_reference ? (
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground" title={c.batch_reference}>
                            {c.batch_reference}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            c.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewContribution(c)}
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {c.status === 'COMPLETED' && hasPermission('contributions.cancel') && (
                            <button
                              onClick={() => handleOpenCancel(c)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Cancel Receipt"
                              aria-label="Cancel Receipt"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3 px-3 sm:px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-muted-foreground w-full">
          <span className="text-center sm:text-left">
            Showing {contributions.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
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

      {/* View Contribution Details Modal */}
      {viewContribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Contribution Receipt Details</h3>
                <span className="font-mono text-xs text-primary font-bold">
                  {viewContribution.receipt_id}
                </span>
              </div>
              <button
                onClick={() => setViewContribution(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Member</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {viewContribution.member_name} ({viewContribution.member_code})
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Target Group Fund</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {viewContribution.group_name} ({viewContribution.group_code})
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Total Paid Amount</span>
                <span className="font-bold text-base font-mono text-foreground mt-0.5 block">
                  ৳{Number(viewContribution.total_amount).toFixed(2)} BDT
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Payment Method</span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {viewContribution.payment_method}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Payment Date</span>
                <span className="text-foreground mt-0.5 block">
                  {viewContribution.payment_date ? new Date(viewContribution.payment_date).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                  viewContribution.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {viewContribution.status}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Transaction Reference</span>
                <span className="font-mono text-foreground mt-0.5 block">
                  {viewContribution.transaction_reference || 'None'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Batch Reference</span>
                <span className="font-mono text-foreground mt-0.5 block">
                  {viewContribution.batch_reference || 'Individual Collection'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Recorded By</span>
                <span className="text-foreground mt-0.5 block">
                  {viewContribution.recorded_by_name || 'Staff User'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Recorded At</span>
                <span className="text-foreground mt-0.5 block">
                  {viewContribution.created_at ? new Date(viewContribution.created_at).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {/* Monthly Allocations Breakdown */}
            <div className="p-3 rounded-lg bg-background border border-border/50 space-y-2">
              <span className="text-[11px] font-semibold text-foreground block">
                Allocated Months ({viewContribution.contribution_year}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {viewContribution.month_allocations && viewContribution.month_allocations.length > 0 ? (
                  viewContribution.month_allocations.map((a: any) => (
                    <span key={a.id} className="px-2 py-1 rounded bg-muted font-mono text-[11px] text-foreground">
                      {a.month_name}: ৳{Number(a.amount).toFixed(2)} ({a.status})
                    </span>
                  ))
                ) : (
                  viewContribution.paid_months?.map((m: number) => (
                    <span key={m} className="px-2 py-1 rounded bg-muted font-mono text-[11px] text-foreground">
                      {MONTH_NAMES[m - 1]}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Notes if present */}
            {viewContribution.notes && (
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <span className="text-[11px] text-muted-foreground block">Notes</span>
                <span className="text-foreground mt-0.5 block">{viewContribution.notes}</span>
              </div>
            )}

            {/* Cancellation info if cancelled */}
            {viewContribution.status === 'CANCELLED' && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Cancellation Record
                </div>
                <div>Reason: {viewContribution.cancel_reason}</div>
                <div className="text-[10px] text-muted-foreground">
                  Cancelled by: {viewContribution.cancelled_by_name || 'Admin'} on {viewContribution.cancelled_at ? new Date(viewContribution.cancelled_at).toLocaleString() : 'N/A'}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewContribution(null)}
                className="px-4 py-2 rounded-lg border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Contribution Modal */}
      {cancelContribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md bg-card border border-destructive/30 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                <Ban className="w-4 h-4" /> Cancel Contribution Receipt
              </h3>
              <button
                onClick={() => setCancelContribution(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground leading-relaxed">
              Are you sure you want to cancel contribution receipt <strong className="font-mono text-primary font-bold">{cancelContribution.receipt_id}</strong> for <strong className="text-foreground">{cancelContribution.member_name}</strong>?
            </p>

            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] leading-relaxed">
              <strong>Financial Impact:</strong> This action will mark all month allocations as Cancelled and post an atomic reversal in the <strong>{cancelContribution.group_name}</strong> Fund ledger.
            </div>

            {cancelError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the audit reason for this cancellation (e.g. Member deposited wrong amount, duplicate entry, etc.)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-destructive text-foreground resize-y"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setCancelContribution(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
                >
                  Keep Receipt
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shadow-xs"
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

export default function ManageContributionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading contributions...</div>}>
      <ManageContributionsContent />
    </Suspense>
  );
}
