import { create } from 'zustand';
import {
  WhaleAlert,
  BullBearMetrics,
  HypeRealityMetrics,
  InstitutionalExecutionEvent,
  OrderBookSnapshot,
  ExecutedTrade,
} from '@/lib/types';

interface TradeStore {
  whaleAlerts: WhaleAlert[];
  bullBearMetrics: BullBearMetrics | null;
  hypeRealityMetrics: HypeRealityMetrics | null;
  institutionalEvents: InstitutionalExecutionEvent[];
  orderBook: OrderBookSnapshot | null;
  executedTrades: ExecutedTrade[];
  replayWhaleAlerts: WhaleAlert[];
  replayInstitutionalEvents: InstitutionalExecutionEvent[];
  replayOrderBook: OrderBookSnapshot | null;
  isConnected: boolean;
  priceHistory: Array<{ timestamp: string; price: number; volume: number }>;
  selectedWhaleTradeId: number | null;
  
  addWhaleAlert: (alert: WhaleAlert) => void;
  updateWhaleAlert: (tradeId: number, updates: Partial<WhaleAlert>) => void;
  updateBullBearMetrics: (metrics: BullBearMetrics) => void;
  updateHypeRealityMetrics: (metrics: HypeRealityMetrics) => void;
  addInstitutionalEvent: (event: InstitutionalExecutionEvent) => void;
  updateOrderBook: (snapshot: OrderBookSnapshot) => void;
  addExecutedTrade: (trade: ExecutedTrade) => void;
  addReplayWhaleAlert: (alert: WhaleAlert) => void;
  updateReplayWhaleAlert: (tradeId: number, updates: Partial<WhaleAlert>) => void;
  addReplayInstitutionalEvent: (event: InstitutionalExecutionEvent) => void;
  updateReplayOrderBook: (snapshot: OrderBookSnapshot) => void;
  resetReplayState: () => void;
  setConnected: (connected: boolean) => void;
  addPriceHistory: (data: any[]) => void;
  clearAlerts: () => void;
  setSelectedWhaleTradeId: (tradeId: number | null) => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  whaleAlerts: [],
  bullBearMetrics: null,
  hypeRealityMetrics: null,
  institutionalEvents: [],
  orderBook: null,
  executedTrades: [],
  replayWhaleAlerts: [],
  replayInstitutionalEvents: [],
  replayOrderBook: null,
  isConnected: false,
  priceHistory: [],
  selectedWhaleTradeId: null,
  
  addWhaleAlert: (alert) =>
    set((state) => ({
      whaleAlerts: [alert, ...state.whaleAlerts].slice(0, 100), // Keep last 100
    })),

  updateWhaleAlert: (tradeId, updates) =>
    set((state) => ({
      whaleAlerts: state.whaleAlerts.map((alert) =>
        alert.trade_id === tradeId ? { ...alert, ...updates } : alert
      ),
    })),
  
  updateBullBearMetrics: (metrics) =>
    set({ bullBearMetrics: metrics }),

  updateHypeRealityMetrics: (metrics) =>
    set({ hypeRealityMetrics: metrics }),

  addInstitutionalEvent: (event) =>
    set((state) => ({
      institutionalEvents: [event, ...state.institutionalEvents].slice(0, 20),
    })),

  updateOrderBook: (snapshot) =>
    set({ orderBook: snapshot }),

  addExecutedTrade: (trade) =>
    set((state) => ({
      executedTrades: [trade, ...state.executedTrades].slice(0, 200),
    })),

  addReplayWhaleAlert: (alert) =>
    set((state) => ({
      replayWhaleAlerts: [alert, ...state.replayWhaleAlerts].slice(0, 100),
    })),

  updateReplayWhaleAlert: (tradeId, updates) =>
    set((state) => ({
      replayWhaleAlerts: state.replayWhaleAlerts.map((alert) =>
        alert.trade_id === tradeId ? { ...alert, ...updates } : alert
      ),
    })),

  addReplayInstitutionalEvent: (event) =>
    set((state) => ({
      replayInstitutionalEvents: [event, ...state.replayInstitutionalEvents].slice(0, 50),
    })),

  updateReplayOrderBook: (snapshot) =>
    set({ replayOrderBook: snapshot }),

  resetReplayState: () =>
    set({
      replayWhaleAlerts: [],
      replayInstitutionalEvents: [],
      replayOrderBook: null,
    }),
  
  setConnected: (connected) =>
    set({ isConnected: connected }),
  
  addPriceHistory: (data) =>
    set({ priceHistory: data }),
  
  clearAlerts: () =>
    set({ whaleAlerts: [] }),

  setSelectedWhaleTradeId: (tradeId) =>
    set({ selectedWhaleTradeId: tradeId }),
}));
