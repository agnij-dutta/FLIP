"use client";

import { SimpleNavbar } from "@/components/ui/core-header-navbar";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export function Header() {
  const { address, isConnected } = useAccount();

  return (
    <div className="relative">
      <SimpleNavbar 
        title="FLIP Protocol" 
        userName={isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : undefined}
        userImage={undefined}
      />
      <div className="absolute top-4 right-4 z-20">
        <ConnectButton />
      </div>
    </div>
  );
}

