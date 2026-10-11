'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  HandCoins, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  Download, 
  AlertCircle,
  TrendingUp,
  PieChart,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function DonationReportPage() {
  const { hasPermission } = useAuth();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'month' | 'day'>('month');
  const [summaryData, setSummaryData] = useState<any | null>(null);

  // Detailed records list
  const [detailedItems, setDetailedItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary statistics
      const summaryParams = new URLSearchParams({ group_by: groupBy });
      if (startDate) summaryParams.append('start_date', startDate);
      if (endDate) summaryParams.append('end_date', endDate);

      const summaryRes = await fetch(`/api/donations/report/summary?${summaryParams.toString()}`, {
        credentials: 'include',
      });
      if (!summaryRes.ok) {
        if (summaryRes.status === 403) throw new Error('Access Denied: Missing donation_reports.view permission.');
        if (summaryRes.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load donation report summary.');
      }
      const summaryJson = await summaryRes.json();
      setSummaryData(summaryJson);

      // Fetch detailed items matching the date range
      const listParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: 'COMPLETED',
        sort_by: 'donation_date',
        order: 'desc',
      });
      if (startDate) listParams.append('start_date', startDate);
      if (endDate) listParams.append('end_date', endDate);

      const listRes = await fetch(`/api/donations?${listParams.toString()}`, {
        credentials: 'include',
      });
      if (listRes.ok) {
        const listJson = await listRes.json();
        setDetailedItems(listJson.items || []);
        setTotalRecords(listJson.total || 0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, groupBy, page, limit]);

  if (!hasPermission('donation_reports.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">donation_reports.view</code> permission.
        </p>
      </div>
    );
  }

  const exportCSV = () => {
    if (!detailedItems || detailedItems.length === 0) {
      alert('No records available to export.');
      return;
    }
    const headers = ['Donation ID', 'Date', 'Donor Name', 'Amount', 'Payment Method', 'Reference', 'Status', 'Recorded By'];
    const rows = detailedItems.map(d => [
      d.donation_id,
      d.donation_date,
      `"${d.donor_name}"`,
      d.amount,
      d.payment_method,
      `"${d.transaction_reference || ''}"`,
      d.status,
      `"${d.recorded_by_name || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `donation_report_${startDate || 'all'}_to_${endDate || 'today'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const totalAmountFormatted = summaryData ? Number(summaryData.total_amount).toFixed(2) : '0.00';
  const totalCount = summaryData ? summaryData.total_transactions : 0;
  const avgAmountFormatted = totalCount > 0 ? (Number(summaryData.total_amount) / totalCount).toFixed(2) : '0.00';

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/donations/manage"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Donations
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <BarChart3 className="w-5 h-5 text-primary" /> Donation Financial Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated financial summary and analytical breakdown derived from persisted PostgreSQL donation records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-primary" /> Export CSV
          </button>
          {hasPermission('donations.view') && (
            <Link
              href="/donations/manage"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs transition-all"
            >
              <List className="w-4 h-4" /> Manage List
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2 border border-destructive/20 w-full min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">Start Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">End Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground text-xs"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-xs text-primary hover:underline py-1 self-start sm:self-auto"
            >
              Clear Range
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="text-[11px] text-muted-foreground font-medium">Interval:</span>
          <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-background">
            <button
              onClick={() => setGroupBy('month')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                groupBy === 'month' ? 'bg-primary text-primary-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setGroupBy('day')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                groupBy === 'day' ? 'bg-primary text-primary-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Daily
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Received</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-foreground">${totalAmountFormatted}</span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Across {totalCount} completed donations
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transactions</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{totalCount}</span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Active contributions in period
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Ticket</span>
            <div className="w-8 h-8 rounded-full bg-zinc-500/10 text-foreground flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-foreground">${avgAmountFormatted}</span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Per donation transaction
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown by Payment Method & Periodic Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Methods Breakdown */}
        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> Breakdown by Payment Method
            </h2>
            <span className="text-[11px] text-muted-foreground font-mono">
              {summaryData?.by_payment_method?.length || 0} methods
            </span>
          </div>

          {summaryData?.by_payment_method?.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No payment data in selected range.</p>
          ) : (
            <div className="space-y-3">
              {summaryData?.by_payment_method?.map((m: any) => {
                const totalAmt = Number(summaryData.total_amount) || 1;
                const methodAmt = Number(m.total_amount);
                const pct = Math.min(100, Math.round((methodAmt / totalAmt) * 100));

                return (
                  <div key={m.payment_method} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{m.payment_method}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground font-bold">${methodAmt.toFixed(2)}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {m.transaction_count} transaction{m.transaction_count === 1 ? '' : 's'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Periodic Summary Table */}
        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> {groupBy === 'month' ? 'Monthly' : 'Daily'} Summary
            </h2>
            <span className="text-[11px] text-muted-foreground font-mono">
              {summaryData?.periodic_summary?.length || 0} periods
            </span>
          </div>

          {summaryData?.periodic_summary?.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No periodic activity in selected range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground font-semibold">
                    <th className="py-2 px-2">Period</th>
                    <th className="py-2 px-2 text-right">Transactions</th>
                    <th className="py-2 px-2 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {summaryData?.periodic_summary?.map((p: any) => (
                    <tr key={p.period} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-2 px-2 font-mono font-medium text-foreground">{p.period}</td>
                      <td className="py-2 px-2 text-right font-mono text-muted-foreground">{p.transaction_count}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                        ${Number(p.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Transaction Ledger Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="p-3.5 sm:p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <List className="w-4 h-4 text-primary" /> Detailed Transactions ({totalRecords})
          </h2>
          <span className="text-[11px] text-muted-foreground">Filtered period</span>
        </div>

        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[680px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Donation ID</th>
                <th className="py-3 px-3 sm:px-4">Date</th>
                <th className="py-3 px-3 sm:px-4">Donor Name</th>
                <th className="py-3 px-3 sm:px-4">Amount</th>
                <th className="py-3 px-3 sm:px-4">Method</th>
                <th className="py-3 px-3 sm:px-4">Reference</th>
                <th className="py-3 px-3 sm:px-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading transactions...</p>
                  </td>
                </tr>
              ) : detailedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    <HandCoins className="w-7 h-7 mx-auto mb-1.5 opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">No records found for period</p>
                  </td>
                </tr>
              ) : (
                detailedItems.map((d) => (
                  <tr key={d.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 sm:px-4 font-mono font-bold text-primary">
                      {d.donation_id}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-muted-foreground">
                      {d.donation_date ? new Date(d.donation_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-medium text-foreground">
                      {d.donor_name}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-mono font-bold text-foreground">
                      ${Number(d.amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10 text-foreground">
                        {d.payment_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-mono text-muted-foreground truncate max-w-[120px]">
                      {d.transaction_reference || '—'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-muted-foreground truncate max-w-[120px]">
                      {d.recorded_by_name || 'Staff'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3 px-3 sm:px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-muted-foreground w-full">
          <span>
            Showing {detailedItems.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, totalRecords)} of {totalRecords} records
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
    </div>
  );
}
