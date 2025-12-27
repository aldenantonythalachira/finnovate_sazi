import { create } from 'zustand';
import {
  WhaleAlert,
  BullBearMetrics,
  HypeRealityMetrics,
  InstitutionalExecutionEvent,
  OrderBookSnapshot,
} from '@/lib/types';

interface TradeStore {
  whaleAlerts: WhaleAlert[];
  bullBearMetrics: BullBearMetrics | null;
  hypeRealityMetrics: HypeRealityMetrics | null;
  institutionalEvents: InstitutionalExecutionEvent[];
  orderBook: OrderBookSnapshot | null;
  isConnected: boolean;
  priceHistory: Array<{ timestamp: string; price: number; volume: number }>;
  
  addWhaleAlert: (alert: WhaleAlert) => void;
  updateBullBearMetrics: (metrics: BullBearMetrics) => void;
  updateHypeRealityMetrics: (metrics: HypeRealityMetrics) => void;
  addInstitutionalEvent: (event: InstitutionalExecutionEvent) => void;
  updateOrderBook: (snapshot: OrderBookSnapshot) => void;
  setConnected: (connected: boolean) => void;
  addPriceHistory: (data: any[]) => void;
  clearAlerts: () => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  whaleAlerts: [],
  bullBearMetrics: null,
  hypeRealityMetrics: null,
  institutionalEvents: [],
  orderBook: null,
  isConnected: false,
  priceHistory: [],
  
  addWhaleAlert: (alert) =>
    set((state) => ({
      whaleAlerts: [alert, ...state.whaleAlerts].slice(0, 100), // Keep last 100
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
  
  setConnected: (connected) =>
    set({ isConnected: connected }),
  
  addPriceHistory: (data) =>
    set({ priceHistory: data }),
  
  clearAlerts: () =>
    set({ whaleAlerts: [] }),
}));
