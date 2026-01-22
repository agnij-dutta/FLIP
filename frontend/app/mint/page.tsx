'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import React from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, Address, decodeEventLog } from 'viem';
import { coston2 } from '@/lib/chains';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAvailableAgents, getCollateralReservationFee, getCollateralReservationInfo, getAssetMintingDecimals, getAssetManagerAddress, ASSET_MANAGER_ABI, type AgentInfo, type CollateralReservationInfo } from '@/lib/fassets';
import { connectXRPLClient, getXRPBalance, sendXRPPayment, monitorPayment, getTransaction, isValidXRPLAddress, generateAndFundTestnetWallet, type XRPLBalance } from '@/lib/xrpl';
import { Wallet } from 'xrpl';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';

// FXRP address
const FXRP_ADDRESS = '0x0b6A3645c240605887a5532109323A3E12273dc7' as Address;

// ERC20 ABI for FXRP balance
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type MintingStep =
  | 'select-agent'
  | 'reserve-collateral'
  | 'connect-xrpl'
  | 'send-xrp'
  | 'flip-settlement'  // FLIP instant settlement (replaces wait-fdc)
  | 'success';

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isWaitingTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // State
  const [step, setStep] = useState<MintingStep>('select-agent');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [assetManagerAddress, setAssetManagerAddress] = useState<Address | null>(null);
  const [lots, setLots] = useState<string>('1');
  const [crfAmount, setCrfAmount] = useState<bigint>(BigInt(0));
  const [reservationId, setReservationId] = useState<bigint | null>(null);
  const [reservationInfo, setReservationInfo] = useState<CollateralReservationInfo | null>(null);
  // Payment info extracted directly from CollateralReserved event
  const [paymentInfo, setPaymentInfo] = useState<{
    agentXrplAddress: string;
    valueUBA: bigint;
    feeUBA: bigint;
    paymentReference: string;
  } | null>(null);
  const [xrplAddress, setXrplAddress] = useState<string>('');
  const [xrplWallet, setXrplWallet] = useState<Wallet | null>(null);
  const [xrpBalance, setXrpBalance] = useState<XRPLBalance | null>(null);
  const [xrpTxHash, setXrpTxHash] = useState<string | null>(null);
  const [walletSecret, setWalletSecret] = useState<string>('');
  const [sendingPayment, setSendingPayment] = useState<boolean>(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [fxrpBalance, setFxrpBalance] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingWallet, setGeneratingWallet] = useState<boolean>(false);
  // FLIP settlement state
  const [flipMintingId, setFlipMintingId] = useState<bigint | null>(null);
  const [flipSettling, setFlipSettling] = useState<boolean>(false);
  const [flipSettled, setFlipSettled] = useState<boolean>(false);

  // Fetch FXRP balance
  const { data: fxrpBalanceData, refetch: refetchFxrp } = useReadContract({
    address: FXRP_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: fxrpDecimals } = useReadContract({
    address: FXRP_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  useEffect(() => {
    if (fxrpBalanceData && fxrpDecimals) {
      setFxrpBalance(formatUnits(fxrpBalanceData, Number(fxrpDecimals)));
    }
  }, [fxrpBalanceData, fxrpDecimals]);

  // Step 1: Load available agents
  useEffect(() => {
    if (step === 'select-agent') {
      loadAgents();
    }
  }, [step]);

  // Resolve AssetManager address (once)
  useEffect(() => {
    getAssetManagerAddress()
      .then((am) => setAssetManagerAddress(am))
      .catch(() => setAssetManagerAddress(null));
  }, []);

  // Step 2: Calculate CRF when agent and lots are selected
  useEffect(() => {
    if (selectedAgent && lots && step === 'reserve-collateral') {
      calculateCRF();
    }
  }, [selectedAgent, lots, step]);

  // Step 3: Load XRP balance when XRPL address is connected
  useEffect(() => {
    if (xrplAddress && isValidXRPLAddress(xrplAddress) && step === 'connect-xrpl') {
      loadXRPBalance();
    }
  }, [xrplAddress, step]);

  // Step 4: Monitor reservation info after collateral reservation
  useEffect(() => {
    console.log('Step transition check - reservationId:', reservationId, 'txSuccess:', txSuccess, 'step:', step, 'paymentInfo:', paymentInfo);
    if (reservationId && txSuccess && step === 'reserve-collateral') {
      // If we already have payment info from the event, go directly to connect-xrpl
      if (paymentInfo && paymentInfo.agentXrplAddress) {
        console.log('Payment info available from event, skipping contract call');
        setStep('connect-xrpl');
      } else {
        console.log('Loading reservation info from contract...');
        loadReservationInfo();
      }
    }
  }, [reservationId, txSuccess, step, paymentInfo]);

  async function loadAgents() {
    try {
      setLoading(true);
      setError(null);
      
      const availableAgents = await getAvailableAgents(0, 100);
      console.log('Loaded agents:', availableAgents);
      
      // Show all agents with their status
      // Status 0 = NORMAL (active), but we'll show all and let user see status
      setAgents(availableAgents);
      
      if (availableAgents.length === 0) {
        setError('No available agents found. Minting FXRP may not be available on Coston2 testnet. You can test redemption if you already have FXRP tokens.');
      } else {
        // Check if any are NORMAL status
        const normalAgents = availableAgents.filter(agent => agent.status === 0);
        if (normalAgents.length === 0) {
          setError(`Found ${availableAgents.length} agent(s), but none are in NORMAL status (status=0). Current status: ${availableAgents[0]?.status}. You may still be able to use them, or they may be paused.`);
        }
      }
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setError(`Failed to load agents: ${err.message}`);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  async function calculateCRF() {
    try {
      const fee = await getCollateralReservationFee(parseInt(lots));
      setCrfAmount(fee);
    } catch (err: any) {
      setError(`Failed to calculate CRF: ${err.message}`);
    }
  }

  async function loadReservationInfo() {
    if (!reservationId) {
      console.log('loadReservationInfo called but no reservationId');
      return;
    }

    console.log('Loading reservation info for ID:', reservationId.toString());

    try {
      setLoading(true);
      const info = await getCollateralReservationInfo(reservationId);
      console.log('Reservation info loaded:', info);
      setReservationInfo(info);
      console.log('Transitioning to connect-xrpl step');
      setStep('connect-xrpl');
    } catch (err: any) {
      console.error('Failed to load reservation info:', err);
      setError(`Failed to load reservation info: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadXRPBalance() {
    if (!xrplAddress || !isValidXRPLAddress(xrplAddress)) return;
    
    try {
      setLoading(true);
      const balance = await getXRPBalance(xrplAddress);
      setXrpBalance(balance);
    } catch (err: any) {
      setError(`Failed to load XRP balance: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAgent(agent: AgentInfo) {
    setSelectedAgent(agent);
    setStep('reserve-collateral');
  }

  async function handleReserveCollateral() {
    if (!selectedAgent || !address || !assetManagerAddress) {
      console.log('handleReserveCollateral: missing required data', { selectedAgent, address, assetManagerAddress });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Parse reservation fee
      const fee = await getCollateralReservationFee(parseInt(lots));
      console.log('Collateral reservation fee:', fee.toString());
      console.log('Calling reserveCollateral with:', {
        agentVault: selectedAgent.agentVault,
        lots: lots,
        feeBIPS: selectedAgent.feeBIPS.toString(),
      });

      // Call reserveCollateral
      writeContract({
        address: assetManagerAddress,
        abi: ASSET_MANAGER_ABI,
        functionName: 'reserveCollateral',
        args: [
          selectedAgent.agentVault,
          BigInt(lots),
          selectedAgent.feeBIPS,
          '0x0000000000000000000000000000000000000000' as Address, // executor
        ],
        value: fee,
      });

      // Loading will be managed by isPending/isWaitingTx states from wagmi
      setLoading(false);
    } catch (err: any) {
      console.error('Error in handleReserveCollateral:', err);
      setError(`Failed to reserve collateral: ${err.message}`);
      setLoading(false);
    }
  }

  // Parse CollateralReserved event to get reservation ID
  useEffect(() => {
    if (txHash && txSuccess && publicClient && step === 'reserve-collateral') {
      console.log('Transaction successful, parsing receipt for txHash:', txHash);

      publicClient.getTransactionReceipt({ hash: txHash }).then((receipt) => {
        console.log('Transaction receipt:', receipt);
        console.log('Number of logs:', receipt.logs.length);

        // CollateralReserved event ABI from FAssets AssetManager
        const eventAbi = {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'agentVault', type: 'address' },
            { indexed: true, name: 'minter', type: 'address' },
            { indexed: true, name: 'collateralReservationId', type: 'uint256' },
            { indexed: false, name: 'valueUBA', type: 'uint256' },
            { indexed: false, name: 'feeUBA', type: 'uint256' },
            { indexed: false, name: 'firstUnderlyingBlock', type: 'uint256' },
            { indexed: false, name: 'lastUnderlyingBlock', type: 'uint256' },
            { indexed: false, name: 'lastUnderlyingTimestamp', type: 'uint256' },
            { indexed: false, name: 'paymentAddress', type: 'string' },
            { indexed: false, name: 'paymentReference', type: 'bytes32' },
            { indexed: false, name: 'executor', type: 'address' },
            { indexed: false, name: 'executorFeeNatWei', type: 'uint256' },
          ],
          name: 'CollateralReserved',
          type: 'event',
        };

        let found = false;

        // Try to decode each log - don't rely on hardcoded topic hash
        for (const log of receipt.logs) {
          console.log('Processing log:', log.address, 'topics:', log.topics);

          // Skip logs with fewer than 4 topics (CollateralReserved has 3 indexed params + signature)
          if (log.topics.length < 4) {
            continue;
          }

          // Try to decode with the CollateralReserved ABI
          try {
            const decoded = decodeEventLog({
              abi: [eventAbi],
              data: log.data,
              topics: log.topics,
            });

            console.log('Successfully decoded event:', decoded.eventName, decoded.args);

            if (decoded.eventName === 'CollateralReserved') {
              const args = decoded.args as any;
              const resId = args.collateralReservationId;
              if (resId != null) {
                console.log('Found collateralReservationId:', resId);
                setReservationId(BigInt(resId));

                // Also extract payment info from the event
                const extractedPaymentInfo = {
                  agentXrplAddress: args.paymentAddress || '',
                  valueUBA: BigInt(args.valueUBA || 0),
                  feeUBA: BigInt(args.feeUBA || 0),
                  paymentReference: args.paymentReference || '',
                };
                console.log('Extracted payment info:', extractedPaymentInfo);
                setPaymentInfo(extractedPaymentInfo);

                found = true;
                break;
              }
            }
          } catch (e) {
            // Not this event, continue to next log
            console.log('Log not CollateralReserved event, continuing...', (e as Error).message);
          }
        }

        // Fallback: Try manual extraction from logs with 4 topics
        if (!found) {
          console.log('ABI decoding failed for all logs, trying manual topic extraction...');
          for (const log of receipt.logs) {
            if (log.topics.length >= 4) {
              const resIdTopic = log.topics[3];
              if (resIdTopic) {
                try {
                  const resId = BigInt(resIdTopic);
                  console.log('Extracted collateralReservationId from topic[3]:', resId.toString());
                  setReservationId(resId);

                  // Try to manually parse the data field
                  // Data layout (each uint256 is 32 bytes = 64 hex chars):
                  // [0-64]: valueUBA
                  // [64-128]: feeUBA
                  // [128-192]: firstUnderlyingBlock
                  // [192-256]: lastUnderlyingBlock
                  // [256-320]: lastUnderlyingTimestamp
                  // [320-384]: offset to paymentAddress string
                  // [384-448]: paymentReference (bytes32)
                  // [448-512]: executor (address, padded)
                  // [512-576]: executorFeeNatWei
                  // Then the string data at the offset
                  const data = log.data.slice(2); // Remove '0x'
                  if (data.length >= 576) {
                    const valueUBA = BigInt('0x' + data.slice(0, 64));
                    const feeUBA = BigInt('0x' + data.slice(64, 128));
                    const paymentRefHex = '0x' + data.slice(384, 448);

                    // Parse the string (paymentAddress)
                    // The offset points to where the string data starts
                    const stringOffset = parseInt(data.slice(320, 384), 16) * 2; // Convert to hex char offset
                    const stringLength = parseInt(data.slice(stringOffset, stringOffset + 64), 16);
                    const stringDataHex = data.slice(stringOffset + 64, stringOffset + 64 + stringLength * 2);
                    // Convert hex to string
                    let paymentAddress = '';
                    for (let i = 0; i < stringDataHex.length; i += 2) {
                      const charCode = parseInt(stringDataHex.slice(i, i + 2), 16);
                      if (charCode > 0) paymentAddress += String.fromCharCode(charCode);
                    }

                    console.log('Manually parsed event data:', { valueUBA: valueUBA.toString(), feeUBA: feeUBA.toString(), paymentAddress, paymentRefHex });

                    const extractedPaymentInfo = {
                      agentXrplAddress: paymentAddress,
                      valueUBA: valueUBA,
                      feeUBA: feeUBA,
                      paymentReference: paymentRefHex,
                    };
                    setPaymentInfo(extractedPaymentInfo);
                    found = true;
                    break;
                  }
                } catch (parseError) {
                  console.error('Failed to manually parse event data:', parseError);
                }
              }
            }
          }
        }

        if (!found) {
          console.error('Could not find CollateralReserved event in transaction logs');
          console.log('All logs:', receipt.logs.map(l => ({ address: l.address, topics: l.topics, dataLength: l.data.length })));
          setError('Transaction succeeded but could not parse reservation ID. Please check the transaction on the explorer.');
        }
      }).catch((err) => {
        console.error('Error fetching transaction receipt:', err);
        setError(`Failed to fetch transaction receipt: ${err.message}`);
      });
    }
  }, [txHash, txSuccess, publicClient, step]);

  async function handleConnectXRPL() {
    // For now, we'll use manual address input
    // In production, integrate with Xaman SDK or xrpl.js wallet connection
    if (!xrplAddress || !isValidXRPLAddress(xrplAddress)) {
      setError('Please enter a valid XRPL address');
      return;
    }

    // For demo, we'll proceed with address only
    // In production, you'd connect wallet and get Wallet object
    setStep('send-xrp');
  }

  async function handleGenerateTestWallet() {
    try {
      setGeneratingWallet(true);
      setError(null);
      console.log('Generating testnet wallet...');

      const result = await generateAndFundTestnetWallet();

      if (result.funded) {
        console.log('Wallet generated and funded:', result.wallet.classicAddress, 'Balance:', result.balance);
        setXrplWallet(result.wallet);
        setXrplAddress(result.wallet.classicAddress);
        setXrpBalance({ balance: result.balance, drops: '0' });
      } else {
        // Even if funding failed, we have the wallet
        console.log('Wallet generated but funding failed:', result.error);
        setXrplWallet(result.wallet);
        setXrplAddress(result.wallet.classicAddress);
        setError(`Wallet created but faucet funding failed: ${result.error}. You can manually fund it.`);
      }
    } catch (err: any) {
      console.error('Failed to generate wallet:', err);
      setError(`Failed to generate wallet: ${err.message}`);
    } finally {
      setGeneratingWallet(false);
    }
  }

  async function handleSendWithSecret() {
    if (!paymentInfo?.agentXrplAddress) {
      setError('Payment info not available yet. Please wait for the reservation details.');
      return;
    }
    if (!walletSecret.trim()) {
      setSecretError('Please enter your XRPL wallet secret.');
      return;
    }

    try {
      setSendingPayment(true);
      setError(null);
      setSecretError(null);

      // Create wallet from secret
      let wallet: Wallet;
      try {
        wallet = Wallet.fromSeed(walletSecret.trim());
        console.log('Created wallet from secret:', wallet.classicAddress);
      } catch (e: any) {
        setSecretError('Invalid wallet secret. Please check and try again.');
        setSendingPayment(false);
        return;
      }

      // Calculate total XRP needed (valueUBA + feeUBA) - XRP uses 6 decimal places
      const totalDrops = paymentInfo.valueUBA + paymentInfo.feeUBA;
      const totalXRP = Number(totalDrops) / 1_000_000;
      const totalXRPString = totalXRP.toFixed(6);

      console.log('Sending XRP payment with wallet secret:', {
        from: wallet.classicAddress,
        to: paymentInfo.agentXrplAddress,
        amount: totalXRPString,
        reference: paymentInfo.paymentReference,
      });

      // Convert payment reference to hex string for memo (remove 0x prefix)
      const paymentRef = paymentInfo.paymentReference;
      const memoData = paymentRef.startsWith('0x') ? paymentRef.slice(2) : paymentRef;

      // Send XRP payment
      const result = await sendXRPPayment(
        wallet,
        paymentInfo.agentXrplAddress,
        totalXRPString,
        memoData
      );

      if (result.success && result.txHash) {
        console.log('Payment successful:', result.txHash);
        setXrpTxHash(result.txHash);
        setWalletSecret(''); // Clear the secret for security
        setStep('flip-settlement'); // Go to FLIP instant settlement
      } else {
        setError(result.error || 'Failed to send XRP payment');
      }
    } catch (err: any) {
      console.error('Failed to send payment:', err);
      setError(`Failed to send XRP: ${err.message}`);
    } finally {
      setSendingPayment(false);
    }
  }

  async function handleSendXRP() {
    console.log('handleSendXRP called. xrplWallet:', xrplWallet, 'xrplAddress:', xrplAddress);

    if (!xrplWallet) {
      return;
    }

    // Use paymentInfo from event if available, otherwise fall back to reservationInfo
    const payment = paymentInfo || (reservationInfo ? {
      agentXrplAddress: '', // Need to get from somewhere
      valueUBA: reservationInfo.valueUBA,
      feeUBA: reservationInfo.feeUBA,
      paymentReference: reservationInfo.paymentReference,
    } : null);

    if (!payment || !payment.agentXrplAddress) {
      setError('Payment info not available. Missing agent XRPL address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate total XRP needed (valueUBA + feeUBA) - XRP uses 6 decimal places
      const totalDrops = payment.valueUBA + payment.feeUBA;
      const totalXRP = Number(totalDrops) / 1_000_000; // XRP has 6 decimal places
      const totalXRPString = totalXRP.toFixed(6);

      console.log('Sending XRP payment:', {
        to: payment.agentXrplAddress,
        amount: totalXRPString,
        reference: payment.paymentReference,
      });

      // Convert payment reference to hex string for memo (remove 0x prefix)
      const paymentRef = payment.paymentReference;
      const memoData = paymentRef.startsWith('0x') ? paymentRef.slice(2) : paymentRef;

      // Send XRP payment to the agent's XRPL address
      const result = await sendXRPPayment(
        xrplWallet,
        payment.agentXrplAddress,
        totalXRPString,
        memoData
      );

      if (result.success && result.txHash) {
        setXrpTxHash(result.txHash);
        setStep('flip-settlement'); // Go to FLIP instant settlement
      } else {
        setError(result.error || 'Failed to send XRP payment');
      }
    } catch (err: any) {
      setError(`Failed to send XRP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // FLIP instant settlement - LP provides FXRP immediately, takes FDC wait risk
  async function handleFlipSettlement() {
    if (!xrpTxHash || !reservationId || !address) {
      setError('Missing required data for FLIP settlement');
      return;
    }

    try {
      setFlipSettling(true);
      setError(null);

      // Calculate XRP amount in drops (6 decimals)
      const xrpAmountDrops = paymentInfo
        ? paymentInfo.valueUBA + paymentInfo.feeUBA
        : BigInt(0);

      console.log('Requesting FLIP minting:', {
        collateralReservationId: reservationId.toString(),
        xrplTxHash: xrpTxHash,
        xrpAmount: xrpAmountDrops.toString(),
        asset: FXRP_ADDRESS,
        authorizeFlipExecution: true,
      });

      // Call FLIP requestMinting
      writeContract({
        address: CONTRACTS.coston2.FLIPCore as Address,
        abi: FLIP_CORE_ABI,
        functionName: 'requestMinting',
        args: [
          reservationId,
          xrpTxHash,
          xrpAmountDrops,
          FXRP_ADDRESS,
          true, // authorize FLIP to execute on user's behalf
        ],
      });

      // The rest is handled by useEffect watching txSuccess
    } catch (err: any) {
      console.error('FLIP settlement error:', err);
      setError(`Failed to request FLIP settlement: ${err.message}`);
      setFlipSettling(false);
    }
  }

  // Monitor FLIP settlement transaction success
  useEffect(() => {
    if (txHash && txSuccess && step === 'flip-settlement' && flipSettling) {
      console.log('FLIP settlement transaction confirmed:', txHash);
      setFlipSettled(true);
      setFlipSettling(false);

      // Parse the MintingRequested event to get the minting ID
      if (publicClient) {
        publicClient.getTransactionReceipt({ hash: txHash }).then((receipt) => {
          console.log('FLIP tx receipt:', receipt);
          // Look for MintingRequested event
          const mintingRequestedTopic = '0x'; // Will be calculated by event signature
          for (const log of receipt.logs) {
            // Check if from FLIPCore contract
            if (log.address.toLowerCase() === CONTRACTS.coston2.FLIPCore.toLowerCase()) {
              console.log('Found FLIPCore log:', log);
              // For now, just mark as success - LP will provide FXRP
              // In production, parse the exact event
            }
          }

          // Move to success after short delay to show the settlement animation
          setTimeout(() => {
            setStep('success');
            refetchFxrp();
          }, 1500);
        }).catch(console.error);
      } else {
        setTimeout(() => {
          setStep('success');
          refetchFxrp();
        }, 1500);
      }
    }
  }, [txHash, txSuccess, step, flipSettling, publicClient, refetchFxrp]);

  // Note: FLIP settlement monitor is handled in the useEffect above

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black dark">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card className="bg-gray-900/60 border-gray-800 text-white">
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Please connect your wallet to mint FXRP</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black text-white selection:bg-purple-500/30 dark">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Progress Bar */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-purple-400">Step {getStepNumber(step)} of 6</span>
              <span className="text-gray-400">{getStepName(step)}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${(getStepNumber(step) / 6) * 100}%` }}
              />
            </div>
          </div>

          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
            <CardHeader className="border-b border-gray-800/50 pb-8">
              <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Mint FXRP
              </CardTitle>
              <CardDescription className="text-gray-400 text-lg">
                Convert your native XRP to FAssets on Flare Network with ease.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-8 space-y-8">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Step 1: Select Agent */}
              {step === 'select-agent' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Minting Amount</Label>
                    <div className="relative group">
                      <Input
                        type="number"
                        value={lots}
                        onChange={(e) => setLots(e.target.value)}
                        min="1"
                        className="bg-gray-800/50 border-gray-700 h-14 text-xl font-mono focus:ring-purple-500 focus:border-purple-500 transition-all pl-4 pr-16"
                        placeholder="1"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                        LOTS
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 italic">1 lot = 10 XRP value in FXRP</p>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Available Agents</Label>
                    {loading ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-4">
                        <div className="h-8 w-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-gray-400 animate-pulse">Scanning network for agents...</p>
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-8 text-center space-y-4">
                        <div className="mx-auto h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <span className="text-yellow-500 text-2xl font-bold">!</span>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-yellow-400 font-semibold text-lg">No Agents Available</h3>
                          <p className="text-gray-400 text-sm max-w-sm mx-auto">
                            We couldn&apos;t find any active agents on Coston2 testnet right now.
                          </p>
                        </div>
                        {parseFloat(fxrpBalance) > 0 && (
                          <div className="pt-4 border-t border-gray-800 mt-4">
                            <p className="text-emerald-400 text-sm font-medium mb-4 italic">
                              You already have {fxrpBalance} FXRP tokens!
                            </p>
                            <Button 
                              variant="outline" 
                              className="border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
                              asChild
                            >
                              <a href="/redeem">Try Redemption Flow instead</a>
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {agents.map((agent) => (
                          <div
                            key={agent.agentVault}
                            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                              selectedAgent?.agentVault === agent.agentVault 
                                ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500' 
                                : 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                            }`}
                            onClick={() => handleSelectAgent(agent)}
                          >
                            <div className="p-5 flex justify-between items-center relative z-10">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${agent.status === 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                                  <span className="font-mono text-xs text-gray-400">{agent.agentVault.slice(0, 10)}...{agent.agentVault.slice(-8)}</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-lg font-bold text-white">{Number(agent.feeBIPS) / 10000}%</span>
                                  <span className="text-xs text-gray-500 uppercase font-semibold">Fee</span>
                                  <span className="mx-2 text-gray-700">|</span>
                                  <span className="text-lg font-bold text-white">{Number(agent.freeCollateralLots)}</span>
                                  <span className="text-xs text-gray-500 uppercase font-semibold">Lots Available</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={selectedAgent?.agentVault === agent.agentVault ? "default" : "outline"}
                                className={`${selectedAgent?.agentVault === agent.agentVault ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-700 text-gray-400 group-hover:text-white group-hover:border-gray-500'}`}
                              >
                                {selectedAgent?.agentVault === agent.agentVault ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                            {/* Decorative background gradient */}
                            {selectedAgent?.agentVault === agent.agentVault && (
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-50" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Reserve Collateral */}
              {step === 'reserve-collateral' && selectedAgent && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="bg-gray-800/40 rounded-3xl p-8 border border-gray-800 space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Selected Agent</p>
                        <p className="font-mono text-sm text-purple-300 truncate">{selectedAgent.agentVault}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Minting Amount</p>
                        <p className="text-xl font-bold">{lots} Lots <span className="text-sm text-gray-400 font-normal">({parseInt(lots) * 10} XRP)</span></p>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-gray-700/50">
                      <div className="flex justify-between items-baseline">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Estimated Fee</p>
                        <div className="text-right">
                          <p className="text-3xl font-black text-white">{formatUnits(crfAmount, 18)} <span className="text-sm font-medium text-purple-400">FLR</span></p>
                          <p className="text-xs text-gray-500 mt-1">Collateral Reservation Fee</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleReserveCollateral}
                    disabled={!assetManagerAddress || isPending || isWaitingTx || loading}
                    className="w-full h-16 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-500/20 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {isPending || isWaitingTx ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Confirming Transaction...</span>
                      </div>
                    ) : (
                      'Lock Collateral & Proceed'
                    )}
                  </Button>
                  
                  <button 
                    onClick={() => setStep('select-agent')}
                    className="w-full text-center text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                  >
                    ← Back to Agent Selection
                  </button>
                </div>
              )}

              {/* Step 3: Connect XRPL */}
              {step === 'connect-xrpl' && (paymentInfo || reservationInfo) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  {/* Payment Details Card */}
                  <div className="bg-gray-800/40 rounded-3xl p-6 border border-gray-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Reservation ID</p>
                        <p className="font-mono text-sm text-white">{reservationId?.toString()}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Amount to Pay</p>
                        <p className="text-xl font-black text-white">
                          {(() => {
                            const totalDrops = paymentInfo
                              ? paymentInfo.valueUBA + paymentInfo.feeUBA
                              : (reservationInfo ? reservationInfo.valueUBA + reservationInfo.feeUBA : BigInt(0));
                            const xrpAmount = Number(totalDrops) / 1_000_000;
                            return xrpAmount.toFixed(2);
                          })()}
                          <span className="text-sm font-medium text-blue-400 ml-1">XRP</span>
                        </p>
                      </div>
                    </div>

                    {/* Agent's XRPL Address - where to send the XRP */}
                    {paymentInfo?.agentXrplAddress && (
                      <div className="pt-4 border-t border-gray-700/50 space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Send XRP To (Agent Address)</p>
                        <p className="font-mono text-sm text-blue-300 break-all">{paymentInfo.agentXrplAddress}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-700/50 space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Payment Reference (Memo)</p>
                      <p className="font-mono text-[10px] text-gray-400 break-all leading-relaxed">
                        {paymentInfo?.paymentReference || reservationInfo?.paymentReference}
                      </p>
                    </div>
                  </div>

                  {/* Wallet Section */}
                  <div className="bg-gray-800/40 rounded-3xl p-6 border border-gray-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Your XRPL Wallet</Label>
                      {!xrplWallet && (
                        <Button
                          onClick={handleGenerateTestWallet}
                          disabled={generatingWallet}
                          variant="outline"
                          size="sm"
                          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        >
                          {generatingWallet ? (
                            <span className="flex items-center gap-2">
                              <span className="h-3 w-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            'Generate Test Wallet'
                          )}
                        </Button>
                      )}
                    </div>

                    {xrplWallet ? (
                      <div className="space-y-3">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                          <p className="text-xs text-green-400 font-semibold mb-1">Wallet Ready</p>
                          <p className="font-mono text-sm text-white break-all">{xrplAddress}</p>
                          {xrpBalance && (
                            <p className="text-sm text-green-400 mt-2">Balance: {xrpBalance.balance} XRP</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                          Generate a testnet wallet above, or enter your own XRPL address:
                        </p>
                        <Input
                          value={xrplAddress}
                          onChange={(e) => setXrplAddress(e.target.value)}
                          placeholder="r..."
                          className="bg-gray-800/50 border-gray-700 h-12 pl-4 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setStep('send-xrp')}
                    disabled={!xrplWallet && (!xrplAddress || !isValidXRPLAddress(xrplAddress))}
                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20 rounded-2xl transition-all"
                  >
                    Continue to Payment
                  </Button>
                </div>
              )}

              {/* Step 4: Send XRP */}
              {step === 'send-xrp' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center space-y-3">
                    <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-blue-500/5">
                      <span className="text-blue-500 text-2xl font-bold">XRP</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white">Send XRP Payment</h3>
                    <p className="text-gray-400 max-w-sm mx-auto text-sm">
                      {xrplWallet
                        ? 'Click the button below to send XRP from your generated wallet to the agent.'
                        : 'Enter your XRPL wallet secret to authorize the payment. The XRP will be sent directly to the agent.'}
                    </p>
                  </div>

                  <div className="p-5 bg-gray-800/30 rounded-2xl border border-gray-800 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">From</span>
                      <span className="text-white font-mono text-sm truncate max-w-[200px]">{xrplAddress}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">To (Agent)</span>
                      <span className="text-blue-300 font-mono text-sm truncate max-w-[200px]">
                        {paymentInfo?.agentXrplAddress || 'Loading...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                      <span className="text-gray-500 text-sm font-semibold">Amount</span>
                      <span className="text-white text-xl font-bold">
                        {(() => {
                          const totalDrops = paymentInfo
                            ? paymentInfo.valueUBA + paymentInfo.feeUBA
                            : (reservationInfo ? reservationInfo.valueUBA + reservationInfo.feeUBA : BigInt(0));
                          const xrpAmount = Number(totalDrops) / 1_000_000;
                          return xrpAmount.toFixed(6);
                        })()}
                        <span className="text-blue-400 text-sm ml-1">XRP</span>
                      </span>
                    </div>
                  </div>

                  {xrpBalance && (
                    <div className="text-center text-sm text-gray-400">
                      Your wallet balance: <span className="text-white font-semibold">{xrpBalance.balance} XRP</span>
                    </div>
                  )}

                  {xrplWallet ? (
                    <Button
                      onClick={handleSendXRP}
                      disabled={loading || !paymentInfo?.agentXrplAddress || !xrplAddress}
                      className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20 rounded-2xl"
                    >
                      {loading ? 'Sending...' : 'Send XRP Now'}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-sm text-blue-300">
                        <p className="font-semibold mb-2">Enter Your Wallet Secret</p>
                        <p>
                          Enter your XRPL wallet secret (seed) to authorize the payment. The payment will be sent directly from your wallet.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">XRPL Wallet Secret</Label>
                        <Input
                          type="password"
                          value={walletSecret}
                          onChange={(e) => {
                            setWalletSecret(e.target.value);
                            setSecretError(null);
                          }}
                          placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                          className={`bg-gray-800/50 border-gray-700 h-12 pl-4 focus:ring-blue-500 transition-all font-mono ${
                            secretError ? 'border-red-500' : ''
                          }`}
                        />
                        {secretError && (
                          <p className="text-red-400 text-xs">{secretError}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Your secret is used only to sign the transaction and is never stored.
                        </p>
                      </div>

                      <Button
                        onClick={handleSendWithSecret}
                        disabled={sendingPayment || !walletSecret.trim() || !paymentInfo?.agentXrplAddress}
                        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20 rounded-2xl"
                      >
                        {sendingPayment ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending Payment...
                          </span>
                        ) : (
                          'Send XRP Payment'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: FLIP Instant Settlement */}
              {step === 'flip-settlement' && xrpTxHash && (
                <div className="space-y-8 animate-in fade-in duration-500 text-center py-8">
                  {!flipSettled ? (
                    <>
                      <div className="relative mx-auto h-24 w-24">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 blur-2xl opacity-30 animate-pulse" />
                        <div className="relative h-full w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-xl">
                          <span className="text-white text-3xl font-black">⚡</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-2xl font-bold text-white">FLIP Instant Settlement</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">
                          {flipSettling
                            ? 'Connecting you with a liquidity provider for instant FXRP...'
                            : 'Get your FXRP instantly! A liquidity provider will send you FXRP now, taking the FDC verification wait for you.'}
                        </p>
                      </div>

                      <div className="bg-gray-800/20 rounded-xl p-4 inline-block border border-gray-800">
                        <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-widest">XRPL Payment Hash</p>
                        <p className="font-mono text-xs text-purple-300">{xrpTxHash}</p>
                      </div>

                      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-5 text-left max-w-md mx-auto">
                        <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
                          <span>⚡</span> How FLIP Works
                        </h4>
                        <ul className="text-sm text-gray-400 space-y-2">
                          <li>• LP provides FXRP to you instantly</li>
                          <li>• LP earns a small fee (~0.3%) for taking the wait risk</li>
                          <li>• FDC verifies your XRP payment in background</li>
                          <li>• You skip the 3-5 minute verification wait!</li>
                        </ul>
                      </div>

                      <Button
                        onClick={handleFlipSettlement}
                        disabled={flipSettling || isPending || isWaitingTx}
                        className="w-full max-w-md mx-auto h-16 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-500/20 rounded-2xl transition-all"
                      >
                        {flipSettling || isPending || isWaitingTx ? (
                          <div className="flex items-center gap-3">
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Settling with LP...</span>
                          </div>
                        ) : (
                          <>
                            <span className="mr-2">⚡</span> Get FXRP Instantly via FLIP
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative mx-auto h-20 w-20">
                        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl animate-pulse" />
                        <div className="relative h-full w-full bg-emerald-500 rounded-full flex items-center justify-center shadow-xl">
                          <span className="text-white text-3xl font-black">✓</span>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-emerald-400">Settlement Complete!</h3>
                      <p className="text-gray-400">LP provided your FXRP. Redirecting to success...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Success */}
              {step === 'success' && (
                <div className="space-y-8 animate-in fade-in scale-95 duration-700 py-4">
                  <div className="relative mx-auto h-32 w-32">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative h-full w-full bg-emerald-500 rounded-full flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-emerald-500/50">
                      ✓
                    </div>
                  </div>

                  <div className="text-center space-y-4">
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-white tracking-tight">Success!</h2>
                      <p className="text-emerald-400 font-semibold tracking-widest uppercase text-sm">FXRP Minted Successfully</p>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 max-w-xs mx-auto">
                      <p className="text-gray-500 text-xs uppercase font-bold mb-1">Current Balance</p>
                      <p className="text-3xl font-mono font-bold text-white">{fxrpBalance} <span className="text-sm font-medium text-purple-400">FXRP</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => {
                        setStep('select-agent');
                        setSelectedAgent(null);
                        setReservationId(null);
                        setReservationInfo(null);
                        setPaymentInfo(null);
                        setXrpTxHash(null);
                        setFlipMintingId(null);
                        setFlipSettled(false);
                        setFlipSettling(false);
                      }}
                      className="h-14 rounded-xl bg-white text-black hover:bg-gray-200 font-bold transition-all"
                    >
                      Mint More Tokens
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-12 text-gray-500 hover:text-white"
                      asChild
                    >
                      <a href="/">Return Dashboard</a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function getStepNumber(step: MintingStep): number {
  const steps: Record<MintingStep, number> = {
    'select-agent': 1,
    'reserve-collateral': 2,
    'connect-xrpl': 3,
    'send-xrp': 4,
    'flip-settlement': 5,
    'success': 6,
  };
  return steps[step];
}

function getStepName(step: MintingStep): string {
  const names: Record<MintingStep, string> = {
    'select-agent': 'Select Agent',
    'reserve-collateral': 'Reserve Collateral',
    'connect-xrpl': 'Connect XRPL Wallet',
    'send-xrp': 'Send XRP Payment',
    'flip-settlement': 'FLIP Instant Settlement',
    'success': 'Success',
  };
  return names[step];
}

