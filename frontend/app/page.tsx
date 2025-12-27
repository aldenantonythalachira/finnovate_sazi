'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTradeStore } from '@/store/tradeStore';
import { WhaleAlertFeed } from '@/components/WhaleAlertFeed';
import { PriceChart } from '@/components/PriceChart';
import { BullBearMeter } from '@/components/BullBearMeter';
// import { ThreeDVisualizer } from '@/components/ThreeDVisualizer'; // Disabled: incompatible with latest Next.js
import { BitcoinInfo } from '@/components/BitcoinInfo';
import { ChartDataPoint, Trade3D } from '@/lib/types';
import toast from 'react-hot-toast';

export default function Home() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [trades3D, setTrades3D] = useState<Trade3D[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const {
    whaleAlerts,
    bullBearMetrics,
    isConnected,
    clearAlerts,
  } = useWebSocket('ws://localhost:8000/ws');

  // Fetch chart data on mount and periodically
  useEffect(() => {
    const fetchChartData = async () => {
      setLoadingChart(true);
      try {
        const res = await fetch('http://localhost:8000/api/chart-data?minutes=60');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setChartData(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchChartData();
    const interval = setInterval(fetchChartData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Convert whale alerts to 3D trades
  useEffect(() => {
    const trades3D: Trade3D[] = whaleAlerts.map((alert, idx) => ({
      id: alert.trade_id,
      value: alert.trade_value,
      isBuy: alert.is_buy,
      timestamp: new Date(alert.timestamp),
      position: [
        Math.random() * 20 - 10,
        Math.random() * 20 - 10,
        Math.random() * 20 - 10,
      ] as [number, number, number],
    }));
    setTrades3D(trades3D);
  }, [whaleAlerts]);

  // Show toast when connected/disconnected
  useEffect(() => {
    if (isConnected) {
      toast.success('Connected to Whale Watcher backend', {
        icon: '🐋',
        duration: 3000,
      });
    } else {
      toast.error('Disconnected from backend', {
        icon: '⚠️',
        duration: 3000,
      });
    }
  }, [isConnected]);

  // Show toast for new whale alerts
  useEffect(() => {
    if (whaleAlerts.length > 0) {
      const latest = whaleAlerts[0];
      toast.success(
        `${latest.is_buy ? '🟢 BUY' : '🔴 SELL'}: $${latest.trade_value.toLocaleString()} whale detected!`,
        {
          duration: 5000,
          icon: '🐋',
        }
      );
    }
  }, [whaleAlerts.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/20 to-gray-950">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-md border-b border-gray-800/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🐋</span>
              <div>
                <h1 className="text-2xl font-bold text-white">Whale Watcher Pro</h1>
                <p className="text-xs text-gray-400">Real-Time Crypto Whale Detection</p>
              </div>
            </div>

            {/* Status indicator */}
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
        </div>
      </motion.header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <BitcoinInfo loading={false} />

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <button
                onClick={clearAlerts}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm font-semibold text-gray-200"
              >
                Clear Alerts
              </button>
            </motion.div>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Alert feed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="px-4"
            >
              <WhaleAlertFeed
                alerts={whaleAlerts}
                maxVisible={3}
              />
            </motion.div>
          </div>
        </div>

        {/* Charts section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PriceChart data={chartData} loading={loadingChart} />
        </motion.div>

        {/* Analytics section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <BullBearMeter metrics={bullBearMetrics} />

          {/* Sentiment placeholder */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">
              Hype vs Reality Sentiment
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Social Hype Score</p>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  />
                </div>
                <p className="text-sm text-orange-400 mt-1">65/100 - Moderate Hype</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">Whale Activity Score</p>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '78%' }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                  />
                </div>
                <p className="text-sm text-green-400 mt-1">78/100 - High Activity</p>
              </div>

              <p className="text-xs text-gray-500 pt-4 border-t border-gray-700">
                ⚠️ Reality Check: Whale activity is outpacing social sentiment. Strong fundamental interest detected.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* 3D Visualization - Disabled: incompatible with latest Next.js */}
        {/* 
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <ThreeDVisualizer trades={trades3D} />
        </motion.div>
        */}
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="border-t border-gray-800 mt-16 py-8 text-center text-gray-400"
      >
        <p className="text-sm">
          Whale Watcher Pro • Detecting Whale Moves Since 2024 •{' '}
          <span className="text-gray-500">Real-time data from Binance</span>
        </p>
      </motion.footer>
    </div>
  );
}
