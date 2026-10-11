'use client';

import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  Search, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Building2,
  UsersRound,
  FileQuestion
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function MemberDueListPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeGroups, setActiveGroups] = useState<{ id: number; code: string; name: string }[]>([]);

  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetch('/api/groups/active-options', {
          headers: { 'X-User': activeUsername },
        });
        if (res.ok) {
          const data = await res.json();
          setActiveGroups(data);
        }
      } catch (e) {
        console.error('Error loading groups', e);
      }
    }
    loadGroups();
  }, [activeUsername]);

  const fetchDueList = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append('q', search.trim());
      if (groupFilter) params.append('group_id', groupFilter);

      const res = await fetch(`/api/members/due-list?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing members.due_list.view permission.');
        throw new Error('Failed to load member due list');
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueList();
  }, [page, limit, search, groupFilter, activeUsername]);

  if (!hasPermission('members.due_list.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">members.due_list.view</code> permission.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Member Due List</h1>
        <p className="text-xs text-muted-foreground">
          Track outstanding member obligations with strict financial integrity adherence.
        </p>
      </div>

      {/* Financial Integrity & Architectural Banner */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5 sm:gap-3 w-full min-w-0">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1 min-w-0">
          <span className="font-semibold text-blue-950 dark:text-blue-100">
            Dues Ledger Architecture Notice
          </span>
          <p className="text-blue-800 dark:text-blue-300 break-words">
            In compliance with accounting standards, member due amounts are never assumed or fabricated from sample numbers.
            Because the foundation's automated contribution collection and dues ledger module has not yet been deployed,
            due amounts remain pending formal ledger integration.
          </p>
        </div>
      </div>

      {/* Search & Group Filter */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Member ID or Name..."
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
            {activeGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.code})
              </option>
            ))}
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

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2 w-full min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Due List Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[540px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Member ID</th>
                <th className="py-3 px-3 sm:px-4">Member Name</th>
                <th className="py-3 px-3 sm:px-4">Group Name</th>
                <th className="py-3 px-3 sm:px-4">Group Code</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Outstanding Due Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading member due list...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <UsersRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No members found</p>
                    <p className="text-[11px] mt-0.5">Adjust filter criteria to view members.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {item.member_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {item.group_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {item.group_code}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        item.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.has_ledger ? (
                        <span className="font-mono font-bold text-foreground">
                          ${Number(item.due_amount).toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground italic bg-secondary/50 px-2 py-0.5 rounded">
                          <FileQuestion className="w-3 h-3 text-muted-foreground/70" />
                          Pending Dues Module
                        </span>
                      )}
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
            Showing {items.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} records
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
