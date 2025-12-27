import { create } from 'zustand';
import { WhaleAlert, BullBearMetrics } from '@/lib/types';

interface TradeStore {
  whaleAlerts: WhaleAlert[];
  bullBearMetrics: BullBearMetrics | null;
  isConnected: boolean;
  priceHistory: Array<{ timestamp: string; price: number; volume: number }>;
  
  addWhaleAlert: (alert: WhaleAlert) => void;
  updateBullBearMetrics: (metrics: BullBearMetrics) => void;
  setConnected: (connected: boolean) => void;
  addPriceHistory: (data: any[]) => void;
  clearAlerts: () => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  whaleAlerts: [],
  bullBearMetrics: null,
  isConnected: false,
  priceHistory: [],
  
  addWhaleAlert: (alert) =>
    set((state) => ({
      whaleAlerts: [alert, ...state.whaleAlerts].slice(0, 100), // Keep last 100
    })),
  
  updateBullBearMetrics: (metrics) =>
    set({ bullBearMetrics: metrics }),
  
  setConnected: (connected) =>
    set({ isConnected: connected }),
  
  addPriceHistory: (data) =>
    set({ priceHistory: data }),
  
  clearAlerts: () =>
    set({ whaleAlerts: [] }),
}));
