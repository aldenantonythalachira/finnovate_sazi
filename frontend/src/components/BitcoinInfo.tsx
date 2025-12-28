'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface BitcoinInfoProps {
  loading?: boolean;
}

export function BitcoinInfo({ loading = false }: BitcoinInfoProps) {
  const [metadata, setMetadata] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/bitcoin');
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            setMetadata((prev: any) => ({
              ...(prev || {}),
              usd: payload.data.price,
              usd_24h_change: payload.data.price_change_percent,
              usd_24h_vol: payload.data.quote_volume,
            }));
          }
        }

        // Fetch logo + market cap from CoinGecko directly
        const logoRes = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&market_data=true'
        );
        const logoData = await logoRes.json();
        setLogoUrl(logoData.image?.large || '');

        setMetadata((prev: any) => ({
          ...(prev || {}),
          usd_market_cap: logoData.market_data?.market_cap?.usd,
        }));
      } catch (error) {
        console.error('Error fetching Bitcoin info:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !metadata) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
      </div>
    );
  }

  const priceChange = metadata.usd_24h_change;
  const isPositive = priceChange >= 0;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatMarketCap = (num?: number) => {
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      return 'N/A';
    }
    return `$${formatNumber(Math.round(num / 1_000_000_000))}B`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        {logoUrl && (
          <motion.img
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            src={logoUrl}
            alt="Bitcoin"
            className="w-16 h-16 rounded-full border-2 border-blue-500"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold text-white">Bitcoin</h2>
          <p className="text-gray-400 text-sm">BTC / USD</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Price */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Current Price</p>
          <p className="text-3xl font-bold text-blue-400">
            ${formatNumber(Math.round(metadata.usd))}
          </p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </p>
        </div>

        {/* Market Cap */}
        <div className="bg-gray-800 rounded p-3">
          <p className="text-gray-400 text-xs mb-1">Market Capitalization</p>
          <p className="text-xl font-bold text-purple-400">
            {formatMarketCap(metadata.usd_market_cap)}
          </p>
        </div>

      </div>
    </motion.div>
  );
}
