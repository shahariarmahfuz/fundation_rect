'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Wallet, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  UsersRound, 
  Receipt, 
  CreditCard, 
  ArrowRight, 
  Plus, 
  Trash2, 
  History, 
  Landmark, 
  DollarSign, 
  Layers, 
  ShieldCheck, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Printer
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type BeneficiaryOption = {
  id: number;
  beneficiary_id: string;
  name: string;
  phone?: string;
};

type LoanOption = {
  id: number;
  loan_id: string;
  beneficiary_id: number;
  loan_date: string;
  principal_amount: string | number;
  amount_repaid: string | number;
  outstanding_principal: string | number;
  repayment_arrangement: string;
  next_due_date?: string;
  funding_allocations: {
    group_id: number;
    group_code: string;
    group_name: string;
    amount: string | number;
  }[];
  beneficiary: {
    id: number;
    beneficiary_id: string;
    name: string;
  };
};

type GroupOption = {
  id: number;
  code: string;
  name: string;
  status: string;
  available_balance: string | number;
};

type AllocationState = {
  groupId: number;
  amount: string;
};

type RepaymentRow = {
  id: number;
  receipt_id: string;
  loan_id: number;
  loan_code: string;
  beneficiary_id: number;
  beneficiary_code: string;
  beneficiary_name: string;
  repayment_date: string;
  amount: string | number;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
  status: string;
  recorded_by_name?: string;
  allocations: {
    group_id: number;
    group_code: string;
    group_name: string;
    amount: string | number;
  }[];
  created_at: string;
};

function RepaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLoanId = searchParams.get('loan_id');
  const { hasPermission, user } = useAuth();

  // Active Tab: 'record' or 'history'
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');

  // Form States
  const [nextReceiptId, setNextReceiptId] = useState<string>('QHR-0001');
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | ''>('');
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [isBenDropdownOpen, setIsBenDropdownOpen] = useState(false);

  const [eligibleLoans, setEligibleLoans] = useState<LoanOption[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<number | ''>('');

  const [repaymentDate, setRepaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [repaymentAmount, setRepaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Receiving Group Allocations
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  // Page States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<RepaymentRow | null>(null);

  // History Tab States
  const [historyItems, setHistoryItems] = useState<RepaymentRow[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalSum, setHistoryTotalSum] = useState<string | number>('0.00');
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load Beneficiaries, Groups, Preview next receipt ID
  useEffect(() => {
    async function init() {
      try {
        setLoadingInitial(true);
        setErrorMsg(null);

        const [bRes, gRes, idRes] = await Promise.all([
          fetch('/api/beneficiaries?limit=200&status=Active', { credentials: 'include' }),
          fetch('/api/qard-hasan/active-groups-with-balance', { credentials: 'include' }),
          fetch('/api/qard-hasan/next-repay-id', { credentials: 'include' })
        ]);

        if (bRes.ok) {
          const bData = await bRes.json();
          setBeneficiaries(bData.items || []);
        }

        if (gRes.ok) {
          const gData = await gRes.json();
          setAllGroups(gData);
        }

        if (idRes.ok) {
          const idData = await idRes.json();
          if (idData.next_id) setNextReceiptId(idData.next_id);
        }
      } catch (err: any) {
        console.error('Error loading initial repayment data', err);
        setErrorMsg('Failed to initialize repayment form.');
      } finally {
        setLoadingInitial(false);
      }
    }
    init();
  }, []);

  // Fetch eligible loans when beneficiary changes (or all eligible loans if not selected)
  const fetchEligibleLoans = useCallback(async (bId?: number) => {
    try {
      const url = bId 
        ? `/api/qard-hasan/eligible-loans?beneficiary_id=${bId}`
        : `/api/qard-hasan/eligible-loans`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEligibleLoans(data);

        // If preselectedLoanId is set, find and select it
        if (preselectedLoanId) {
          const pId = parseInt(preselectedLoanId);
          const found = data.find((l: LoanOption) => l.id === pId);
          if (found) {
            setSelectedLoanId(found.id);
            setSelectedBeneficiaryId(found.beneficiary_id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching eligible loans', err);
    }
  }, [preselectedLoanId]);

  useEffect(() => {
    fetchEligibleLoans(selectedBeneficiaryId ? Number(selectedBeneficiaryId) : undefined);
  }, [selectedBeneficiaryId, fetchEligibleLoans]);

  // Selected Loan Object
  const selectedLoan = eligibleLoans.find(l => l.id === selectedLoanId);

  // If a loan is selected, auto-populate receiving groups from funding groups if allocations empty
  useEffect(() => {
    if (selectedLoan && allocations.length === 0 && selectedLoan.funding_allocations.length > 0) {
      // Default receiving group to first funding group
      setAllocations([{
        groupId: selectedLoan.funding_allocations[0].group_id,
        amount: ''
      }]);
    }
  }, [selectedLoan, allocations.length]);

  // Calculations
  const numericRepay = parseFloat(repaymentAmount) || 0;
  const loanOutstanding = selectedLoan ? parseFloat(String(selectedLoan.outstanding_principal)) || 0 : 0;
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remainingAllocation = Math.round((numericRepay - totalAllocated) * 100) / 100;
  const isAllocationBalanced = numericRepay > 0 && Math.abs(remainingAllocation) < 0.009;

  // Quick Amount Buttons
  const setFullOutstanding = () => {
    if (loanOutstanding > 0) {
      const amt = loanOutstanding.toFixed(2);
      setRepaymentAmount(amt);
      if (allocations.length === 1) {
        setAllocations([{ ...allocations[0], amount: amt }]);
      }
    }
  };

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

  const splitEquallyAcrossSelected = () => {
    if (numericRepay <= 0 || allocations.length === 0) return;
    const count = allocations.length;
    const base = Math.floor((numericRepay / count) * 100) / 100;
    let rem = Math.round((numericRepay - base * count) * 100) / 100;

    setAllocations(allocations.map((a, idx) => ({
      ...a,
      amount: (idx === 0 ? base + rem : base).toFixed(2)
    })));
  };

  // Return to original funding groups proportionally
  const allocateToOriginalLendingGroups = () => {
    if (!selectedLoan || numericRepay <= 0 || selectedLoan.funding_allocations.length === 0) return;
    const totalPrincipal = parseFloat(String(selectedLoan.principal_amount)) || 1;
    
    let sumAssigned = 0;
    const newAllocs: AllocationState[] = [];

    selectedLoan.funding_allocations.forEach((fa, idx) => {
      const faAmt = parseFloat(String(fa.amount)) || 0;
      const ratio = faAmt / totalPrincipal;
      const share = Math.floor(numericRepay * ratio * 100) / 100;
      sumAssigned += share;
      newAllocs.push({
        groupId: fa.group_id,
        amount: share.toFixed(2)
      });
    });

    // Add remainder cents to first group
    const rem = Math.round((numericRepay - sumAssigned) * 100) / 100;
    if (newAllocs.length > 0 && rem !== 0) {
      newAllocs[0].amount = (parseFloat(newAllocs[0].amount) + rem).toFixed(2);
    }

    setAllocations(newAllocs);
  };

  // Validation
  const validateForm = (): string | null => {
    if (!selectedLoanId) return 'Please select an eligible Qard Hasan loan.';
    if (!repaymentDate) return 'Repayment date is required.';
    if (numericRepay <= 0) return 'Repayment amount must be greater than zero.';
    if (numericRepay > loanOutstanding) {
      return `Repayment amount (৳${numericRepay.toFixed(2)}) cannot exceed outstanding principal (৳${loanOutstanding.toFixed(2)}).`;
    }
    if (allocations.length === 0) return 'Please select at least one receiving group.';
    if (!isAllocationBalanced) {
      return `Receiving group allocations (৳${totalAllocated.toFixed(2)}) must exactly equal the repayment amount (৳${numericRepay.toFixed(2)}).`;
    }
    for (const a of allocations) {
      const amt = parseFloat(a.amount) || 0;
      if (amt <= 0) return 'Each receiving group allocation must be greater than zero.';
    }
    return null;
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
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

      const payload = {
        loan_id: Number(selectedLoanId),
        repayment_date: repaymentDate,
        amount: numericRepay,
        payment_method: paymentMethod,
        allocations: allocations.map(a => ({
          group_id: a.groupId,
          amount: parseFloat(a.amount)
        })),
        transaction_reference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined
      };

      const res = await fetch('/api/qard-hasan/repayments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to record repayment.');
      }

      const receipt = await res.json();
      setSuccessReceipt(receipt);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Refresh list of eligible loans and next ID
      fetchEligibleLoans(selectedBeneficiaryId ? Number(selectedBeneficiaryId) : undefined);
      fetch('/api/qard-hasan/next-repay-id', { credentials: 'include' })
        .then(r => r.json())
        .then(d => d.next_id && setNextReceiptId(d.next_id))
        .catch(() => {});
    } catch (err: any) {
      console.error('Error posting repayment', err);
      setErrorMsg(err.message || 'Error occurred while recording repayment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch History Tab data
  const fetchRepaymentHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams();
      params.append('page', historyPage.toString());
      params.append('limit', '10');
      if (historySearch.trim()) params.append('q', historySearch.trim());

      const res = await fetch(`/api/qard-hasan/repayments?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.items || []);
        setHistoryTotal(data.total || 0);
        setHistoryTotalPages(data.total_pages || 1);
        setHistoryTotalSum(data.total_repaid_sum || '0.00');
      }
    } catch (err) {
      console.error('Error fetching repayment history', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historySearch]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchRepaymentHistory();
    }
  }, [activeTab, fetchRepaymentHistory]);

  if (!hasPermission('qard_hasan.repayment.create') && !hasPermission('qard_hasan.repayment.view')) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-12 h-12 mb-3 text-destructive/80" strokeWidth={1.5} />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm mt-1 max-w-md">You do not have permission to access Qard Hasan repayments. Please contact an administrator.</p>
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
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Qard Hasan Repayment
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Record principal loan repayments, allocate returns into group fund accounts, and generate official receipts.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/60 self-start sm:self-auto">
          {hasPermission('qard_hasan.repayment.create') && (
            <button
              type="button"
              onClick={() => setActiveTab('record')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'record'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Repayment</span>
            </button>
          )}
          {hasPermission('qard_hasan.repayment.view') && (
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Repayment History</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Receipt Modal/Card */}
      {successReceipt && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Repayment Posted Successfully!
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Receipt ID <strong className="font-mono">{successReceipt.receipt_id}</strong> for loan{' '}
                  <strong className="font-mono">{successReceipt.loan_code}</strong>. Receiving group funds and beneficiary ledger have been credited.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessReceipt(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 p-1"
            >
              ×
            </button>
          </div>

          <div className="bg-white dark:bg-card border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-muted-foreground">
              <span>Receipt Ref:</span>
              <span className="font-bold text-foreground">{successReceipt.receipt_id}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Beneficiary:</span>
              <span className="font-bold text-foreground">{successReceipt.beneficiary_name} ({successReceipt.beneficiary_code})</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Amount Repaid:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                ৳{parseFloat(String(successReceipt.amount)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Payment Method:</span>
              <span className="text-foreground">{successReceipt.payment_method}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Receiving Groups:</span>
              <span className="text-foreground">
                {successReceipt.allocations.map(a => `${a.group_code} (৳${parseFloat(String(a.amount)).toFixed(2)})`).join(', ')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/50 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccessReceipt(null);
                setRepaymentAmount('');
                setTransactionReference('');
                setNotes('');
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
            >
              Record Another Payment
            </button>
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

      {/* TAB 1: RECORD REPAYMENT */}
      {activeTab === 'record' && (
        <form onSubmit={handleRecordRepayment} className="space-y-6">
          {/* Step 1: Beneficiary & Eligible Loan Selection */}
          <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UsersRound className="w-4 h-4 text-primary" />
                1. Select Beneficiary & Eligible Loan
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Receipt ID:</span>
                <span className="px-2.5 py-0.5 rounded font-mono text-xs font-bold bg-muted text-foreground border border-border/50">
                  {nextReceiptId}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Beneficiary Filter */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Beneficiary (Optional filter)
                </label>
                <select
                  value={selectedBeneficiaryId}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setSelectedBeneficiaryId(val);
                    setSelectedLoanId('');
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                >
                  <option value="">All Beneficiaries with Active Loans</option>
                  {beneficiaries.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.beneficiary_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Outstanding Loan Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Active Qard Hasan Loan <span className="text-destructive">*</span>
                </label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setSelectedLoanId(id);
                    if (id) {
                      const l = eligibleLoans.find(loan => loan.id === id);
                      if (l) setSelectedBeneficiaryId(l.beneficiary_id);
                    }
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-hidden focus:border-primary"
                  required
                >
                  <option value="">Select outstanding loan...</option>
                  {eligibleLoans.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.loan_id} — {l.beneficiary?.name} (Outstanding: ৳{parseFloat(String(l.outstanding_principal)).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Loan Spotlight Card */}
            {selectedLoan && (
              <div className="bg-muted/30 border border-border/60 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Beneficiary</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedLoan.beneficiary?.name}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Principal Disbursed</span>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    ৳{parseFloat(String(selectedLoan.principal_amount)).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Already Repaid</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ৳{parseFloat(String(selectedLoan.amount_repaid)).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Outstanding Balance</span>
                  <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 text-sm">
                    ৳{loanOutstanding.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Payment Details */}
          <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
              <CreditCard className="w-4 h-4 text-primary" />
              2. Repayment Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Repayment Date */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Repayment Date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="date"
                    value={repaymentDate}
                    onChange={(e) => setRepaymentDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                    required
                  />
                </div>
              </div>

              {/* Repayment Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Repayment Amount (৳) <span className="text-destructive">*</span>
                  </label>
                  {selectedLoan && (
                    <button
                      type="button"
                      onClick={setFullOutstanding}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Pay Full (৳{loanOutstanding.toFixed(2)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={loanOutstanding || undefined}
                    placeholder="0.00"
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-hidden focus:border-primary"
                    required
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-hidden focus:border-primary"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Transaction Reference */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank slip #, bKash TrxID, Cheque #"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Receiving Group Fund Accounting */}
          <div className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  3. Receiving Group Accounts
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Designate which group fund account(s) will be credited with the received money.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isAllocationBalanced 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  Credited: ৳{totalAllocated.toFixed(2)} / ৳{numericRepay.toFixed(2)}
                </span>
                {remainingAllocation !== 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    (Diff: ৳{remainingAllocation.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            {/* Helper Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {selectedLoan && selectedLoan.funding_allocations.length > 0 && (
                <button
                  type="button"
                  onClick={allocateToOriginalLendingGroups}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 transition-colors"
                >
                  Allocate Proportionally to Original Lending Groups
                </button>
              )}
              {allocations.length > 1 && (
                <button
                  type="button"
                  onClick={splitEquallyAcrossSelected}
                  className="px-2.5 py-1 text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground rounded border border-border/50"
                >
                  Split Equally Across Selected ({allocations.length} Groups)
                </button>
              )}
            </div>

            {/* Quick Pick Buttons for Groups */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Select Group:</span>
              {allGroups.map(g => {
                const isSelected = allocations.some(a => a.groupId === g.id);
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
                    className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                        : 'bg-background hover:bg-muted text-foreground border-border/70'
                    }`}
                  >
                    <span>{g.code} ({g.name})</span>
                  </button>
                );
              })}
            </div>

            {/* Allocations Table */}
            {allocations.length === 0 ? (
              <div className="p-6 border border-dashed border-border/80 rounded-xl text-center text-xs text-muted-foreground">
                No receiving group selected. Please click an available group above to receive the funds.
              </div>
            ) : (
              <div className="border border-border/70 rounded-lg overflow-hidden divide-y divide-border/40">
                {allocations.map(a => {
                  const g = allGroups.find(grp => grp.id === a.groupId);
                  return (
                    <div key={a.groupId} className="p-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-foreground">{g?.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground ml-1.5">
                          {g?.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="relative w-36">
                          <span className="absolute left-2.5 top-1.5 text-xs font-bold text-muted-foreground">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={a.amount}
                            onChange={(e) => updateAllocationAmount(a.groupId, e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-hidden focus:border-primary"
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

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <Link
              href="/qard-hasan/manage"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-border/70 hover:bg-muted text-xs font-semibold text-center transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !isAllocationBalanced || !selectedLoanId || numericRepay <= 0}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Recording Repayment...</span>
                </>
              ) : (
                <>
                  <span>Post Repayment Receipt</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: REPAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Search & Total Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/60 rounded-xl p-4 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search receipt ID, loan ID, beneficiary..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total Repayments:</span>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                ৳{parseFloat(String(historyTotalSum)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-4 py-3">Receipt ID</th>
                    <th className="px-4 py-3">Loan ID</th>
                    <th className="px-4 py-3">Beneficiary</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount (৳)</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Receiving Groups</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                          <span>Loading history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                        No repayments found.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          {r.receipt_id}
                        </td>
                        <td className="px-4 py-3 font-mono text-primary font-semibold">
                          {r.loan_code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{r.beneficiary_name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{r.beneficiary_code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.repayment_date}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ৳{parseFloat(String(r.amount)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-muted text-[10px] text-foreground font-medium">
                            {r.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.allocations.map((a, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                                {a.group_code} (৳{parseFloat(String(a.amount)).toFixed(0)})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.recorded_by_name || 'System'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* History Pagination */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Showing <strong className="text-foreground">{historyItems.length}</strong> of{' '}
                <strong className="text-foreground">{historyTotal}</strong> total repayments
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage(historyPage - 1)}
                  className="px-2.5 py-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="font-mono px-2">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <button
                  type="button"
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage(historyPage + 1)}
                  className="px-2.5 py-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QardHasanRepaymentPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-xs text-muted-foreground">
        Loading Qard Hasan Repayments...
      </div>
    }>
      <RepaymentContent />
    </Suspense>
  );
}
