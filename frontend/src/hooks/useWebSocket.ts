'use client';

import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTradeStore } from '@/store/tradeStore';
import { WhaleAlert, BullBearMetrics } from '@/lib/types';

export function useWebSocket(url: string = 'ws://localhost:8000') {
  const { addWhaleAlert, updateBullBearMetrics, setConnected } = useTradeStore();

  useEffect(() => {
    const socket: Socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Connected to whale watcher backend');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setConnected(false);
    });

    socket.on('whale_alert', (data: { data: WhaleAlert }) => {
      console.log('🐋 Whale alert received:', data.data);
      addWhaleAlert(data.data);
    });

    socket.on('bull_bear_metrics', (data: { data: BullBearMetrics }) => {
      console.log('📊 Bull/Bear metrics:', data.data);
      updateBullBearMetrics(data.data);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('whale_alert');
      socket.off('bull_bear_metrics');
      socket.disconnect();
    };
  }, [url, addWhaleAlert, updateBullBearMetrics, setConnected]);

  return useTradeStore();
}
