// Type definitions for Whale Watcher Pro

export interface WhaleAlert {
  trade_id: number;
  timestamp: string;
  price: number;
  quantity: number;
  trade_value: number;
  is_buy: boolean;
  whale_score: number;
  similar_patterns: PatternMatch[];
  bull_bear_sentiment: number;
}

export interface PatternMatch {
  trade_id: number;
  timestamp: string;
  price: number;
  value: number;
  is_buy: boolean;
  similarity_score: number;
}

export interface BullBearMetrics {
  net_buy_volume: number;
  net_sell_volume: number;
  bull_power: number; // -1 to 1
  momentum: number;
  timestamp: string;
}

export interface ChartDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  whale_volume: number;
}

export interface BitcoinMetadata {
  usd: number;
  usd_market_cap: number;
  usd_24h_vol: number;
  usd_24h_change: number;
}

export interface Trade3D {
  id: number;
  value: number;
  isBuy: boolean;
  timestamp: Date;
  position: [number, number, number];
}
