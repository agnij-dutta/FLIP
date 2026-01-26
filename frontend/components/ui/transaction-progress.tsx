'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, Loader2, AlertTriangle, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  txHash?: string;
  explorerUrl?: string;
}

interface TransactionProgressProps {
  steps: ProgressStep[];
  currentStep: number;
  title?: string;
}

export function TransactionProgress({ steps, currentStep, title }: TransactionProgressProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      )}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <ProgressStepItem
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressStepItem({
  step,
  index,
  isLast,
}: {
  step: ProgressStep;
  index: number;
  isLast: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyTxHash = () => {
    if (step.txHash) {
      navigator.clipboard.writeText(step.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusIcons = {
    pending: <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />,
    active: <Loader2 className="w-4 h-4 text-flare-pink animate-spin" />,
    completed: <Check className="w-4 h-4 text-white" />,
    error: <AlertTriangle className="w-4 h-4 text-white" />,
  };

  const statusColors = {
    pending: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    active: 'bg-flare-pink/10 border-flare-pink ring-4 ring-flare-pink/20',
    completed: 'bg-emerald-500 border-emerald-500',
    error: 'bg-red-500 border-red-500',
  };

  const lineColors = {
    pending: 'bg-gray-200 dark:bg-gray-700',
    active: 'bg-gradient-to-b from-flare-pink to-gray-200 dark:to-gray-700',
    completed: 'bg-emerald-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex gap-4">
      {/* Step indicator */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: step.status === 'active' ? [1, 1.1, 1] : 1 }}
          transition={{ repeat: step.status === 'active' ? Infinity : 0, duration: 1.5 }}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${statusColors[step.status]}`}
        >
          {statusIcons[step.status]}
        </motion.div>
        {!isLast && (
          <div className={`w-0.5 h-12 mt-2 transition-all duration-500 ${lineColors[step.status]}`} />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 pb-8">
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold transition-colors ${
              step.status === 'completed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : step.status === 'active'
                ? 'text-flare-pink'
                : step.status === 'error'
                ? 'text-red-500'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {step.label}
          </span>
          {step.status === 'active' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-medium text-flare-pink bg-flare-pink/10 px-2 py-0.5 rounded-full"
            >
              In Progress
            </motion.span>
          )}
        </div>

        {step.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.description}</p>
        )}

        {step.txHash && (
          <div className="mt-2 flex items-center gap-2">
            <code className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {step.txHash.slice(0, 10)}...{step.txHash.slice(-8)}
            </code>
            <button
              onClick={copyTxHash}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
            {step.explorerUrl && (
              <a
                href={`${step.explorerUrl}/tx/${step.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-flare-pink" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// FDC Countdown Component
interface FDCCountdownProps {
  startTime: number;
  duration?: number; // seconds, default 300 (5 min)
  onComplete?: () => void;
}

export function FDCCountdown({ startTime, duration = 300, onComplete }: FDCCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, duration - elapsed);
  });

  useState(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  const progress = ((duration - timeLeft) / duration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-white">FDC Verification</span>
        </div>
        <span className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Waiting for Flare Data Connector to verify the transaction...
      </p>
    </div>
  );
}

// Agent Status Card
interface AgentStatusProps {
  agentAddress: string;
  agentXrplAddress?: string;
  status: 'pending' | 'processing' | 'sent' | 'confirmed' | 'failed';
  xrplTxHash?: string;
}

export function AgentStatus({ agentAddress, agentXrplAddress, status, xrplTxHash }: AgentStatusProps) {
  const statusConfig = {
    pending: {
      label: 'Waiting for Agent',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      icon: <Clock className="w-4 h-4" />,
    },
    processing: {
      label: 'Agent Processing',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
    },
    sent: {
      label: 'XRP Sent',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      icon: <Check className="w-4 h-4" />,
    },
    confirmed: {
      label: 'Confirmed',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      icon: <CheckCircle className="w-4 h-4" />,
    },
    failed: {
      label: 'Failed',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Agent Status</span>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
          {config.icon}
          <span className="text-xs font-semibold">{config.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Agent Vault</p>
          <p className="font-mono text-sm text-gray-900 dark:text-white truncate">{agentAddress}</p>
        </div>

        {agentXrplAddress && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">XRPL Address</p>
            <p className="font-mono text-sm text-gray-900 dark:text-white truncate">{agentXrplAddress}</p>
          </div>
        )}

        {xrplTxHash && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">XRPL Transaction</p>
            <a
              href={`https://testnet.xrpl.org/transactions/${xrplTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-flare-pink hover:text-flare-pink-dark flex items-center gap-1"
            >
              {xrplTxHash.slice(0, 12)}...{xrplTxHash.slice(-8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Live Status Pulse
export function LiveStatusPulse({ label, isActive = true }: { label: string; isActive?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
        {isActive && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        )}
      </div>
      <span className={`text-sm font-medium ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
