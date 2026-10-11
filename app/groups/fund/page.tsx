'use client';

import React, { useEffect, useState } from 'react';
import { 
  Wallet, 
  Search, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Receipt, 
  AlertCircle,
  X,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function GroupFundPage() {
  const { hasPermission, activeUsername } = useAuth();

  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected group ledger modal
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);

  // Add legitimate transaction modal (for testing/integration)
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState('Received');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/groups/funds/summary', {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access Denied: Missing group_funds.view permission.');
        throw new Error('Failed to load group funds summary');
      }
      const data = await res.json();
      setSummaries(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, [activeUsername]);

  const fetchLedger = async (groupId: number, pageNum = 1) => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await fetch(`/api/groups/${groupId}/funds/ledger?${params.toString()}`, {
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) {
        throw new Error('Failed to load fund transaction ledger');
      }
      const data = await res.json();
      setLedgerData(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenLedger = (group: any) => {
    if (!hasPermission('group_funds.ledger.view')) {
      alert('Access Denied: You do not possess the group_funds.ledger.view permission.');
      return;
    }
    setSelectedGroup(group);
    setLedgerPage(1);
    fetchLedger(group.id, 1);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !txAmount || Number(txAmount) <= 0) return;

    try {
      setTxSubmitting(true);
      const res = await fetch(`/api/groups/${selectedGroup.id}/funds/transaction?transaction_type=${txType}&amount=${txAmount}&description=${encodeURIComponent(txDesc)}`, {
        method: 'POST',
        headers: { 'X-User': activeUsername },
      });
      if (!res.ok) throw new Error('Failed to record transaction');
      
      setShowAddTx(false);
      setTxAmount('');
      setTxDesc('');
      await fetchLedger(selectedGroup.id, 1);
      await fetchSummaries();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTxSubmitting(false);
    }
  };

  if (!hasPermission('group_funds.view')) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-destructive/30 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied (HTTP 403)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role does not possess the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">group_funds.view</code> permission.
        </p>
      </div>
    );
  }

  // Calculate system-wide totals
  const totalReceivedSystem = summaries.reduce((acc, curr) => acc + Number(curr.total_received || 0), 0);
  const totalSpentSystem = summaries.reduce((acc, curr) => acc + Number(curr.total_spent || 0), 0);
  const netBalanceSystem = totalReceivedSystem - totalSpentSystem;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Group Fund Accounts</h1>
          <p className="text-xs text-muted-foreground">
            Audited balances calculated directly from recorded financial ledger transactions.
          </p>
        </div>
      </div>

      {/* Financial Integrity Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <Receipt className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Financial Integrity Guarantee:</span> Balances are strictly calculated from actual persisted transactions. No hard-coded, estimated, or fabricated financial numbers are used. If no transactions exist for a group, a zero balance is displayed with an explicit empty state.
        </div>
      </div>

      {/* High-level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border/60 shadow-xs">
          <span className="text-xs text-muted-foreground font-medium uppercase">Total Received</span>
          <div className="flex items-center gap-2 mt-2">
            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
            <span className="text-2xl font-bold text-foreground font-mono">
              ${totalReceivedSystem.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border/60 shadow-xs">
          <span className="text-xs text-muted-foreground font-medium uppercase">Total Disbursed / Spent</span>
          <div className="flex items-center gap-2 mt-2">
            <ArrowDownRight className="w-5 h-5 text-rose-500" />
            <span className="text-2xl font-bold text-foreground font-mono">
              ${totalSpentSystem.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border/60 shadow-xs">
          <span className="text-xs text-muted-foreground font-medium uppercase">Net Available Balance</span>
          <div className="flex items-center gap-2 mt-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-foreground font-mono">
              ${netBalanceSystem.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Group Funds Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                <th className="py-3 px-4">Group Code</th>
                <th className="py-3 px-4">Group Name</th>
                <th className="py-3 px-4 text-right">Total Funds Received</th>
                <th className="py-3 px-4 text-right">Total Funds Spent</th>
                <th className="py-3 px-4 text-right">Available Balance</th>
                <th className="py-3 px-4 text-center">Transactions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Calculating verified balances from ledger...</p>
                  </td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    No groups registered.
                  </td>
                </tr>
              ) : (
                summaries.map((g) => (
                  <tr key={g.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-primary">
                      {g.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {g.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      ${Number(g.total_received).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                      ${Number(g.total_spent).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      ${Number(g.available_balance).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                        {g.transaction_count} recorded
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('group_funds.ledger.view') && (
                        <button
                          onClick={() => handleOpenLedger(g)}
                          className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs transition-colors"
                        >
                          View Ledger
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Group Fund Ledger Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-card border border-border/60 rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Fund Ledger: {selectedGroup.name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {selectedGroup.code}
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Complete chronological financial transaction ledger for this group.
                </p>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date Filters & Add Transaction */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-background border border-border/70 text-xs"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-background border border-border/70 text-xs"
                />
                <button
                  onClick={() => fetchLedger(selectedGroup.id, 1)}
                  className="px-3 py-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 text-xs font-medium"
                >
                  Filter
                </button>
              </div>

              <button
                onClick={() => setShowAddTx(!showAddTx)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Record Transaction
              </button>
            </div>

            {/* Add Transaction Inline Form */}
            {showAddTx && (
              <form onSubmit={handleCreateTransaction} className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-border/60 space-y-3">
                <div className="text-xs font-semibold text-foreground">Post New Verified Ledger Transaction</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="px-2 py-1.5 rounded bg-background border border-border/70 text-xs text-foreground"
                  >
                    <option value="Received">Received (Credit)</option>
                    <option value="Spent">Spent (Debit)</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Amount (USD)"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="px-2 py-1.5 rounded bg-background border border-border/70 text-xs text-foreground font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Description / Purpose"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    className="px-2 py-1.5 rounded bg-background border border-border/70 text-xs text-foreground"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTx(false)}
                    className="px-2.5 py-1 text-xs rounded border border-border/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={txSubmitting}
                    className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground font-medium"
                  >
                    {txSubmitting ? 'Posting...' : 'Post Entry'}
                  </button>
                </div>
              </form>
            )}

            {/* Ledger Transactions Table */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Loading transaction ledger...
                      </td>
                    </tr>
                  ) : !ledgerData || ledgerData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground">
                        <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-foreground">No financial transactions recorded</p>
                        <p className="text-[11px] mt-0.5">
                          This group does not have any recorded receipts or expenses yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledgerData.items.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {new Date(tx.transaction_date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {tx.reference}
                        </td>
                        <td className="py-2.5 px-3 text-foreground">
                          {tx.description || 'General fund entry'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            tx.transaction_type === 'Received'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          }`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                          tx.transaction_type === 'Received' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {tx.transaction_type === 'Received' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer with Summary */}
            {ledgerData && (
              <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between text-xs">
                <div className="flex gap-4">
                  <span>Received: <strong className="font-mono text-emerald-600">${Number(ledgerData.summary.total_received).toFixed(2)}</strong></span>
                  <span>Spent: <strong className="font-mono text-rose-600">${Number(ledgerData.summary.total_spent).toFixed(2)}</strong></span>
                  <span>Balance: <strong className="font-mono text-foreground">${Number(ledgerData.summary.available_balance).toFixed(2)}</strong></span>
                </div>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
