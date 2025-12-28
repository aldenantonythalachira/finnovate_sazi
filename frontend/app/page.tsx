'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BitcoinInfo } from '@/components/BitcoinInfo';
import { PriceChart } from '@/components/PriceChart';
import { BullBearMeter } from '@/components/BullBearMeter';
import { useTradeStore } from '@/store/tradeStore';
import { ChartDataPoint } from '@/lib/types';

export default function Home() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const hasLoadedChartRef = useRef(false);
  const [volume24h, setVolume24h] = useState<number | null>(null);

  const { bullBearMetrics, hypeRealityMetrics } = useTradeStore();

  useEffect(() => {
    const fetchChartData = async () => {
      if (!hasLoadedChartRef.current) {
        setLoadingChart(true);
      }
      try {
        const res = await fetch('http://localhost:8000/api/chart-data?minutes=60&interval_seconds=60');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setChartData(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        if (!hasLoadedChartRef.current) {
          setLoadingChart(false);
          hasLoadedChartRef.current = true;
        }
      }
    };

    fetchChartData();
    const interval = setInterval(fetchChartData, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/bitcoin');
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            setVolume24h(payload.data.base_volume ?? null);
          }
        }
      } catch (error) {
        console.error('Error fetching BTC ticker:', error);
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatHypeLabel = (score: number) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Moderate';
    return 'Low';
  };

  const formatActivityLabel = (score: number) => {
    if (score >= 70) return 'High Activity';
    if (score >= 40) return 'Moderate Activity';
    return 'Low Activity';
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <BitcoinInfo loading={false} />
        </div>
        <div className="lg:col-span-3 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PriceChart data={chartData} loading={loadingChart} volume24h={volume24h ?? undefined} />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <BullBearMeter metrics={bullBearMetrics} />

        <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Hype vs Reality Sentiment
          </h2>
          {!hypeRealityMetrics ? (
            <p className="text-sm text-gray-400">Waiting for live sentiment data...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Social Hype Score</p>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(hypeRealityMetrics.social_hype_score, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  />
                </div>
                <p className="text-sm text-orange-400 mt-1">
                  {hypeRealityMetrics.social_hype_score.toFixed(0)}/100 -{' '}
                  {formatHypeLabel(hypeRealityMetrics.social_hype_score)} Hype
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">Whale Activity Score</p>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(hypeRealityMetrics.whale_activity_score, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                  />
                </div>
                <p className="text-sm text-green-400 mt-1">
                  {hypeRealityMetrics.whale_activity_score.toFixed(0)}/100 -{' '}
                  {formatActivityLabel(hypeRealityMetrics.whale_activity_score)}
                </p>
              </div>

              <p className="text-xs text-gray-500 pt-4 border-t border-gray-700">
                {hypeRealityMetrics.insight}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
