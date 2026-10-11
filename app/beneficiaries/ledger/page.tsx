'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  HandHeart, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  FileSpreadsheet, 
  PlusCircle, 
  AlertCircle,
  Building2,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function BeneficiaryLedgerPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Ledger state
  const [ledgerSummary, setLedgerSummary] = useState<any | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // New Transaction Modal State
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState('Received');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Load beneficiaries for selector
  useEffect(() => {
    async function loadBeneficiaries() {
      try {
        const res = await fetch('/api/beneficiaries/options', {
          headers: { 'X-User': activeUsername },
        });
        if (res.ok) {
          const data = await res.json();
          setBeneficiaries(data);
          if (data.length > 0 && selectedBeneficiaryId === null) {
            setSelectedBeneficiaryId(data[0].id);
          }
        }
      } catch (e) {
        console.error('Error loading beneficiaries options', e);
      }
    }
    loadBeneficiaries();
  }, [activeUsername]);

  const fetchLedger = async (bid: number, pageNum = 1) => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (typeFilter) params.append('transaction_type', typeFilter);
      if (searchTerm.trim()) params.append('q', searchTerm.trim());

      const res = await fetch(`/api/beneficiaries/${bid}/ledger?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing beneficiary_ledger.view permission.');
        throw new Error('Failed to load beneficiary ledger');
      }
      const data = await res.json();
      setLedgerSummary(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBeneficiaryId) {
      fetchLedger(selectedBeneficiaryId, page);
    }
  }, [selectedBeneficiaryId, page, limit, typeFilter, activeUsername]);

  if (!hasPermission('beneficiary_ledger.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">beneficiary_ledger.view</code> permission.
        </p>
      </div>
    );
  }

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiaryId || !txAmount || Number(txAmount) <= 0) return;

    try {
      setTxSubmitting(true);
      const res = await fetch(
        `/api/beneficiaries/${selectedBeneficiaryId}/ledger?transaction_type=${txType}&amount=${txAmount}&description=${encodeURIComponent(txDesc)}`,
        {
          method: 'POST',
          headers: { 'X-User': activeUsername },
        }
      );
      if (!res.ok) throw new Error('Failed to post ledger transaction');

      setShowAddTx(false);
      setTxAmount('');
      setTxDesc('');
      await fetchLedger(selectedBeneficiaryId, 1);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTxSubmitting(false);
    }
  };

  const selectedBeneficiaryObj = beneficiaries.find(b => b.id === selectedBeneficiaryId);
  const filteredBeneficiaryOptions = beneficiaries.filter(b => 
    b.name.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
    b.beneficiary_id.toLowerCase().includes(beneficiarySearch.toLowerCase())
  );

  const totalCount = ledgerSummary ? ledgerSummary.total_count : 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Page Title & Register Shortcut */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Beneficiary Financial Ledger</h1>
          <p className="text-xs text-muted-foreground">
            Audited transaction ledger with chronologically verified running balances.
          </p>
        </div>
        {hasPermission('beneficiaries.create') && (
          <Link
            href="/beneficiaries/add"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs shrink-0"
          >
            + Add Beneficiary
          </Link>
        )}
      </div>

      {/* Beneficiary Selector Card */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/60 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
        <div className="flex-1 relative min-w-0">
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">
            Selected Beneficiary
          </label>
          <div
            onClick={() => setIsSelectorOpen(!isSelectorOpen)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border/70 cursor-pointer flex items-center justify-between hover:border-primary/50 min-w-0"
          >
            {selectedBeneficiaryObj ? (
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="font-mono font-bold text-primary shrink-0">{selectedBeneficiaryObj.beneficiary_id}</span>
                <span className="font-medium text-foreground truncate">{selectedBeneficiaryObj.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground shrink-0">
                  {selectedBeneficiaryObj.status}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select a registered beneficiary...</span>
            )}
            <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
          </div>

          {/* Search Dropdown */}
          {isSelectorOpen && (
            <div className="absolute top-[105%] left-0 w-full max-w-full bg-card border border-border/60 rounded-xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in">
              <input
                type="text"
                autoFocus
                placeholder="Search by Beneficiary ID (B-XXXX) or Name..."
                value={beneficiarySearch}
                onChange={(e) => setBeneficiarySearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredBeneficiaryOptions.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">
                    No beneficiaries match search.
                  </div>
                ) : (
                  filteredBeneficiaryOptions.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBeneficiaryId(b.id);
                        setIsSelectorOpen(false);
                        setBeneficiarySearch('');
                        setPage(1);
                      }}
                      className={`px-3 py-2 text-xs rounded-md cursor-pointer flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                        selectedBeneficiaryId === b.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold shrink-0">{b.beneficiary_id}</span>
                        <span className="truncate">{b.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{b.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {selectedBeneficiaryId && (
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setShowAddTx(!showAddTx)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-xs w-full md:w-auto"
            >
              <PlusCircle className="w-4 h-4" /> Post Ledger Entry
            </button>
          </div>
        )}
      </div>

      {/* Record Transaction Form */}
      {showAddTx && (
        <form onSubmit={handleCreateTransaction} className="p-3.5 sm:p-4 rounded-xl bg-card border border-primary/30 shadow-md space-y-3 animate-in fade-in w-full min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground truncate">Post Verified Transaction for {selectedBeneficiaryObj?.name}</span>
            <button type="button" onClick={() => setShowAddTx(false)} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Transaction Type</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border/70 text-xs text-foreground"
              >
                <option value="Received">Received (Assistance Grant Inflow)</option>
                <option value="Disbursed">Disbursed (Direct Benefit Outflow)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Monetary Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border/70 text-xs text-foreground font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Description / Memo</label>
              <input
                type="text"
                placeholder="e.g. Monthly stipend disbursement"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border/70 text-xs text-foreground"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddTx(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-border/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={txSubmitting}
              className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {txSubmitting ? 'Posting...' : 'Post Entry'}
            </button>
          </div>
        </form>
      )}

      {/* Summary Cards */}
      {ledgerSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs min-w-0">
            <span className="text-xs text-muted-foreground font-medium uppercase truncate block">Total Received</span>
            <div className="flex items-center gap-2 mt-2 min-w-0">
              <ArrowUpRight className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="text-xl sm:text-2xl font-bold text-foreground font-mono truncate">
                ${Number(ledgerSummary.total_received).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs min-w-0">
            <span className="text-xs text-muted-foreground font-medium uppercase truncate block">Total Disbursed</span>
            <div className="flex items-center gap-2 mt-2 min-w-0">
              <ArrowDownRight className="w-5 h-5 text-rose-500 shrink-0" />
              <span className="text-xl sm:text-2xl font-bold text-foreground font-mono truncate">
                ${Number(ledgerSummary.total_disbursed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/60 shadow-xs min-w-0">
            <span className="text-xs text-muted-foreground font-medium uppercase truncate block">Current Balance</span>
            <div className="flex items-center gap-2 mt-2 min-w-0">
              <Wallet className="w-5 h-5 text-primary shrink-0" />
              <span className="text-xl sm:text-2xl font-bold text-foreground font-mono truncate">
                ${Number(ledgerSummary.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table & Filters */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden space-y-0 w-full max-w-full min-w-0">
        {/* Filter bar */}
        <div className="p-3 sm:p-3.5 border-b border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs w-full min-w-0">
          <input
            type="text"
            placeholder="Filter description or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2.5 py-1.5 rounded-md bg-background border border-border/60 text-xs w-full sm:w-auto sm:flex-1 min-w-0"
          />
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md bg-background border border-border/60 text-xs flex-1 sm:flex-initial"
            >
              <option value="">All Types</option>
              <option value="Received">Received</option>
              <option value="Disbursed">Disbursed</option>
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 rounded bg-background border border-border/60 text-xs w-[125px] sm:w-auto"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 rounded bg-background border border-border/60 text-xs w-[125px] sm:w-auto"
              />
              <button
                onClick={() => selectedBeneficiaryId && fetchLedger(selectedBeneficiaryId, 1)}
                className="px-2.5 py-1 rounded bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-3 sm:px-4">Date</th>
                <th className="py-3 px-3 sm:px-4">Transaction Reference</th>
                <th className="py-3 px-3 sm:px-4">Description</th>
                <th className="py-3 px-3 sm:px-4">Transaction Type</th>
                <th className="py-3 px-3 sm:px-4 text-right">Amount Received</th>
                <th className="py-3 px-3 sm:px-4 text-right">Amount Disbursed</th>
                <th className="py-3 px-3 sm:px-4 text-right font-mono">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ledgerLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Calculating verified running balances...</p>
                  </td>
                </tr>
              ) : !ledgerSummary || ledgerSummary.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No ledger transactions recorded</p>
                    <p className="text-[11px] mt-0.5">
                      No financial transactions exist for this beneficiary yet. Balances are verified zero.
                    </p>
                  </td>
                </tr>
              ) : (
                ledgerSummary.entries.map((e: any) => (
                  <tr key={e.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(e.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {e.reference}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {e.description || 'Assistance entry'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        e.transaction_type === 'Received'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      }`}>
                        {e.transaction_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {e.transaction_type === 'Received' ? `$${Number(e.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                      {e.transaction_type === 'Disbursed' ? `$${Number(e.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      ${Number(e.running_balance).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-3 px-3 sm:px-4 border-t border-border/50 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-muted-foreground w-full">
          <span>
            Total Transactions: {totalCount}
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
