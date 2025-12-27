'use client';

import { useEffect } from 'react';
import { useTradeStore } from '@/store/tradeStore';
import { WhaleAlert, BullBearMetrics } from '@/lib/types';

export function useWebSocket(url: string = 'ws://localhost:8000/ws') {
  const { addWhaleAlert, updateBullBearMetrics, setConnected } = useTradeStore();

  useEffect(() => {
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
              console.log('🐋 Whale alert received:', data);
              addWhaleAlert({
                trade_id: data.trade_id,
                timestamp: data.timestamp,
                price: data.price,
                quantity: data.quantity,
                trade_value: data.trade_value,
                is_buy: data.is_buy,
                whale_score: data.whale_score,
                bull_bear_sentiment: data.bull_bear_sentiment,
              });
            } else if (data.type === 'bull_bear_metrics') {
              console.log('📊 Bull/Bear metrics:', data);
              updateBullBearMetrics({
                net_buy_volume: data.net_buy_volume,
                net_sell_volume: data.net_sell_volume,
                bull_power: data.bull_power,
                momentum: data.momentum,
                timestamp: data.timestamp,
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
  }, [url, addWhaleAlert, updateBullBearMetrics, setConnected]);

  return useTradeStore();
}
