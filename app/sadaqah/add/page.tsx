'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  HandHeart, 
  Search, 
  Calendar, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  UsersRound, 
  Building2,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Receipt,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type BeneficiaryOption = {
  id: number;
  beneficiary_id: string;
  name: string;
  phone?: string;
  status: string;
};

type GroupBalanceOption = {
  id: number;
  code: string;
  name: string;
  status: string;
  available_balance: string;
  total_received: string;
  total_spent: string;
};

type AllocationState = {
  groupId: number;
  amount: string;
};

export default function AddSadaqahPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // Next ID Preview
  const [nextId, setNextId] = useState<string>('S-0001');

  // Form Fields
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | ''>('');
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [isBeneficiaryDropdownOpen, setIsBeneficiaryDropdownOpen] = useState(false);

  const [sadaqahDate, setSadaqahDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Groups and Allocations
  const [groupOptions, setGroupOptions] = useState<GroupBalanceOption[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  // States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Load Beneficiaries, Groups with balance, and preview next ID
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        setErrorMsg(null);

        const [bRes, gRes, idRes] = await Promise.all([
          fetch('/api/beneficiaries?limit=100&status=Active', { credentials: 'include' }),
          fetch('/api/sadaqah/active-groups-with-balance', { credentials: 'include' }),
          fetch('/api/sadaqah/next-id', { credentials: 'include' })
        ]);

        if (bRes.ok) {
          const bData = await bRes.json();
          setBeneficiaries(bData.items || []);
        }

        if (gRes.ok) {
          const gData = await gRes.json();
          setGroupOptions(gData);
        }

        if (idRes.ok) {
          const idData = await idRes.json();
          if (idData.next_id) setNextId(idData.next_id);
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
        setErrorMsg('Failed to fetch beneficiaries or group balances. Please try refreshing.');
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  // Filtered beneficiaries
  const filteredBeneficiaries = beneficiaries.filter(b => 
    b.name.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
    b.beneficiary_id.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
    (b.phone && b.phone.includes(beneficiarySearch))
  );

  const selectedBeneficiary = beneficiaries.find(b => b.id === Number(selectedBeneficiaryId));

  // Filtered available groups (excluding already selected)
  const selectedGroupIds = new Set(allocations.map(a => a.groupId));
  const availableGroups = groupOptions.filter(g => 
    !selectedGroupIds.has(g.id) &&
    (g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
     g.code.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  // Group helpers
  const handleAddGroup = (group: GroupBalanceOption) => {
    // Determine initial suggested allocation: remaining needed up to available balance
    const currentAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const target = parseFloat(totalAmount) || 0;
    const remaining = Math.max(0, target - currentAllocated);
    const avail = parseFloat(group.available_balance) || 0;
    const suggested = Math.min(remaining, avail);

    setAllocations(prev => [
      ...prev, 
      { groupId: group.id, amount: suggested > 0 ? suggested.toFixed(2) : '' }
    ]);
    setIsGroupDropdownOpen(false);
    setGroupSearch('');
  };

  const handleRemoveGroup = (groupId: number) => {
    setAllocations(prev => prev.filter(a => a.groupId !== groupId));
  };

  const handleAllocationChange = (groupId: number, value: string) => {
    setAllocations(prev => prev.map(a => a.groupId === groupId ? { ...a, amount: value } : a));
  };

  const handleAllocateMax = (groupId: number) => {
    const grp = groupOptions.find(g => g.id === groupId);
    if (!grp) return;
    const avail = parseFloat(grp.available_balance) || 0;
    const otherAllocated = allocations
      .filter(a => a.groupId !== groupId)
      .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const target = parseFloat(totalAmount) || 0;
    const needed = Math.max(0, target - otherAllocated);
    const toAllocate = Math.min(avail, needed > 0 ? needed : avail);
    handleAllocationChange(groupId, toAllocate.toFixed(2));
  };

  // Calculation summaries
  const targetTotal = parseFloat(totalAmount) || 0;
  const currentAllocatedSum = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remainingDifference = targetTotal - currentAllocatedSum;
  const isAllocationBalanced = targetTotal > 0 && Math.abs(remainingDifference) < 0.001;

  // Validation checks
  const allocationErrors: string[] = [];
  allocations.forEach(a => {
    const grp = groupOptions.find(g => g.id === a.groupId);
    const val = parseFloat(a.amount) || 0;
    const avail = grp ? parseFloat(grp.available_balance) : 0;
    if (val <= 0) {
      allocationErrors.push(`Group ${grp?.code || a.groupId} has zero or invalid allocation.`);
    } else if (val > avail) {
      allocationErrors.push(`Group ${grp?.code || a.groupId} allocation (৳${val.toLocaleString()}) exceeds available balance (৳${avail.toLocaleString()}).`);
    }
  });

  const canSubmit = 
    selectedBeneficiaryId !== '' &&
    sadaqahDate &&
    targetTotal > 0 &&
    allocations.length > 0 &&
    isAllocationBalanced &&
    allocationErrors.length === 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        beneficiary_id: Number(selectedBeneficiaryId),
        sadaqah_date: sadaqahDate,
        total_amount: targetTotal,
        allocations: allocations.map(a => ({
          group_id: a.groupId,
          amount: parseFloat(a.amount)
        })),
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined
      };

      const res = await fetch('/api/sadaqah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to record Sadaqah transaction');
      }

      const created = await res.json();
      setSuccessResult(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission('sadaqah.create')) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Access Denied: You do not possess the &quot;sadaqah.create&quot; permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <HandHeart className="w-3.5 h-3.5" />
              Sadaqah Module
            </span>
            <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50">
              {nextId}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Record Sadaqah Payment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Disburse verified Sadaqah assistance to an active beneficiary funded across one or more groups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/sadaqah/manage"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-medium border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors shadow-xs"
          >
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <span>Manage Sadaqah</span>
          </Link>
        </div>
      </div>

      {/* Success Modal / Banner */}
      {successResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-foreground animate-in fade-in duration-300 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                Sadaqah Transaction Posted Successfully
              </h3>
              <p className="text-sm text-muted-foreground">
                Transaction reference <span className="font-mono font-bold text-foreground">{successResult.sadaqah_id}</span> has been committed atomically. 
                Group funds have been deducted and recorded in the Beneficiary Ledger.
              </p>
            </div>
          </div>

          <div className="bg-background/80 border border-emerald-500/20 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Beneficiary</span>
              <span className="font-semibold text-foreground">
                {successResult.beneficiary?.name} ({successResult.beneficiary?.beneficiary_id})
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Total Disbursed</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-base">
                ৳{parseFloat(successResult.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Participating Groups</span>
              <span className="font-medium text-foreground">
                {successResult.allocations?.map((a: any) => `${a.group_code} (৳${parseFloat(a.amount).toLocaleString()})`).join(', ')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/sadaqah/manage"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              <span>View in Manage Sadaqah</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => {
                setSuccessResult(null);
                setSelectedBeneficiaryId('');
                setTotalAmount('');
                setPurpose('');
                setNotes('');
                setAllocations([]);
                // Refresh preview ID and balances
                fetch('/api/sadaqah/next-id', { credentials: 'include' })
                  .then(r => r.json())
                  .then(d => d.next_id && setNextId(d.next_id));
                fetch('/api/sadaqah/active-groups-with-balance', { credentials: 'include' })
                  .then(r => r.json())
                  .then(d => setGroupOptions(d));
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-card hover:bg-muted/60 transition-colors"
            >
              Record Another Payment
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Unable to complete transaction</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Form Inputs (Left 2 cols) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Beneficiary & Basic Info Card */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 pb-3 border-b border-border/50">
                <UsersRound className="w-4 h-4 text-primary" />
                <span>1. Beneficiary Information</span>
              </h2>

              {/* Beneficiary Selector */}
              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                  Select Beneficiary <span className="text-destructive">*</span>
                </label>
                
                {/* Searchable Picker trigger */}
                <div 
                  onClick={() => setIsBeneficiaryDropdownOpen(!isBeneficiaryDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-background border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors text-sm shadow-xs"
                >
                  {selectedBeneficiary ? (
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {selectedBeneficiary.beneficiary_id}
                      </span>
                      <span className="font-medium text-foreground truncate">{selectedBeneficiary.name}</span>
                      {selectedBeneficiary.phone && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">({selectedBeneficiary.phone})</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Search and select an active beneficiary...</span>
                  )}
                  <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                </div>

                {/* Dropdown Menu */}
                {isBeneficiaryDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 border-b border-border/60 bg-muted/40">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Type name, phone, or ID (e.g. B-0001)..."
                          value={beneficiarySearch}
                          onChange={(e) => setBeneficiarySearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/30">
                      {filteredBeneficiaries.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No active beneficiaries matching search.
                        </div>
                      ) : (
                        filteredBeneficiaries.map(b => (
                          <div
                            key={b.id}
                            onClick={() => {
                              setSelectedBeneficiaryId(b.id);
                              setIsBeneficiaryDropdownOpen(false);
                              setBeneficiarySearch('');
                            }}
                            className="p-2.5 hover:bg-primary/5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-bold text-primary">{b.beneficiary_id}</span>
                              <span className="font-medium text-foreground">{b.name}</span>
                            </div>
                            {b.phone && <span className="text-muted-foreground font-mono text-[11px]">{b.phone}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date and Total Amount Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Sadaqah Date <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                    <input
                      type="date"
                      required
                      value={sadaqahDate}
                      onChange={(e) => setSadaqahDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Total Sadaqah Amount (৳) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="text-sm font-bold text-muted-foreground absolute left-3 top-2">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 5000"
                      required
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Purpose and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Purpose / Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Medical emergency relief, Eid assistance"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Internal Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Approved by Executive Committee"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Funding Groups & Allocation Card */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/50">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>2. Funding Groups & Allocation</span>
                </h2>
                <span className="text-xs text-muted-foreground">
                  Multi-group funding allowed. Deductions are verified against available balances.
                </span>
              </div>

              {/* Add Group Dropdown */}
              <div className="relative">
                <div 
                  onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/70 hover:border-primary/40 transition-colors text-sm"
                >
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    Select a group to contribute funds...
                  </span>
                  <span className="text-xs font-semibold text-primary">Browse Active Groups ({availableGroups.length})</span>
                </div>

                {isGroupDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 border-b border-border/60 bg-muted/40">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search group code or name..."
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/30">
                      {availableGroups.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No more available groups to add.
                        </div>
                      ) : (
                        availableGroups.map(grp => {
                          const bal = parseFloat(grp.available_balance);
                          return (
                            <div
                              key={grp.id}
                              onClick={() => handleAddGroup(grp)}
                              className="p-2.5 hover:bg-primary/5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono font-bold text-foreground">{grp.code}</span>
                                <span className="text-muted-foreground truncate">{grp.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                                  bal > 0 
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  Avail: ৳{bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <Plus className="w-3.5 h-3.5 text-primary" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Groups Allocation Table */}
              {allocations.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs space-y-1">
                  <Building2 className="w-6 h-6 mx-auto text-muted-foreground/50 mb-1" />
                  <p className="font-medium text-foreground">No funding groups selected yet</p>
                  <p>Choose one or more groups above to allocate funds toward the ৳{targetTotal > 0 ? targetTotal.toLocaleString() : '0'} Sadaqah payment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocations.map((a, index) => {
                    const grp = groupOptions.find(g => g.id === a.groupId);
                    const avail = grp ? parseFloat(grp.available_balance) : 0;
                    const allocVal = parseFloat(a.amount) || 0;
                    const isExceeding = allocVal > avail;
                    const isZeroOrNegative = allocVal <= 0 && a.amount !== '';

                    return (
                      <div 
                        key={a.groupId}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isExceeding 
                            ? 'bg-destructive/5 border-destructive/30' 
                            : 'bg-muted/30 border-border/70 hover:border-border'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-foreground">{grp?.code}</span>
                                <span className="text-xs font-semibold text-foreground">{grp?.name}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground">Available Balance:</span>
                                <span className={`font-mono font-semibold text-[11px] ${avail > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                  ৳{avail.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Allocation Input & Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleAllocateMax(a.groupId)}
                              className="px-2 py-1 text-[11px] font-medium border border-border/80 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                              title="Allocate up to available balance or remaining needed"
                            >
                              Auto-Fill
                            </button>

                            <div className="relative w-32 sm:w-36">
                              <span className="text-xs font-bold text-muted-foreground absolute left-2.5 top-2">৳</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                required
                                value={a.amount}
                                onChange={(e) => handleAllocationChange(a.groupId, e.target.value)}
                                className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border text-right focus:outline-none focus:ring-1 ${
                                  isExceeding
                                    ? 'border-destructive text-destructive focus:ring-destructive bg-destructive/10'
                                    : 'border-border bg-background focus:ring-primary'
                                }`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveGroup(a.groupId)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Remove group allocation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Error warnings per row */}
                        {isExceeding && (
                          <div className="mt-2 text-[11px] text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Allocation exceeds Group {grp?.code}&apos;s available balance of ৳{avail.toLocaleString()}.</span>
                          </div>
                        )}
                        {isZeroOrNegative && (
                          <div className="mt-2 text-[11px] text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Allocation amount must be greater than zero.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Summary Sidebar (1 col) */}
          <div className="space-y-6">
            
            {/* Allocation Live Balance Card */}
            <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4 sticky top-6">
              <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2 pb-3 border-b border-border/50">
                <Receipt className="w-4 h-4 text-primary" />
                <span>Financial Integrity Check</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Required Sadaqah:</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    ৳{targetTotal > 0 ? targetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Total Allocated:</span>
                  <span className={`font-mono font-bold text-sm ${isAllocationBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                    ৳{currentAllocatedSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Balance Difference:</span>
                  <span className={`font-mono font-bold text-sm ${
                    isAllocationBalanced 
                      ? 'text-emerald-700 dark:text-emerald-400' 
                      : remainingDifference > 0 
                        ? 'text-amber-700 dark:text-amber-400' 
                        : 'text-destructive'
                  }`}>
                    {isAllocationBalanced ? '৳0.00 (Balanced)' : (remainingDifference > 0 ? `৳${remainingDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })} remaining` : `+৳${Math.abs(remainingDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })} over`)}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className={`p-3 rounded-xl border text-xs font-medium space-y-1 ${
                  isAllocationBalanced && allocationErrors.length === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isAllocationBalanced && allocationErrors.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Ready to Commit</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Allocation Mismatch</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {isAllocationBalanced && allocationErrors.length === 0
                      ? 'All funding group allocations strictly equal the total required amount with sufficient balances.'
                      : targetTotal <= 0
                        ? 'Please enter the total required Sadaqah amount.'
                        : remainingDifference > 0
                          ? `Allocate ৳${remainingDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })} more from one or more groups.`
                          : `Allocations exceed total by ৳${Math.abs(remainingDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`}
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all ${
                    canSubmit
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-primary/20'
                      : 'bg-muted text-muted-foreground cursor-not-allowed border border-border/50'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Posting Transaction...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Post Sadaqah Payment</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                <p className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-primary shrink-0" />
                  <span>Row-level lock serializes concurrent withdrawals.</span>
                </p>
                <p className="flex items-center gap-1">
                  <Receipt className="w-3 h-3 text-primary shrink-0" />
                  <span>Deduction and ledger recorded atomically.</span>
                </p>
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}
