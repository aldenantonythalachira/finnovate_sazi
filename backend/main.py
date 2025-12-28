"""
Whale Watcher Pro - Live Binance API Server
Provides REST + WebSocket endpoints for live BTC/USDT data
"""

import asyncio
import logging
import math
import time

import httpx
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware  

from .services.binance_stream import BinanceWebSocketManager, BinanceDepthStreamManager
from .services.whale_detection import WhaleDetectionEngine, InstitutionalExecutionDetector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Whale Watcher Pro API",
    description="Real-time cryptocurrency whale detection",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Live services
trade_stream = BinanceWebSocketManager("btcusdt")
depth_stream = BinanceDepthStreamManager("btcusdt", depth_level=20)
whale_engine = WhaleDetectionEngine()
institutional_detector = InstitutionalExecutionDetector("BTCUSDT")

BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"
BINANCE_TICKER_TTL_SECONDS = 30.0

# In-memory state
connected_clients: set[WebSocket] = set()
recent_trades: deque = deque(maxlen=6000)
recent_institutional_events: deque = deque(maxlen=300)
pending_whale_severity: deque = deque(maxlen=500)
replay_events: deque = deque(maxlen=20000)
latest_order_book: Dict[str, Any] = {
    "last_update_id": None,
    "bids": [],
    "asks": [],
    "timestamp": None,
}
last_order_book_emit = 0.0
binance_24h_cache: Dict[str, Any] = {
    "timestamp": 0.0,
    "volume": None,
    "ticker": None,
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def record_replay_event(event_type: str, payload: Dict[str, Any], ts: datetime | None = None) -> None:
    allowed = {"whale_alert", "whale_alert_update", "institutional_execution", "order_book"}
    if event_type not in allowed:
        return
    event_ts = ts or datetime.utcnow()
    replay_events.append({
        "ts": int(event_ts.timestamp() * 1000),
        "type": event_type,
        "data": payload,
    })


def compute_severity_score(move_pct: float) -> int:
    # 0.2% per severity step, capped 1-10
    score = int(round(move_pct / 0.2))
    return max(1, min(score, 10))


def get_recent_trades(window_seconds: int) -> List[Dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    return [trade for trade in list(recent_trades) if trade["timestamp"] >= cutoff]


def compute_price_change_pct(window_minutes: int) -> float:
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    window = [trade for trade in list(recent_trades) if trade["timestamp"] >= cutoff]
    if len(window) < 2:
        return 0.0
    price_open = window[0]["price"]
    price_last = window[-1]["price"]
    if price_open <= 0:
        return 0.0
    return ((price_last - price_open) / price_open) * 100


def detect_liquidity_wall(side: str, price: float) -> bool:
    if not latest_order_book.get("bids") or not latest_order_book.get("asks"):
        return False
    levels = latest_order_book["asks"] if side == "BUY" else latest_order_book["bids"]
    parsed = []
    for level_price, level_qty in levels[:20]:
        try:
            level_price_f = float(level_price)
            level_qty_f = float(level_qty)
        except ValueError:
            continue
        parsed.append((level_price_f, level_qty_f))
    if not parsed:
        return False
    values = [p * q for p, q in parsed]
    median_value = sorted(values)[len(values) // 2]
    wall_threshold = max(median_value * 5, max(values))
    for (level_price, level_qty), level_value in zip(parsed, values):
        if level_value < wall_threshold:
            continue
        distance_pct = abs(level_price - price) / price
        if distance_pct <= 0.0015:
            return True
    return False


def classify_whale_action(trade: Dict[str, Any]) -> str | None:
    trade_value = trade["value"]
    side = "BUY" if trade["is_buy"] else "SELL"

    price_pump = compute_price_change_pct(10)
    if side == "SELL" and price_pump >= 1.5:
        return "Distribution Sell"

    if detect_liquidity_wall(side, trade["price"]) and trade_value >= 1_000_000:
        return "Liquidity Grab"

    recent_2m = [t for t in get_recent_trades(120) if t["is_buy"]]
    support_count = sum(
        1 for t in recent_2m
        if abs(t["price"] - trade["price"]) / trade["price"] <= 0.001
    )
    if support_count >= 6 and side == "BUY":
        return "Support Defense"

    recent_10s = get_recent_trades(10)
    if len(recent_10s) >= 5:
        prices = [t["price"] for t in recent_10s]
        price_open = prices[0]
        price_last = prices[-1]
        move_10s = abs(price_last - price_open) / price_open if price_open else 0.0
        range_10s = (max(prices) - min(prices)) / price_last if price_last else 0.0
        if trade_value >= 500_000 and move_10s <= 0.0005 and range_10s <= 0.001:
            return "Fake Pressure"

    return None


def update_pending_severity(current_price: float, now: datetime) -> List[Dict[str, Any]]:
    updates: List[Dict[str, Any]] = []
    remaining = deque(maxlen=pending_whale_severity.maxlen)
    for item in list(pending_whale_severity):
        if now - item["timestamp"] < timedelta(minutes=1):
            remaining.append(item)
            continue
        price_at_alert = item["price"]
        if not price_at_alert:
            continue
        move_pct = abs(current_price - price_at_alert) / price_at_alert * 100
        severity = compute_severity_score(move_pct)
        updates.append({
            "trade_id": item["trade_id"],
            "severity_score": severity,
            "price_move_pct": round(move_pct, 4),
        })
    pending_whale_severity.clear()
    pending_whale_severity.extend(remaining)
    return updates


def parse_trade(trade: Dict[str, Any]) -> Dict[str, Any]:
    price = float(trade["price"])
    quantity = float(trade["quantity"])
    trade_value = price * quantity
    trade_time = datetime.utcfromtimestamp(trade["trade_time"] / 1000)
    is_buyer_maker = trade.get("is_buyer_maker", False)
    is_buy = not is_buyer_maker

    return {
        "trade_id": trade["trade_id"],
        "timestamp": trade_time,
        "price": price,
        "quantity": quantity,
        "value": trade_value,
        "is_buy": is_buy,
        "is_buyer_maker": is_buyer_maker,
    }


async def broadcast(payload: Dict[str, Any]) -> None:
    event_type = payload.get("type")
    if event_type in {"whale_alert", "whale_alert_update", "institutional_execution", "order_book"}:
        if event_type == "order_book":
            replay_payload = payload.get("data", {})
            ts_value = replay_payload.get("timestamp")
        else:
            replay_payload = {key: value for key, value in payload.items() if key != "type"}
            ts_value = replay_payload.get("timestamp") or replay_payload.get("ts")

        replay_ts = None
        if isinstance(ts_value, str):
            try:
                replay_ts = datetime.fromisoformat(ts_value)
            except ValueError:
                replay_ts = None

        record_replay_event(event_type, replay_payload, replay_ts)

    if not connected_clients:
        return

    for client in list(connected_clients):
        try:
            await client.send_json(payload)
        except Exception:
            connected_clients.discard(client)


async def get_binance_ticker() -> dict[str, Any] | None:
    now = time.monotonic()
    cached = binance_24h_cache.get("ticker")
    if cached and now - binance_24h_cache.get("timestamp", 0.0) < BINANCE_TICKER_TTL_SECONDS:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(BINANCE_TICKER_URL)
            response.raise_for_status()
            data = response.json()

        binance_24h_cache["timestamp"] = now
        binance_24h_cache["ticker"] = data
        binance_24h_cache["volume"] = float(data.get("quoteVolume") or 0.0)
        return data
    except Exception as exc:
        logger.warning("Failed to fetch Binance 24h ticker: %s", exc)
        return cached


async def get_binance_24h_volume() -> float | None:
    now = time.monotonic()
    cached = binance_24h_cache.get("volume")
    if cached is not None and now - binance_24h_cache.get("timestamp", 0.0) < BINANCE_TICKER_TTL_SECONDS:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(BINANCE_TICKER_URL)
            response.raise_for_status()
            data = response.json()
            volume = float(data.get("quoteVolume") or 0.0)

        binance_24h_cache["timestamp"] = now
        binance_24h_cache["volume"] = volume
        return volume
    except Exception as exc:
        logger.warning("Failed to fetch Binance 24h ticker: %s", exc)
        return cached


async def fetch_binance_klines(minutes: int) -> List[Dict[str, Any]]:
    limit = max(1, min(minutes, 500))
    url = f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit={limit}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            raw = response.json()
    except Exception as exc:
        logger.warning("Failed to fetch Binance klines: %s", exc)
        return []

    klines: List[Dict[str, Any]] = []
    for candle in raw:
        if len(candle) < 6:
            continue
        open_time = datetime.utcfromtimestamp(candle[0] / 1000)
        klines.append({
            "timestamp": open_time.isoformat(),
            "open": float(candle[1]),
            "high": float(candle[2]),
            "low": float(candle[3]),
            "close": float(candle[4]),
            "volume": float(candle[5]),
            "whale_volume": 0.0,
        })

    return klines


def build_chart_data(minutes: int, interval_seconds: int = 60) -> List[Dict[str, Any]]:
    if not recent_trades:
        return []

    interval_seconds = max(5, min(interval_seconds, 300))
    now = datetime.utcnow().replace(microsecond=0)
    bucket_count = max(int((minutes * 60) / interval_seconds), 1)
    start = now - timedelta(seconds=interval_seconds * (bucket_count - 1))

    buckets: Dict[datetime, Dict[str, Any]] = {}
    institutional_bucket_volume: Dict[datetime, float] = {}

    for event in list(recent_institutional_events):
        bucket_epoch = int(event["timestamp"].timestamp() // interval_seconds) * interval_seconds
        bucket_time = datetime.utcfromtimestamp(bucket_epoch)
        price = event.get("price") or 0.0
        if price <= 0:
            continue
        volume_btc = event["volume"] / price
        institutional_bucket_volume[bucket_time] = institutional_bucket_volume.get(bucket_time, 0.0) + volume_btc

    for trade in list(recent_trades):
        if trade["timestamp"] < start:
            continue

        bucket_epoch = int(trade["timestamp"].timestamp() // interval_seconds) * interval_seconds
        bucket_time = datetime.utcfromtimestamp(bucket_epoch)
        bucket = buckets.get(bucket_time)

        if bucket is None:
            bucket = {
                "open": trade["price"],
                "high": trade["price"],
                "low": trade["price"],
                "close": trade["price"],
                "volume": 0.0,
                "whale_volume": 0.0,
            }
        else:
            bucket["high"] = max(bucket["high"], trade["price"])
            bucket["low"] = min(bucket["low"], trade["price"])
            bucket["close"] = trade["price"]

        bucket["volume"] += trade["quantity"]
        if whale_engine.is_whale_trade(trade["value"]):
            bucket["whale_volume"] += trade["quantity"]

        buckets[bucket_time] = bucket

    chart_data: List[Dict[str, Any]] = []
    last_close = None

    for i in range(bucket_count):
        bucket_time = start + timedelta(seconds=interval_seconds * i)
        bucket = buckets.get(bucket_time)

        if bucket:
            last_close = bucket["close"]
            bucket["whale_volume"] += institutional_bucket_volume.get(bucket_time, 0.0)
            chart_data.append({
                "timestamp": bucket_time.isoformat(),
                **bucket,
            })
        elif last_close is not None:
            chart_data.append({
                "timestamp": bucket_time.isoformat(),
                "open": last_close,
                "high": last_close,
                "low": last_close,
                "close": last_close,
                "volume": 0.0,
                "whale_volume": institutional_bucket_volume.get(bucket_time, 0.0),
            })

    return chart_data


def build_bull_bear_payload() -> Dict[str, Any]:
    metrics = whale_engine.calculate_bull_bear_power(list(recent_trades), whales_only=False)
    return {
        "type": "bull_bear_metrics",
        "net_buy_volume": metrics["net_buy_volume"],
        "net_sell_volume": metrics["net_sell_volume"],
        "bull_power": metrics["bull_power"],
        "momentum": metrics["momentum"],
        "timestamp": datetime.utcnow().isoformat(),
    }


def compute_price_change_10s(trades: List[Dict[str, Any]]) -> float | None:
    if not trades:
        return None
    cutoff = datetime.utcnow() - timedelta(seconds=10)
    recent = [t for t in trades if t["timestamp"] >= cutoff]
    if len(recent) < 2:
        return None
    price_open = recent[0]["price"]
    price_last = recent[-1]["price"]
    if price_open <= 0:
        return None
    return ((price_last - price_open) / price_open) * 100


async def build_hype_reality_payload() -> Dict[str, Any] | None:
    ticker = await get_binance_ticker()
    if not ticker:
        return None

    trades = list(recent_trades)
    short_term_change = compute_price_change_10s(trades)
    five_min_change = compute_price_change_pct(5)
    price_change_percent = five_min_change or short_term_change
    if price_change_percent is None:
        price_change_percent = float(ticker.get("priceChangePercent") or 0.0)

    cutoff_5m = datetime.utcnow() - timedelta(minutes=5)
    cutoff_30m = datetime.utcnow() - timedelta(minutes=30)
    volume_5m = sum(t["value"] for t in trades if t["timestamp"] >= cutoff_5m)
    volume_30m = sum(t["value"] for t in trades if t["timestamp"] >= cutoff_30m)
    baseline_5m = volume_30m / 6 if volume_30m > 0 else 0.0
    volume_ratio = volume_5m / baseline_5m if baseline_5m > 0 else 1.0
    volume_burst = clamp((volume_ratio - 1.0) / 3.0, 0.0, 1.0)

    price_component = min(abs(price_change_percent) * 40, 70.0)
    volume_component = volume_burst * 30.0
    social_hype_score = min(price_component + volume_component, 100.0)
    whale_score, whale_value = compute_whale_activity_score(trades)

    return {
        "type": "hype_reality_metrics",
        "social_hype_score": round(social_hype_score, 1),
        "whale_activity_score": round(whale_score, 1),
        "price_change_percent": price_change_percent,
        "whale_value": whale_value,
        "timestamp": datetime.utcnow().isoformat(),
        "insight": interpret_hype_reality(social_hype_score, whale_score),
    }


def compute_whale_activity_score(
    trades: List[Dict[str, Any]],
    window_minutes: int = 30,
    whale_threshold: float = 100_000,
) -> tuple[float, float]:
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    window_trades = [trade for trade in trades if trade["timestamp"] >= cutoff]
    whale_value = sum(
        trade["value"]
        for trade in window_trades
        if trade["value"] >= whale_threshold
    )
    total_value = sum(trade["value"] for trade in window_trades)

    if total_value <= 0:
        return 0.0, whale_value

    whale_ratio = whale_value / max(total_value, 1.0)
    volume_score = clamp(math.log(max(total_value / 1_000_000, 1.0), 50.0))
    score = min((0.6 * volume_score + 0.4 * whale_ratio) * 100, 100.0)
    return score, whale_value


def interpret_hype_reality(social_score: float, whale_score: float) -> str:
    if whale_score - social_score > 10:
        return "Reality Check: Whale activity outpacing price hype. Institutional flows dominate."
    if social_score - whale_score > 10:
        return "Reality Check: Price hype outpacing whale activity. Retail-driven move risk."
    return "Reality Check: Whale activity and price hype are in balance."


# REST Endpoints
@app.get("/")
async def health_check():
    return {"status": "ok", "message": "Whale Watcher Pro API is running"}


@app.get("/api/health")
async def health_status():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "binance_connected": trade_stream.websocket is not None,
        "order_book_connected": depth_stream.websocket is not None,
    }


@app.get("/api/whale-trades")
async def get_whale_trades(limit: int = 50):
    whales = whale_engine.get_latest_whales(count=min(limit, 50))
    return {"trades": whales, "count": len(whales)}




@app.get("/api/bitcoin")
async def get_bitcoin_ticker():
    ticker = await get_binance_ticker()
    if not ticker:
        return {"success": False, "data": None}

    price = float(ticker.get("lastPrice") or 0.0)
    quote_volume = float(ticker.get("quoteVolume") or 0.0)
    base_volume = float(ticker.get("volume") or 0.0)
    if quote_volume <= 0 and base_volume > 0 and price > 0:
        quote_volume = base_volume * price

    return {
        "success": True,
        "data": {
            "price": price,
            "price_change_percent": float(ticker.get("priceChangePercent") or 0.0),
            "quote_volume": quote_volume,
            "base_volume": base_volume,
        },
    }


@app.get("/api/statistics")
async def get_statistics():
    trades = list(recent_trades)
    total_volume = sum(t["value"] for t in trades)
    whale_trades = [t for t in trades if whale_engine.is_whale_trade(t["value"])]
    binance_volume_24h = await get_binance_24h_volume()

    return {
        "total_trades": len(trades),
        "total_volume_24h": binance_volume_24h if binance_volume_24h is not None else total_volume,
        "total_volume_since_start": total_volume,
        "total_whale_trades": len(whale_trades),
        "average_trade_value": total_volume / max(len(trades), 1),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/chart-data")
async def get_chart_data(minutes: int = 60, interval_seconds: int = 60):
    data = build_chart_data(minutes, interval_seconds=interval_seconds)
    if not data:
        data = await fetch_binance_klines(minutes)
        interval_seconds = 60

    return {
        "success": True,
        "data": data,
        "period_minutes": minutes,
        "interval_seconds": interval_seconds,
    }


@app.get("/api/order-book")
async def get_order_book():
    timestamp = latest_order_book.get("timestamp")
    replay_ts = None
    if isinstance(timestamp, str):
        try:
            replay_ts = datetime.fromisoformat(timestamp)
        except ValueError:
            replay_ts = None
    record_replay_event("order_book", latest_order_book, replay_ts)
    return {
        "success": True,
        "data": latest_order_book,
    }


@app.get("/api/replay")
async def get_replay(minutes: int = 60):
    safe_minutes = max(0, minutes)
    cutoff_ms = int((datetime.utcnow() - timedelta(minutes=safe_minutes)).timestamp() * 1000)
    events = [
        event
        for event in list(replay_events)
        if int(event.get("ts", 0)) >= cutoff_ms
    ]
    return {"success": True, "count": len(events), "events": events}


@app.get("/api/metrics")
async def get_metrics():
    hype_payload = await build_hype_reality_payload()
    return {
        "success": True,
        "bull_bear_metrics": build_bull_bear_payload(),
        "hype_reality_metrics": hype_payload,
    }


# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info("Client connected via WebSocket")

    try:
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to Whale Watcher Pro",
            "timestamp": datetime.utcnow().isoformat(),
        })

        while True:
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        logger.info("Client disconnected")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        connected_clients.discard(websocket)


async def stream_binance_trades() -> None:
    async for trade in trade_stream.stream_trades():
        parsed = parse_trade(trade)
        recent_trades.append(parsed)
        last_trade = recent_trades[-1] if recent_trades else parsed
        await broadcast({
            "type": "trade",
            "trade_id": parsed["trade_id"],
            "timestamp": parsed["timestamp"].isoformat(),
            "price": parsed["price"],
            "quantity": parsed["quantity"],
            "trade_value": parsed["value"],
            "is_buy": parsed["is_buy"],
        })

        institutional_detector.ingest_trade(
            price=parsed["price"],
            qty=parsed["quantity"],
            is_buyer_maker=parsed["is_buyer_maker"],
            ts_ms=int(parsed["timestamp"].timestamp() * 1000),
        )
        event = institutional_detector.maybe_evaluate()
        if event:
            recent_institutional_events.append({
                "timestamp": datetime.utcnow(),
                "volume": event["features"]["vol_10s"],
                "price": last_trade["price"],
            })
            bull_bear = whale_engine.calculate_bull_bear_power(list(recent_trades), whales_only=False)
            institutional_value = event["features"]["vol_10s"]
            price = last_trade["price"]
            quantity = institutional_value / price if price else last_trade["quantity"]
            institutional_alert = {
                "type": "whale_alert",
                "trade_id": int(time.time() * 1000),
                "timestamp": datetime.utcnow().isoformat(),
                "price": price,
                "quantity": quantity,
                "trade_value": institutional_value,
                "is_buy": event["side"] == "BUY",
                "whale_score": event["score"] / 100.0,
                "bull_bear_sentiment": bull_bear["bull_power"],
                "similar_patterns": [],
                "label": event["label"],
                "action_label": classify_whale_action({
                    **parsed,
                    "price": price,
                    "value": institutional_value,
                    "is_buy": event["side"] == "BUY",
                }),
            }
            whale_engine.record_whale_trade(institutional_alert)
            await broadcast(institutional_alert)
            pending_whale_severity.append({
                "trade_id": institutional_alert["trade_id"],
                "price": institutional_alert["price"],
                "timestamp": datetime.utcnow(),
            })
            await broadcast({"type": "institutional_execution", **event})

        if whale_engine.is_whale_trade(parsed["value"]):
            whale_score = whale_engine.calculate_whale_score(parsed["value"])
            similar_patterns = whale_engine.find_similar_patterns(
                parsed["value"],
                parsed["is_buy"],
                list(recent_trades),
            )
            metrics = whale_engine.calculate_bull_bear_power(list(recent_trades))

            whale_alert = {
                "type": "whale_alert",
                "trade_id": parsed["trade_id"],
                "timestamp": parsed["timestamp"].isoformat(),
                "price": parsed["price"],
                "quantity": parsed["quantity"],
                "trade_value": parsed["value"],
                "is_buy": parsed["is_buy"],
                "whale_score": whale_score,
                "bull_bear_sentiment": metrics["bull_power"],
                "similar_patterns": similar_patterns,
                "action_label": classify_whale_action(parsed),
            }

            whale_engine.record_whale_trade(whale_alert)
            await broadcast(whale_alert)
            pending_whale_severity.append({
                "trade_id": whale_alert["trade_id"],
                "price": whale_alert["price"],
                "timestamp": parsed["timestamp"],
            })

        severity_updates = update_pending_severity(parsed["price"], parsed["timestamp"])
        for update in severity_updates:
            whale_engine.update_whale_trade(update["trade_id"], update)
            await broadcast({"type": "whale_alert_update", **update})


async def stream_binance_order_book() -> None:
    global latest_order_book
    global last_order_book_emit

    async for depth in depth_stream.stream_depth():
        latest_order_book = {
            "last_update_id": depth.get("last_update_id"),
            "bids": depth.get("bids", []),
            "asks": depth.get("asks", []),
            "timestamp": datetime.utcnow().isoformat(),
        }

        now = time.monotonic()
        if now - last_order_book_emit >= 1.0:
            last_order_book_emit = now
            await broadcast({
                "type": "order_book",
                "data": latest_order_book,
            })


async def emit_bull_bear_metrics() -> None:
    while True:
        await asyncio.sleep(5)
        await broadcast(build_bull_bear_payload())


async def emit_hype_reality_metrics() -> None:
    while True:
        await asyncio.sleep(10)
        payload = await build_hype_reality_payload()
        if payload:
            await broadcast(payload)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stream_binance_trades())
    asyncio.create_task(stream_binance_order_book())
    asyncio.create_task(emit_bull_bear_metrics())
    asyncio.create_task(emit_hype_reality_metrics())
    logger.info("Live Binance tasks started")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
