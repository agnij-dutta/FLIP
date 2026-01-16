"use client";

import { SimpleNavbar } from "@/components/ui/core-header-navbar";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export function Header() {
  const { address, isConnected } = useAccount();

  return (
    <div className="relative">
      <SimpleNavbar 
        title="FLIP Protocol" 
        userName={isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : undefined}
        userImage={undefined}
      />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <nav className="hidden md:flex gap-4 text-sm">
          <Link href="/" className="text-gray-300 hover:text-white">Home</Link>
          <Link href="/mint" className="text-gray-300 hover:text-white">Mint</Link>
          <Link href="/redeem" className="text-gray-300 hover:text-white">Redeem</Link>
          <Link href="/lp" className="text-gray-300 hover:text-white">LP Dashboard</Link>
          <Link href="/status" className="text-gray-300 hover:text-white">Status</Link>
        </nav>
        <ConnectButton />
      </div>
    </div>
  );
}

