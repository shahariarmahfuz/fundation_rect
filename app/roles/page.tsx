'use client';

import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Users, 
  Lock, 
  CheckCircle2, 
  RotateCcw 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RoleManagementPage() {
  const { hasPermission, activeUsername, refreshUser } = useAuth();

  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [assignedPerms, setAssignedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rRes, pRes] = await Promise.all([
        fetch('/api/auth/roles', { headers: { 'X-User': activeUsername } }),
        fetch('/api/auth/permissions', { headers: { 'X-User': activeUsername } }),
      ]);

      if (!rRes.ok || !pRes.ok) {
        throw new Error('Failed to load roles or permissions');
      }

      const rolesData = await rRes.json();
      const permsData = await pRes.json();

      setRoles(rolesData);
      setPermissions(permsData);

      if (rolesData.length > 0) {
        setSelectedRole(rolesData[0]);
        setAssignedPerms(rolesData[0].permissions || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeUsername]);

  const handleSelectRole = (role: any) => {
    setSelectedRole(role);
    setAssignedPerms(role.permissions || []);
    setSaveSuccess(false);
  };

  const handleTogglePerm = (code: string) => {
    if (assignedPerms.includes(code)) {
      setAssignedPerms(assignedPerms.filter(p => p !== code));
    } else {
      setAssignedPerms([...assignedPerms, code]);
    }
    setSaveSuccess(false);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/auth/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User': activeUsername,
        },
        body: JSON.stringify({
          permission_codes: assignedPerms,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to update role permissions');
      }

      setSaveSuccess(true);
      await refreshUser();
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission('roles.manage')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your active role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">roles.manage</code> permission.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Switch to System Administrator via the header switcher to manage role permissions.
        </p>
      </div>
    );
  }

  // Group permissions by module
  const permsByModule = permissions.reduce((acc: any, p: any) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Role & Permission Management</h1>
          <p className="text-xs text-muted-foreground">
            Configure granular access control for Groups, Members, Beneficiaries, and Financial Ledgers.
          </p>
        </div>
        <button
          onClick={handleSavePermissions}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-xs"
        >
          {saving ? 'Updating Permissions...' : 'Save Role Permissions'}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Role permissions updated successfully in PostgreSQL! Changes are active immediately.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Roles List */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            System Roles
          </span>
          <div className="space-y-1.5">
            {roles.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectRole(r)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedRole?.id === r.id
                    ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                    : 'bg-card border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{r.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">
                    {r.permissions.length} perms
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-normal mt-1 truncate">
                  {r.description || 'Custom role'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="md:col-span-3 rounded-xl bg-card border border-border/60 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Configuring Permissions for: <span className="text-primary">{selectedRole?.name}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select or deselect permission keys to adjust effective RBAC capabilities for this role.
            </p>
          </div>

          <div className="space-y-6">
            {Object.keys(permsByModule).map((module) => (
              <div key={module} className="space-y-2.5">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider block border-b border-border/50 pb-1">
                  {module.toUpperCase()} MODULE
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permsByModule[module].map((p: any) => {
                    const isChecked = assignedPerms.includes(p.code);
                    return (
                      <label
                        key={p.code}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 text-foreground'
                            : 'bg-background border-border/60 text-muted-foreground hover:border-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePerm(p.code)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <code className="text-[11px] font-mono font-semibold block text-primary truncate">
                            {p.code}
                          </code>
                          <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                            {p.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
