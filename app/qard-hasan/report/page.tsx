'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Calendar, 
  Filter, 
  Landmark, 
  Building2, 
  UsersRound, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Ban, 
  Wallet,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type GroupDisbursement = {
  group_id: number;
  group_code: string;
  group_name: string;
  total_disbursed: string | number;
  transaction_count: number;
};

type GroupRepayment = {
  group_id: number;
  group_code: string;
  group_name: string;
  total_repaid: string | number;
  transaction_count: number;
};

type BeneficiarySummary = {
  beneficiary_id: number;
  beneficiary_code: string;
  beneficiary_name: string;
  total_principal: string | number;
  total_repaid: string | number;
  outstanding_principal: string | number;
  loan_count: number;
  active_loans: number;
};

type QardHasanReportData = {
  total_principal_disbursed: string | number;
  total_principal_repaid: string | number;
  total_outstanding_principal: string | number;
  total_overdue_principal: string | number;
  active_loans_count: number;
  fully_repaid_loans_count: number;
  cancelled_loans_count: number;
  total_loans_count: number;
  start_date?: string;
  end_date?: string;
  disbursements_by_group: GroupDisbursement[];
  repayments_by_group: GroupRepayment[];
  beneficiary_balances: BeneficiarySummary[];
};

export default function QardHasanReportPage() {
  const { hasPermission } = useAuth();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown options
  const [groups, setGroups] = useState<{ id: number; code: string; name: string }[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<{ id: number; beneficiary_id: string; name: string }[]>([]);

  // Report Data
  const [reportData, setReportData] = useState<QardHasanReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load filter dropdown options
  useEffect(() => {
    async function loadOptions() {
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
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, []);

  // Fetch Report Data
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGroupId) params.append('group_id', selectedGroupId);
      if (selectedBeneficiaryId) params.append('beneficiary_id', selectedBeneficiaryId);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/qard-hasan/report/summary?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to load Qard Hasan report.');
      }

      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      console.error('Error fetching report', err);
      setErrorMsg(err.message || 'Error loading report metrics.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedGroupId, selectedBeneficiaryId, statusFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedGroupId('');
    setSelectedBeneficiaryId('');
    setStatusFilter('');
  };

  // Export CSV
  const exportToCSV = () => {
    if (!reportData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Principal Disbursed (৳)', reportData.total_principal_disbursed],
      ['Total Principal Repaid (৳)', reportData.total_principal_repaid],
      ['Total Outstanding Principal (৳)', reportData.total_outstanding_principal],
      ['Overdue Principal (৳)', reportData.total_overdue_principal],
      ['Active Loans Count', reportData.active_loans_count],
      ['Fully Repaid Loans Count', reportData.fully_repaid_loans_count],
      ['Cancelled Loans Count', reportData.cancelled_loans_count],
      [],
      ['Group Disbursements', 'Group Code', 'Group Name', 'Disbursed (৳)', 'Loan Count'],
      ...reportData.disbursements_by_group.map(g => [
        '', g.group_code, g.group_name, g.total_disbursed, g.transaction_count
      ]),
      [],
      ['Group Repayments', 'Group Code', 'Group Name', 'Repaid (৳)', 'Receipt Count'],
      ...reportData.repayments_by_group.map(g => [
        '', g.group_code, g.group_name, g.total_repaid, g.transaction_count
      ]),
      [],
      ['Beneficiary Balances', 'Beneficiary ID', 'Name', 'Disbursed (৳)', 'Repaid (৳)', 'Outstanding (৳)', 'Active Loans'],
      ...reportData.beneficiary_balances.map(b => [
        '', b.beneficiary_code, b.beneficiary_name, b.total_principal, b.total_repaid, b.outstanding_principal, b.active_loans
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `qard_hasan_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasPermission('qard_hasan_reports.view')) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-12 h-12 mb-3 text-destructive/80" strokeWidth={1.5} />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm mt-1 max-w-md">You do not have permission to view Qard Hasan financial reports. Please contact an administrator.</p>
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
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Qard Hasan Report
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Principal disbursement analytics, group capital recovery, and overdue risk monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={!reportData || loading}
            className="px-3.5 py-2 rounded-lg border border-border/70 hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>
          <Link
            href="/qard-hasan/manage"
            className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-colors"
          >
            Manage Loans
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-medium flex-1">{errorMsg}</div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Funding Group</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">All Funding Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Beneficiary</label>
            <select
              value={selectedBeneficiaryId}
              onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">All Beneficiaries</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.beneficiary_id})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-background border border-border rounded-md text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">Active & Completed</option>
              <option value="Active">Active</option>
              <option value="Partially Repaid">Partially Repaid</option>
              <option value="Fully Repaid">Fully Repaid</option>
              <option value="Cancelled">Cancelled Only</option>
            </select>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Disbursed */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Principal Disbursed
          </span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            ৳{parseFloat(String(reportData?.total_principal_disbursed || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {reportData?.active_loans_count || 0} active • {reportData?.fully_repaid_loans_count || 0} fully repaid
          </span>
        </div>

        {/* Repaid */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Principal Repaid
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ৳{parseFloat(String(reportData?.total_principal_repaid || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Returned to group accounts
          </span>
        </div>

        {/* Outstanding */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Outstanding Principal
          </span>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            ৳{parseFloat(String(reportData?.total_outstanding_principal || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Remaining uncollected capital
          </span>
        </div>

        {/* Overdue */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            Overdue Principal
          </span>
          <div className="text-2xl font-bold font-mono text-destructive mt-1">
            ৳{parseFloat(String(reportData?.total_overdue_principal || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Past agreed installment due dates
          </span>
        </div>
      </div>

      {/* Group Level Analytics (Disbursements & Repayments) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disbursements by Group */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
            <Building2 className="w-4 h-4 text-primary" />
            Disbursements by Funding Group
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Total Disbursed (৳)</th>
                  <th className="px-3 py-2 text-right">Loans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!reportData?.disbursements_by_group.length ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No group disbursements recorded.
                    </td>
                  </tr>
                ) : (
                  reportData.disbursements_by_group.map((g) => (
                    <tr key={g.group_id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {g.group_code} — {g.group_name}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        ৳{parseFloat(String(g.total_disbursed)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {g.transaction_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Repayments by Group */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            Repayments Received by Group
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Total Repaid (৳)</th>
                  <th className="px-3 py-2 text-right">Receipts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!reportData?.repayments_by_group.length ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No repayments recorded for groups yet.
                    </td>
                  </tr>
                ) : (
                  reportData.repayments_by_group.map((g) => (
                    <tr key={g.group_id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {g.group_code} — {g.group_name}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{parseFloat(String(g.total_repaid)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {g.transaction_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Beneficiary Wise Balances Table */}
      <div className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
          <UsersRound className="w-4 h-4 text-primary" />
          Beneficiary-Wise Loan Balances
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-2.5">Beneficiary</th>
                <th className="px-4 py-2.5">Total Disbursed (৳)</th>
                <th className="px-4 py-2.5">Total Repaid (৳)</th>
                <th className="px-4 py-2.5">Outstanding Balance (৳)</th>
                <th className="px-4 py-2.5 text-right">Active Loans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {!reportData?.beneficiary_balances.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No beneficiary loan transactions found for current filter.
                  </td>
                </tr>
              ) : (
                reportData.beneficiary_balances.map((b) => (
                  <tr key={b.beneficiary_id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{b.beneficiary_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{b.beneficiary_code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground font-semibold">
                      ৳{parseFloat(String(b.total_principal)).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ৳{parseFloat(String(b.total_repaid)).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                      ৳{parseFloat(String(b.outstanding_principal)).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">
                      {b.active_loans} / {b.loan_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
