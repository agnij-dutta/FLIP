#!/usr/bin/env node
// XRPL payment bridge - called by Go agent to send XRP payments
const xrpl = require('xrpl');

async function sendPayment(seed, destination, amountDrops, memoData) {
  const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed(seed);
  
  const amountXRP = parseFloat(amountDrops) / 1_000_000;
  
  const payment = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: destination,
    Amount: amountXRP.toString(),
  };

  if (memoData) {
    payment.Memos = [{
      Memo: {
        MemoData: Buffer.from(memoData, 'utf8').toString('hex').toUpperCase()
      }
    }];
  }

  const prepared = await client.autofill(payment);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  await client.disconnect();

  if (result.result.meta.TransactionResult === 'tesSUCCESS') {
    return {
      success: true,
      txHash: result.result.hash,
    };
  } else {
    throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.length >= 3) {
  const [seed, destination, amountDrops, memoData] = args;
  sendPayment(seed, destination, amountDrops, memoData || '')
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch(err => {
      console.error(JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
} else {
  console.error('Usage: xrpl_bridge.js <seed> <destination> <amountDrops> [memoData]');
  process.exit(1);
}

