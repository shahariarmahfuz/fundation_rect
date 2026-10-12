'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Calendar, 
  Search, 
  AlertCircle, 
  Users, 
  Building2, 
  Receipt, 
  CheckCircle2, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  DollarSign, 
  Clock, 
  UserCheck,
  Plus
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function DueContributionContent() {
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [year, setYear] = useState<number>(currentYear);
  const [upToMonth, setUpToMonth] = useState<number>(currentMonth);
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalDueAmount, setTotalDueAmount] = useState<string>('0.00');
  const [monthlyAmount, setMonthlyAmount] = useState<string>('100.00');
  const [groups, setGroups] = useState<any[]>([]);

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
        console.error('Failed to load groups filter:', err);
      }
    }
    loadGroups();
  }, []);

  const fetchDueList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: year.toString(),
        up_to_month: upToMonth.toString(),
        page: page.toString(),
        limit: limit.toString(),
      });

      if (groupFilter) params.append('group_id', groupFilter);
      if (search.trim()) params.append('q', search.trim());

      const res = await fetch(`/api/contributions/due-list?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing contributions.due_list.view permission.');
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        throw new Error('Failed to load due list.');
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalDueAmount(Number(data.total_due_amount || 0).toFixed(2));
      setMonthlyAmount(Number(data.monthly_amount || 100).toFixed(2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year, upToMonth, groupFilter, search, page, limit]);

  useEffect(() => {
    fetchDueList();
  }, [fetchDueList]);

  const totalPages = Math.ceil(total / limit) || 1;

  if (!hasPermission('contributions.due_list.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">contributions.due_list.view</code> permission.
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
            <Calendar className="w-5 h-5 text-primary" /> Member Due Contributions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify members with outstanding monthly contribution obligations up to the selected period.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasPermission('contributions.create') && (
            <Link
              href="/contributions/add"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Collect Contribution
            </Link>
          )}
          {hasPermission('contributions.view') && (
            <Link
              href="/contributions/manage"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <Receipt className="w-3.5 h-3.5" /> Manage All
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

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Outstanding Dues</span>
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">৳{totalDueAmount} BDT</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Members with Outstanding Dues</span>
            <div className="text-lg font-bold text-foreground font-mono mt-0.5">{total}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Monthly Rate</span>
            <div className="text-xs text-foreground font-semibold mt-0.5">
              ৳{monthlyAmount} BDT / month
            </div>
            <span className="text-[10px] text-muted-foreground">Up to {MONTH_NAMES[upToMonth - 1]} {year}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Period Selection Bar */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative w-full sm:flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search member by Name or Member ID..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>

            <select
              value={upToMonth}
              onChange={(e) => { setUpToMonth(Number(e.target.value)); setPage(1); }}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>Up to {m}</option>
              ))}
            </select>

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
          </div>
        </div>
      </div>

      {/* Due Members Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Member</th>
                <th className="py-3 px-3 sm:px-4">Group</th>
                <th className="py-3 px-3 sm:px-4">Joining Date</th>
                <th className="py-3 px-3 sm:px-4">Months Due</th>
                <th className="py-3 px-3 sm:px-4">Months Paid</th>
                <th className="py-3 px-3 sm:px-4">Total Due</th>
                <th className="py-3 px-3 sm:px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Calculating dues...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-500" />
                    <p className="font-semibold text-foreground">All Member Accounts are Up to Date!</p>
                    <p className="text-[11px] mt-0.5">No outstanding contribution dues found up to {MONTH_NAMES[upToMonth - 1]} {year}.</p>
                  </td>
                </tr>
              ) : (
                items.map((m) => {
                  const dueMonthsText = m.due_month_names && m.due_month_names.length > 0
                    ? m.due_month_names.map((name: string) => name.substring(0, 3)).join(', ')
                    : 'None';

                  const paidMonthsText = m.paid_month_names && m.paid_month_names.length > 0
                    ? m.paid_month_names.map((name: string) => name.substring(0, 3)).join(', ')
                    : 'None';

                  const dueMonthsQuery = m.due_months ? m.due_months.join(',') : '';

                  return (
                    <tr key={m.member_id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                        <div>{m.member_name}</div>
                        <span className="text-[10px] text-muted-foreground font-mono">{m.member_code}</span>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary" title={m.group_name}>
                          {m.group_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-muted-foreground">
                        {m.joining_date ? new Date(m.joining_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {m.due_months_count} month(s)
                        </span>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={dueMonthsText}>
                          {dueMonthsText}
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="text-muted-foreground">
                          {m.paid_months_count} month(s)
                        </span>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={paidMonthsText}>
                          {paidMonthsText}
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-mono font-bold text-foreground">
                        <span className="text-amber-700 dark:text-amber-400">
                          ৳{Number(m.total_due_amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        {hasPermission('contributions.create') ? (
                          <Link
                            href={`/contributions/add?member_id=${m.member_id}&year=${year}&months=${dueMonthsQuery}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity"
                          >
                            Collect <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Due</span>
                        )}
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
            Showing {items.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
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
    </div>
  );
}

export default function DueContributionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading due contributions...</div>}>
      <DueContributionContent />
    </Suspense>
  );
}
