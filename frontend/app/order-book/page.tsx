'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { OrderBookPanel } from '@/components/OrderBookPanel';
import { useTradeStore } from '@/store/tradeStore';

export default function OrderBookPage() {
  const { orderBook } = useTradeStore();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <OrderBookPanel snapshot={orderBook} />
      </motion.div>
    </>
  );
}
