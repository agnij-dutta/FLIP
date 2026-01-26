'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Search,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  Hash,
  RefreshCw,
  Copy,
  CheckCircle
} from "lucide-react";
import { connectXRPLClient, isValidXRPLAddress } from '@/lib/xrpl';
import { dropsToXrp } from 'xrpl';

interface Transaction {
  hash: string;
  type: string;
  amount: string;
  destination?: string;
  source?: string;
  date: string;
  timestamp: number;
  fee: string;
  result: string;
  isIncoming: boolean;
}

interface AccountInfo {
  balance: string;
  sequence: number;
  ownerCount: number;
  previousTxnId?: string;
}

export default function XRPLExplorer() {
  const [address, setAddress] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAccountData = async (addr: string) => {
    if (!addr || !isValidXRPLAddress(addr)) {
      setError('Please enter a valid XRPL address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAccountInfo(null);
    setTransactions([]);

    try {
      const client = await connectXRPLClient();

      try {
        // Fetch account info
        const accountInfoResponse = await client.request({
          command: 'account_info',
          account: addr,
          ledger_index: 'validated',
        });

        const accountData = accountInfoResponse.result.account_data;
        setAccountInfo({
          balance: String(dropsToXrp(accountData.Balance)),
          sequence: accountData.Sequence,
          ownerCount: accountData.OwnerCount,
          previousTxnId: accountData.PreviousTxnID,
        });

        // Fetch transaction history
        const txResponse = await client.request({
          command: 'account_tx',
          account: addr,
          limit: 50,
          ledger_index_min: -1,
          ledger_index_max: -1,
        });

        const formattedTxs: Transaction[] = txResponse.result.transactions.map((tx: any) => {
          const txData = tx.tx || tx.tx_json;
          const meta = tx.meta;
          const isIncoming = txData.Destination === addr;

          let amount = '0';
          if (txData.Amount) {
            if (typeof txData.Amount === 'string') {
              amount = String(dropsToXrp(txData.Amount));
            } else if (txData.Amount.value) {
              amount = txData.Amount.value;
            }
          }

          // Parse date from ripple epoch (seconds since Jan 1, 2000)
          const rippleEpoch = 946684800; // Unix timestamp for Jan 1, 2000
          const timestamp = (txData.date || 0) + rippleEpoch;
          const date = new Date(timestamp * 1000);

          return {
            hash: txData.hash || tx.hash,
            type: txData.TransactionType,
            amount,
            destination: txData.Destination,
            source: txData.Account,
            date: date.toLocaleString(),
            timestamp,
            fee: String(dropsToXrp(txData.Fee || '0')),
            result: meta?.TransactionResult || 'unknown',
            isIncoming,
          };
        });

        setTransactions(formattedTxs);
        setSearchAddress(addr);
      } finally {
        await client.disconnect();
      }
    } catch (err: any) {
      console.error('Failed to fetch account data:', err);
      if (err.message?.includes('actNotFound')) {
        setError('Account not found. This address may not be activated yet.');
      } else {
        setError(err.message || 'Failed to fetch account data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAccountData(address);
  };

  const handleRefresh = () => {
    if (searchAddress) {
      fetchAccountData(searchAddress);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      {/* Hero Section */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <span className="section-label">XRPL Integration</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mt-4 mb-4">
              XRPL <span className="text-gradient">Explorer</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Check XRP balances and view transaction history for any XRPL address.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Search Box */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-flare-pink" />
              </div>
              Search Address
            </CardTitle>
            <CardDescription>
              Enter an XRPL address to view balance and transaction history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="flex-1 input-modern text-lg font-mono"
              />
              <Button
                type="submit"
                disabled={isLoading || !address}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">Error</p>
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Account Info */}
        {accountInfo && (
          <Card className="card-pink overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-flare-pink/10 to-transparent border-b border-flare-pink/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-flare-pink" />
                  </div>
                  Account Details
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Address */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-gray-900 dark:text-white break-all">
                    {searchAddress}
                  </code>
                  <button
                    onClick={() => copyToClipboard(searchAddress)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <a
                    href={`https://testnet.xrpl.org/accounts/${searchAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Balance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white number-display">
                    {Number(accountInfo.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-sm text-gray-500">XRP</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sequence</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white number-display">
                    {accountInfo.sequence.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Current</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Owner Count</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white number-display">
                    {accountInfo.ownerCount}
                  </p>
                  <p className="text-sm text-gray-500">Objects</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white number-display">
                    {transactions.length}
                  </p>
                  <p className="text-sm text-gray-500">Recent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                Transaction History
              </CardTitle>
              <CardDescription>
                Recent transactions for this address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((tx, index) => (
                  <div
                    key={tx.hash || index}
                    className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-flare-pink/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Icon + Type + Hash */}
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.type === 'Payment'
                            ? tx.isIncoming
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          {tx.type === 'Payment' ? (
                            tx.isIncoming ? (
                              <ArrowDownLeft className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )
                          ) : (
                            <Hash className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {tx.type}
                            </p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              tx.result === 'tesSUCCESS'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {tx.result === 'tesSUCCESS' ? 'Success' : tx.result}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs font-mono text-gray-500">
                              {truncateHash(tx.hash)}
                            </code>
                            <a
                              href={`https://testnet.xrpl.org/transactions/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-flare-pink hover:text-flare-pink-light"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {tx.type === 'Payment' && (
                            <p className="text-xs text-gray-500 mt-1">
                              {tx.isIncoming ? 'From: ' : 'To: '}
                              <code className="font-mono">
                                {truncateHash(tx.isIncoming ? tx.source || '' : tx.destination || '')}
                              </code>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount + Date */}
                      <div className="text-right">
                        {tx.type === 'Payment' && (
                          <p className={`text-lg font-bold ${
                            tx.isIncoming
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {tx.isIncoming ? '+' : '-'}{Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{tx.date}</p>
                        <p className="text-xs text-gray-400">Fee: {tx.fee} XRP</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!accountInfo && !isLoading && !error && (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Search an XRPL Address
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Enter an XRP Ledger address above to view its balance and transaction history.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white mb-2">XRPL Testnet</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This explorer connects to the XRPL testnet. Balances and transactions are for testing only.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white mb-2">Address Format</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  XRPL addresses start with 'r' followed by 25-34 base58 characters (e.g., rXXX...).
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white mb-2">Account Reserve</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  XRPL accounts require a 10 XRP base reserve plus 2 XRP per owned object.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
