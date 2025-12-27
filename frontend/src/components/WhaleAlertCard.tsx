'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WhaleAlert } from '@/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface WhaleAlertCardProps {
  alert: WhaleAlert;
  onDismiss?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0, x: 100, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: { opacity: 0, x: 100, transition: { duration: 0.2 } },
};

const pulseVariants = {
  initial: { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)' },
  animate: {
    boxShadow: '0 0 0 20px rgba(59, 130, 246, 0)',
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { delay: 0.1 } },
};

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { delay: 0.2 } },
};

export function WhaleAlertCard({ alert, onDismiss }: WhaleAlertCardProps) {
  const isBuy = alert.is_buy;
  const bgGradient = isBuy
    ? 'from-green-900/30 to-green-800/30'
    : 'from-red-900/30 to-red-800/30';
  const borderColor = isBuy ? 'border-green-500/50' : 'border-red-500/50';
  const textColor = isBuy ? 'text-green-400' : 'text-red-400';

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`relative bg-gradient-to-br ${bgGradient} border ${borderColor} rounded-lg p-4 overflow-hidden`}
    >
      {/* Pulse background effect */}
      <motion.div
        variants={pulseVariants}
        initial="initial"
        animate="animate"
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 rounded-lg"
      />

      <div className="relative z-10">
        {/* Header */}
        <motion.div variants={headerVariants} className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🐋</span>
            <h3 className="text-lg font-bold text-white">
              WHALE {isBuy ? '🟢 BUY' : '🔴 SELL'}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </motion.div>

        {/* Main metrics */}
        <motion.div variants={contentVariants} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Trade Value */}
            <div className="bg-black/40 rounded p-2">
              <p className="text-xs text-gray-400 mb-1">Trade Value</p>
              <p className={`text-xl font-bold ${textColor}`}>
                {formatUSD(alert.trade_value)}
              </p>
            </div>

            {/* Price */}
            <div className="bg-black/40 rounded p-2">
              <p className="text-xs text-gray-400 mb-1">Price / BTC</p>
              <p className="text-xl font-bold text-blue-400">
                {formatUSD(alert.price)}
              </p>
            </div>

            {/* Quantity */}
            <div className="bg-black/40 rounded p-2">
              <p className="text-xs text-gray-400 mb-1">Quantity</p>
              <p className="text-xl font-bold text-purple-400">
                {alert.quantity.toFixed(4)} BTC
              </p>
            </div>

            {/* Whale Score */}
            <div className="bg-black/40 rounded p-2">
              <p className="text-xs text-gray-400 mb-1">Whale Score</p>
              <p className="text-xl font-bold text-yellow-400">
                {(alert.whale_score * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Bull/Bear Sentiment */}
          <div className="bg-black/40 rounded p-2">
            <p className="text-xs text-gray-400 mb-2">Market Sentiment</p>
            <div className="flex items-center gap-2">
              {alert.bull_bear_sentiment > 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full ${
                    alert.bull_bear_sentiment > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(alert.bull_bear_sentiment + 1) * 50}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs font-mono text-gray-300 w-8">
                {alert.bull_bear_sentiment.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Similar Patterns */}
          {alert.similar_patterns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-blue-900/30 border border-blue-500/30 rounded p-2"
            >
              <p className="text-xs font-semibold text-blue-300 mb-2">
                📊 Similar Patterns ({alert.similar_patterns.length})
              </p>
              <div className="space-y-1">
                {alert.similar_patterns.slice(0, 2).map((pattern, idx) => (
                  <div key={idx} className="text-xs text-gray-300">
                    <span className="font-mono">#{pattern.trade_id}</span>
                    {' '} · {' '}
                    <span className={pattern.is_buy ? 'text-green-400' : 'text-red-400'}>
                      {pattern.is_buy ? 'BUY' : 'SELL'}
                    </span>
                    {' '} · {' '}
                    {formatUSD(pattern.value)}
                    {' '} · {' '}
                    <span className="text-yellow-300">
                      {(pattern.similarity_score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-600/50">
            {formatTime(alert.timestamp)}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
