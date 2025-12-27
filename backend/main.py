"""
Whale Watcher Pro - Main FastAPI Application
Real-time cryptocurrency whale detection and visualization
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from collections import deque

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import websockets
from pydantic import BaseModel
from dotenv import load_dotenv

from services.binance_stream import BinanceWebSocketManager
from services.whale_detection import WhaleDetectionEngine
from services.external_api import ExternalServicesManager
from services.database import SupabaseManager
from services.alerts import AlertManager

# Throttling
TRADE_TICK_HZ = 20
DEPTH_HZ = 1
LABEL_HZ = 1

last_trade_emit = 0.0
last_depth_emit = 0.0

# Replay
replay_buffer = deque(maxlen=200_000)
replay_active = False
replay_speed = 10

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI application
app = FastAPI(
    title="Whale Watcher Pro API",
    description="Real-time cryptocurrency whale detection and visualization",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Pydantic Models
# ============================================================================

class TradeData(BaseModel):
    """Raw trade data from Binance"""
    event_time: int
    trade_id: int
    price: float
    quantity: float
    buyer_order_id: int
    seller_order_id: int
    trade_time: int
    is_buyer_maker: bool

class WhaleAlertPayload(BaseModel):
    """Whale trade alert"""
    trade_id: int
    timestamp: datetime
    price: float
    quantity: float
    trade_value: float
    is_buy: bool
    whale_score: float  # 0-1 based on magnitude
    similar_patterns: List[Dict[str, Any]] = []
    bull_bear_sentiment: float  # -1 to 1

class BullBearMetrics(BaseModel):
    """Bull vs Bear power calculation"""
    timestamp: datetime
    net_buy_volume: float
    net_sell_volume: float
    bull_power: float  # -1 to 1
    momentum: float

# ============================================================================
# Global State Management
# ============================================================================

class WebSocketConnectionManager:
    """Manage active WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

# Initialize components
manager = WebSocketConnectionManager()
binance_manager: Optional[BinanceWebSocketManager] = None
whale_engine: Optional[WhaleDetectionEngine] = None
external_services: Optional[ExternalServicesManager] = None
supabase_manager: Optional[SupabaseManager] = None
alert_manager: Optional[AlertManager] = None

# Trade history (rolling 60-minute window)
trade_history: deque = deque(maxlen=1000)

# ============================================================================
# Startup and Shutdown Events
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global binance_manager, whale_engine, external_services, supabase_manager, alert_manager
    
    logger.info("Starting Whale Watcher Pro...")
    
    try:
        # Initialize managers
        binance_manager = BinanceWebSocketManager()
        whale_engine = WhaleDetectionEngine()
        external_services = ExternalServicesManager()
        supabase_manager = SupabaseManager()
        alert_manager = AlertManager(external_services)
        
        # Start Binance stream in background
        asyncio.create_task(start_binance_stream())
        
        logger.info("All services initialized successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Whale Watcher Pro...")
    if binance_manager:
        await binance_manager.close()

# ============================================================================
# Background Tasks
# ============================================================================

async def start_binance_stream():
    """Main background task: stream Binance data and process whale trades"""
    logger.info("Starting Binance WebSocket stream...")
    
    while True:
        try:
            async for trade in binance_manager.stream_trades():
                # Process trade
                await process_trade(trade)
        except Exception as e:
            logger.error(f"Stream error: {e}, retrying in 5 seconds...")
            await asyncio.sleep(5)

