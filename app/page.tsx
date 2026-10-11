'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UsersRound, 
  HandHeart, 
  ArrowRight, 
  ShieldCheck, 
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, hasPermission, activeUsername } = useAuth();
  const [stats, setStats] = useState({
    groups: 0,
    members: 0,
    beneficiaries: 0,
    loading: true
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const headers = { 'X-User': activeUsername };
        const [gRes, mRes, bRes] = await Promise.allSettled([
          fetch('/api/groups?limit=1', { headers }).then(r => r.ok ? r.json() : null),
          fetch('/api/members?limit=1', { headers }).then(r => r.ok ? r.json() : null),
          fetch('/api/beneficiaries?limit=1', { headers }).then(r => r.ok ? r.json() : null),
        ]);

        setStats({
          groups: gRes.status === 'fulfilled' && gRes.value ? gRes.value.total : 0,
          members: mRes.status === 'fulfilled' && mRes.value ? mRes.value.total : 0,
          beneficiaries: bRes.status === 'fulfilled' && bRes.value ? bRes.value.total : 0,
          loading: false,
        });
      } catch (e) {
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
    loadStats();
  }, [activeUsername]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Foundation Management System</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized governance for community groups, active members, and registered beneficiaries.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/60 shadow-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-foreground">PostgreSQL & RBAC Online</span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Groups Card */}
        <div className="p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.groups}</span>
              <span className="text-xs text-muted-foreground ml-2">Registered Groups</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sequential G-XXXX codes, status tracking, and verified fund ledger accounts.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <Link
              href="/groups/manage"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Manage Groups <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {hasPermission('groups.create') && (
              <Link
                href="/groups/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                + Add
              </Link>
            )}
          </div>
        </div>

        {/* Members Card */}
        <div className="p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary">
                <UsersRound className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.members}</span>
              <span className="text-xs text-muted-foreground ml-2">Enrolled Members</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Automated M-XXXX IDs, mandatory active group assignment, and dues monitoring.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <Link
              href="/members/manage"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Manage Members <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {hasPermission('members.create') && (
              <Link
                href="/members/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                + Add
              </Link>
            )}
          </div>
        </div>

        {/* Beneficiaries Card */}
        <div className="p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beneficiary Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary">
                <HandHeart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.beneficiaries}</span>
              <span className="text-xs text-muted-foreground ml-2">Beneficiaries</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Automated B-XXXX IDs, chronological running balance, and financial ledger audit.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <Link
              href="/beneficiaries/ledger"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Beneficiary Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {hasPermission('beneficiaries.create') && (
              <Link
                href="/beneficiaries/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                + Add
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Module Shortcuts & Financial Integrity Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Nav Panel */}
        <div className="p-6 rounded-xl bg-card border border-border/60 shadow-xs">
          <h2 className="text-base font-semibold text-foreground mb-4">Module Navigation</h2>
          <div className="space-y-3">
            <Link
              href="/groups/fund"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-xs font-medium text-foreground">Group Fund Ledger</div>
                  <div className="text-[11px] text-muted-foreground">View actual recorded group funds and transaction ledgers</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <Link
              href="/members/due-list"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-xs font-medium text-foreground">Member Due List</div>
                  <div className="text-[11px] text-muted-foreground">Check member dues status with financial integrity guarantees</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <Link
              href="/roles"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-xs font-medium text-foreground">Role Management & RBAC</div>
                  <div className="text-[11px] text-muted-foreground">Inspect and assign granular permissions across all modules</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Financial Integrity & Architectural Compliance */}
        <div className="p-6 rounded-xl bg-card border border-border/60 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-foreground">System Guarantees & Principles</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground">1. Financial Integrity:</span>
              <span>Zero fabricated transactions or assumed balances. All fund totals derive from audited database entries.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground">2. Sequence Safety:</span>
              <span>Member IDs (`M-XXXX`) and Beneficiary IDs (`B-XXXX`) use atomic PostgreSQL sequences to prevent collisions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground">3. Enforced Group Link:</span>
              <span>Every member must strictly be tied to a valid active group in PostgreSQL with foreign key validation.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground">4. Granular RBAC:</span>
              <span>Every backend route enforces 401/403 controls. UI submenus filter according to effective user permissions.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
