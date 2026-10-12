'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Landmark, 
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
  HelpCircle,
  Clock,
  Layers,
  Sparkles
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
  available_balance: string | number;
  total_received: string | number;
  total_spent: string | number;
};

type AllocationState = {
  groupId: number;
  amount: string;
};

type InstallmentRow = {
  installment_number: number;
  due_date: string;
  principal_due: string;
};

export default function AddQardHasanPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // Next Loan ID Preview
  const [nextId, setNextId] = useState<string>('QH-0001');

  // Form Fields
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | ''>('');
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [isBeneficiaryDropdownOpen, setIsBeneficiaryDropdownOpen] = useState(false);

  const [loanDate, setLoanDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [principalAmount, setPrincipalAmount] = useState<string>('');
  const [repaymentArrangement, setRepaymentArrangement] = useState<'One-time' | 'Installments'>('Installments');
  const [oneTimeDueDate, setOneTimeDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  // Installment schedule settings
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [installmentCount, setInstallmentCount] = useState<number>(4);
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [schedules, setSchedules] = useState<InstallmentRow[]>([]);

  const [purpose, setPurpose] = useState<string>('');
  const [internalReference, setInternalReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Groups and Allocations
  const [groupOptions, setGroupOptions] = useState<GroupBalanceOption[]>([]);
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  // Page States
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
          fetch('/api/qard-hasan/active-groups-with-balance', { credentials: 'include' }),
          fetch('/api/qard-hasan/next-id', { credentials: 'include' })
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
          if (idData.next_id) {
            setNextId(idData.next_id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching initial Qard Hasan data', err);
        setErrorMsg('Failed to load required data. Please check connection.');
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  // Generate Installment Schedule automatically
  const generateSchedule = () => {
    const principal = parseFloat(principalAmount);
    if (isNaN(principal) || principal <= 0) {
      setErrorMsg('Please enter a valid principal amount before generating a schedule.');
      return;
    }
    if (installmentCount < 1) return;

    const baseAmount = Math.floor((principal / installmentCount) * 100) / 100;
    let remainder = Math.round((principal - baseAmount * installmentCount) * 100) / 100;

    const startDate = new Date(firstDueDate || loanDate);
    const newSchedules: InstallmentRow[] = [];

    for (let i = 1; i <= installmentCount; i++) {
      const d = new Date(startDate);
      if (frequency === 'monthly') {
        d.setMonth(d.getMonth() + (i - 1));
      } else if (frequency === 'biweekly') {
        d.setDate(d.getDate() + (i - 1) * 14);
      } else {
        d.setDate(d.getDate() + (i - 1) * 7);
      }

      // Add remainder cents to first installment
      const installmentAmount = (i === 1 ? baseAmount + remainder : baseAmount).toFixed(2);
      newSchedules.push({
        installment_number: i,
        due_date: d.toISOString().split('T')[0],
        principal_due: installmentAmount
      });
    }

    setSchedules(newSchedules);
  };

  // Keep schedule in sync if principal or count changes when arrangement is Installments
  useEffect(() => {
    if (repaymentArrangement === 'Installments' && principalAmount && parseFloat(principalAmount) > 0) {
      generateSchedule();
    }
  }, [principalAmount, installmentCount, frequency, firstDueDate, repaymentArrangement]);

  // Selected Beneficiary info
  const selectedBeneficiary = beneficiaries.find(b => b.id === selectedBeneficiaryId);

  // Filtered beneficiaries for dropdown search
  const filteredBeneficiaries = beneficiaries.filter(b => 
    b.name.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
    b.beneficiary_id.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
    (b.phone && b.phone.includes(beneficiarySearch))
  );

  // Group Allocation Handlers
  const addGroupAllocation = (groupId: number) => {
    if (allocations.some(a => a.groupId === groupId)) return;
    setAllocations([...allocations, { groupId, amount: '' }]);
  };

  const removeGroupAllocation = (groupId: number) => {
    setAllocations(allocations.filter(a => a.groupId !== groupId));
  };

  const updateAllocationAmount = (groupId: number, val: string) => {
    setAllocations(allocations.map(a => a.groupId === groupId ? { ...a, amount: val } : a));
  };

  // Quick Split Allocations
  const autoAllocateSingle = (groupId: number) => {
    if (!principalAmount || parseFloat(principalAmount) <= 0) return;
    setAllocations([{ groupId, amount: parseFloat(principalAmount).toFixed(2) }]);
  };

  const splitEquallyAcrossSelected = () => {
    const total = parseFloat(principalAmount);
    if (isNaN(total) || total <= 0 || allocations.length === 0) return;
    const count = allocations.length;
    const base = Math.floor((total / count) * 100) / 100;
    let rem = Math.round((total - base * count) * 100) / 100;

    setAllocations(allocations.map((a, idx) => ({
      ...a,
      amount: (idx === 0 ? base + rem : base).toFixed(2)
    })));
  };

  // Calculations
  const numericPrincipal = parseFloat(principalAmount) || 0;
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remainingAllocation = Math.round((numericPrincipal - totalAllocated) * 100) / 100;
  const isAllocationBalanced = numericPrincipal > 0 && Math.abs(remainingAllocation) < 0.009;

  const totalScheduled = schedules.reduce((sum, s) => sum + (parseFloat(s.principal_due) || 0), 0);
  const isScheduleBalanced = repaymentArrangement === 'One-time' || Math.abs(numericPrincipal - totalScheduled) < 0.009;

  // Validation
  const validateForm = (): string | null => {
    if (!selectedBeneficiaryId) return 'Please select a beneficiary.';
    if (!loanDate) return 'Loan date is required.';
    if (numericPrincipal <= 0) return 'Principal amount must be greater than zero.';
    if (allocations.length === 0) return 'Please select at least one funding group.';
    if (!isAllocationBalanced) return `Group allocations sum (৳${totalAllocated.toFixed(2)}) must exactly equal the principal (৳${numericPrincipal.toFixed(2)}).`;

    // Check balances
    for (const alloc of allocations) {
      const g = groupOptions.find(grp => grp.id === alloc.groupId);
      const allocAmt = parseFloat(alloc.amount) || 0;
      if (allocAmt <= 0) return `Allocation for group ${g?.code || alloc.groupId} must be greater than zero.`;
      const avail = parseFloat(String(g?.available_balance || '0'));
      if (allocAmt > avail) {
        return `Group ${g?.code} (${g?.name}) has insufficient balance. Available: ৳${avail.toFixed(2)}, Allocated: ৳${allocAmt.toFixed(2)}.`;
      }
    }

    if (repaymentArrangement === 'Installments') {
      if (!firstDueDate) return 'First Due Date is required for installment repayment.';
      if (schedules.length === 0) return 'At least one installment schedule is required.';
      if (!isScheduleBalanced) {
        return `Installments sum (৳${totalScheduled.toFixed(2)}) must equal principal (৳${numericPrincipal.toFixed(2)}).`;
      }
    } else {
      if (!oneTimeDueDate) return 'Due Date is required for one-time repayment.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setErrorMsg(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload: any = {
        beneficiary_id: Number(selectedBeneficiaryId),
        loan_date: loanDate,
        principal_amount: numericPrincipal,
        repayment_arrangement: repaymentArrangement,
        allocations: allocations.map(a => ({
          group_id: a.groupId,
          amount: parseFloat(a.amount)
        })),
        purpose: purpose.trim() || undefined,
        internal_reference: internalReference.trim() || undefined,
        notes: notes.trim() || undefined
      };

      if (repaymentArrangement === 'Installments') {
        payload.first_due_date = firstDueDate;
        payload.expected_completion_date = schedules[schedules.length - 1]?.due_date;
        payload.schedules = schedules.map(s => ({
          installment_number: s.installment_number,
          due_date: s.due_date,
          principal_due: parseFloat(s.principal_due)
        }));
      } else {
        payload.expected_completion_date = oneTimeDueDate;
        payload.first_due_date = oneTimeDueDate;
      }

      const res = await fetch('/api/qard-hasan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to issue Qard Hasan loan.');
      }

      const result = await res.json();
      setSuccessResult(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error creating Qard Hasan loan', err);
      setErrorMsg(err.message || 'Error occurred while saving transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission('qard_hasan.create')) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-12 h-12 mb-3 text-destructive/80" strokeWidth={1.5} />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm mt-1 max-w-md">You do not have permission to issue Qard Hasan loans. Please contact a system administrator.</p>
          <Link href="/" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Add Qard Hasan
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Interest-Free
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Issue an interest-free loan funded by group accounts to an eligible beneficiary.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/qard-hasan/manage"
            className="px-3.5 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium transition-colors"
          >
            Manage Loans
          </Link>
          <Link
            href="/qard-hasan/repayment"
            className="px-3.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
          >
            Record Repayment
          </Link>
        </div>
      </div>

      {/* Success Banner */}
      {successResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Qard Hasan Loan Issued Successfully!
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                Loan ID <strong className="font-mono">{successResult.loan_id}</strong> for{' '}
                <strong>{successResult.beneficiary?.name}</strong> has been posted. Group funds and beneficiary ledger have been deducted atomically.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/qard-hasan/manage"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  View in Manage Loans
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessResult(null);
                    setPrincipalAmount('');
                    setAllocations([]);
                    setSelectedBeneficiaryId('');
                    setPurpose('');
                    setNotes('');
                    // refresh next ID
                    fetch('/api/qard-hasan/next-id', { credentials: 'include' })
                      .then(r => r.json())
                      .then(d => d.next_id && setNextId(d.next_id))
                      .catch(() => {});
                  }}
                  className="px-3 py-1.5 bg-white dark:bg-card border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  Issue Another Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-medium flex-1">{errorMsg}</div>
        </div>
      )}

      {/* Interest-Free Guarantee Callout */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-xl p-3.5 sm:p-4 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-xs text-foreground/80 leading-relaxed">
          <strong className="text-emerald-700 dark:text-emerald-300 font-semibold">Qard Hasan Principle:</strong> All loans are strictly interest-free with 0% markup, no late penalties, and principal-only repayment. The beneficiary is expected to repay only the exact principal disbursed.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Loan Identifiers & Date Section */}
        <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              1. Loan Origination & Beneficiary
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Generated ID:</span>
              <span className="px-2.5 py-0.5 rounded font-mono text-xs font-bold bg-muted text-foreground border border-border/50">
                {nextId}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Beneficiary Selector */}
            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Beneficiary <span className="text-destructive">*</span>
              </label>

              <div 
                onClick={() => setIsBeneficiaryDropdownOpen(!isBeneficiaryDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-xs cursor-pointer hover:border-primary/50 transition-colors"
              >
                {selectedBeneficiary ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground truncate">{selectedBeneficiary.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono shrink-0">
                      {selectedBeneficiary.beneficiary_id}
                    </span>
                    {selectedBeneficiary.phone && (
                      <span className="text-muted-foreground text-[11px] truncate hidden sm:inline">
                        • {selectedBeneficiary.phone}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select an active beneficiary...</span>
                )}
                <UsersRound className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>

              {/* Beneficiary Dropdown Modal */}
              {isBeneficiaryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsBeneficiaryDropdownOpen(false)} />
                  <div className="absolute top-[64px] left-0 w-full bg-card border border-border rounded-xl shadow-xl z-40 p-2 space-y-2 animate-in fade-in duration-100 max-h-72 flex flex-col">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search beneficiary name, ID or phone..."
                        value={beneficiarySearch}
                        onChange={(e) => setBeneficiarySearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 space-y-1">
                      {filteredBeneficiaries.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No matching active beneficiaries found.
                        </div>
                      ) : (
                        filteredBeneficiaries.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => {
                              setSelectedBeneficiaryId(b.id);
                              setIsBeneficiaryDropdownOpen(false);
                            }}
                            className={`px-3 py-2 rounded-lg cursor-pointer text-xs flex items-center justify-between transition-colors ${
                              selectedBeneficiaryId === b.id
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{b.name}</span>
                              <span className={`text-[10px] ${selectedBeneficiaryId === b.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                ID: {b.beneficiary_id} {b.phone ? `• ${b.phone}` : ''}
                              </span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-1 rounded bg-black/10 dark:bg-white/10 shrink-0">
                              {b.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Loan Date */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Loan Date <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                  required
                />
              </div>
            </div>

            {/* Principal Amount */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Principal Amount (৳) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-hidden focus:border-primary"
                  required
                />
              </div>
            </div>

            {/* Repayment Arrangement Selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Repayment Arrangement <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRepaymentArrangement('Installments')}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    repaymentArrangement === 'Installments'
                      ? 'border-primary bg-primary/10 text-primary shadow-xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Scheduled Installments
                </button>
                <button
                  type="button"
                  onClick={() => setRepaymentArrangement('One-time')}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    repaymentArrangement === 'One-time'
                      ? 'border-primary bg-primary/10 text-primary shadow-xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  One-time Repayment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Repayment Schedule Section */}
        <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              2. Repayment Schedule ({repaymentArrangement})
            </h2>
            {repaymentArrangement === 'Installments' && (
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                isScheduleBalanced ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
              }`}>
                Scheduled: ৳{totalScheduled.toFixed(2)} / ৳{numericPrincipal.toFixed(2)}
              </span>
            )}
          </div>

          {repaymentArrangement === 'One-time' ? (
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Expected Completion / Due Date <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="date"
                  value={oneTimeDueDate}
                  onChange={(e) => setOneTimeDueDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                The full principal amount of ৳{numericPrincipal.toFixed(2)} is agreed to be returned by this date.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    First Due Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Bi-weekly (14 days)</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Number of Installments
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
                  />
                </div>
              </div>

              {/* Schedules Table */}
              <div className="border border-border/70 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2 w-16">Inst #</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2">Principal Due (৳)</th>
                      <th className="px-3 py-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {schedules.map((s, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-muted-foreground">
                          #{s.installment_number}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={s.due_date}
                            onChange={(e) => {
                              const updated = [...schedules];
                              updated[idx].due_date = e.target.value;
                              setSchedules(updated);
                            }}
                            className="px-2 py-1 bg-background border border-border/60 rounded text-xs focus:outline-hidden focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="relative max-w-[160px]">
                            <span className="absolute left-2 top-1 text-[11px] text-muted-foreground">৳</span>
                            <input
                              type="number"
                              step="0.01"
                              value={s.principal_due}
                              onChange={(e) => {
                                const updated = [...schedules];
                                updated[idx].principal_due = e.target.value;
                                setSchedules(updated);
                              }}
                              className="w-full pl-6 pr-2 py-1 bg-background border border-border/60 rounded text-xs font-mono font-semibold focus:outline-hidden focus:border-primary"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {schedules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = schedules.filter((_, i) => i !== idx).map((row, i) => ({
                                  ...row,
                                  installment_number: i + 1
                                }));
                                setSchedules(updated);
                              }}
                              className="text-muted-foreground hover:text-destructive p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Group Funding Allocations Section */}
        <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                3. Group Funding Allocations
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Select one or multiple groups providing the loan capital. Sum must equal principal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                isAllocationBalanced 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                Allocated: ৳{totalAllocated.toFixed(2)} / ৳{numericPrincipal.toFixed(2)}
              </span>
              {remainingAllocation !== 0 && (
                <span className="text-[11px] text-muted-foreground">
                  (Diff: ৳{remainingAllocation.toFixed(2)})
                </span>
              )}
            </div>
          </div>

          {/* Group Selector and Quick-Pick */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Available Groups:</span>
              {groupOptions.map(g => {
                const isSelected = allocations.some(a => a.groupId === g.id);
                const avail = parseFloat(String(g.available_balance || '0'));
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        removeGroupAllocation(g.id);
                      } else {
                        addGroupAllocation(g.id);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                        : 'bg-background hover:bg-muted text-foreground border-border/70'
                    }`}
                  >
                    <span>{g.code} ({g.name})</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      Avail: ৳{avail.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            {allocations.length > 1 && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={splitEquallyAcrossSelected}
                  className="px-2.5 py-1 text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground rounded border border-border/50"
                >
                  Split Equally Across Selected ({allocations.length} Groups)
                </button>
              </div>
            )}

            {/* Allocation rows */}
            {allocations.length === 0 ? (
              <div className="p-6 border border-dashed border-border/80 rounded-xl text-center text-xs text-muted-foreground">
                No funding group selected. Please click an available group button above to allocate funds.
              </div>
            ) : (
              <div className="border border-border/70 rounded-lg overflow-hidden divide-y divide-border/40">
                {allocations.map(a => {
                  const g = groupOptions.find(grp => grp.id === a.groupId);
                  const avail = parseFloat(String(g?.available_balance || '0'));
                  const currentAlloc = parseFloat(a.amount) || 0;
                  const hasOverdraft = currentAlloc > avail;

                  return (
                    <div key={a.groupId} className="p-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">{g?.name}</span>
                          <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                            {g?.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Available Group Balance: <strong className="font-mono text-foreground">৳{avail.toFixed(2)}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => autoAllocateSingle(a.groupId)}
                          className="px-2 py-1 text-[10px] text-primary hover:bg-primary/10 rounded font-medium border border-primary/20"
                        >
                          Fund Entire Loan
                        </button>

                        <div className="relative w-36">
                          <span className="absolute left-2.5 top-1.5 text-xs font-bold text-muted-foreground">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={a.amount}
                            onChange={(e) => updateAllocationAmount(a.groupId, e.target.value)}
                            className={`w-full pl-7 pr-2.5 py-1.5 bg-background border rounded-lg text-xs font-bold text-foreground focus:outline-hidden ${
                              hasOverdraft ? 'border-destructive ring-1 ring-destructive' : 'border-border focus:border-primary'
                            }`}
                            required
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeGroupAllocation(a.groupId)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Optional Metadata Section */}
        <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
            <FileText className="w-4 h-4 text-primary" />
            4. Additional Details & Reference (Optional)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Loan Purpose / Project
              </label>
              <input
                type="text"
                placeholder="e.g. Small business startup, medical assistance"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                maxLength={255}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Internal Reference
              </label>
              <input
                type="text"
                placeholder="e.g. Committee Approval #2026-04"
                value={internalReference}
                onChange={(e) => setInternalReference(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Notes & Terms
              </label>
              <textarea
                rows={2}
                placeholder="Any special remarks or guarantor information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Link
            href="/qard-hasan/manage"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-border/70 hover:bg-muted text-xs font-semibold text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !isAllocationBalanced || !isScheduleBalanced || !selectedBeneficiaryId}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Processing Loan...</span>
              </>
            ) : (
              <>
                <span>Issue Qard Hasan Loan</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
