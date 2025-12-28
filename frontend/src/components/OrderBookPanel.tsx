'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { OrderBookSnapshot } from '@/lib/types';
import { useTradeStore } from '@/store/tradeStore';

interface OrderBookPanelProps {
  snapshot: OrderBookSnapshot | null;
  depth?: number;
  highlightHistory?: OrderBookSnapshot[];
  enableWhaleMarkers?: boolean;
}

const formatNumber = (value: number, decimals: number) => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function OrderBookPanel({
  snapshot,
  depth = 10,
  highlightHistory,
  enableWhaleMarkers = true,
}: OrderBookPanelProps) {
  const { whaleAlerts } = useTradeStore();
  const flowFlashRef = useRef(new Map<string, { dir: 'up' | 'down'; ts: number }>());
  const lastLevelsRef = useRef(new Map<string, number>());
  const [pulseTick, setPulseTick] = useState(0);
  const [ripples, setRipples] = useState<Array<{ id: number; price: number; is_buy: boolean; ts: number }>>([]);
  const seenRippleRef = useRef(new Set<number>());
  const hasSnapshot = snapshot && (snapshot.bids.length || snapshot.asks.length);

  const bids = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.bids.slice(0, depth).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));
  }, [snapshot, depth]);

  const asks = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.asks.slice(0, depth).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));
  }, [snapshot, depth]);

  const maxBidQty = Math.max(...bids.map((b) => b.qty), 1);
  const maxAskQty = Math.max(...asks.map((a) => a.qty), 1);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const midPrice = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const totalBidQty = bids.reduce((sum, bid) => sum + bid.qty, 0);
  const totalAskQty = asks.reduce((sum, ask) => sum + ask.qty, 0);
  const imbalance = (totalBidQty - totalAskQty) / Math.max(totalBidQty + totalAskQty, 1);
  const imbalancePct = Math.abs(imbalance * 100);
  const imbalanceLabel = imbalance >= 0 ? 'Bid-dominant' : 'Ask-dominant';
  const imbalancePrefix = imbalance >= 0 ? '+' : '-';
  const bucketSize = midPrice > 0 ? Math.max(Math.round(midPrice * 0.001), 10) : 10;

  const bucketize = (levels: { price: number; qty: number }[]) => {
    const buckets = new Map<number, number>();
    levels.forEach((level) => {
      const bucket = Math.round(level.price / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + level.qty);
    });
    return Array.from(buckets.entries())
      .map(([price, qty]) => ({ price, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);
  };

  const bidWalls = bucketize(bids);
  const askWalls = bucketize(asks);
  const maxWallQty = Math.max(
    1,
    ...bidWalls.map((wall) => wall.qty),
    ...askWalls.map((wall) => wall.qty)
  );

  const computeHighlight = (walls: { price: number; qty: number }[], side: 'bid' | 'ask') => {
    if (!highlightHistory || highlightHistory.length < 2 || bucketSize <= 0) {
      return new Map<number, number>();
    }
    const stats = new Map<number, { sum: number; sumSq: number; count: number }>();
    highlightHistory.forEach((snap) => {
      const levels = side === 'bid' ? snap.bids : snap.asks;
      const parsed = levels.slice(0, depth).map(([price, qty]) => ({
        price: parseFloat(price),
        qty: parseFloat(qty),
      }));
      parsed.forEach((level) => {
        const bucket = Math.round(level.price / bucketSize) * bucketSize;
        const entry = stats.get(bucket) || { sum: 0, sumSq: 0, count: 0 };
        entry.sum += level.qty;
        entry.sumSq += level.qty * level.qty;
        entry.count += 1;
        stats.set(bucket, entry);
      });
    });

    const highlights = new Map<number, number>();
    walls.forEach((wall) => {
      const entry = stats.get(wall.price);
      if (!entry || entry.count < 2) {
        highlights.set(wall.price, 0);
        return;
      }
      const mean = entry.sum / entry.count;
      const variance = entry.sumSq / entry.count - mean * mean;
      const std = Math.sqrt(Math.max(variance, 0));
      if (std <= 0) {
        highlights.set(wall.price, 0);
        return;
      }
      const z = (wall.qty - mean) / std;
      const intensity = Math.max(0, Math.min(z / 3, 1));
      highlights.set(wall.price, intensity);
    });
    return highlights;
  };

  const bidHighlights = computeHighlight(bidWalls, 'bid');
  const askHighlights = computeHighlight(askWalls, 'ask');
  const bidWallBuckets = new Set(bidWalls.map((wall) => wall.price));
  const askWallBuckets = new Set(askWalls.map((wall) => wall.price));

  const strongestBidWall = bidWalls[0];
  const strongestAskWall = askWalls[0];
  const bidWallDistance =
    strongestBidWall && midPrice > 0
      ? ((midPrice - strongestBidWall.price) / midPrice) * 100
      : null;
  const askWallDistance =
    strongestAskWall && midPrice > 0
      ? ((strongestAskWall.price - midPrice) / midPrice) * 100
      : null;

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseTick(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const now = Date.now();
    const nextLevels = new Map<string, number>();
    const nextFlashes = new Map(flowFlashRef.current);

    const updateLevel = (side: 'bid' | 'ask', price: number, qty: number) => {
      const key = `${side}-${price.toFixed(2)}`;
      const previous = lastLevelsRef.current.get(key);
      if (previous !== undefined && previous !== qty) {
        nextFlashes.set(key, {
          dir: qty > previous ? 'up' : 'down',
          ts: now,
        });
      }
      nextLevels.set(key, qty);
    };

    bids.forEach((bid) => updateLevel('bid', bid.price, bid.qty));
    asks.forEach((ask) => updateLevel('ask', ask.price, ask.qty));

    for (const [key, entry] of nextFlashes.entries()) {
      if (now - entry.ts > 900) {
        nextFlashes.delete(key);
      }
    }

    lastLevelsRef.current = nextLevels;
    flowFlashRef.current = nextFlashes;
  }, [snapshot, bids, asks]);

  useEffect(() => {
    if (!enableWhaleMarkers) {
      return;
    }
    if (!whaleAlerts.length) {
      return;
    }
    const latest = whaleAlerts[0];
    if (seenRippleRef.current.has(latest.trade_id)) {
      return;
    }
    seenRippleRef.current.add(latest.trade_id);
    setRipples((prev) => [
      { id: latest.trade_id, price: latest.price, is_buy: latest.is_buy, ts: Date.now() },
      ...prev,
    ].slice(0, 20));
  }, [whaleAlerts, enableWhaleMarkers]);

  const activeRipples = useMemo(() => {
    const now = Date.now();
    return ripples.filter((ripple) => now - ripple.ts <= 2000);
  }, [ripples, pulseTick]);

  const getFlashDir = (key: string) => {
    const entry = flowFlashRef.current.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.ts > 900) {
      return null;
    }
    return entry.dir;
  };

  return (
    !hasSnapshot ? (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-gray-400">
        Waiting for order book data...
      </div>
    ) : (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">BTC/USDT Order Book</h2>
          <p className="text-xs text-gray-400">Live depth from Binance</p>
        </div>
        <span className="text-xs text-gray-500">
          {snapshot.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString() : 'Live'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-xs text-green-400 mb-2">Bids</p>
          <div className="space-y-2">
            {bids.map((bid, idx) => {
              const bucket = Math.round(bid.price / bucketSize) * bucketSize;
              const isWall = bidWallBuckets.has(bucket);
              const flashKey = `bid-${bid.price.toFixed(2)}`;
              const flashDir = getFlashDir(flashKey);
              const ripple = enableWhaleMarkers
                ? activeRipples.find(
                    (entry) => Math.abs(entry.price - bid.price) / bid.price <= 0.0006
                  )
                : null;
              const heatOpacity = 0.15 + 0.6 * (bid.qty / maxBidQty);

              return (
                <div
                  key={`bid-${idx}`}
                  className={`relative overflow-hidden rounded bg-black/30 ${isWall ? 'wall-glow-bid' : ''}`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500/30 to-green-500/5"
                    style={{ width: `${(bid.qty / maxBidQty) * 100}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 bg-green-400"
                    style={{ opacity: heatOpacity }}
                  />
                  {flashDir && (
                    <div
                      className={`absolute inset-0 ${
                        flashDir === 'up' ? 'order-flash-green' : 'order-flash-red'
                      }`}
                    />
                  )}
                  {ripple && (
                    <div
                      className={`absolute inset-0 ${
                        ripple.is_buy ? 'order-ripple-green' : 'order-ripple-red'
                      }`}
                    />
                  )}
                  <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                    <span className="text-green-300">{formatNumber(bid.price, 2)}</span>
                    <span>{formatNumber(bid.qty, 4)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-red-400 mb-2">Asks</p>
          <div className="space-y-2">
            {asks.map((ask, idx) => {
              const bucket = Math.round(ask.price / bucketSize) * bucketSize;
              const isWall = askWallBuckets.has(bucket);
              const flashKey = `ask-${ask.price.toFixed(2)}`;
              const flashDir = getFlashDir(flashKey);
              const ripple = enableWhaleMarkers
                ? activeRipples.find(
                    (entry) => Math.abs(entry.price - ask.price) / ask.price <= 0.0006
                  )
                : null;
              const heatOpacity = 0.15 + 0.6 * (ask.qty / maxAskQty);

              return (
                <div
                  key={`ask-${idx}`}
                  className={`relative overflow-hidden rounded bg-black/30 ${isWall ? 'wall-glow-ask' : ''}`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/30 to-red-500/5"
                    style={{ width: `${(ask.qty / maxAskQty) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full w-1.5 bg-red-400"
                    style={{ opacity: heatOpacity }}
                  />
                  {flashDir && (
                    <div
                      className={`absolute inset-0 ${
                        flashDir === 'up' ? 'order-flash-red' : 'order-flash-green'
                      }`}
                    />
                  )}
                  {ripple && (
                    <div
                      className={`absolute inset-0 ${
                        ripple.is_buy ? 'order-ripple-green' : 'order-ripple-red'
                      }`}
                    />
                  )}
                  <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                    <span className="text-red-300">{formatNumber(ask.price, 2)}</span>
                    <span>{formatNumber(ask.qty, 4)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="rounded bg-gray-800/60 p-3">
          <p className="text-gray-400">Mid Price</p>
          <p className="text-white">{formatNumber(midPrice, 2)}</p>
          <div className="mt-2 space-y-1 text-[11px]">
            {bidWallDistance !== null && bidWallDistance >= 0 && (
              <p className="text-green-300">
                Strong bid wall {bidWallDistance.toFixed(2)}% below
              </p>
            )}
            {askWallDistance !== null && askWallDistance >= 0 && (
              <p className="text-red-300">
                Strong ask wall {askWallDistance.toFixed(2)}% above
              </p>
            )}
          </div>
        </div>
        <div className="rounded bg-gray-800/60 p-3">
          <p
            className="text-gray-400"
            title="Tight spread = higher liquidity and faster execution."
          >
            Spread
          </p>
          <p className="text-white">{formatNumber(spread, 2)}</p>
        </div>
        <div className="rounded bg-gray-800/60 p-3">
          <p
            className="text-gray-400"
            title="Measures buy vs sell-side depth pressure."
          >
            Depth Imbalance
          </p>
          <p className={imbalance >= 0 ? 'text-green-300' : 'text-red-300'}>
            {imbalancePrefix}{imbalancePct.toFixed(1)}% ({imbalanceLabel})
          </p>
        </div>
        <div className="rounded bg-gray-800/60 p-3">
          <p className="text-gray-400">Top {depth} Depth</p>
          <p className="text-white">
            {formatNumber(totalBidQty, 2)} / {formatNumber(totalAskQty, 2)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p
          className="text-xs text-gray-400 mb-2"
          title="Large resting orders acting as support/resistance."
        >
          Liquidity Walls Heatmap
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded bg-gray-900/60 border border-gray-800 p-3">
            <p
              className="text-green-400 mb-2"
              title="Large bid liquidity acting as support."
            >
              Bid Walls
            </p>
            <div className="space-y-2">
              {bidWalls.map((wall) => {
                const intensity = bidHighlights.get(wall.price) ?? 0;
                const baseWidth = (wall.qty / maxWallQty) * 100;
                const glowAlpha = 0.15 + intensity * 0.35;
                const isWall = intensity >= 0.35;
                return (
                  <div
                    key={`bid-wall-${wall.price}`}
                    className={`relative rounded bg-black/30 overflow-hidden ${isWall ? 'wall-glow-bid' : ''}`}
                  >
                    <div
                      className="absolute inset-0 bg-green-500/15"
                      style={{ width: `${baseWidth}%`, opacity: glowAlpha }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                      <span className="text-green-300">{formatNumber(wall.price, 2)}</span>
                      <span>{formatNumber(wall.qty, 2)}</span>
                    </div>
                  </div>
                );
              })}
              {bidWalls.length === 0 && (
                <p className="text-gray-500">No dominant bid walls detected.</p>
              )}
            </div>
          </div>

          <div className="rounded bg-gray-900/60 border border-gray-800 p-3">
            <p
              className="text-red-400 mb-2"
              title="Large ask liquidity acting as resistance."
            >
              Ask Walls
            </p>
            <div className="space-y-2">
              {askWalls.map((wall) => {
                const intensity = askHighlights.get(wall.price) ?? 0;
                const baseWidth = (wall.qty / maxWallQty) * 100;
                const glowAlpha = 0.15 + intensity * 0.35;
                const isWall = intensity >= 0.35;
                return (
                  <div
                    key={`ask-wall-${wall.price}`}
                    className={`relative rounded bg-black/30 overflow-hidden ${isWall ? 'wall-glow-ask' : ''}`}
                  >
                    <div
                      className="absolute inset-0 bg-red-500/15"
                      style={{ width: `${baseWidth}%`, opacity: glowAlpha }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-1 text-gray-200">
                      <span className="text-red-300">{formatNumber(wall.price, 2)}</span>
                      <span>{formatNumber(wall.qty, 2)}</span>
                    </div>
                  </div>
                );
              })}
              {askWalls.length === 0 && (
                <p className="text-gray-500">No dominant ask walls detected.</p>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Walls are aggregated by price buckets (~{formatNumber(bucketSize, 0)} USD) from the top {depth} levels.
        </p>
      </div>

      <style jsx>{`
        .wall-glow-bid {
          animation: wallGlowBid 1.5s ease-in-out infinite;
        }
        .wall-glow-ask {
          animation: wallGlowAsk 1.5s ease-in-out infinite;
        }
        .order-flash-green {
          background: rgba(16, 185, 129, 0.22);
          animation: orderFlash 0.6s ease-out;
        }
        .order-flash-red {
          background: rgba(248, 113, 113, 0.22);
          animation: orderFlash 0.6s ease-out;
        }
        .order-ripple-green {
          background: radial-gradient(circle at center, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0) 60%);
          animation: orderRipple 1.4s ease-out;
        }
        .order-ripple-red {
          background: radial-gradient(circle at center, rgba(248, 113, 113, 0.35) 0%, rgba(248, 113, 113, 0) 60%);
          animation: orderRipple 1.4s ease-out;
        }
        @keyframes wallGlowBid {
          0% { box-shadow: 0 0 0 rgba(16, 185, 129, 0.0); }
          50% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }
          100% { box-shadow: 0 0 0 rgba(16, 185, 129, 0.0); }
        }
        @keyframes wallGlowAsk {
          0% { box-shadow: 0 0 0 rgba(248, 113, 113, 0.0); }
          50% { box-shadow: 0 0 12px rgba(248, 113, 113, 0.35); }
          100% { box-shadow: 0 0 0 rgba(248, 113, 113, 0.0); }
        }
        @keyframes orderFlash {
          0% { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes orderRipple {
          0% { opacity: 0.6; transform: scaleX(0.2); }
          100% { opacity: 0; transform: scaleX(1.05); }
        }
      `}</style>
    </motion.div>
    )
  );
}
