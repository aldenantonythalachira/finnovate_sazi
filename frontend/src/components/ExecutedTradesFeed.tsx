'use client';

import React from 'react';
import { ExecutedTrade } from '@/lib/types';

interface ExecutedTradesFeedProps {
  trades: ExecutedTrade[];
  maxRows?: number;
}

const formatNumber = (value: number, decimals: number) => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function ExecutedTradesFeed({ trades, maxRows = 50 }: ExecutedTradesFeedProps) {
  const rows = trades.slice(0, maxRows);

  return (
    <div className="bg-[#0b0f1a]/90 border border-gray-800 rounded-lg p-6 shadow-[0_0_30px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-wide">Executed Trades</h2>
          <p className="text-xs text-gray-500">Raw Binance trade tape</p>
        </div>
        <span className="text-xs text-gray-500">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="min-w-[620px] w-full text-xs font-mono table-fixed">
          <thead className="bg-gray-900/70 text-gray-400">
            <tr>
              <th className="px-2 py-2 text-left w-[90px]">Time</th>
              <th className="px-2 py-2 text-left w-[60px]">Side</th>
              <th className="px-2 py-2 text-right w-[110px]">Price</th>
              <th className="px-2 py-2 text-right w-[110px]">Qty (BTC)</th>
              <th className="px-2 py-2 text-right w-[130px]">Value (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Waiting for executed trades...
                </td>
              </tr>
            ) : (
              rows.map((trade, idx) => (
                <tr
                  key={`${trade.trade_id}-${trade.timestamp}-${idx}`}
                  className="border-t border-gray-800/70"
                >
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className={`px-2 py-2 whitespace-nowrap ${trade.is_buy ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.is_buy ? 'BUY' : 'SELL'}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    {formatNumber(trade.price, 2)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    {formatNumber(trade.quantity, 4)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-200 whitespace-nowrap">
                    ${formatNumber(trade.trade_value, 0)}
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
