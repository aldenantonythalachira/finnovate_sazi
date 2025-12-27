'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/lib/types';

interface PriceChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  volume24h?: number;
}

export function PriceChart({ data, loading = false, volume24h }: PriceChartProps) {
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="animate-pulse text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="text-gray-400">No data available</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">BTC/USDT Price & Volume</h2>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis yAxisId="left" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" style={{ fontSize: '12px' }} />

            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
              }}
              formatter={(value: number) => {
                if (typeof value === 'number') {
                  return [value.toFixed(2), ''];
                }
                return value;
              }}
            />
            <Legend wrapperStyle={{ color: '#E5E7EB' }} />

            {/* Price Area */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="close"
              fill="#3B82F6"
              stroke="#60A5FA"
              fillOpacity={0.3}
              name="Price (USD)"
            />

            {/* Volume Line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="volume"
              stroke="#10B981"
              strokeWidth={2}
              name="Volume (BTC)"
              dot={false}
            />

            {/* Whale Volume Line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="whale_volume"
              stroke="#F59E0B"
              strokeWidth={3}
              strokeDasharray="5 5"
              name="Whale Volume (BTC)"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800 rounded p-3">
            <p className="text-gray-400 text-xs mb-1">Current Price</p>
            <p className="text-xl font-bold text-blue-400">
              ${data[data.length - 1]?.close.toFixed(2) || 'N/A'}
            </p>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <p className="text-gray-400 text-xs mb-1">24h Volume</p>
            <p className="text-xl font-bold text-green-400">
              {volume24h !== undefined
                ? `${volume24h.toFixed(2)} BTC`
                : `${data.reduce((sum, d) => sum + d.volume, 0).toFixed(2)} BTC`}
            </p>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <p className="text-gray-400 text-xs mb-1">Whale Volume</p>
            <p className="text-xl font-bold text-amber-400">
              {data.reduce((sum, d) => sum + d.whale_volume, 0).toFixed(2)} BTC
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
