'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Landmark, 
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
  ShieldAlert, 
  RotateCcw,
  Clock,
  User,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type FundingAllocation = {
  id: number;
  group_id: number;
  group_code: string;
  group_name: string;
  amount: string | number;
  created_at: string;
};

type ScheduleItem = {
  id: number;
  installment_number: number;
  due_date: string;
  principal_due: string | number;
  principal_paid: string | number;
  status: string;
  is_overdue: boolean;
};

type RepaymentGroupAllocation = {
  id: number;
  group_id: number;
  group_code: string;
  group_name: string;
  amount: string | number;
};

type RepaymentItem = {
  id: number;
  receipt_id: string;
  loan_id: number;
  loan_code: string;
  beneficiary_id: number;
  beneficiary_code: string;
  beneficiary_name: string;
  repayment_date: string;
  amount: string | number;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
  status: string;
  recorded_by_name?: string;
  allocations: RepaymentGroupAllocation[];
  created_at: string;
};

type QardHasanLoan = {
  id: number;
  loan_id: string;
  loan_date: string;
  principal_amount: string | number;
  amount_repaid: string | number;
  outstanding_principal: string | number;
  repayment_arrangement: string;
  first_due_date?: string;
  expected_completion_date?: string;
  next_due_date?: string;
  purpose?: string;
  internal_reference?: string;
  notes?: string;
  status: string;
  beneficiary: {
    id: number;
    beneficiary_id: string;
    name: string;
    phone?: string;
  };
  funding_allocations: FundingAllocation[];
  schedules: ScheduleItem[];
  repayments: RepaymentItem[];
  recorded_by_id: number;
  recorded_by_name?: string;
  cancelled_at?: string;
  cancelled_by_id?: number;
  cancelled_by_name?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
};

