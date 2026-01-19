/**
 * XRPL Integration Helpers
 * 
 * Provides functions for connecting to XRPL, sending payments,
 * and monitoring transactions on the XRP Ledger.
 */

import { Client, Wallet, xrpToDrops, dropsToXrp, Payment, TxResponse } from 'xrpl';

// XRPL Testnet endpoint
const XRPL_TESTNET_WS = 'wss://s.altnet.rippletest.net:51233';
const XRPL_TESTNET_RPC = 'https://s.altnet.rippletest.net:51233';

export interface XRPLWallet {
  address: string;
  classicAddress: string;
  seed?: string; // Only for server-side or secure storage
}

export interface PaymentStatus {
  success: boolean;
  txHash?: string;
  error?: string;
  finalized?: boolean;
}

export interface XRPLBalance {
  balance: string; // XRP amount as string
  drops: string; // XRP amount in drops
}

/**
 * Connect to XRPL testnet
 */
export async function connectXRPLClient(): Promise<Client> {
  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();
  return client;
}

/**
 * Get XRP balance for an address
 */
export async function getXRPBalance(address: string): Promise<XRPLBalance> {
  const client = await connectXRPLClient();
  try {
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });

    const balance = accountInfo.result.account_data.Balance;
    return {
      balance: String(dropsToXrp(balance)),
      drops: balance,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Send XRP payment with memo (payment reference)
 */
export async function sendXRPPayment(
  wallet: Wallet,
  destination: string,
  amountXRP: string,
  paymentReference: string
): Promise<PaymentStatus> {
  const client = await connectXRPLClient();
  
  try {
    // Convert XRP amount to drops
    const amountDrops = xrpToDrops(amountXRP);

    // Create payment transaction
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: wallet.classicAddress,
      Destination: destination,
      Amount: amountDrops,
      Memos: [
        {
          Memo: {
            MemoData: paymentReference,
          },
        },
      ],
    };

    // Autofill transaction
    const prepared = await client.autofill(payment);
    
    // Sign transaction
    const signed = wallet.sign(prepared);
    
    // Submit and wait for finalization
    const result: TxResponse = await client.submitAndWait(signed.tx_blob);
    
    const txResult =
      result.result &&
      typeof (result.result as any).meta === 'object' &&
      (result.result as any).meta &&
      'TransactionResult' in (result.result as any).meta
        ? ((result.result as any).meta.TransactionResult as string)
        : undefined;

    if (txResult === 'tesSUCCESS') {
      return {
        success: true,
        txHash: signed.hash,
        finalized: true,
      };
    } else {
      return {
        success: false,
        error: txResult || 'Unknown error',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send payment',
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Monitor XRPL for incoming payment with specific payment reference
 */
export async function monitorPayment(
  address: string,
  paymentReference: string,
  timeoutSeconds: number = 300
): Promise<PaymentStatus> {
  const client = await connectXRPLClient();
  
  try {
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;

    // Subscribe to account transactions
    await client.request({
      command: 'subscribe',
      accounts: [address],
    });

    return new Promise((resolve) => {
      let interval: ReturnType<typeof setInterval> | undefined;

      const checkTimeout = () => {
        if (Date.now() - startTime > timeout) {
          if (interval) clearInterval(interval);
          client.disconnect();
          resolve({
            success: false,
            error: 'Timeout waiting for payment',
          });
        }
      };

      client.on('transaction', (tx: any) => {
        if (tx?.transaction?.TransactionType === 'Payment') {
          const payment = tx.transaction as Payment;
          
          // Check if payment is to our address
          if (payment.Destination === address) {
            // Check if memo matches payment reference
            const memos = payment.Memos || [];
            for (const memo of memos) {
              if (memo.Memo?.MemoData === paymentReference) {
                if (interval) clearInterval(interval);
                client.disconnect();
                resolve({
                  success: true,
                  txHash: tx?.transaction?.hash ?? tx?.hash,
                  finalized: true,
                });
                return;
              }
            }
          }
        }
      });

      // Check timeout periodically
      interval = setInterval(() => {
        checkTimeout();
      }, 1000);
    });
  } catch (error: any) {
    await client.disconnect();
    return {
      success: false,
      error: error.message || 'Failed to monitor payment',
    };
  }
}

/**
 * Get transaction details by hash
 */
export async function getTransaction(txHash: string): Promise<any> {
  const client = await connectXRPLClient();
  
  try {
    const tx = await client.request({
      command: 'tx',
      transaction: txHash,
    });
    
    return tx.result;
  } finally {
    await client.disconnect();
  }
}

/**
 * Validate XRPL address format
 */
export function isValidXRPLAddress(address: string): boolean {
  // XRPL addresses are base58 encoded, typically starting with 'r'
  return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
}

/**
 * Create wallet from seed (for server-side use only)
 */
export function createWalletFromSeed(seed: string): Wallet {
  return Wallet.fromSeed(seed);
}

