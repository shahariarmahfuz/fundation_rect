'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Receipt, 
  PlusCircle, 
  Users, 
  UserCheck, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Search, 
  Layers, 
  CreditCard, 
  Edit3, 
  List, 
  ArrowLeft,
  X,
  ChevronRight,
  ShieldCheck,
  Check,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Mobile Money',
  'Cheque'
];

type SettingData = {
  id: number;
  monthly_amount: string | number;
  currency: string;
  effective_from?: string;
  updated_by_name?: string;
};

type MemberOption = {
  id: number;
  member_id: string;
  name: string;
  phone?: string;
  group_id: number;
  group_code: string;
  group_name: string;
  status: string;
  joining_date?: string;
};

type GroupOption = {
  id: number;
  code: string;
  name: string;
  status: string;
};

function AddContributionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  // Mode: single or batch
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Next Receipt ID Preview
  const [nextId, setNextId] = useState<string>('MC-0001');

  // Global Settings state
  const [setting, setSetting] = useState<SettingData>({
    id: 1,
    monthly_amount: '100.00',
    currency: 'BDT'
  });
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [newMonthlyAmount, setNewMonthlyAmount] = useState('');
  const [updatingSetting, setUpdatingSetting] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);

  // Common fields
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().substring(0, 10);
  const [year, setYear] = useState<number>(currentYear);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Groups and Members
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Single member state
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [paidMonths, setPaidMonths] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [loadingPaidMonths, setLoadingPaidMonths] = useState(false);

  // Batch collection state
  const [batchGroupFilter, setBatchGroupFilter] = useState<number | ''>('');
  const [batchItems, setBatchItems] = useState<{ [memberId: number]: number[] }>({});

  // Submitting / Result state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [singleSuccess, setSingleSuccess] = useState<any | null>(null);
  const [batchSuccess, setBatchSuccess] = useState<any | null>(null);

  // 1. Load initial data: settings, next-id, members, groups
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingInitial(true);
      setErrorMsg(null);

      const [settingRes, idRes, membersRes, groupsRes] = await Promise.all([
        fetch('/api/contributions/settings', { credentials: 'include' }),
        fetch('/api/contributions/next-receipt-id', { credentials: 'include' }),
        fetch('/api/contributions/members-for-collection', { credentials: 'include' }),
        fetch('/api/groups?status=Active&limit=100', { credentials: 'include' })
      ]);

      if (settingRes.ok) {
        const sData = await settingRes.json();
        setSetting(sData);
        setNewMonthlyAmount(String(sData.monthly_amount));
      }

      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData.next_id) setNextId(idData.next_id);
      }

      if (membersRes.ok) {
        const mData = await membersRes.json();
        setAllMembers(mData || []);
      }

      if (groupsRes.ok) {
        const gData = await groupsRes.json();
        setGroups(gData.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load initial contribution data:', err);
      setErrorMsg('Failed to load initial data. Please refresh.');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle URL query parameters (e.g. member_id from Due list)
  useEffect(() => {
    const qMemberId = searchParams.get('member_id');
    const qYear = searchParams.get('year');
    if (qMemberId) {
      setSelectedMemberId(Number(qMemberId));
    }
    if (qYear) {
      setYear(Number(qYear));
    }
  }, [searchParams]);

  // 2. Fetch paid months when selectedMemberId or year changes
  useEffect(() => {
    if (!selectedMemberId) {
      setPaidMonths([]);
      setSelectedMonths([]);
      return;
    }

    async function fetchPaidMonths() {
      try {
        setLoadingPaidMonths(true);
        const res = await fetch(`/api/contributions/member-paid-months/${selectedMemberId}/${year}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setPaidMonths(data.paid_months || []);

          // Pre-select months from query param if available
          const qMonths = searchParams.get('months');
          if (qMonths) {
            const requestedMonths = qMonths.split(',').map(Number).filter(m => !data.paid_months.includes(m));
            setSelectedMonths(requestedMonths);
          } else {
            // Keep existing selections that aren't already paid
            setSelectedMonths(prev => prev.filter(m => !data.paid_months.includes(m)));
          }
        }
      } catch (err) {
        console.error('Failed to fetch member paid months:', err);
      } finally {
        setLoadingPaidMonths(false);
      }
    }

    fetchPaidMonths();
  }, [selectedMemberId, year, searchParams]);

  // Find currently selected member object
  const selectedMember = allMembers.find(m => m.id === Number(selectedMemberId));

  // Toggle single member month selection
  const toggleMonth = (mNum: number) => {
    if (paidMonths.includes(mNum)) return; // Already paid, disabled
    setSelectedMonths(prev => 
      prev.includes(mNum) ? prev.filter(m => m !== mNum) : [...prev, mNum].sort((a, b) => a - b)
    );
  };

  // Select all remaining unpaid months for single member
  const handleSelectAllUnpaid = () => {
    const unpaid: number[] = [];
    for (let m = 1; m <= 12; m++) {
      if (!paidMonths.includes(m)) unpaid.push(m);
    }
    setSelectedMonths(unpaid);
  };

  const handleClearSelectedMonths = () => {
    setSelectedMonths([]);
  };

  // Filtered members for dropdown
  const filteredMembers = allMembers.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.member_id.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.group_name && m.group_name.toLowerCase().includes(memberSearch.toLowerCase())) ||
    (m.group_code && m.group_code.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  // Batch members filtered by group
  const batchFilteredMembers = batchGroupFilter 
    ? allMembers.filter(m => m.group_id === Number(batchGroupFilter))
    : allMembers;

  // Toggle month in batch mode for a specific member
  const toggleBatchMemberMonth = (memId: number, mNum: number) => {
    setBatchItems(prev => {
      const current = prev[memId] || [];
      const updated = current.includes(mNum)
        ? current.filter(m => m !== mNum)
        : [...current, mNum].sort((a, b) => a - b);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[memId];
        return copy;
      }
      return { ...prev, [memId]: updated };
    });
  };

  // Batch total calculation
  const totalBatchMonthsCount = Object.values(batchItems).reduce((sum, months) => sum + months.length, 0);
  const ratePerMonth = Number(setting.monthly_amount) || 100;
  const singleTotalAmount = (selectedMonths.length * ratePerMonth).toFixed(2);
  const batchTotalAmount = (totalBatchMonthsCount * ratePerMonth).toFixed(2);

  // Update Global Monthly Setting Handler
  const handleUpdateSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingError(null);
    const parsed = parseFloat(newMonthlyAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setSettingError('Monthly amount must be greater than zero.');
      return;
    }

    try {
      setUpdatingSetting(true);
      const res = await fetch('/api/contributions/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ monthly_amount: parsed.toFixed(2) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update setting.');
      }
      setSetting(data);
      setShowSettingModal(false);
    } catch (err: any) {
      setSettingError(err.message);
    } finally {
      setUpdatingSetting(false);
    }
  };

  // Single Member Submission
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSingleSuccess(null);

    if (!selectedMemberId) {
      setErrorMsg('Please select a member.');
      return;
    }

    if (selectedMonths.length === 0) {
      setErrorMsg('Please select at least one contribution month.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/contributions/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          member_id: Number(selectedMemberId),
          contribution_year: year,
          months: selectedMonths,
          total_amount: singleTotalAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim() || undefined,
          notes: notes.trim() || undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to record contribution.');
      }

      setSingleSuccess(data);
      // Refresh paid months
      setPaidMonths(prev => [...prev, ...selectedMonths].sort((a, b) => a - b));
      setSelectedMonths([]);
      setTransactionRef('');
      setNotes('');

      // Refresh next preview ID
      const idRes = await fetch('/api/contributions/next-receipt-id', { credentials: 'include' });
      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData.next_id) setNextId(idData.next_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Batch Collection Submission
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBatchSuccess(null);

    const itemsPayload = Object.entries(batchItems).map(([mId, mList]) => ({
      member_id: Number(mId),
      months: mList
    })).filter(item => item.months.length > 0);

    if (itemsPayload.length === 0) {
      setErrorMsg('Please select at least one month for at least one member.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/contributions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contribution_year: year,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim() || undefined,
          notes: notes.trim() || undefined,
          items: itemsPayload
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to record batch contribution.');
      }

      setBatchSuccess(data);
      setBatchItems({});
      setTransactionRef('');
      setNotes('');

      // Refresh preview ID
      const idRes = await fetch('/api/contributions/next-receipt-id', { credentials: 'include' });
      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData.next_id) setNextId(idData.next_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission('contributions.create')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">contributions.create</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/contributions/manage"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Contributions
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <Receipt className="w-5 h-5 text-primary" /> Collect Monthly Contribution
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record regular member monthly contributions and atomically credit the member&apos;s assigned Group Fund.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasPermission('contributions.due_list.view') && (
            <Link
              href="/contributions/due-list"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <Calendar className="w-3.5 h-3.5" /> View Dues
            </Link>
          )}
          {hasPermission('contributions.view') && (
            <Link
              href="/contributions/manage"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground"
            >
              <List className="w-3.5 h-3.5" /> Manage
            </Link>
          )}
        </div>
      </div>

      {/* Global Monthly Contribution Setting Banner */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Global Monthly Contribution Setting:
              </span>
              <span className="font-mono font-bold text-sm text-primary">
                ৳{Number(setting.monthly_amount).toFixed(2)} {setting.currency} / month
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Uniform monthly contribution rate applied equally across all registered foundation members.
            </span>
          </div>
        </div>

        {hasPermission('contribution_settings.update') && (
          <button
            type="button"
            onClick={() => setShowSettingModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/80 hover:bg-muted text-xs font-medium text-foreground transition-colors shrink-0 shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-primary" /> Update Rate
          </button>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-border/60">
        <button
          type="button"
          onClick={() => { setMode('single'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            mode === 'single'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Single Member Collection
        </button>
        <button
          type="button"
          onClick={() => { setMode('batch'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            mode === 'batch'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Multi-Member Batch Collection
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2 border border-destructive/20 w-full min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-words">{errorMsg}</span>
        </div>
      )}

      {/* Single Member Success Banner */}
      {singleSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Monthly Contribution Recorded Successfully!</span>
          </div>
          <p className="text-xs leading-relaxed">
            Receipt <strong className="font-mono text-emerald-950 dark:text-emerald-100">{singleSuccess.receipt_id}</strong> issued for member <strong className="text-foreground">{singleSuccess.member_name}</strong> ({singleSuccess.member_code}).
            Total <strong className="font-mono text-emerald-950 dark:text-emerald-100">৳{Number(singleSuccess.total_amount).toFixed(2)}</strong> atomically credited to <strong className="text-foreground">{singleSuccess.group_name}</strong> ({singleSuccess.group_code}) fund ledger.
          </p>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-1">
            <span>Paid Months: {singleSuccess.month_allocations?.map((a: any) => a.month_name).join(', ')} {singleSuccess.contribution_year}</span>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/contributions/manage"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline hover:opacity-80"
            >
              View in Manage Contributions &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setSingleSuccess(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Batch Success Banner */}
      {batchSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Batch Contribution Recorded Successfully!</span>
          </div>
          <p className="text-xs leading-relaxed">
            Batch Reference <strong className="font-mono text-emerald-950 dark:text-emerald-100">{batchSuccess.batch_reference}</strong> processed {batchSuccess.members_count} member receipts.
            Total <strong className="font-mono text-emerald-950 dark:text-emerald-100">৳{Number(batchSuccess.total_collected).toFixed(2)}</strong> credited to respective member Group Funds.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/contributions/manage"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline hover:opacity-80"
            >
              View in Manage Contributions &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setBatchSuccess(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MODE 1: SINGLE MEMBER COLLECTION FORM */}
      {mode === 'single' && (
        <div className="rounded-xl bg-card border border-border/60 shadow-xs p-4 sm:p-6 space-y-5">
          <form onSubmit={handleSingleSubmit} className="space-y-5 text-xs">
            {/* Top row: Next Receipt ID & Contribution Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Receipt ID
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={`Next ID: ${nextId}`}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-muted/60 border border-border/60 font-mono text-muted-foreground cursor-not-allowed"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Generated sequentially (MC-0001...)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Contribution Year <span className="text-destructive">*</span>
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Recorded By
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={user?.full_name ? `${user.full_name} (${user.role_name || 'Staff'})` : 'Current User'}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-muted/60 border border-border/60 text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            {/* Member Selection */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Select Member <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <div 
                  onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 flex items-center justify-between cursor-pointer hover:border-primary/50"
                >
                  <span className={selectedMember ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    {selectedMember 
                      ? `${selectedMember.member_id} — ${selectedMember.name} (${selectedMember.group_name})`
                      : 'Choose active member to collect contribution...'}
                  </span>
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                </div>

                {isMemberDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card border border-border/70 rounded-lg shadow-xl p-2 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      placeholder="Search by name, ID or group..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-muted/40 border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary mb-1 text-foreground"
                      autoFocus
                    />
                    <div className="divide-y divide-border/40">
                      {filteredMembers.length === 0 ? (
                        <div className="py-3 text-center text-muted-foreground text-xs">No active members found</div>
                      ) : (
                        filteredMembers.map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setIsMemberDropdownOpen(false);
                              setMemberSearch('');
                            }}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-foreground">{m.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {m.member_id} &bull; Group: {m.group_code} ({m.group_name})
                              </div>
                            </div>
                            {selectedMemberId === m.id && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Group Fund Notification Card when member selected */}
              {selectedMember && (
                <div className="mt-2.5 p-3 rounded-lg bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <span className="text-[11px] text-muted-foreground">Target Group Fund:</span>
                      <div className="font-semibold text-foreground">
                        {selectedMember.group_name} ({selectedMember.group_code})
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Joining Date: {selectedMember.joining_date ? new Date(selectedMember.joining_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              )}
            </div>

            {/* Months Selector Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Select Contribution Month(s) for {year} <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground block">
                    Choose one or multiple months. Already paid months are locked to prevent duplicate collection.
                  </span>
                </div>
                {selectedMemberId && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllUnpaid}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Select All Unpaid
                    </button>
                    <span className="text-muted-foreground text-[11px]">&bull;</span>
                    <button
                      type="button"
                      onClick={handleClearSelectedMonths}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {loadingPaidMonths ? (
                <div className="py-6 text-center text-muted-foreground">
                  <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                  <p>Loading member payment history...</p>
                </div>
              ) : !selectedMemberId ? (
                <div className="p-4 rounded-lg bg-muted/30 border border-border/40 text-center text-muted-foreground text-xs">
                  Please select a member above to view available contribution months.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {MONTH_NAMES.map((name, idx) => {
                    const mNum = idx + 1;
                    const isPaid = paidMonths.includes(mNum);
                    const isSelected = selectedMonths.includes(mNum);

                    return (
                      <button
                        key={mNum}
                        type="button"
                        disabled={isPaid}
                        onClick={() => toggleMonth(mNum)}
                        className={`p-2.5 rounded-lg border text-left transition-all relative ${
                          isPaid
                            ? 'bg-muted/40 border-border/40 opacity-50 cursor-not-allowed text-muted-foreground'
                            : isSelected
                            ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary shadow-xs'
                            : 'bg-background border-border/60 hover:border-primary/40 text-foreground cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">{name}</span>
                          {isPaid ? (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">
                              PAID
                            </span>
                          ) : isSelected ? (
                            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : null}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-1">
                          ৳{ratePerMonth.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total Calculation Strip */}
            <div className="p-3.5 rounded-xl bg-card border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Contribution Summary</span>
                <div className="text-xs font-medium text-foreground mt-0.5">
                  {selectedMonths.length} month(s) selected &times; ৳{ratePerMonth.toFixed(2)} / month
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block uppercase font-semibold">Total Collection Amount</span>
                <div className="text-xl font-bold font-mono text-primary">
                  ৳{singleTotalAmount} BDT
                </div>
              </div>
            </div>

            {/* Payment Details: Date, Method, Reference, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Transaction Reference <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-10293, Bank Slip #, or Mobile Money ID"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Additional context or remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border/50">
              <Link
                href="/contributions/manage"
                className="px-4 py-2 rounded-lg border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground cursor-pointer transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || selectedMonths.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shadow-xs cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                {submitting ? 'Recording...' : `Record Contribution (৳${singleTotalAmount})`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODE 2: BATCH COLLECTION FORM */}
      {mode === 'batch' && (
        <div className="rounded-xl bg-card border border-border/60 shadow-xs p-4 sm:p-6 space-y-5">
          <form onSubmit={handleBatchSubmit} className="space-y-5 text-xs">
            {/* Batch Controls: Filter by Group, Year, Date, Method */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Filter Group
                </label>
                <select
                  value={batchGroupFilter}
                  onChange={(e) => setBatchGroupFilter(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">All Groups ({allMembers.length} members)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Year <span className="text-destructive">*</span>
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Member Batch Month Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-foreground">Select Months for Each Member ({batchFilteredMembers.length} Available)</h3>
                  <p className="text-[10px] text-muted-foreground">Each member will receive a unique receipt ID linked under a shared batch reference.</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-primary">
                    Total Selected: {totalBatchMonthsCount} months &bull; ৳{batchTotalAmount} BDT
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Group</th>
                      <th className="py-2.5 px-3">Select Months (Jan - Dec)</th>
                      <th className="py-2.5 px-3 text-right">Member Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {batchFilteredMembers.map(m => {
                      const mSelectedMonths = batchItems[m.id] || [];
                      const mTotal = (mSelectedMonths.length * ratePerMonth).toFixed(2);

                      return (
                        <tr key={m.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground block">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{m.member_id}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                              {m.group_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {MONTH_NAMES.map((mName, mIdx) => {
                                const mNum = mIdx + 1;
                                const isSelected = mSelectedMonths.includes(mNum);
                                return (
                                  <button
                                    key={mNum}
                                    type="button"
                                    onClick={() => toggleBatchMemberMonth(m.id, mNum)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground font-bold'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                    title={mName}
                                  >
                                    {mName.substring(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            ৳{mTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reference & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Batch Transaction Reference <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deposit Slip / Bank Transfer Reference"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Batch Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Additional context or remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            {/* Batch Submission Button */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border/50">
              <Link
                href="/contributions/manage"
                className="px-4 py-2 rounded-lg border border-border/60 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-foreground cursor-pointer transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || totalBatchMonthsCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shadow-xs cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                {submitting ? 'Recording Batch...' : `Record Batch (৳${batchTotalAmount} BDT)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Global Monthly Setting Modal */}
      {showSettingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md bg-card border border-border/60 rounded-xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" /> Update Monthly Contribution Rate
              </h3>
              <button
                onClick={() => setShowSettingModal(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {settingError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                {settingError}
              </div>
            )}

            <form onSubmit={handleUpdateSetting} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Monthly Amount (BDT ৳) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={newMonthlyAmount}
                  onChange={(e) => setNewMonthlyAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-mono"
                  placeholder="100.00"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Preserves historical payments. Only applies to new contributions collected after this update.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowSettingModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border/60 text-xs text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingSetting}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {updatingSetting ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddContributionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading contribution form...</div>}>
      <AddContributionContent />
    </Suspense>
  );
}
