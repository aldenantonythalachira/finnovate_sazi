'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WhaleAlert } from '@/lib/types';
import { WhaleAlertCard } from './WhaleAlertCard';

interface WhaleAlertFeedProps {
  alerts: WhaleAlert[];
  onDismiss?: (tradeId: number) => void;
  maxVisible?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export function WhaleAlertFeed({ 
  alerts, 
  onDismiss, 
  maxVisible = 5 
}: WhaleAlertFeedProps) {
  const visibleAlerts = alerts.slice(0, maxVisible);

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="px-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl animate-bounce">🐋</span>
          Whale Alerts Feed
          {alerts.length > 0 && (
            <span className="ml-auto text-sm font-normal text-gray-400">
              {alerts.length} detected
            </span>
          )}
        </h2>
      </div>

      {/* Alerts */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {visibleAlerts.length > 0 ? (
            visibleAlerts.map((alert) => (
              <WhaleAlertCard
                key={alert.trade_id}
                alert={alert}
                onDismiss={() => onDismiss?.(alert.trade_id)}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-gray-400"
            >
              <p className="text-lg">👀 Watching for whale movements...</p>
              <p className="text-sm mt-2">Alert me when large trades occur</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Show more indicator */}
      {alerts.length > maxVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <p className="text-sm text-gray-400">
            +{alerts.length - maxVisible} more alert{alerts.length - maxVisible > 1 ? 's' : ''}
          </p>
        </motion.div>
      )}
    </div>
  );
}
