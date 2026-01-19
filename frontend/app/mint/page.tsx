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
import { connectXRPLClient, getXRPBalance, sendXRPPayment, monitorPayment, isValidXRPLAddress, type XRPLBalance } from '@/lib/xrpl';
import { Wallet } from 'xrpl';

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
  | 'wait-fdc'
  | 'execute-minting'
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
  const [xrplAddress, setXrplAddress] = useState<string>('');
  const [xrplWallet, setXrplWallet] = useState<Wallet | null>(null);
  const [xrpBalance, setXrpBalance] = useState<XRPLBalance | null>(null);
  const [xrpTxHash, setXrpTxHash] = useState<string | null>(null);
  const [fdcRoundId, setFdcRoundId] = useState<number | null>(null);
  const [fxrpBalance, setFxrpBalance] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
    if (reservationId && txSuccess && step === 'reserve-collateral') {
      loadReservationInfo();
    }
  }, [reservationId, txSuccess, step]);

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
    if (!reservationId) return;
    
    try {
      setLoading(true);
      const info = await getCollateralReservationInfo(reservationId);
      setReservationInfo(info);
      setStep('connect-xrpl');
    } catch (err: any) {
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
    if (!selectedAgent || !address || !assetManagerAddress) return;

    try {
      setLoading(true);
      setError(null);

      // Parse reservation fee
      const fee = await getCollateralReservationFee(parseInt(lots));
      
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
    } catch (err: any) {
      setError(`Failed to reserve collateral: ${err.message}`);
      setLoading(false);
    }
  }

  // Parse CollateralReserved event to get reservation ID
  useEffect(() => {
    if (txHash && txSuccess && publicClient) {
      publicClient.getTransactionReceipt({ hash: txHash }).then((receipt) => {
        // Decode CollateralReserved event
        const eventAbi = {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'collateralReservationId', type: 'uint256' },
            { indexed: true, name: 'minter', type: 'address' },
            { indexed: true, name: 'agentVault', type: 'address' },
            { name: 'lots', type: 'uint256' },
            { name: 'valueUBA', type: 'uint256' },
            { name: 'feeUBA', type: 'uint256' },
            { name: 'lastUnderlyingBlock', type: 'uint256' },
            { name: 'lastUnderlyingTimestamp', type: 'uint256' },
            { name: 'paymentReference', type: 'bytes32' },
          ],
          name: 'CollateralReserved',
          type: 'event',
        };

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: [eventAbi],
              data: log.data,
              topics: log.topics,
            });
            
            // viem returns args as an object when inputs have names
            if (decoded.eventName === 'CollateralReserved' && decoded.args && (decoded.args as any).collateralReservationId != null) {
              setReservationId((decoded.args as any).collateralReservationId as bigint);
              break;
            }
          } catch (e) {
            // Not this event, continue
          }
        }
      });
    }
  }, [txHash, txSuccess, publicClient]);

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

  async function handleSendXRP() {
    if (!reservationInfo || !xrplWallet) {
      setError('XRPL wallet not connected. Please connect your XRPL wallet.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate total XRP needed (valueUBA + feeUBA)
      const decimals = await getAssetMintingDecimals();
      const totalXRP = Number(reservationInfo.valueUBA + reservationInfo.feeUBA) / Math.pow(10, decimals);
      const totalXRPString = totalXRP.toFixed(6);

      // Convert payment reference to hex string for memo
      const paymentRef = reservationInfo.paymentReference;
      const memoData = paymentRef.startsWith('0x') ? paymentRef.slice(2) : paymentRef;

      // Send XRP payment
      const result = await sendXRPPayment(
        xrplWallet,
        selectedAgent?.agentVault || '', // Agent's XRPL address (need to get from agent info)
        totalXRPString,
        memoData
      );

      if (result.success && result.txHash) {
        setXrpTxHash(result.txHash);
        setStep('wait-fdc');
      } else {
        setError(result.error || 'Failed to send XRP payment');
      }
    } catch (err: any) {
      setError(`Failed to send XRP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteMinting() {
    if (!reservationId || !fdcRoundId) {
      setError('FDC proof not ready');
      return;
    }
    if (!assetManagerAddress) {
      setError('AssetManager address could not be resolved.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // TODO: Fetch FDC proof from Data Availability Layer
      // For now, this is a placeholder
      const proof = {
        merkleProof: [],
        data: '0x',
      };

      writeContract({
        address: assetManagerAddress,
        abi: ASSET_MANAGER_ABI,
        functionName: 'executeMinting',
        args: [
          {
            merkleProof: proof.merkleProof,
            data: proof.data as `0x${string}`,
          },
          reservationId,
        ],
      });
    } catch (err: any) {
      setError(`Failed to execute minting: ${err.message}`);
      setLoading(false);
    }
  }

  // Monitor minting execution success
  useEffect(() => {
    if (txHash && txSuccess && step === 'execute-minting') {
      setStep('success');
      refetchFxrp();
    }
  }, [txHash, txSuccess, step, refetchFxrp]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Please connect your wallet to mint FXRP</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">Mint FXRP from XRP</CardTitle>
            <CardDescription>
              Step {getStepNumber(step)} of 7: {getStepName(step)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Step 1: Select Agent */}
            {step === 'select-agent' && (
              <div className="space-y-4">
                <div>
                  <Label>Number of Lots</Label>
                  <Input
                    type="number"
                    value={lots}
                    onChange={(e) => setLots(e.target.value)}
                    min="1"
                    placeholder="1"
                  />
                  <p className="text-sm text-gray-400 mt-1">1 lot = 10 XRP</p>
                </div>

                {loading ? (
                  <p className="text-center text-gray-400">Loading agents...</p>
                ) : agents.length === 0 ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
                      <p className="text-yellow-400 text-sm mb-2">
                        ⚠️ AssetManager not configured or no agents available on Coston2 testnet.
                      </p>
                      <p className="text-gray-400 text-sm mb-3">
                        Minting FXRP requires the AssetManager contract to be deployed and configured.
                      </p>
                      {parseFloat(fxrpBalance) > 0 ? (
                        <div className="mt-3">
                          <p className="text-green-400 text-sm mb-2">
                            ✅ You already have {fxrpBalance} FXRP in your wallet!
                          </p>
                          <a
                            href="/redeem"
                            className="text-blue-400 hover:text-blue-300 text-sm underline"
                          >
                            → Go to Redemption Page to test FLIP
                          </a>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          To test FLIP redemption, you&apos;ll need FXRP tokens. You can:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Get FXRP from Flare testnet faucet or community</li>
                            <li>Configure AssetManager address if you have it</li>
                            <li>Use a different testnet that has FAssets deployed</li>
                          </ul>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Select Agent</Label>
                    {agents.map((agent) => (
                      <Card
                        key={agent.agentVault}
                        className={`cursor-pointer hover:bg-gray-800 ${
                          selectedAgent?.agentVault === agent.agentVault ? 'border-blue-500' : ''
                        }`}
                        onClick={() => handleSelectAgent(agent)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-mono text-sm">{agent.agentVault.slice(0, 10)}...</p>
                              <p className="text-sm text-gray-400">
                                Fee: {Number(agent.feeBIPS) / 10000}% | Available: {Number(agent.freeCollateralLots)} lots
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Status: {
                                  agent.status === 0 ? '✅ NORMAL' :
                                  agent.status === 1 ? '⏸️ PAUSED' :
                                  agent.status === 2 ? '⚠️ LIQUIDATION' :
                                  agent.status === 3 ? '❌ DESTROYED' :
                                  `⚠️ Unknown (${agent.status})`
                                }
                              </p>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (agent.status !== 0) {
                                  setError(`Agent status is ${agent.status} (not NORMAL). The contract may reject this agent. Try anyway?`);
                                }
                                handleSelectAgent(agent);
                              }}
                            >
                              Select {agent.status !== 0 && '(Status: ' + agent.status + ')'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Reserve Collateral */}
            {step === 'reserve-collateral' && selectedAgent && (
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Agent</p>
                  <p className="font-mono text-sm">{selectedAgent.agentVault}</p>
                  <p className="text-sm text-gray-400 mt-2">Lots</p>
                  <p>{lots}</p>
                  <p className="text-sm text-gray-400 mt-2">Collateral Reservation Fee</p>
                  <p>{formatUnits(crfAmount, 18)} FLR</p>
                </div>

                <Button
                  onClick={handleReserveCollateral}
                  disabled={!assetManagerAddress || isPending || isWaitingTx || loading}
                  className="w-full"
                >
                  {isPending || isWaitingTx ? 'Processing...' : 'Reserve Collateral'}
                </Button>
              </div>
            )}

            {/* Step 3: Connect XRPL */}
            {step === 'connect-xrpl' && reservationInfo && (
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Reservation ID</p>
                  <p className="font-mono">{reservationId?.toString()}</p>
                  <p className="text-sm text-gray-400 mt-2">Payment Reference</p>
                  <p className="font-mono text-xs break-all">{reservationInfo.paymentReference}</p>
                  <p className="text-sm text-gray-400 mt-2">Amount to Pay</p>
                  <p>
                    {formatUnits(reservationInfo.valueUBA + reservationInfo.feeUBA, 6)} XRP
                  </p>
                </div>

                <div>
                  <Label>Your XRPL Address</Label>
                  <Input
                    value={xrplAddress}
                    onChange={(e) => setXrplAddress(e.target.value)}
                    placeholder="r..."
                  />
                  {xrpBalance && (
                    <p className="text-sm text-gray-400 mt-1">
                      Balance: {xrpBalance.balance} XRP
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleConnectXRPL}
                  disabled={!xrplAddress || !isValidXRPLAddress(xrplAddress) || loading}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 4: Send XRP */}
            {step === 'send-xrp' && (
              <div className="space-y-4">
                <p className="text-gray-400">
                  Please send XRP payment using your XRPL wallet. The payment reference has been copied to your clipboard.
                </p>
                <Button
                  onClick={handleSendXRP}
                  disabled={!xrplWallet || loading}
                  className="w-full"
                >
                  {loading ? 'Sending...' : 'Send XRP Payment'}
                </Button>
              </div>
            )}

            {/* Step 5: Wait for FDC */}
            {step === 'wait-fdc' && xrpTxHash && (
              <div className="space-y-4">
                <p className="text-gray-400">
                  XRP payment sent! Transaction: {xrpTxHash}
                </p>
                <p className="text-gray-400">
                  Waiting for FDC confirmation (3-5 minutes)...
                </p>
                <p className="text-sm text-gray-500">
                  This step requires FDC proof fetching. Implementation pending.
                </p>
              </div>
            )}

            {/* Step 6: Execute Minting */}
            {step === 'execute-minting' && (
              <div className="space-y-4">
                <Button
                  onClick={handleExecuteMinting}
                  disabled={!fdcRoundId || isPending || isWaitingTx || loading}
                  className="w-full"
                >
                  {isPending || isWaitingTx ? 'Processing...' : 'Execute Minting'}
                </Button>
              </div>
            )}

            {/* Step 7: Success */}
            {step === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
                  <p className="text-green-400 text-lg font-semibold">Minting Successful!</p>
                  <p className="text-gray-400 mt-2">Your FXRP Balance: {fxrpBalance} FXRP</p>
                </div>
                <Button
                  onClick={() => {
                    setStep('select-agent');
                    setSelectedAgent(null);
                    setReservationId(null);
                    setReservationInfo(null);
                    setXrpTxHash(null);
                    setFdcRoundId(null);
                  }}
                  className="w-full"
                >
                  Mint More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getStepNumber(step: MintingStep): number {
  const steps: Record<MintingStep, number> = {
    'select-agent': 1,
    'reserve-collateral': 2,
    'connect-xrpl': 3,
    'send-xrp': 4,
    'wait-fdc': 5,
    'execute-minting': 6,
    'success': 7,
  };
  return steps[step];
}

function getStepName(step: MintingStep): string {
  const names: Record<MintingStep, string> = {
    'select-agent': 'Select Agent',
    'reserve-collateral': 'Reserve Collateral',
    'connect-xrpl': 'Connect XRPL Wallet',
    'send-xrp': 'Send XRP Payment',
    'wait-fdc': 'Wait for FDC Confirmation',
    'execute-minting': 'Execute Minting',
    'success': 'Success',
  };
  return names[step];
}