async def process_trade(trade_data: dict):
    """
    Process incoming trade:
    1. Add to history
    2. Check if whale trade
    3. Broadcast if significant
    """
    try:
        trade_time = datetime.fromtimestamp(trade_data['trade_time'] / 1000)
        price = float(trade_data['price'])
        quantity = float(trade_data['quantity'])
        trade_value = price * quantity
        is_buy = not trade_data['is_buyer_maker']
        
        # Add to trade history
        trade_history.append({
            'timestamp': trade_time,
            'price': price,
            'quantity': quantity,
            'value': trade_value,
            'is_buy': is_buy,
            'trade_id': trade_data['trade_id']
        })

        now = datetime.utcnow().timestamp()

        if now - last_trade_emit >= 1 / TRADE_TICK_HZ:
            tick = {
                "type": "trade_tick",
                "data": {
                    "ts": trade_time.timestamp(),
                    "price": price,
                    "qty": quantity,
                    "side": "buy" if is_buy else "sell"
                }
            }
            await manager.broadcast(tick)
            replay_buffer.append({"ts": trade_time.timestamp(), "event": tick})
            last_trade_emit = now
        
        # Check if whale trade
        if whale_engine.is_whale_trade(trade_value):
            # Detect similar patterns
            similar_trades = whale_engine.find_similar_patterns(
                trade_value, is_buy, list(trade_history)[-100:]  # Last 100 trades
            )
            
            # Calculate sentiment
            bull_bear = whale_engine.calculate_bull_bear_power(list(trade_history)[-600:])  # 10 min
            whale_score = min(trade_value / 5_000_000, 1.0)  # Normalize to 5M
            
            # Create alert payload
            alert = WhaleAlertPayload(
                trade_id=trade_data['trade_id'],
                timestamp=trade_time,
                price=price,
                quantity=quantity,
                trade_value=trade_value,
                is_buy=is_buy,
                whale_score=whale_score,
                similar_patterns=similar_trades,
                bull_bear_sentiment=bull_bear['bull_power']
            )
            
            # Broadcast to all connected clients
            features = whale_engine.enrich_whale_event(
                trade_value=trade_value,
                is_buy=is_buy,
                price=price,
                recent_trades=list(trade_history),
                depth_snapshot=latest_depth
            )

            event = {
                "type": "whale_event",
                "data": {
                    "ts": trade_time.timestamp(),
                    "trade_id": trade_data["trade_id"],
                    "price": price,
                    "qty": quantity,
                    "notional": trade_value,
                    "side": "buy" if is_buy else "sell",
                    **features
                }
            }

            await manager.broadcast(event)
            replay_buffer.append({"ts": trade_time.timestamp(), "event": event})

            
            # Save to database
            await supabase_manager.insert_whale_trade(alert)
            
            # Send external alerts (Discord, Telegram)
            await alert_manager.send_alerts(alert)
            
            logger.info(f"🐋 WHALE DETECTED: {trade_value:,.2f} USD ({'BUY' if is_buy else 'SELL'})")
        
        # Periodically broadcast bull/bear metrics
        if len(trade_history) % 10 == 0:  # Every ~10 trades
            metrics = whale_engine.calculate_bull_bear_power(list(trade_history)[-600:])
            await manager.broadcast({
                'type': 'bull_bear_metrics',
                'data': metrics,
                'timestamp': datetime.utcnow().isoformat()
            })
    
    except Exception as e:
        logger.error(f"Error processing trade: {e}")

# ============================================================================
# REST API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Whale Watcher Pro",
        "version": "1.0.0",
        "connected_clients": len(manager.active_connections)
    }

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_connections": len(manager.active_connections),
        "trades_in_window": len(trade_history)
    }

@app.get("/api/whale-trades")
async def get_whale_trades(limit: int = 50):
    """Get recent whale trades from database"""
    try:
        trades = await supabase_manager.get_recent_whale_trades(limit)
        return {
            "success": True,
            "count": len(trades),
            "trades": trades
        }
    except Exception as e:
        logger.error(f"Error fetching whale trades: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/statistics")
async def get_statistics():
    """Get trading statistics"""
    if not trade_history:
        return {
            "success": True,
            "stats": {
                "total_trades": 0,
                "whale_trades": 0,
                "avg_price": 0,
                "high_price": 0,
                "low_price": 0
            }
        }
    
    prices = [t['price'] for t in trade_history]
    whale_count = len([t for t in trade_history if whale_engine.is_whale_trade(t['value'])])
    
    return {
        "success": True,
        "stats": {
            "total_trades": len(trade_history),
            "whale_trades": whale_count,
            "avg_price": sum(prices) / len(prices),
            "high_price": max(prices),
            "low_price": min(prices),
            "volume_24h": sum([t['value'] for t in trade_history])
        }
    }

@app.get("/api/chart-data")
async def get_chart_data(minutes: int = 60):
    """Get aggregated chart data for frontend"""
    if not trade_history:
        return {"success": True, "data": []}
    
    # Aggregate trades by minute
    aggregated = {}
    for trade in trade_history:
        minute_key = trade['timestamp'].replace(second=0, microsecond=0)
        if minute_key not in aggregated:
            aggregated[minute_key] = {
                'timestamp': minute_key.isoformat(),
                'open': trade['price'],
                'high': trade['price'],
                'low': trade['price'],
                'close': trade['price'],
                'volume': 0,
                'whale_volume': 0
            }
        
        agg = aggregated[minute_key]
        agg['high'] = max(agg['high'], trade['price'])
        agg['low'] = min(agg['low'], trade['price'])
        agg['close'] = trade['price']
        agg['volume'] += trade['quantity']
        
        if whale_engine.is_whale_trade(trade['value']):
            agg['whale_volume'] += trade['quantity']
    
    return {
        "success": True,
        "data": sorted(aggregated.values(), key=lambda x: x['timestamp'])
    }

# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws/trades")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time trade updates"""
    await manager.connect(websocket)
    
    try:
        # Send initial data on connection
        await websocket.send_json({
            'type': 'connection',
            'message': 'Connected to Whale Watcher Pro',
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and listen for messages
        while True:
            data = await websocket.receive_text()
            
            # Echo received message (can be extended for client commands)
            if data == "ping":
                await websocket.send_json({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
