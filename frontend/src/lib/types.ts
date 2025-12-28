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
  severity_score?: number;
  price_move_pct?: number;
  label?: string;
  action_label?: string;
}

export interface ExecutedTrade {
  trade_id: number;
  timestamp: string;
  price: number;
  quantity: number;
  trade_value: number;
  is_buy: boolean;
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

export interface HypeRealityMetrics {
  social_hype_score: number; // 0-100
  whale_activity_score: number; // 0-100
  price_change_percent: number;
  whale_value: number;
  insight: string;
  timestamp: string;
}

export interface InstitutionalExecutionEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  label: string;
  score: number;
  confidence: number;
  features: {
    size_score: number;
    slicing_score: number;
    absorption_score: number;
    aggression_score: number;
    impact_anomaly_score: number;
    flow_ratio_10s: number;
    flow_ratio_60s: number;
    range_10s: number;
    vol_10s: number;
  };
  ts: string;
}

export interface OrderBookSnapshot {
  last_update_id: number | null;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: string | null;
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
