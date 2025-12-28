'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTradeStore } from '@/store/tradeStore';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/feed', label: 'Whale Feed' },
  { href: '/order-book', label: 'Order Book' },
  { href: '/visuals', label: 'Bubble Space' },
  { href: '/replay', label: 'Replay' },
  { href: '/news', label: 'News' },
];

function BitcoinIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-[#f7931a] text-white font-bold shadow-sm ring-1 ring-black/40 ${className ?? ''}`}
      aria-hidden="true"
    >
      <span className="leading-none text-[0.95em]">₿</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useWebSocket('ws://localhost:8000/ws');
  const { isConnected, whaleAlerts, clearAlerts } = useTradeStore();

  useEffect(() => {
    if (isConnected) {
      toast.success('Connected to Whale Watcher backend', {
        icon: <BitcoinIcon className="w-5 h-5" />,
        duration: 3000,
      });
    } else {
      toast.error('Disconnected from backend', {
        icon: <BitcoinIcon className="w-5 h-5" />,
        duration: 3000,
      });
    }
  }, [isConnected]);

  useEffect(() => {
    if (whaleAlerts.length > 0) {
      const latest = whaleAlerts[0];
      const sideLabel = latest.is_buy ? 'BUY' : 'SELL';
      toast.success(
        `${sideLabel}: $${latest.trade_value.toLocaleString()} whale detected!`,
        {
          duration: 5000,
          icon: <BitcoinIcon className="w-5 h-5" />,
        }
      );
    }
  }, [whaleAlerts.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/20 to-gray-950">
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10">
                <BitcoinIcon className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Whale Watcher Pro</h1>
                <p className="text-xs text-gray-400">Real-Time Crypto Whale Detection</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-400">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full border ${
                  pathname === item.href
                    ? 'border-blue-400 text-blue-200 bg-blue-500/10'
                    : 'border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={clearAlerts}
              className="ml-auto px-3 py-1.5 rounded-full border border-gray-700 text-gray-300 hover:text-white"
            >
              Clear Alerts
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
