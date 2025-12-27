'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BullBearMetrics } from '@/lib/types';

interface BullBearMeterProps {
  metrics: BullBearMetrics | null;
}

export function BullBearMeter({ metrics }: BullBearMeterProps) {
  if (!metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center"
      >
        <p className="text-gray-400">Waiting for market data...</p>
      </motion.div>
    );
  }

  const bullPower = metrics.bull_power;
  const momentum = metrics.momentum;
  const isBullish = bullPower > 0;

  // Calculate gauge position (0-100%)
  const gaugePosition = ((bullPower + 1) / 2) * 100;

  const formatVolume = (value: number) => {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K';
    return value.toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
    >
      <h2 className="text-lg font-semibold text-white mb-6">Bull vs Bear Power</h2>

      {/* Gauge visualization */}
      <div className="mb-8">
        <div className="relative h-8 bg-gradient-to-r from-red-600 via-gray-700 to-green-600 rounded-full overflow-hidden">
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: `${gaugePosition}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="absolute top-0 w-1 h-full bg-white shadow-lg"
          />
        </div>

        <div className="flex justify-between mt-2 text-xs font-semibold">
          <span className="text-red-400">BEAR</span>
          <span className="text-gray-400">NEUTRAL</span>
          <span className="text-green-400">BULL</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Bull Power */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className={`rounded-lg p-4 border ${
            isBullish
              ? 'bg-green-900/20 border-green-500/50'
              : 'bg-red-900/20 border-red-500/50'
          }`}
        >
          <p className="text-xs text-gray-400 mb-1">Power Reading</p>
          <p className={`text-2xl font-bold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
            {isBullish ? '+' : ''}{(bullPower * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isBullish ? '🟢 Bullish Momentum' : '🔴 Bearish Pressure'}
          </p>
        </motion.div>

        {/* Momentum */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="rounded-lg p-4 border bg-blue-900/20 border-blue-500/50"
        >
          <p className="text-xs text-gray-400 mb-1">Momentum Strength</p>
          <p className="text-2xl font-bold text-blue-400">
            {(momentum * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {momentum > 0.7 ? '⚡ Strong' : momentum > 0.4 ? '📈 Moderate' : '🔇 Weak'}
          </p>
        </motion.div>
      </div>

      {/* Volume comparison */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-green-400">Buy Volume (Whales)</span>
            <span className="text-sm font-mono text-gray-300">
              ${formatVolume(metrics.net_buy_volume)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${
                  (metrics.net_buy_volume /
                    Math.max(
                      metrics.net_buy_volume,
                      metrics.net_sell_volume,
                      1
                    )) *
                  100
                }%`,
              }}
              transition={{ duration: 0.5 }}
              className="h-full bg-green-500"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-red-400">Sell Volume (Whales)</span>
            <span className="text-sm font-mono text-gray-300">
              ${formatVolume(metrics.net_sell_volume)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${
                  (metrics.net_sell_volume /
                    Math.max(
                      metrics.net_buy_volume,
                      metrics.net_sell_volume,
                      1
                    )) *
                  100
                }%`,
              }}
              transition={{ duration: 0.5 }}
              className="h-full bg-red-500"
            />
          </div>
        </div>
      </div>

      {/* Insight */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-4 pt-4 border-t border-gray-700"
      >
        <p className="text-xs text-gray-400">
          <span className="text-white font-semibold">Market Insight: </span>
          {isBullish
            ? 'Whales are accumulating BTC. Bullish pressure detected in the market.'
            : 'Whales are distributing BTC. Bearish pressure detected in the market.'}
        </p>
      </motion.div>
    </motion.div>
  );
}
