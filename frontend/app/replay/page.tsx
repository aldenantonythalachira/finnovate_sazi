'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WhaleTerminalFeed } from '@/components/WhaleTerminalFeed';
import { OrderBookPanel } from '@/components/OrderBookPanel';
import { useTradeStore } from '@/store/tradeStore';

const SPEED = 10;

type ReplayEvent = {
  ts: number;
  type: string;
  data: any;
};

export default function ReplayPage() {
  const {
    replayWhaleAlerts,
    replayOrderBook,
    addReplayWhaleAlert,
    updateReplayWhaleAlert,
    addReplayInstitutionalEvent,
    updateReplayOrderBook,
    resetReplayState,
  } = useTradeStore();

  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orderBookHistory, setOrderBookHistory] = useState<ReplayEvent[]>([]);


  const eventsRef = useRef<ReplayEvent[]>([]);
  const indexRef = useRef(0);
  const startTsRef = useRef(0);
  const endTsRef = useRef(0);
  const virtualTimeRef = useRef(0);
  const playOriginRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const pushOrderBookHistory = useCallback((event: ReplayEvent) => {
    setOrderBookHistory((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || event.ts - last.ts >= 5000) {
        next.push(event);
      }
      const cutoff = event.ts - 60 * 60 * 1000;
      return next.filter((entry) => entry.ts >= cutoff);
    });
  }, []);

  const applyEvent = useCallback((event: ReplayEvent) => {
    switch (event.type) {
      case 'whale_alert':
        addReplayWhaleAlert(event.data);
        break;
      case 'whale_alert_update':
        updateReplayWhaleAlert(event.data.trade_id, {
          severity_score: event.data.severity_score,
          price_move_pct: event.data.price_move_pct,
        });
        break;
      case 'institutional_execution':
        addReplayInstitutionalEvent(event.data);
        break;
      case 'order_book':
        updateReplayOrderBook(event.data);
        pushOrderBookHistory(event);
        break;
      default:
        break;
    }
  }, [
    addReplayInstitutionalEvent,
    addReplayWhaleAlert,
    updateReplayOrderBook,
    updateReplayWhaleAlert,
    pushOrderBookHistory,
  ]);

  const applyEventsUpTo = useCallback((virtualMs: number) => {
    resetReplayState();
    setOrderBookHistory([]);
    const startTs = startTsRef.current;
    const targetTs = startTs + virtualMs;
    let idx = 0;
    const list = eventsRef.current;
    while (idx < list.length && list[idx].ts <= targetTs) {
      applyEvent(list[idx]);
      idx += 1;
    }
    indexRef.current = idx;
  }, [applyEvent, resetReplayState]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const startTs = startTsRef.current;
    const endTs = endTsRef.current;
    if (!playOriginRef.current) {
      return;
    }
    const elapsed = (performance.now() - playOriginRef.current) * SPEED;
    virtualTimeRef.current = Math.min(elapsed, endTs - startTs);

    const list = eventsRef.current;
    while (indexRef.current < list.length) {
      const event = list[indexRef.current];
      if (event.ts - startTs > virtualTimeRef.current) {
        break;
      }
      applyEvent(event);
      indexRef.current += 1;
    }

    const ratio = endTs > startTs ? virtualTimeRef.current / (endTs - startTs) : 0;
    setProgress(Math.min(Math.max(ratio, 0), 1));

    if (virtualTimeRef.current >= endTs - startTs) {
      stopPlayback();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [applyEvent, stopPlayback]);

  const startPlayback = useCallback(() => {
    if (!eventsRef.current.length) {
      return;
    }
    playOriginRef.current = performance.now() - virtualTimeRef.current / SPEED;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const handleScrub = useCallback((value: number) => {
    const startTs = startTsRef.current;
    const endTs = endTsRef.current;
    if (!endTs || !startTs) {
      return;
    }
    const virtualMs = (endTs - startTs) * value;
    virtualTimeRef.current = virtualMs;
    setProgress(value);
    applyEventsUpTo(virtualMs);
    if (isPlaying) {
      playOriginRef.current = performance.now() - virtualTimeRef.current / SPEED;
    }
  }, [applyEventsUpTo, isPlaying]);

  useEffect(() => {
    const fetchReplay = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:8000/api/replay?minutes=60');
        if (!res.ok) {
          return;
        }
        const payload = await res.json();
        if (payload.success && payload.events) {
          const sorted = payload.events.sort((a: ReplayEvent, b: ReplayEvent) => a.ts - b.ts);
          setEvents(sorted);
          eventsRef.current = sorted;
          startTsRef.current = sorted[0]?.ts ?? 0;
          endTsRef.current = sorted[sorted.length - 1]?.ts ?? 0;
          indexRef.current = 0;
          virtualTimeRef.current = 0;
          resetReplayState();
          if (sorted.length === 0) {
            setProgress(0);
            setOrderBookHistory([]);
          }
        }
      } catch (error) {
        console.error('Replay fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReplay();
  }, [resetReplayState]);

  const elapsedLabel = useMemo(() => {
    const totalMs = endTsRef.current - startTsRef.current;
    const currentMs = totalMs * progress;
    const minutes = Math.floor(currentMs / 60000);
    const seconds = Math.floor((currentMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, [progress]);

  const totalLabel = useMemo(() => {
    const totalMs = endTsRef.current - startTsRef.current;
    const minutes = Math.floor(totalMs / 60000);
    return `${minutes}m`;
  }, [events]);

  return (
    <>
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className="px-4 py-2 rounded bg-blue-500/20 border border-blue-400 text-blue-200"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => {
              stopPlayback();
              handleScrub(0);
            }}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300"
          >
            Reset
          </button>
          <div className="text-sm text-gray-400">Speed: {SPEED}x</div>
          <div className="text-sm text-gray-400">{elapsedLabel} / {totalLabel}</div>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(event) => handleScrub(parseFloat(event.target.value))}
            className="w-full"
          />
        </div>

        {loading && <p className="text-sm text-gray-400 mt-2">Loading replay events...</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WhaleTerminalFeed alerts={replayWhaleAlerts} />
        <OrderBookPanel
          snapshot={replayOrderBook}
          highlightHistory={orderBookHistory.map((entry) => entry.data)}
          enableWhaleMarkers={false}
        />
      </div>
    </>
  );
}
