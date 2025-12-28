'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTradeStore } from '@/store/tradeStore';
import { ExecutedTrade, OrderBookSnapshot, WhaleAlert } from '@/lib/types';

type Bubble = {
  id: number;
  mesh: THREE.Mesh;
  ring?: THREE.Mesh;
  trail?: THREE.Line;
  trailPositions?: Float32Array;
  velocity: THREE.Vector3;
  createdAt: number;
  price: number;
  isBuy: boolean;
  isWhale: boolean;
  tradeValue: number;
  aggression: number;
  baseOpacity: number;
};

type PatternMarker = {
  id: number;
  label: string;
  price: number;
  side: 'BUY' | 'SELL';
  ts: number;
};

type HoveredBubble = {
  tradeId: number;
  price: number;
  tradeValue: number;
  qty: number;
  isBuy: boolean;
  label?: string;
  x: number;
  y: number;
};

const LIFESPAN_MS = 60000;
const MAX_BUBBLES = 420;
const WHALE_THRESHOLD = 100000;
const PRICE_RANGE = 6;
const PRICE_SCALE = 120;

const bubbleRadius = (tradeValue: number) => {
  const raw = Math.sqrt(Math.max(tradeValue, 1)) / 400;
  return Math.max(0.28, Math.min(raw, 2.8));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const getAlertTimestampMs = (iso: string) => {
  const parsed = Date.parse(iso);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return null;
};

const formatNumber = (value: number, decimals: number) => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const getMidPrice = (snapshot: OrderBookSnapshot | null) => {
  if (!snapshot) {
    return 0;
  }
  const bestBid = snapshot.bids?.[0]?.[0] ? parseFloat(snapshot.bids[0][0]) : 0;
  const bestAsk = snapshot.asks?.[0]?.[0] ? parseFloat(snapshot.asks[0][0]) : 0;
  if (!bestBid || !bestAsk) {
    return 0;
  }
  return (bestBid + bestAsk) / 2;
};

const getIntentColor = (isBuy: boolean, aggression: number) => {
  const passive = new THREE.Color(isBuy ? '#14532d' : '#7f1d1d');
  const bright = new THREE.Color(isBuy ? '#4ade80' : '#f87171');
  return passive.lerp(bright, aggression);
};

export function WhaleBubbleSpace() {
  const { orderBook, whaleAlerts, executedTrades, setSelectedWhaleTradeId } = useTradeStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef<HTMLSpanElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const seenTradesRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);
  const midPriceRef = useRef(0);
  const avgTradeValueRef = useRef(0);
  const lastTradeTsRef = useRef<number | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const overlayGroupRef = useRef<THREE.Group | null>(null);
  const midLineRef = useRef<THREE.Line | null>(null);
  const wallBandsRef = useRef<THREE.Group | null>(null);
  const hydrateRef = useRef<() => void>(() => undefined);
  const hoveredRef = useRef<HoveredBubble | null>(null);
  const focusModeRef = useRef<'all' | 'whales'>('all');

  const [focusMode, setFocusMode] = useState<'all' | 'whales'>('all');
  const [hovered, setHovered] = useState<HoveredBubble | null>(null);
  const [patterns, setPatterns] = useState<PatternMarker[]>([]);

  const geometryCache = useMemo(() => new Map<number, THREE.SphereGeometry>(), []);
  const getGeometry = useCallback(
    (radius: number) => {
      if (geometryCache.has(radius)) {
        return geometryCache.get(radius) as THREE.SphereGeometry;
      }
      const geometry = new THREE.SphereGeometry(radius, 24, 24);
      geometryCache.set(radius, geometry);
      return geometry;
    },
    [geometryCache]
  );

  const priceToY = useCallback((price: number) => {
    const mid = midPriceRef.current;
    if (!mid || !price) {
      return 0;
    }
    const delta = (price - mid) / mid;
    return clamp(delta * PRICE_SCALE, -PRICE_RANGE, PRICE_RANGE);
  }, []);

  const resetBubbles = useCallback(() => {
    const scene = sceneRef.current;
    if (scene) {
      bubblesRef.current.forEach((bubble) => {
        scene.remove(bubble.mesh);
        if (bubble.ring) {
          scene.remove(bubble.ring);
        }
        if (bubble.trail) {
          scene.remove(bubble.trail);
        }
        bubble.mesh.geometry.dispose();
        if (Array.isArray(bubble.mesh.material)) {
          bubble.mesh.material.forEach((mat) => mat.dispose());
        } else {
          bubble.mesh.material.dispose();
        }
        if (bubble.ring && bubble.ring.material instanceof THREE.Material) {
          bubble.ring.material.dispose();
        }
        if (bubble.trail && bubble.trail.material instanceof THREE.Material) {
          bubble.trail.material.dispose();
        }
      });
    }
    bubblesRef.current = [];
    seenTradesRef.current = new Set();
    lastTradeTsRef.current = null;
  }, []);

  const addBubble = useCallback(
    (
      trade: ExecutedTrade | WhaleAlert,
      opts: { isWhale: boolean; ageMs: number; aggression: number; qty: number }
    ) => {
      const tradeId = trade.trade_id;
      if (seenTradesRef.current.has(tradeId)) {
        return;
      }
      seenTradesRef.current.add(tradeId);

      const scene = sceneRef.current;
      if (!scene) {
        return;
      }

      const ageMs = opts.ageMs;
      if (ageMs >= LIFESPAN_MS) {
        return;
      }

      const radius = bubbleRadius(trade.trade_value);
      const geometry = getGeometry(radius);
      const intentColor = getIntentColor(trade.is_buy, opts.aggression);
      const material = new THREE.MeshStandardMaterial({
        color: intentColor,
        transparent: true,
        opacity: opts.isWhale ? 0.9 : 0.65,
        roughness: 0.4,
        metalness: 0.1,
        emissive: intentColor,
        emissiveIntensity: opts.isWhale ? 0.35 : 0.15,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const yBase = priceToY(trade.price);
      mesh.position.set(
        (Math.random() - 0.5) * 10,
        yBase,
        (Math.random() - 0.5) * 10
      );

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        0,
        (Math.random() - 0.5) * 0.02
      );

      let ring: THREE.Mesh | undefined;
      let trail: THREE.Line | undefined;
      let trailPositions: Float32Array | undefined;

      if (opts.isWhale) {
        const ringGeometry = new THREE.RingGeometry(radius * 1.25, radius * 1.45, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: intentColor,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);

        const trailGeometry = new THREE.BufferGeometry();
        trailPositions = new Float32Array(18);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({
          color: intentColor,
          transparent: true,
          opacity: 0.4,
        });
        trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
      }

      const label = 'label' in trade ? trade.label : undefined;
      mesh.userData = {
        tradeId,
        price: trade.price,
        tradeValue: trade.trade_value,
        qty: opts.qty,
        isBuy: trade.is_buy,
        isWhale: opts.isWhale,
        label,
      };

      scene.add(mesh);

      const bubble: Bubble = {
        id: tradeId,
        mesh,
        ring,
        trail,
        trailPositions,
        velocity,
        createdAt: Date.now() - ageMs,
        price: trade.price,
        isBuy: trade.is_buy,
        isWhale: opts.isWhale,
        tradeValue: trade.trade_value,
        aggression: opts.aggression,
        baseOpacity: opts.isWhale ? 0.85 : 0.6,
      };

      bubblesRef.current.push(bubble);
      if (bubblesRef.current.length > MAX_BUBBLES) {
        const removed = bubblesRef.current.shift();
        if (removed && scene) {
          scene.remove(removed.mesh);
          if (removed.ring) {
            scene.remove(removed.ring);
          }
          if (removed.trail) {
            scene.remove(removed.trail);
          }
        }
      }
    },
    [getGeometry, priceToY]
  );

  const computeAggression = useCallback(
    (tradeValue: number, ts: number) => {
      const avg = avgTradeValueRef.current || tradeValue || 1;
      const ratio = avg > 0 ? tradeValue / avg : 1;
      const sizeScore = clamp(Math.log(Math.max(ratio, 1)) / Math.log(6), 0, 1);
      const lastTs = lastTradeTsRef.current;
      const deltaMs = lastTs ? Math.max(ts - lastTs, 0) : 1000;
      const speedScore = clamp((500 - deltaMs) / 500, 0, 1);
      lastTradeTsRef.current = ts;
      return clamp(sizeScore * 0.7 + speedScore * 0.3, 0, 1);
    },
    []
  );

  const hydrateFromTrades = useCallback(() => {
    const now = Date.now();
    const trades = (focusMode === 'whales' ? whaleAlerts : executedTrades)
      .slice(0, 200)
      .slice()
      .sort((a, b) => {
        const aTs = getAlertTimestampMs(a.timestamp) ?? 0;
        const bTs = getAlertTimestampMs(b.timestamp) ?? 0;
        return aTs - bTs;
      });

    trades.forEach((trade) => {
      const ts = getAlertTimestampMs(trade.timestamp);
      const tradeTs = ts ?? now;
      const ageMs = now - tradeTs;
      const isWhale = focusMode === 'whales' || trade.trade_value >= WHALE_THRESHOLD;
      const aggression = computeAggression(trade.trade_value, tradeTs);
      addBubble(trade, { isWhale, ageMs, aggression, qty: trade.quantity });
    });
  }, [addBubble, computeAggression, executedTrades, focusMode, whaleAlerts]);

  useEffect(() => {
    hydrateRef.current = hydrateFromTrades;
  }, [hydrateFromTrades]);

  useEffect(() => {
    const values = executedTrades.slice(0, 200).map((trade) => trade.trade_value);
    const avg = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    avgTradeValueRef.current = avg || 1;
  }, [executedTrades]);

  useEffect(() => {
    const newMid = getMidPrice(orderBook);
    if (newMid) {
      midPriceRef.current = newMid;
    }
  }, [orderBook]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const light = new THREE.PointLight(0xffffff, 0.8);
    light.position.set(6, 6, 6);
    scene.add(ambient, light);

    const overlayGroup = new THREE.Group();
    overlayGroupRef.current = overlayGroup;
    scene.add(overlayGroup);

    const midLineMaterial = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 });
    const midLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-6, 0, 0),
      new THREE.Vector3(6, 0, 0),
    ]);
    const midLine = new THREE.Line(midLineGeometry, midLineMaterial);
    midLineRef.current = midLine;
    overlayGroup.add(midLine);

    const wallGroup = new THREE.Group();
    wallBandsRef.current = wallGroup;
    overlayGroup.add(wallGroup);

    hydrateRef.current();

    let animationFrame = 0;

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const animate = () => {
      const now = Date.now();
      const mid = midPriceRef.current;
      const whales = bubblesRef.current.filter((bubble) => bubble.isWhale);

      bubblesRef.current = bubblesRef.current.filter((bubble) => {
        const age = now - bubble.createdAt;
        if (age > LIFESPAN_MS) {
          scene.remove(bubble.mesh);
          if (bubble.ring) {
            scene.remove(bubble.ring);
          }
          if (bubble.trail) {
            scene.remove(bubble.trail);
          }
          bubble.mesh.geometry.dispose();
          if (Array.isArray(bubble.mesh.material)) {
            bubble.mesh.material.forEach((mat) => mat.dispose());
          } else {
            bubble.mesh.material.dispose();
          }
          if (bubble.ring && bubble.ring.material instanceof THREE.Material) {
            bubble.ring.material.dispose();
          }
          if (bubble.trail && bubble.trail.material instanceof THREE.Material) {
            bubble.trail.material.dispose();
          }
          return false;
        }

        const lifeRatio = age / LIFESPAN_MS;
        const fade = 1 - lifeRatio;
        const material = bubble.mesh.material as THREE.MeshStandardMaterial;
        material.opacity = bubble.baseOpacity * fade;
        material.emissiveIntensity = bubble.isWhale ? 0.4 * fade : 0.2 * fade;
        const scale = 1 - lifeRatio * (bubble.isWhale ? 0.12 : 0.2);
        bubble.mesh.scale.setScalar(scale);

        const yTarget = mid ? priceToY(bubble.price) : bubble.mesh.position.y;
        bubble.mesh.position.y = yTarget + Math.sin((now - bubble.createdAt) / 900) * 0.06;
        const driftScale = focusModeRef.current === 'whales' ? 0.5 : 1;
        bubble.mesh.position.add(bubble.velocity.clone().multiplyScalar(driftScale));

        if (bubble.ring) {
          bubble.ring.position.copy(bubble.mesh.position);
          bubble.ring.lookAt(camera.position);
          const pulse = 1 + Math.sin((now - bubble.createdAt) / 700) * 0.08;
          bubble.ring.scale.set(pulse, pulse, pulse);
          (bubble.ring.material as THREE.Material).opacity = 0.35 * fade;
        }

        if (bubble.trail && bubble.trailPositions) {
          const positions = bubble.trailPositions;
          positions.copyWithin(3, 0, positions.length - 3);
          positions[0] = bubble.mesh.position.x;
          positions[1] = bubble.mesh.position.y;
          positions[2] = bubble.mesh.position.z;
          const attr = bubble.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
          attr.needsUpdate = true;
          (bubble.trail.material as THREE.Material).opacity = 0.3 * fade;
        }

        return true;
      });

      if (whales.length > 0) {
        bubblesRef.current.forEach((bubble) => {
          if (bubble.isWhale) {
            return;
          }
          whales.forEach((whale) => {
            const dist = bubble.mesh.position.distanceTo(whale.mesh.position);
            if (dist < 2.2 && dist > 0.1) {
              const push = bubble.mesh.position.clone().sub(whale.mesh.position).normalize().multiplyScalar(0.015);
              bubble.mesh.position.add(push);
            }
          });
        });
      }

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      initializedRef.current = false;
    };
  }, [priceToY, resetBubbles]);

  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) {
      return;
    }
    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const meshes = bubblesRef.current.map((bubble) => bubble.mesh);
      const intersects = raycasterRef.current.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const data = hit.userData as any;
        const nextHover = {
          tradeId: data.tradeId,
          price: data.price,
          tradeValue: data.tradeValue,
          qty: data.qty,
          isBuy: data.isBuy,
          label: data.label,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        hoveredRef.current = nextHover;
        setHovered(nextHover);
      } else {
        hoveredRef.current = null;
        setHovered(null);
      }
    };

    const handleClick = () => {
      const active = hoveredRef.current;
      if (active && active.tradeId) {
        const isWhale = active.tradeValue >= WHALE_THRESHOLD;
        if (isWhale) {
          setSelectedWhaleTradeId(active.tradeId);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousemove', handlePointerMove);
    dom.addEventListener('mouseleave', () => setHovered(null));
    dom.addEventListener('click', handleClick);

    return () => {
      dom.removeEventListener('mousemove', handlePointerMove);
      dom.removeEventListener('mouseleave', () => setHovered(null));
      dom.removeEventListener('click', handleClick);
    };
  }, [setSelectedWhaleTradeId]);

  useEffect(() => {
    if (!orderBook || !overlayGroupRef.current || !wallBandsRef.current) {
      return;
    }
    const mid = getMidPrice(orderBook);
    if (!mid) {
      return;
    }
    midPriceRef.current = mid;

    if (midLineRef.current) {
      midLineRef.current.position.y = 0;
    }

    const wallGroup = wallBandsRef.current;
    while (wallGroup.children.length > 0) {
      const child = wallGroup.children.pop();
      if (child && child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
        child.geometry.dispose();
      }
    }

    const depth = 15;
    const bids = orderBook.bids.slice(0, depth).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));
    const asks = orderBook.asks.slice(0, depth).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));

    const bucketSize = Math.max(Math.round(mid * 0.001), 10);
    const bucketize = (levels: { price: number; qty: number }[]) => {
      const buckets = new Map<number, number>();
      levels.forEach((level) => {
        const bucket = Math.round(level.price / bucketSize) * bucketSize;
        buckets.set(bucket, (buckets.get(bucket) || 0) + level.qty);
      });
      return Array.from(buckets.entries())
        .map(([price, qty]) => ({ price, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 2);
    };

    const bidWalls = bucketize(bids);
    const askWalls = bucketize(asks);
    const bandWidth = 12;
    const bandHeight = 0.16;

    const buildBand = (price: number, color: string) => {
      const geometry = new THREE.PlaneGeometry(bandWidth, bandHeight);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, priceToY(price), -2);
      return mesh;
    };

    bidWalls.forEach((wall) => {
      wallGroup.add(buildBand(wall.price, '#22c55e'));
    });
    askWalls.forEach((wall) => {
      wallGroup.add(buildBand(wall.price, '#f87171'));
    });
  }, [orderBook, priceToY]);

  useEffect(() => {
    focusModeRef.current = focusMode;
    resetBubbles();
    hydrateFromTrades();
  }, [focusMode, hydrateFromTrades, resetBubbles]);

  useEffect(() => {
    const now = Date.now();
    const source = (focusMode === 'whales' ? whaleAlerts : executedTrades)
      .slice(0, 200)
      .slice()
      .sort((a, b) => {
        const aTs = getAlertTimestampMs(a.timestamp) ?? 0;
        const bTs = getAlertTimestampMs(b.timestamp) ?? 0;
        return aTs - bTs;
      });
    source.forEach((trade) => {
      const ts = getAlertTimestampMs(trade.timestamp) ?? now;
      const ageMs = now - ts;
      const isWhale = focusMode === 'whales' || trade.trade_value >= WHALE_THRESHOLD;
      const aggression = computeAggression(trade.trade_value, ts);
      addBubble(trade, { isWhale, ageMs, aggression, qty: trade.quantity });
    });
  }, [executedTrades, whaleAlerts, focusMode, addBubble, computeAggression]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const windowTrades = executedTrades.filter((trade) => {
        const ts = getAlertTimestampMs(trade.timestamp) ?? 0;
        return now - ts <= 30000;
      });
      const buckets = new Map<number, { buys: number; sells: number }>();
      windowTrades.forEach((trade) => {
        const key = Math.round(trade.price / 50) * 50;
        const entry = buckets.get(key) || { buys: 0, sells: 0 };
        if (trade.is_buy) {
          entry.buys += 1;
        } else {
          entry.sells += 1;
        }
        buckets.set(key, entry);
      });

      const markers: PatternMarker[] = [];
      buckets.forEach((entry, price) => {
        if (entry.buys >= 3) {
          markers.push({ id: now + price, label: 'SUPPORT DEFENSE', price, side: 'BUY', ts: now });
        }
      });

      const latest = executedTrades[0];
      if (latest && latest.trade_value > (avgTradeValueRef.current || latest.trade_value) * 3) {
        const recentPrices = executedTrades.slice(0, 20).map((trade) => trade.price);
        if (recentPrices.length >= 2) {
          const move = (recentPrices[0] - recentPrices[recentPrices.length - 1]) / recentPrices[recentPrices.length - 1];
          if (move > 0.004 && !latest.is_buy) {
            markers.push({ id: now + 2, label: 'DISTRIBUTION', price: latest.price, side: 'SELL', ts: now });
          }
          if (Math.abs(move) < 0.0005 && latest.trade_value > (avgTradeValueRef.current || 1) * 3) {
            markers.push({ id: now + 3, label: 'ABSORPTION', price: latest.price, side: latest.is_buy ? 'BUY' : 'SELL', ts: now });
          }
        }
      }

      setPatterns((prev) => {
        const active = prev.filter((marker) => now - marker.ts <= 5000);
        return [...active, ...markers].slice(-6);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [executedTrades]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (countRef.current) {
        countRef.current.textContent = `${bubblesRef.current.length} active`;
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const patternOverlays = useMemo(() => {
    if (!containerRef.current) {
      return [];
    }
    const height = containerRef.current.clientHeight;
    return patterns.map((marker) => {
      const y = priceToY(marker.price);
      const top = clamp(50 - (y / PRICE_RANGE) * 50, 5, 95);
      return {
        ...marker,
        top,
      };
    });
  }, [patterns, priceToY]);

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Whale Bubble Space</h2>
          <p className="text-xs text-gray-400">Price axis view | Mid price centered | 60s lifespan</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setFocusMode('all')}
              className={`px-2 py-1 rounded border ${
                focusMode === 'all'
                  ? 'border-blue-400 text-blue-200 bg-blue-500/10'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              All Trades
            </button>
            <button
              onClick={() => setFocusMode('whales')}
              className={`px-2 py-1 rounded border ${
                focusMode === 'whales'
                  ? 'border-green-400 text-green-200 bg-green-500/10'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              Whales Only
            </button>
          </div>
          <span ref={countRef} className="text-xs text-gray-500">0 active</span>
        </div>
      </div>

      <div className="relative h-96 w-full overflow-hidden rounded-lg bg-black/30">
        <div ref={containerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-400/30" />
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-300">
          Mid Price
        </div>
        <div className="pointer-events-none absolute left-3 top-2 text-[11px] text-slate-400">
          Higher price (sells)
        </div>
        <div className="pointer-events-none absolute left-3 bottom-2 text-[11px] text-slate-400">
          Lower price (buys)
        </div>

        {patternOverlays.map((marker) => (
          <div
            key={`${marker.id}-${marker.label}`}
            className={`absolute left-3 px-2 py-1 text-[10px] rounded border shadow ${
              marker.side === 'BUY'
                ? 'border-green-500/50 text-green-200 bg-green-500/10'
                : 'border-red-500/50 text-red-200 bg-red-500/10'
            }`}
            style={{ top: `${marker.top}%` }}
          >
            {marker.label}
          </div>
        ))}

        {hovered && (
          <div
            className="pointer-events-none absolute px-2 py-1 text-[11px] rounded border border-gray-700 bg-gray-900/90 text-gray-200"
            style={{ left: hovered.x + 12, top: hovered.y + 12 }}
          >
            <div className="font-semibold">{hovered.isBuy ? 'BUY' : 'SELL'}</div>
            <div>Price: {formatNumber(hovered.price, 2)}</div>
            <div>Value: ${formatNumber(hovered.tradeValue, 0)}</div>
            <div>Qty: {formatNumber(hovered.qty, 4)} BTC</div>
            {hovered.label && <div>Label: {hovered.label}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
