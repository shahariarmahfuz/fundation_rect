'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Receipt, 
  Calendar, 
  DollarSign, 
  Building2, 
  Download, 
  AlertCircle, 
  TrendingUp, 
  Layers, 
  List, 
  Filter, 
  CheckCircle2, 
  Clock,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function ContributionReportContent() {
  const { hasPermission } = useAuth();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(currentYear);
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [groups, setGroups] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load groups for filter
  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetch('/api/groups?status=Active&limit=100', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setGroups(data.items || []);
        }
      } catch (err) {
        console.error('Failed to load groups for report:', err);
      }
    }
    loadGroups();
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: year.toString(),
      });
      if (groupFilter) params.append('group_id', groupFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/contributions/report/summary?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing contribution_reports.view permission.');
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load contribution report summary.');
      }

      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year, groupFilter, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!summary) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Foundation Monthly Contribution Report\n';
    csvContent += `Year,${year}\n`;
    csvContent += `Total Collected (BDT),${summary.total_collected}\n`;
    csvContent += `Total Receipts Issued,${summary.total_receipts}\n`;
    csvContent += `Advance Collected (BDT),${summary.total_advance_collected}\n`;
    csvContent += `Outstanding Dues (BDT),${summary.total_due_outstanding}\n\n`;

    csvContent += 'Group Fund Breakdown\n';
    csvContent += 'Group Code,Group Name,Receipts Count,Total Collected (BDT)\n';
    summary.group_summaries?.forEach((g: any) => {
      csvContent += `"${g.group_code}","${g.group_name}",${g.receipts_count},${g.total_collected}\n`;
    });

    csvContent += '\nMonthly Collection Breakdown\n';
    csvContent += 'Month Number,Month Name,Receipts Count,Total Collected (BDT)\n';
    summary.monthly_summaries?.forEach((m: any) => {
      csvContent += `${m.month},"${m.month_name}",${m.receipts_count},${m.total_collected}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monthly_contributions_report_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasPermission('contribution_reports.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">contribution_reports.view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/contributions/manage"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Contributions
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <BarChart3 className="w-5 h-5 text-primary" /> Monthly Contribution Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit collection performance, group fund distributions, and monthly trends.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={loading || !summary}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          {hasPermission('contributions.due_list.view') && (
            <Link
              href="/contributions/due-list"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <Calendar className="w-3.5 h-3.5" /> Due List
            </Link>
          )}
          {hasPermission('contributions.manage') && (
            <Link
              href="/contributions/manage"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs"
            >
              <List className="w-4 h-4" /> Manage
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-2 border border-destructive/20 w-full min-w-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Report Year:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full sm:w-auto"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Group:</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full sm:w-auto"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full sm:w-auto"
            />
          </div>

          <div className="flex items-center gap-2 sm:w-auto w-full">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full sm:w-auto"
            />
          </div>

          {(groupFilter || startDate || endDate) && (
            <button
              onClick={() => { setGroupFilter(''); setStartDate(''); setEndDate(''); }}
              className="text-xs text-primary hover:underline sm:ml-auto self-start sm:self-auto py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Collected</span>
            <div className="text-xl font-bold text-foreground font-mono mt-0.5">
              ৳{Number(summary?.total_collected || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">{summary?.total_receipts || 0} receipts issued</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Advance Collected</span>
            <div className="text-xl font-bold text-foreground font-mono mt-0.5">
              ৳{Number(summary?.total_advance_collected || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Future months paid</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Outstanding Dues</span>
            <div className="text-xl font-bold text-foreground font-mono mt-0.5">
              ৳{Number(summary?.total_due_outstanding || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">For year {year}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Active Groups</span>
            <div className="text-xl font-bold text-foreground font-mono mt-0.5">
              {summary?.group_summaries?.length || 0}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Fund recipients</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Column Grid: Group Breakdown & Monthly Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Group Breakdown Table */}
        <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 sm:p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Group Fund Distribution
            </h2>
            <span className="text-[11px] text-muted-foreground">Credited to group ledgers</span>
          </div>

          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3 text-right">Receipts</th>
                  <th className="py-2.5 px-3 text-right">Total Credited</th>
                  <th className="py-2.5 px-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                      <p>Loading group breakdown...</p>
                    </td>
                  </tr>
                ) : !summary?.group_summaries || summary.group_summaries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No group distributions recorded for this period.
                    </td>
                  </tr>
                ) : (
                  summary.group_summaries.map((g: any) => {
                    const totalCol = Number(summary.total_collected || 0);
                    const gCol = Number(g.total_collected || 0);
                    const pct = totalCol > 0 ? ((gCol / totalCol) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={g.group_id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-foreground block">{g.group_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{g.group_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {g.receipts_count}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          ৳{gCol.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Collection Trend Table */}
        <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 sm:p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Monthly Collections ({year})
            </h2>
            <span className="text-[11px] text-muted-foreground">Allocations by month</span>
          </div>

          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3 text-right">Receipts</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                      <p>Loading monthly trend...</p>
                    </td>
                  </tr>
                ) : !summary?.monthly_summaries || summary.monthly_summaries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      No monthly collections recorded.
                    </td>
                  </tr>
                ) : (
                  summary.monthly_summaries.map((m: any) => (
                    <tr key={m.month} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                      <td className="py-2 px-3 font-medium text-foreground">
                        {m.month_name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {m.receipts_count}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        ৳{Number(m.total_collected).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContributionReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading contribution report...</div>}>
      <ContributionReportContent />
    </Suspense>
  );
}
