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
  Clock,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';

export default function HomePage() {
  const { hasPermission, activeUsername } = useAuth();
  const { foundationName, tagline } = useSettings();
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
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-border/50 w-full min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
            {foundationName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {tagline || 'Centralized governance for community groups, active members, and registered beneficiaries.'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border/60 shadow-xs self-start sm:self-auto shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-medium text-foreground whitespace-nowrap">
            PostgreSQL & RBAC Online
          </span>
        </div>
      </div>

      {/* Overview Cards (1 column on mobile, 2 on sm, 3 on lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
        {/* Groups Card */}
        <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow w-full min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.groups}</span>
              <span className="text-xs text-muted-foreground ml-2">Registered Groups</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 break-words">
              Sequential G-XXXX codes, status tracking, and verified fund ledger accounts.
            </p>
          </div>
          <div className="mt-5 sm:mt-6 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
            <Link
              href="/groups/manage"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1 truncate"
            >
              <span>Manage Groups</span> <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
            {hasPermission('groups.create') && (
              <Link
                href="/groups/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 shrink-0"
              >
                + Add
              </Link>
            )}
          </div>
        </div>

        {/* Members Card */}
        <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow w-full min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0">
                <UsersRound className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.members}</span>
              <span className="text-xs text-muted-foreground ml-2">Enrolled Members</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 break-words">
              Automated M-XXXX IDs, mandatory active group assignment, and dues monitoring.
            </p>
          </div>
          <div className="mt-5 sm:mt-6 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
            <Link
              href="/members/manage"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1 truncate"
            >
              <span>Manage Members</span> <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
            {hasPermission('members.create') && (
              <Link
                href="/members/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 shrink-0"
              >
                + Add
              </Link>
            )}
          </div>
        </div>

        {/* Beneficiaries Card */}
        <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow w-full min-w-0 sm:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beneficiary Module</span>
              <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0">
                <HandHeart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.loading ? '...' : stats.beneficiaries}</span>
              <span className="text-xs text-muted-foreground ml-2">Beneficiaries</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 break-words">
              Automated B-XXXX IDs, chronological running balance, and financial ledger audit.
            </p>
          </div>
          <div className="mt-5 sm:mt-6 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
            <Link
              href="/beneficiaries/ledger"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1 truncate"
            >
              <span>Beneficiary Ledger</span> <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
            {hasPermission('beneficiaries.create') && (
              <Link
                href="/beneficiaries/add"
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 shrink-0"
              >
                + Add
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Module Shortcuts & Financial Integrity Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0">
        {/* Quick Nav Panel */}
        <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs w-full min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4">Module Navigation</h2>
          <div className="space-y-2.5 sm:space-y-3">
            <Link
              href="/groups/fund"
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors gap-2"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <Wallet className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">Group Fund Ledger</div>
                  <div className="text-[11px] text-muted-foreground truncate">View actual recorded group funds and transaction ledgers</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>

            <Link
              href="/members/due-list"
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors gap-2"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">Member Due List</div>
                  <div className="text-[11px] text-muted-foreground truncate">Check member dues status with financial integrity guarantees</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>

            <Link
              href="/roles"
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 border border-border/40 transition-colors gap-2"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">Role Management & RBAC</div>
                  <div className="text-[11px] text-muted-foreground truncate">Inspect and assign granular permissions across all modules</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          </div>
        </div>

        {/* Financial Integrity & Architectural Compliance */}
        <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/60 shadow-xs w-full min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-foreground">System Guarantees & Principles</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2 min-w-0">
              <span className="font-bold text-foreground shrink-0">1. Financial Integrity:</span>
              <span className="break-words">Zero fabricated transactions or assumed balances. All fund totals derive from audited database entries.</span>
            </li>
            <li className="flex items-start gap-2 min-w-0">
              <span className="font-bold text-foreground shrink-0">2. Sequence Safety:</span>
              <span className="break-words">Member IDs (`M-XXXX`) and Beneficiary IDs (`B-XXXX`) use atomic PostgreSQL sequences to prevent collisions.</span>
            </li>
            <li className="flex items-start gap-2 min-w-0">
              <span className="font-bold text-foreground shrink-0">3. Enforced Group Link:</span>
              <span className="break-words">Every member must strictly be tied to a valid active group in PostgreSQL with foreign key validation.</span>
            </li>
            <li className="flex items-start gap-2 min-w-0">
              <span className="font-bold text-foreground shrink-0">4. Granular RBAC:</span>
              <span className="break-words">Every backend route enforces 401/403 controls. UI submenus filter according to effective user permissions.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