export default function ManageQardHasanPage() {
  const { hasPermission } = useAuth();

  // Loans list state
  const [items, setItems] = useState<QardHasanLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDisbursedSum, setTotalDisbursedSum] = useState<string | number>('0.00');
  const [totalRepaidSum, setTotalRepaidSum] = useState<string | number>('0.00');
  const [totalOutstandingSum, setTotalOutstandingSum] = useState<string | number>('0.00');
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

  // Filter dropdown options
  const [groups, setGroups] = useState<{ id: number; code: string; name: string }[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<{ id: number; beneficiary_id: string; name: string }[]>([]);

  // Modals state
  const [detailModalItem, setDetailModalItem] = useState<QardHasanLoan | null>(null);
  const [cancelModalItem, setCancelModalItem] = useState<QardHasanLoan | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Fetch Filter Options once
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [gRes, bRes] = await Promise.all([
          fetch('/api/groups', { credentials: 'include' }),
          fetch('/api/beneficiaries?limit=200', { credentials: 'include' })
        ]);
        if (gRes.ok) {
          const gData = await gRes.json();
          setGroups(gData.items || gData || []);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBeneficiaries(bData.items || []);
        }
      } catch (err) {
        console.error('Error fetching filter dropdown options', err);
      }
    }
    loadFilterOptions();
  }, []);

  // Fetch Loans with current filters
  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (selectedGroupId) params.append('group_id', selectedGroupId);
      if (selectedBeneficiaryId) params.append('beneficiary_id', selectedBeneficiaryId);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);

      const res = await fetch(`/api/qard-hasan?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to fetch Qard Hasan loans.');
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setTotalDisbursedSum(data.total_disbursed_sum || '0.00');
      setTotalRepaidSum(data.total_repaid_sum || '0.00');
      setTotalOutstandingSum(data.total_outstanding_sum || '0.00');
    } catch (err: any) {
      console.error('Error loading loans', err);
      setErrorMsg(err.message || 'Error loading records.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, selectedGroupId, selectedBeneficiaryId, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Handle Cancel Loan
  const handleCancelLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalItem) return;
    if (!cancelReason.trim()) {
      alert('A cancellation reason is required.');
      return;
    }

    try {
      setCancelling(true);
      const res = await fetch(`/api/qard-hasan/${cancelModalItem.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancel_reason: cancelReason.trim() })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to cancel loan.');
      }

      setActionSuccessMsg(`Loan ${cancelModalItem.loan_id} has been safely cancelled and funds restored to funding groups.`);
      setCancelModalItem(null);
      setCancelReason('');
      fetchLoans();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  // Reset Filters
  const resetFilters = () => {
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

  if (!hasPermission('qard_hasan.view')) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-12 h-12 mb-3 text-destructive/80" strokeWidth={1.5} />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm mt-1 max-w-md">You do not have permission to view Qard Hasan records. Please contact an administrator.</p>
          <Link href="/" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Manage Qard Hasan
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Administer interest-free loans, inspect funding group ledgers, and track repayment milestones.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasPermission('qard_hasan.create') && (
            <Link
              href="/qard-hasan/add"
              className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Qard Hasan</span>
            </Link>
          )}
          {hasPermission('qard_hasan.repayment.create') && (
            <Link
              href="/qard-hasan/repayment"
              className="px-3.5 py-2 rounded-lg border border-border/70 hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Wallet className="w-4 h-4 text-primary" />
              <span>Record Repayment</span>
            </Link>
          )}
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-medium flex-1">{errorMsg}</div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Disbursed
          </span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            ৳{parseFloat(String(totalDisbursedSum)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Across active & completed loans
          </span>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Total Repaid
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ৳{parseFloat(String(totalRepaidSum)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Credited back into group funds
          </span>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Total Outstanding
          </span>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            ৳{parseFloat(String(totalOutstandingSum)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Remaining principal balance
          </span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search loan ID, beneficiary, ref..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
            >
              <option value="">All Funding Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} - {g.name}
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Partially Repaid">Partially Repaid</option>
              <option value="Fully Repaid">Fully Repaid</option>
              <option value="Cancelled">Cancelled</option>
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
            >
              <option value="">All Beneficiaries</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.beneficiary_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range and Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Loan Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-background border border-border rounded-md text-xs focus:outline-hidden focus:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-background border border-border rounded-md text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Loan ID</th>
                <th className="px-4 py-3">Beneficiary</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Principal (৳)</th>
                <th className="px-4 py-3">Repaid (৳)</th>
                <th className="px-4 py-3">Outstanding (৳)</th>
                <th className="px-4 py-3">Funding Groups</th>
                <th className="px-4 py-3">Next Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                      <span>Loading Qard Hasan loans...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Landmark className="w-8 h-8 text-muted-foreground/40 mb-2" />
                      <p className="font-medium text-foreground">No loans found</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {searchQuery || selectedGroupId || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or filters.'
                          : 'No Qard Hasan loans have been issued yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((loan) => {
                  const principal = parseFloat(String(loan.principal_amount)) || 0;
                  const repaid = parseFloat(String(loan.amount_repaid)) || 0;
                  const outstanding = parseFloat(String(loan.outstanding_principal)) || 0;
                  const canCancel = hasPermission('qard_hasan.cancel') && loan.status !== 'Cancelled' && repaid === 0 && loan.status !== 'Fully Repaid';

                  // Determine status badge color
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {loan.status}
                    </span>
                  );
                  if (loan.status === 'Cancelled') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        Cancelled
                      </span>
                    );
                  } else if (loan.status === 'Partially Repaid') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Partially Repaid
                      </span>
                    );
                  } else if (loan.status === 'Fully Repaid') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Fully Repaid
                      </span>
                    );
                  }

                  return (
                    <tr key={loan.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {loan.loan_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{loan.beneficiary?.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {loan.beneficiary?.beneficiary_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {loan.loan_date}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">
                        ৳{principal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        ৳{repaid.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400 font-bold">
                        ৳{outstanding.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {loan.funding_allocations.map((fa) => (
                            <span
                              key={fa.id}
                              className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-foreground"
                              title={`${fa.group_name}: ৳${parseFloat(String(fa.amount)).toFixed(2)}`}
                            >
                              {fa.group_code} (৳{parseFloat(String(fa.amount)).toFixed(0)})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {loan.next_due_date ? (
                          <div className="flex flex-col">
                            <span className="text-foreground">{loan.next_due_date}</span>
                            {new Date(loan.next_due_date) < new Date() && loan.status !== 'Fully Repaid' && loan.status !== 'Cancelled' && (
                              <span className="text-[9px] text-destructive font-semibold flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailModalItem(loan)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {loan.status !== 'Fully Repaid' && loan.status !== 'Cancelled' && hasPermission('qard_hasan.repayment.create') && (
                            <Link
                              href={`/qard-hasan/repayment?loan_id=${loan.id}`}
                              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                              title="Record Repayment"
                            >
                              <Wallet className="w-4 h-4" />
                            </Link>
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelModalItem(loan);
                                setCancelReason('');
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Cancel Loan & Reverse Funds"
                            >
                              <Ban className="w-4 h-4" />
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

        {/* Server Pagination */}
        <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{items.length}</strong> of{' '}
            <strong className="text-foreground">{total}</strong> total loans
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-mono px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {detailModalItem && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-100" onClick={() => setDetailModalItem(null)} />
          <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl bg-card border border-border rounded-xl shadow-2xl z-50 overflow-y-auto max-h-[90vh] p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Loan Details — <span className="font-mono text-primary">{detailModalItem.loan_id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border border-border/40 text-center text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Principal</span>
                <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                  ৳{parseFloat(String(detailModalItem.principal_amount)).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Repaid</span>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ৳{parseFloat(String(detailModalItem.amount_repaid)).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Outstanding</span>
                <div className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                  ৳{parseFloat(String(detailModalItem.outstanding_principal)).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Beneficiary & Loan Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Beneficiary:</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {detailModalItem.beneficiary?.name} ({detailModalItem.beneficiary?.beneficiary_id})
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Loan Date:</span>
                <p className="font-semibold text-foreground mt-0.5">{detailModalItem.loan_date}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Arrangement:</span>
                <p className="font-semibold text-foreground mt-0.5">{detailModalItem.repayment_arrangement}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-semibold text-foreground mt-0.5">{detailModalItem.status}</p>
              </div>
              {detailModalItem.purpose && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Purpose:</span>
                  <p className="font-medium text-foreground mt-0.5">{detailModalItem.purpose}</p>
                </div>
              )}
              {detailModalItem.internal_reference && (
                <div>
                  <span className="text-muted-foreground">Internal Reference:</span>
                  <p className="font-mono text-foreground mt-0.5">{detailModalItem.internal_reference}</p>
                </div>
              )}
              {detailModalItem.recorded_by_name && (
                <div>
                  <span className="text-muted-foreground">Recorded By:</span>
                  <p className="font-medium text-foreground mt-0.5">{detailModalItem.recorded_by_name}</p>
                </div>
              )}
            </div>

            {/* Funding Group Allocations */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Funding Group Allocations
              </h4>
              <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/40 text-xs">
                {detailModalItem.funding_allocations.map(fa => (
                  <div key={fa.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">{fa.group_name}</span>
                      <span className="text-muted-foreground font-mono ml-1.5">({fa.group_code})</span>
                    </div>
                    <span className="font-mono font-bold text-foreground">
                      ৳{parseFloat(String(fa.amount)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repayment Schedules */}
            {detailModalItem.schedules.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Repayment Schedule
                </h4>
                <div className="border border-border/60 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-3 py-1.5">#</th>
                        <th className="px-3 py-1.5">Due Date</th>
                        <th className="px-3 py-1.5">Principal Due</th>
                        <th className="px-3 py-1.5">Principal Paid</th>
                        <th className="px-3 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {detailModalItem.schedules.map(s => (
                        <tr key={s.id} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">#{s.installment_number}</td>
                          <td className="px-3 py-1.5 text-foreground">{s.due_date}</td>
                          <td className="px-3 py-1.5 font-mono">৳{parseFloat(String(s.principal_due)).toFixed(2)}</td>
                          <td className="px-3 py-1.5 font-mono text-emerald-600">৳{parseFloat(String(s.principal_paid)).toFixed(2)}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              s.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' :
                              s.is_overdue ? 'bg-destructive/10 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {s.is_overdue && s.status !== 'Paid' ? 'Overdue' : s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Repayments History */}
            {detailModalItem.repayments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  Repayment Receipts ({detailModalItem.repayments.length})
                </h4>
                <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/40 text-xs">
                  {detailModalItem.repayments.map(r => (
                    <div key={r.id} className="p-2.5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{r.receipt_id}</span>
                          <span className="text-[11px] text-muted-foreground">• {r.repayment_date}</span>
                          <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] text-muted-foreground">
                            {r.payment_method}
                          </span>
                        </div>
                        {r.transaction_reference && (
                          <span className="text-[10px] text-muted-foreground">Ref: {r.transaction_reference}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{parseFloat(String(r.amount)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cancel Loan Modal */}
      {cancelModalItem && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-100" onClick={() => setCancelModalItem(null)} />
          <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-card border border-border rounded-xl shadow-2xl z-50 p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-destructive">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold text-foreground">
                  Cancel Loan <span className="font-mono">{cancelModalItem.loan_id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>Warning:</strong> Cancelling will reverse the loan disbursement. The principal amount of{' '}
                <strong>৳{parseFloat(String(cancelModalItem.principal_amount)).toFixed(2)}</strong> will be restored back into participating group fund accounts, and an offsetting reversal entry will be written to the beneficiary ledger.
              </p>
            </div>

            <form onSubmit={handleCancelLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this loan is being cancelled..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-destructive"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalItem(null)}
                  className="px-3.5 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={cancelling || !cancelReason.trim()}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {cancelling ? 'Reversing...' : 'Confirm Reversal & Cancel'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
