'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Power, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  CheckCircle2,
  X,
  Eye
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ManageGroupsPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit / Details Modal State
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Toggle Confirmation
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append('q', search.trim());
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/groups?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Permission denied: You do not have groups.view permission.');
        throw new Error('Failed to load groups');
      }
      const data = await res.json();
      setGroups(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [page, limit, search, statusFilter, activeUsername]);

  if (!hasPermission('groups.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">groups.view</code> permission.
        </p>
      </div>
    );
  }

  const handleToggleStatus = async (group: any) => {
    if (!hasPermission('groups.deactivate')) {
      alert('Forbidden: You lack groups.deactivate permission.');
      return;
    }
    const confirmMsg = group.status === 'Active'
      ? `Are you sure you want to deactivate ${group.name} (${group.code})?`
      : `Are you sure you want to activate ${group.name} (${group.code})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(group.id);
      const res = await fetch(`/api/groups/${group.id}/status`, {
        method: 'POST',
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to update group status');
      }
      await fetchGroups();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEdit = (group: any) => {
    setSelectedGroup(group);
    setEditName(group.name);
    setEditDescription(group.description || '');
    setIsEditing(true);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      setEditLoading(true);
      setEditError(null);
      const res = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update group');

      setIsEditing(false);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Manage Groups</h1>
          <p className="text-xs text-muted-foreground">View, search, filter, and manage foundation community groups.</p>
        </div>
        {hasPermission('groups.create') && (
          <Link
            href="/groups/add"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Group
          </Link>
        )}
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by group name or code (e.g. G-0001)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Groups Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-4">Group Code</th>
                <th className="py-3 px-4">Group Name</th>
                <th className="py-3 px-4 hidden md:table-cell">Description</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 hidden sm:table-cell">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading groups from PostgreSQL...</p>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-foreground">No groups found</p>
                    <p className="text-[11px] mt-0.5">Try adjusting your search criteria or register a new group.</p>
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-primary">
                      {group.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {group.name}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground max-w-xs truncate">
                      {group.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground">
                        {group.member_count} members
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          group.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {group.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                      {new Date(group.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {hasPermission('groups.update') && (
                          <button
                            onClick={() => handleOpenEdit(group)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Group"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('groups.deactivate') && (
                          <button
                            onClick={() => handleToggleStatus(group)}
                            disabled={actionLoading === group.id}
                            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                              group.status === 'Active'
                                ? 'text-zinc-400 hover:text-destructive'
                                : 'text-zinc-400 hover:text-emerald-600'
                            }`}
                            title={group.status === 'Active' ? 'Deactivate Group' : 'Activate Group'}
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

        {/* Pagination Bar */}
        <div className="py-3 px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {groups.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} groups
          </span>
          <div className="flex items-center gap-1.5">
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

      {/* Edit Group Modal */}
      {isEditing && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border/60 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Group: {selectedGroup.code}</h3>
                <p className="text-[11px] text-muted-foreground">Update group information in PostgreSQL</p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
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

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Group Code (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedGroup.code}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 font-mono text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Group Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
