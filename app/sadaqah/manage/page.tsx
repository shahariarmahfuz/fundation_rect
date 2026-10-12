'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  HandHeart, 
  Search, 
  Filter, 
  Calendar, 
  PlusCircle, 
  Receipt, 
  Eye, 
  Ban, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  UsersRound, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ArrowUpRight, 
  ShieldAlert, 
  FileSpreadsheet, 
  RotateCcw,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type SadaqahAllocationItem = {
  id: number;
  group_id: number;
  group_code: string;
  group_name: string;
  amount: string;
  created_at: string;
};

type SadaqahBeneficiaryItem = {
  id: number;
  beneficiary_id: string;
  name: string;
  phone?: string;
};

type SadaqahTransaction = {
  id: number;
  sadaqah_id: string;
  sadaqah_date: string;
  total_amount: string;
  purpose?: string;
  notes?: string;
  status: string;
  beneficiary: SadaqahBeneficiaryItem;
  allocations: SadaqahAllocationItem[];
  recorded_by_id: number;
  recorded_by_name: string;
  cancelled_at?: string;
  cancelled_by_id?: number;
  cancelled_by_name?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
};

export default function ManageSadaqahPage() {
  const { hasPermission } = useAuth();

  // Transactions list state
  const [items, setItems] = useState<SadaqahTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmountSum, setTotalAmountSum] = useState<string>('0.00');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filter options
  const [groups, setGroups] = useState<{ id: number; code: string; name: string }[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<{ id: number; beneficiary_id: string; name: string }[]>([]);

  // Modals state
  const [detailModalItem, setDetailModalItem] = useState<SadaqahTransaction | null>(null);
  const [cancelModalItem, setCancelModalItem] = useState<SadaqahTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load filter options (groups & beneficiaries)
  useEffect(() => {
    async function loadOptions() {
      try {
        const [gRes, bRes] = await Promise.all([
          fetch('/api/groups?limit=100', { credentials: 'include' }),
          fetch('/api/beneficiaries?limit=100', { credentials: 'include' })
        ]);
        if (gRes.ok) {
          const gData = await gRes.json();
          setGroups(gData.items || []);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBeneficiaries(bData.items || []);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, []);

  // Fetch transactions list
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGroupId) params.append('group_id', selectedGroupId);
      if (selectedBeneficiaryId) params.append('beneficiary_id', selectedBeneficiaryId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/sadaqah?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing sadaqah.view permission.');
        throw new Error('Failed to load Sadaqah transactions');
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setTotalAmountSum(data.total_amount_sum || '0.00');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while loading transactions.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, startDate, endDate, selectedGroupId, selectedBeneficiaryId, statusFilter, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedGroupId('');
    setSelectedBeneficiaryId('');
    setStatusFilter('ALL');
    setSortBy('date');
    setSortOrder('desc');
    setPage(1);
  };

  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalItem || !cancelReason.trim()) return;

    try {
      setCancelling(true);
      setErrorMsg(null);

      const res = await fetch(`/api/sadaqah/${cancelModalItem.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancel_reason: cancelReason.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to cancel Sadaqah transaction.');
      }

      const updated = await res.json();
      setActionSuccessMsg(`Transaction ${updated.sadaqah_id} has been cancelled and reversed successfully.`);
      setCancelModalItem(null);
      setCancelReason('');
      fetchTransactions();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (!hasPermission('sadaqah.view')) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Access Denied: You do not possess the &quot;sadaqah.view&quot; permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <HandHeart className="w-3.5 h-3.5" />
              Sadaqah Directory
            </span>
            <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50">
              {total} Total Records
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Manage Sadaqah</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit and track verified Sadaqah disbursements, per-group allocations, and reversals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasPermission('sadaqah.create') && (
            <Link
              href="/sadaqah/add"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Sadaqah</span>
            </Link>
          )}
          {hasPermission('sadaqah_reports.view') && (
            <Link
              href="/sadaqah/report"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-medium border border-border rounded-xl bg-card hover:bg-muted/50 transition-colors shadow-xs"
            >
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <span>View Report</span>
            </Link>
          )}
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <HandHeart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Completed Disbursements</span>
            <span className="text-lg md:text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              ৳{parseFloat(totalAmountSum).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Matching Transactions</span>
            <span className="text-lg md:text-xl font-bold text-foreground font-mono">
              {total}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/50">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Contributing Groups</span>
            <span className="text-lg md:text-xl font-bold text-foreground font-mono">
              {groups.length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Query */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Sadaqah ID (S-0001) or beneficiary name/ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>

          {/* Group Filter */}
          <div>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs md:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="">All Funding Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Beneficiary Filter */}
          <div>
            <select
              value={selectedBeneficiaryId}
              onChange={(e) => {
                setSelectedBeneficiaryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs md:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="">All Beneficiaries</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>
                  {b.beneficiary_id} — {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs md:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1 bg-background border border-border rounded-lg text-xs"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1 bg-background border border-border rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-muted-foreground hover:text-foreground flex items-center gap-1 hover:bg-muted rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-card border border-border/70 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">Loading Sadaqah records from PostgreSQL...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-foreground">Error loading transactions</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-muted-foreground">
            <HandHeart className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">No Sadaqah transactions found</p>
            <p className="text-xs">Adjust your search or filter parameters to view transactions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Sadaqah ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4">Funding Groups</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((tx) => {
                  const isCompleted = tx.status === 'COMPLETED';
                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-muted/30 transition-colors ${
                        !isCompleted ? 'bg-destructive/5 opacity-80' : ''
                      }`}
                    >
                      {/* Sadaqah ID */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {tx.sadaqah_id}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {tx.sadaqah_date}
                      </td>

                      {/* Beneficiary */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground truncate max-w-[180px]">
                          {tx.beneficiary?.name}
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {tx.beneficiary?.beneficiary_id}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        <span className={isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'line-through text-muted-foreground'}>
                          ৳{parseFloat(tx.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Funding Groups */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {tx.allocations?.map(a => (
                            <span 
                              key={a.id} 
                              className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono border border-border/50 whitespace-nowrap"
                              title={`${a.group_name}: ৳${parseFloat(a.amount).toLocaleString()}`}
                            >
                              {a.group_code}: ৳{parseFloat(a.amount).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Recorded By */}
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {tx.recorded_by_name}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>COMPLETED</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3 h-3" />
                              <span>CANCELLED</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailModalItem(tx)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            title="View Transaction Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isCompleted && hasPermission('sadaqah.cancel') && (
                            <button
                              onClick={() => {
                                setCancelModalItem(tx);
                                setCancelReason('');
                              }}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Cancel / Reverse Transaction"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && items.length > 0 && (
          <div className="p-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> transactions
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-medium text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <HandHeart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Sadaqah Distribution Details
                  </h3>
                  <span className="text-xs font-mono font-semibold text-primary">
                    {detailModalItem.sadaqah_id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Overview Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/50">
              <div>
                <span className="text-muted-foreground block">Status</span>
                <span className={`font-semibold ${detailModalItem.status === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                  {detailModalItem.status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Date</span>
                <span className="font-semibold text-foreground">{detailModalItem.sadaqah_date}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Total Amount</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  ৳{parseFloat(detailModalItem.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Recorded By</span>
                <span className="font-medium text-foreground">{detailModalItem.recorded_by_name}</span>
              </div>
            </div>

            {/* Beneficiary Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Beneficiary Information
              </h4>
              <div className="p-3 rounded-xl border border-border/60 bg-card text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-muted-foreground block">ID:</span>
                  <span className="font-mono font-bold text-primary">{detailModalItem.beneficiary?.beneficiary_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Name:</span>
                  <span className="font-semibold text-foreground">{detailModalItem.beneficiary?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Phone:</span>
                  <span className="font-mono text-muted-foreground">{detailModalItem.beneficiary?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Per-Group Allocations Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Group Fund Allocation Breakdown
              </h4>
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground">
                    <tr>
                      <th className="py-2 px-3">Group Code</th>
                      <th className="py-2 px-3">Group Name</th>
                      <th className="py-2 px-3 text-right">Allocated Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {detailModalItem.allocations?.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono font-bold text-foreground">{a.group_code}</td>
                        <td className="py-2 px-3 text-muted-foreground">{a.group_name}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          ৳{parseFloat(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-bold border-t border-border/60">
                      <td colSpan={2} className="py-2 px-3 text-right text-muted-foreground">Total Allocated:</td>
                      <td className="py-2 px-3 text-right font-mono text-foreground text-sm">
                        ৳{parseFloat(detailModalItem.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purpose & Notes */}
            {(detailModalItem.purpose || detailModalItem.notes) && (
              <div className="space-y-2 text-xs">
                {detailModalItem.purpose && (
                  <div>
                    <span className="text-muted-foreground block font-semibold">Purpose:</span>
                    <p className="text-foreground p-2 bg-muted/20 rounded-lg">{detailModalItem.purpose}</p>
                  </div>
                )}
                {detailModalItem.notes && (
                  <div>
                    <span className="text-muted-foreground block font-semibold">Internal Notes:</span>
                    <p className="text-foreground p-2 bg-muted/20 rounded-lg">{detailModalItem.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Cancellation Details if Cancelled */}
            {detailModalItem.status === 'CANCELLED' && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl space-y-1.5 text-xs text-destructive">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Cancellation Reversal Record</span>
                </div>
                <p>
                  Cancelled by <span className="font-semibold text-foreground">{detailModalItem.cancelled_by_name}</span> on{' '}
                  <span className="font-semibold text-foreground">{detailModalItem.cancelled_at}</span>.
                </p>
                <p className="italic bg-background/50 p-2 rounded border border-destructive/20">
                  Reason: &quot;{detailModalItem.cancel_reason}&quot;
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form 
            onSubmit={handleExecuteCancel}
            className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3.5 text-destructive pb-2 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-foreground">
                  Cancel Sadaqah Distribution
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {cancelModalItem.sadaqah_id} — ৳{parseFloat(cancelModalItem.total_amount).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="text-xs space-y-2 text-muted-foreground bg-destructive/5 p-3 rounded-xl border border-destructive/20">
              <p className="font-semibold text-destructive">Financial Reversal Warning:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Allocated amounts will be refunded back to the respective Group Fund ledgers.</li>
                <li>A reversal transaction will be recorded in the Beneficiary Ledger.</li>
                <li>The original transaction is preserved with full audit trail.</li>
                <li>This action cannot be undone.</li>
              </ul>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-foreground uppercase tracking-wider block">
                Reason for Cancellation <span className="text-destructive">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="State the reason for cancelling this distribution (e.g. Duplicate entry, returned funds, administrative error)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-destructive text-xs shadow-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalItem(null)}
                className="px-3.5 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Keep Active
              </button>
              <button
                type="submit"
                disabled={cancelling || !cancelReason.trim()}
                className="px-4 py-2 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {cancelling ? (
                  <span>Reversing Funds...</span>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Reversal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
