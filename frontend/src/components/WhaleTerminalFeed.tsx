'use client';

import React from 'react';
import { WhaleAlert } from '@/lib/types';

interface WhaleTerminalFeedProps {
  alerts: WhaleAlert[];
  maxRows?: number;
}

const formatNumber = (value: number, decimals: number) => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const severityClass = (score?: number) => {
  if (!score) return 'text-gray-500';
  if (score >= 8) return 'text-red-400';
  if (score >= 5) return 'text-amber-300';
  return 'text-green-300';
};

export function WhaleTerminalFeed({ alerts, maxRows = 15 }: WhaleTerminalFeedProps) {
  const now = Date.now();
  const windowed = alerts.filter((alert) => {
    const ts = new Date(alert.timestamp).getTime();
    return now - ts <= 60 * 60 * 1000;
  });
  const values = windowed.map((alert) => alert.trade_value);
  const mean =
    values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length || 1);
  const std = Math.sqrt(Math.max(variance, 0));

  const rows = alerts.slice(0, maxRows);

  return (
    <div className="bg-[#0b0f1a]/90 border border-gray-800 rounded-lg p-6 shadow-[0_0_30px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-wide">Whale Feed</h2>
          <p className="text-xs text-gray-500">Institutional tape | 1m impact severity</p>
        </div>
        <span className="text-xs text-gray-500">{rows.length} signals</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="min-w-[760px] w-full text-xs font-mono table-fixed">
          <thead className="bg-gray-900/70 text-gray-400">
            <tr>
              <th className="px-2 py-2 text-left w-[90px]">Time</th>
              <th className="px-2 py-2 text-left w-[60px]">Side</th>
              <th className="px-2 py-2 text-left w-[120px]">Action</th>
              <th className="px-2 py-2 text-right w-[95px]">Price</th>
              <th className="px-2 py-2 text-right w-[90px]">Qty (BTC)</th>
              <th className="px-2 py-2 text-right w-[110px]">Value (USD)</th>
              <th className="px-2 py-2 text-right w-[90px]">Severity</th>
              <th className="px-2 py-2 text-right w-[70px]">Move%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Waiting for whale alerts...
                </td>
              </tr>
            ) : (
              rows.map((alert, idx) => (
                <tr
                  key={`${alert.trade_id}-${alert.timestamp}-${idx}`}
                  className={`border-t border-gray-800/70 ${
                    std > 0 && (alert.trade_value - mean) / std >= 2
                      ? 'bg-amber-500/10'
                      : ''
                  }`}
                >
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </td>
                  <td className={`px-2 py-2 whitespace-nowrap ${alert.is_buy ? 'text-green-400' : 'text-red-400'}`}>
                    {alert.is_buy ? 'BUY' : 'SELL'}
                  </td>
                  <td className="px-2 py-2 text-left text-gray-300">
                    {alert.action_label ?? '--'}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    {formatNumber(alert.price, 2)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    {formatNumber(alert.quantity, 4)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    ${formatNumber(alert.trade_value, 0)}
                    {std > 0 && (
                      <span className="ml-2 text-[11px] text-amber-300">sigma {((alert.trade_value - mean) / std).toFixed(1)}</span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap ${severityClass(alert.severity_score)}`}>
                    {alert.severity_score ?? '--'} / 10
                  </td>
                  <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap">
                    {alert.price_move_pct !== undefined ? `${alert.price_move_pct.toFixed(2)}%` : '--'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
