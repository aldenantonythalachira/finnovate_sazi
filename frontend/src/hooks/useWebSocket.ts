'use client';

import { useEffect } from 'react';
import { useTradeStore } from '@/store/tradeStore';
import {
  WhaleAlert,
  BullBearMetrics,
  HypeRealityMetrics,
  InstitutionalExecutionEvent,
  OrderBookSnapshot,
  ExecutedTrade,
} from '@/lib/types';

export function useWebSocket(
  url: string = 'ws://localhost:8000/ws',
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled !== false;
  const {
    addWhaleAlert,
    updateBullBearMetrics,
    updateHypeRealityMetrics,
    addInstitutionalEvent,
    updateOrderBook,
    updateWhaleAlert,
    addExecutedTrade,
    setConnected,
  } = useTradeStore();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('Connected to whale watcher backend');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'whale_alert') {
              console.log('Whale alert received:', data);
              addWhaleAlert({
                trade_id: data.trade_id,
                timestamp: data.timestamp,
                price: data.price,
                quantity: data.quantity,
                trade_value: data.trade_value,
                is_buy: data.is_buy,
                whale_score: data.whale_score,
                bull_bear_sentiment: data.bull_bear_sentiment,
                similar_patterns: data.similar_patterns ?? [],
                label: data.label,
                severity_score: data.severity_score,
                price_move_pct: data.price_move_pct,
                action_label: data.action_label,
              });
            } else if (data.type === 'bull_bear_metrics') {
              console.log('Bull/Bear metrics:', data);
              updateBullBearMetrics({
                net_buy_volume: data.net_buy_volume,
                net_sell_volume: data.net_sell_volume,
                bull_power: data.bull_power,
                momentum: data.momentum,
                timestamp: data.timestamp,
              });
            } else if (data.type === 'trade') {
              const trade: ExecutedTrade = {
                trade_id: data.trade_id,
                timestamp: data.timestamp,
                price: data.price,
                quantity: data.quantity,
                trade_value: data.trade_value,
                is_buy: data.is_buy,
              };
              addExecutedTrade(trade);
            } else if (data.type === 'hype_reality_metrics') {
              const metrics: HypeRealityMetrics = {
                social_hype_score: data.social_hype_score,
                whale_activity_score: data.whale_activity_score,
                price_change_percent: data.price_change_percent,
                whale_value: data.whale_value,
                insight: data.insight,
                timestamp: data.timestamp,
              };
              updateHypeRealityMetrics(metrics);
            } else if (data.type === 'institutional_execution') {
              const event: InstitutionalExecutionEvent = {
                symbol: data.symbol,
                side: data.side,
                label: data.label,
                score: data.score,
                confidence: data.confidence,
                features: data.features,
                ts: data.ts,
              };
              addInstitutionalEvent(event);
            } else if (data.type === 'order_book') {
              const snapshot: OrderBookSnapshot = {
                last_update_id: data.data?.last_update_id ?? null,
                bids: data.data?.bids ?? [],
                asks: data.data?.asks ?? [],
                timestamp: data.data?.timestamp ?? null,
              };
              updateOrderBook(snapshot);
            } else if (data.type === 'whale_alert_update') {
              updateWhaleAlert(data.trade_id, {
                severity_score: data.severity_score,
                price_move_pct: data.price_move_pct,
              });
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        };

        ws.onclose = () => {
          console.log('Disconnected from backend');
          setConnected(false);
          // Attempt to reconnect after 3 seconds
          setTimeout(connect, 3000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [
    enabled,
    url,
    addWhaleAlert,
    updateBullBearMetrics,
    updateHypeRealityMetrics,
    addInstitutionalEvent,
    updateOrderBook,
    updateWhaleAlert,
    addExecutedTrade,
    setConnected,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/metrics');
        if (!res.ok) {
          return;
        }
        const payload = await res.json();
        if (payload.bull_bear_metrics) {
          updateBullBearMetrics(payload.bull_bear_metrics as BullBearMetrics);
        }
        if (payload.hype_reality_metrics) {
          updateHypeRealityMetrics(payload.hype_reality_metrics as HypeRealityMetrics);
        }
      } catch (error) {
        console.error('Metrics fetch error:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);

    return () => clearInterval(interval);
  }, [enabled, updateBullBearMetrics, updateHypeRealityMetrics]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const fetchOrderBook = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/order-book');
        if (!res.ok) {
          return;
        }
        const payload = await res.json();
        if (payload.success && payload.data) {
          updateOrderBook(payload.data as OrderBookSnapshot);
        }
      } catch (error) {
        console.error('Order book fetch error:', error);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000);

    return () => clearInterval(interval);
  }, [enabled, updateOrderBook]);

  return useTradeStore();
}
