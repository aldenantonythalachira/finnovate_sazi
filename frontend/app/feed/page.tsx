'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { WhaleAlertFeed } from '@/components/WhaleAlertFeed';
import { WhaleTerminalFeed } from '@/components/WhaleTerminalFeed';
import { ExecutedTradesFeed } from '@/components/ExecutedTradesFeed';
import { useTradeStore } from '@/store/tradeStore';

export default function FeedPage() {
  const { whaleAlerts, executedTrades, selectedWhaleTradeId } = useTradeStore();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <WhaleAlertFeed alerts={whaleAlerts} maxVisible={5} selectedTradeId={selectedWhaleTradeId} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <WhaleTerminalFeed alerts={whaleAlerts} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <ExecutedTradesFeed trades={executedTrades} />
      </motion.div>
    </>
  );
}
