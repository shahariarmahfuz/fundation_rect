'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  UsersRound, 
  Search, 
  Plus, 
  Edit2, 
  Power, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Eye,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ManageMembersPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [members, setMembers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Groups list for filter dropdown
  const [activeGroups, setActiveGroups] = useState<{ id: number; code: string; name: string }[]>([]);

  // View / Edit Modal State
  const [viewMember, setViewMember] = useState<any | null>(null);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState<number>(0);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append('q', search.trim());
      if (groupFilter) params.append('group_id', groupFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/members?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing members.view permission.');
        throw new Error('Failed to load members');
      }
      const data = await res.json();
      setMembers(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        console.error('Error loading groups filter', e);
      }
    }
    loadGroups();
  }, [activeUsername]);

  useEffect(() => {
    fetchMembers();
  }, [page, limit, search, groupFilter, statusFilter, activeUsername]);

  if (!hasPermission('members.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">members.view</code> permission.
        </p>
      </div>
    );
  }

  const handleToggleStatus = async (m: any) => {
    const isActivating = m.status !== 'Active';
    const requiredPerm = isActivating ? 'members.activate' : 'members.deactivate';
    if (!hasPermission(requiredPerm)) {
      alert(`Forbidden: Missing ${requiredPerm} permission.`);
      return;
    }

    const confirmMsg = isActivating
      ? `Activate member ${m.name} (${m.member_id})?`
      : `Deactivate member ${m.name} (${m.member_id})? Historical and ledger records will be strictly preserved.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = isActivating ? `/api/members/${m.id}/activate` : `/api/members/${m.id}/deactivate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to update member status');
      }
      await fetchMembers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenEdit = (m: any) => {
    setEditMember(m);
    setEditName(m.name);
    setEditGroupId(m.group_id);
    setEditPhone(m.phone || '');
    setEditEmail(m.email || '');
    setEditAddress(m.address || '');
    setEditNotes(m.notes || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    try {
      setEditLoading(true);
      setEditError(null);
      const res = await fetch(`/api/members/${editMember.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify({
          name: editName.trim(),
          group_id: Number(editGroupId),
          phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined,
          address: editAddress.trim() || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update member');

      setEditMember(null);
      await fetchMembers();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Manage Members</h1>
          <p className="text-xs text-muted-foreground">
            Search, filter, view details, and manage foundation member profiles.
          </p>
        </div>
        {hasPermission('members.create') && (
          <Link
            href="/members/add"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Member
          </Link>
        )}
      </div>

      {/* Search & Filters */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Member ID (M-XXXX) or Name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
          {/* Filter by Group */}
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

          {/* Filter by Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-auto px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Page size */}
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="w-full sm:w-auto col-span-2 sm:col-span-1 px-2.5 sm:px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground truncate min-w-0"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2 w-full min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Member ID</th>
                <th className="py-3 px-3 sm:px-4">Member Name</th>
                <th className="py-3 px-3 sm:px-4">Assigned Group</th>
                <th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Phone Number</th>
                <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Joining Date</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading members from PostgreSQL...</p>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <UsersRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No members found</p>
                    <p className="text-[11px] mt-0.5">Register a new member or modify your filters.</p>
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {m.member_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {m.name}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{m.group_name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{m.group_code}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                      {m.phone || '—'}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">
                      {m.joining_date ? new Date(m.joining_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          m.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setViewMember(m)}
                          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {hasPermission('members.update') && (
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            title="Edit Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(hasPermission('members.activate') || hasPermission('members.deactivate')) && (
                          <button
                            onClick={() => handleToggleStatus(m)}
                            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                              m.status === 'Active'
                                ? 'text-zinc-400 hover:text-destructive'
                                : 'text-zinc-400 hover:text-emerald-600'
                            }`}
                            title={m.status === 'Active' ? 'Deactivate Member' : 'Activate Member'}
                          >
                            <Power className="w-3.5 h-3.5" />
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

        {/* Server-side Pagination Bar */}
        <div className="py-3 px-3 sm:px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-muted-foreground w-full">
          <span className="text-center sm:text-left">
            Showing {members.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} registered members
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

      {/* View Member Modal */}
      {viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Member Details</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {viewMember.member_id}
                </span>
              </div>
              <button
                onClick={() => setViewMember(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Full Name</span>
                <span className="text-sm font-medium text-foreground">{viewMember.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Assigned Group</span>
                <span className="text-foreground">{viewMember.group_name} ({viewMember.group_code})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Phone</span>
                  <span className="text-foreground">{viewMember.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Status</span>
                  <span className="text-foreground">{viewMember.status}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Email</span>
                <span className="text-foreground">{viewMember.email || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Address</span>
                <span className="text-foreground">{viewMember.address || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Joining Date</span>
                <span className="text-foreground">{viewMember.joining_date || '—'}</span>
              </div>
              {viewMember.notes && (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Notes</span>
                  <p className="text-muted-foreground bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded border border-border/40 mt-1">
                    {viewMember.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/40 flex justify-end">
              <button
                onClick={() => setViewMember(null)}
                className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Member Information</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: <strong className="text-foreground">{editMember.member_id}</strong> (Read-only)
                </span>
              </div>
              <button
                onClick={() => setEditMember(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
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
                  Member ID (Immutable)
                </label>
                <input
                  type="text"
                  disabled
                  value={editMember.member_id}
                  className="w-full px-3 py-1.5 rounded bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 font-mono text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Member Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Assigned Group <span className="text-destructive">*</span>
                </label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  {activeGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Authorized transfer to another active foundation group.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
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
                  onClick={() => setEditMember(null)}
                  className="px-3 py-1.5 rounded border border-border/60 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Member Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
