'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { OrderBookSnapshot } from '@/lib/types';

interface OrderBookPanelProps {
  snapshot: OrderBookSnapshot | null;
  depth?: number;
}

const formatNumber = (value: number, decimals: number) => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function OrderBookPanel({ snapshot, depth = 10 }: OrderBookPanelProps) {
  if (!snapshot || (!snapshot.bids.length && !snapshot.asks.length)) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-gray-400">
        Waiting for order book data...
      </div>
    );
  }

  const bids = snapshot.bids.slice(0, depth).map(([price, qty]) => ({
    price: parseFloat(price),
    qty: parseFloat(qty),
  }));
  const asks = snapshot.asks.slice(0, depth).map(([price, qty]) => ({
    price: parseFloat(price),
    qty: parseFloat(qty),
  }));

  const maxBidQty = Math.max(...bids.map((b) => b.qty), 1);
  const maxAskQty = Math.max(...asks.map((a) => a.qty), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">BTC/USDT Order Book</h2>
          <p className="text-xs text-gray-400">Live depth from Binance</p>
        </div>
        <span className="text-xs text-gray-500">
          {snapshot.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString() : 'Live'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-xs text-green-400 mb-2">Bids</p>
          <div className="space-y-2">
            {bids.map((bid, idx) => (
              <div key={`bid-${idx}`} className="relative overflow-hidden rounded bg-black/30">
                <div
                  className="absolute inset-0 bg-green-500/10"
                  style={{ width: `${(bid.qty / maxBidQty) * 100}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                  <span className="text-green-300">{formatNumber(bid.price, 2)}</span>
                  <span>{formatNumber(bid.qty, 4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-red-400 mb-2">Asks</p>
          <div className="space-y-2">
            {asks.map((ask, idx) => (
              <div key={`ask-${idx}`} className="relative overflow-hidden rounded bg-black/30">
                <div
                  className="absolute inset-0 bg-red-500/10"
                  style={{ width: `${(ask.qty / maxAskQty) * 100}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                  <span className="text-red-300">{formatNumber(ask.price, 2)}</span>
                  <span>{formatNumber(ask.qty, 4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
