'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Calendar, 
  Filter, 
  HandHeart, 
  Building2, 
  UsersRound, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  DollarSign, 
  CheckCircle2, 
  Ban, 
  TrendingUp,
  Receipt,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type GroupDistribution = {
  group_id: number;
  group_code: string;
  group_name: string;
  total_amount: string;
  percentage: number;
  transaction_count: number;
};

type BeneficiaryDistribution = {
  beneficiary_id: number;
  beneficiary_code: string;
  beneficiary_name: string;
  total_amount: string;
  transaction_count: number;
};

type PeriodicSummary = {
  period: string;
  total_amount: string;
  transaction_count: number;
};

type SadaqahReportData = {
  total_amount_distributed: string;
  total_transactions: number;
  average_amount: string;
  cancelled_count: number;
  cancelled_amount: string;
  start_date?: string;
  end_date?: string;
  by_group: GroupDistribution[];
  by_beneficiary: BeneficiaryDistribution[];
  periodic_summary: PeriodicSummary[];
};

export default function SadaqahReportPage() {
  const { hasPermission } = useAuth();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');

  // Dropdown options
  const [groups, setGroups] = useState<{ id: number; code: string; name: string }[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<{ id: number; beneficiary_id: string; name: string }[]>([]);

  // Report Data
  const [reportData, setReportData] = useState<SadaqahReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load filter dropdown options
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

  // Fetch report summary
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGroupId) params.append('group_id', selectedGroupId);
      if (selectedBeneficiaryId) params.append('beneficiary_id', selectedBeneficiaryId);

      const res = await fetch(`/api/sadaqah/report/summary?${params.toString()}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing sadaqah_reports.view permission.');
        throw new Error('Failed to load Sadaqah analytical report');
      }

      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while generating report.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedGroupId, selectedBeneficiaryId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedGroupId('');
    setSelectedBeneficiaryId('');
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!reportData) return;

    let csv = `Sadaqah Financial Analytics Report\n`;
    csv += `Generated At,${new Date().toISOString()}\n`;
    csv += `Period,${startDate || 'All Time'} to ${endDate || 'Present'}\n`;
    csv += `Total Distributed (BDT),${reportData.total_amount_distributed}\n`;
    csv += `Total Transactions,${reportData.total_transactions}\n`;
    csv += `Average Transaction (BDT),${reportData.average_amount}\n`;
    csv += `Cancelled Transactions,${reportData.cancelled_count}\n`;
    csv += `Cancelled Amount (BDT),${reportData.cancelled_amount}\n\n`;

    csv += `--- Group Funding Breakdown ---\n`;
    csv += `Group Code,Group Name,Allocated Amount (BDT),Percentage (%),Disbursements Count\n`;
    reportData.by_group.forEach(g => {
      csv += `"${g.group_code}","${g.group_name}",${g.total_amount},${g.percentage}%,${g.transaction_count}\n`;
    });

    csv += `\n--- Beneficiary Distribution Breakdown ---\n`;
    csv += `Beneficiary ID,Beneficiary Name,Total Received (BDT),Disbursements Count\n`;
    reportData.by_beneficiary.forEach(b => {
      csv += `"${b.beneficiary_code}","${b.beneficiary_name}",${b.total_amount},${b.transaction_count}\n`;
    });

    csv += `\n--- Periodic Breakdown ---\n`;
    csv += `Period (YYYY-MM),Total Distributed (BDT),Transactions Count\n`;
    reportData.periodic_summary.forEach(p => {
      csv += `"${p.period}",${p.total_amount},${p.transaction_count}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sadaqah_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasPermission('sadaqah_reports.view')) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Access Denied: You do not possess the &quot;sadaqah_reports.view&quot; permission.</p>
        </div>
      </div>
    );
  }

  const totalDist = reportData ? parseFloat(reportData.total_amount_distributed) : 0;
  const avgTicket = reportData ? parseFloat(reportData.average_amount) : 0;
  const cancelledAmt = reportData ? parseFloat(reportData.cancelled_amount) : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="w-3.5 h-3.5" />
              Financial Reporting
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Sadaqah Analytical Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregated audit reports of Sadaqah funds disbursed across groups and beneficiaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
            <span>Export CSV</span>
          </button>
          <Link
            href="/sadaqah/manage"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-medium border border-border rounded-xl bg-card hover:bg-muted/50 transition-colors shadow-xs"
          >
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <span>Manage Sadaqah</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              From Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              To Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
          </div>

          {/* Group Filter */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Funding Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="">All Funding Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>
          </div>

          {/* Beneficiary Filter */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Beneficiary
            </label>
            <select
              value={selectedBeneficiaryId}
              onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="">All Beneficiaries</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>{b.beneficiary_id} — {b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40 text-xs">
          <button
            onClick={handleResetFilters}
            className="px-2.5 py-1 text-muted-foreground hover:text-foreground flex items-center gap-1 hover:bg-muted rounded-lg transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Distributed</span>
              <HandHeart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              ৳{totalDist.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground block">Excludes cancelled transactions</span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Distributions Count</span>
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-foreground">
              {reportData.total_transactions}
            </div>
            <span className="text-[11px] text-muted-foreground block">Completed transactions</span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Average Disbursement</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-foreground">
              ৳{avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground block">Average ticket size</span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Cancelled Reversals</span>
              <Ban className="w-4 h-4 text-destructive" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-destructive">
              ৳{cancelledAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              {reportData.cancelled_count} reversed transactions
            </span>
          </div>
        </div>
      )}

      {/* Main Breakdown Sections */}
      {loading ? (
        <div className="p-16 text-center space-y-3 bg-card border border-border/70 rounded-2xl shadow-xs">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">Computing live SQL analytics across groups and ledgers...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center space-y-2 bg-card border border-border/70 rounded-2xl shadow-xs">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-foreground">Error generating report</p>
          <p className="text-xs text-muted-foreground">{errorMsg}</p>
        </div>
      ) : reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Group Distribution Table & Progress Bars */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Funding Distribution by Group</span>
              </h3>
              <span className="text-xs text-muted-foreground">{reportData.by_group.length} Groups</span>
            </div>

            {reportData.by_group.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No group allocations in this period.</p>
            ) : (
              <div className="space-y-3">
                {reportData.by_group.map((g) => (
                  <div key={g.group_id} className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{g.group_code}</span>
                        <span className="text-muted-foreground truncate max-w-[150px]">{g.group_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-foreground block">
                          ৳{parseFloat(g.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {g.percentage}% ({g.transaction_count} txs)
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, g.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Beneficiary Breakdown */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <UsersRound className="w-4 h-4 text-primary" />
                <span>Top Beneficiaries by Distributed Amount</span>
              </h3>
              <span className="text-xs text-muted-foreground">{reportData.by_beneficiary.length} Beneficiaries</span>
            </div>

            {reportData.by_beneficiary.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No beneficiary disbursements in this period.</p>
            ) : (
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Beneficiary</th>
                      <th className="py-2.5 px-3 text-center">Txs</th>
                      <th className="py-2.5 px-3 text-right">Total Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {reportData.by_beneficiary.map((b) => (
                      <tr key={b.beneficiary_id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-foreground block">{b.beneficiary_name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{b.beneficiary_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                          {b.transaction_count}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          ৳{parseFloat(b.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Periodic Breakdown Table (Full Width) */}
          <div className="lg:col-span-2 bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Periodic Summary (Monthly Breakdown)</span>
              </h3>
            </div>

            {reportData.periodic_summary.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No historical transaction activity found.</p>
            ) : (
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Period (YYYY-MM)</th>
                      <th className="py-2.5 px-4 text-center">Transactions</th>
                      <th className="py-2.5 px-4 text-right">Total Distributed (BDT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {reportData.periodic_summary.map((p) => (
                      <tr key={p.period} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">{p.period}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-muted-foreground">{p.transaction_count}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          ৳{parseFloat(p.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
