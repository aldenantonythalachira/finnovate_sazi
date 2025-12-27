'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstitutionalExecutionEvent } from '@/lib/types';

interface InstitutionalExecutionPanelProps {
  events: InstitutionalExecutionEvent[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const scoreColor = (score: number) => {
  if (score >= 80) return 'from-emerald-500/20 to-emerald-400/5 border-emerald-500/40';
  if (score >= 65) return 'from-cyan-500/20 to-cyan-400/5 border-cyan-500/40';
  return 'from-gray-700/40 to-gray-800/20 border-gray-600/40';
};

const labelCopy = (label: string) => {
  switch (label) {
    case 'INSTITUTIONAL_EXECUTION_STRONG':
      return 'Institutional Execution (Strong)';
    case 'INSTITUTIONAL_EXECUTION_LIKELY':
      return 'Institutional Execution (Likely)';
    case 'LARGE_TRADE_ONLY':
      return 'Large Trade Only';
    default:
      return label;
  }
};

export function InstitutionalExecutionPanel({ events }: InstitutionalExecutionPanelProps) {
  const latest = events[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Institutional Execution Radar</h2>
          <p className="text-xs text-gray-400">Slicing • Absorption • Persistent Aggression</p>
        </div>
        <span className="text-xs text-gray-500">
          {latest ? new Date(latest.ts).toLocaleTimeString() : 'Idle'}
        </span>
      </div>

      {!latest ? (
        <div className="text-sm text-gray-400">
          Listening for institutional execution patterns...
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className={`rounded-lg border bg-gradient-to-br ${scoreColor(latest.score)} p-4`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300">{labelCopy(latest.label)}</p>
                <p className="text-2xl font-bold text-white">
                  {latest.score}
                  <span className="text-sm text-gray-300">/100</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-300">Direction</p>
                <p className={`text-lg font-semibold ${latest.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                  {latest.side}
                </p>
                <p className="text-xs text-gray-400">
                  Confidence {(latest.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-300">
              <div className="bg-black/30 rounded p-2">
                <p className="text-gray-400">Flow Ratio (10s)</p>
                <p className="text-white">{latest.features.flow_ratio_10s.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-gray-400">Flow Ratio (60s)</p>
                <p className="text-white">{latest.features.flow_ratio_60s.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-gray-400">Range (10s)</p>
                <p className="text-white">{(latest.features.range_10s * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-gray-400">Vol (10s)</p>
                <p className="text-white">${latest.features.vol_10s.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Feature Breakdown</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Size', latest.features.size_score],
                ['Slicing', latest.features.slicing_score],
                ['Absorption', latest.features.absorption_score],
                ['Aggression', latest.features.aggression_score],
                ['Impact', latest.features.impact_anomaly_score],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800/60 rounded p-2">
                  <div className="flex items-center justify-between text-gray-300">
                    <span>{label}</span>
                    <span>{(value as number).toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 mt-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((value as number) * 100, 100)}%` }}
                      transition={{ duration: 0.4 }}
                      className="h-full bg-gradient-to-r from-blue-400 to-emerald-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {events.length > 1 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mt-6 space-y-2"
          >
            <p className="text-xs text-gray-500">Recent signals</p>
            {events.slice(1, 4).map((event) => (
              <motion.div
                key={`${event.ts}-${event.score}`}
                variants={cardVariants}
                className="flex items-center justify-between rounded border border-gray-700/70 bg-gray-950/50 px-3 py-2 text-xs text-gray-300"
              >
                <span>{labelCopy(event.label)}</span>
                <span className={event.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                  {event.side}
                </span>
                <span>{event.score}/100</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
