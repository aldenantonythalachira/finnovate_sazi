"""
Whale Watcher Pro - Simplified Mock API Server
For development without complex dependencies
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from datetime import datetime, timedelta
import random
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Whale Watcher Pro API",
    description="Real-time cryptocurrency whale detection",
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

# Generate mock data
def generate_whale_alert():
    return {
        "trade_id": random.randint(1000000, 9999999),
        "timestamp": datetime.now().isoformat(),
        "price": random.uniform(40000, 50000),
        "quantity": random.uniform(1, 50),
        "trade_value": random.uniform(500000, 2500000),
        "is_buy": random.choice([True, False]),
        "whale_score": random.uniform(0.5, 1.0),
        "bull_bear_sentiment": random.uniform(-1, 1),
        "similar_patterns": [
            {
                "pattern_id": f"PAT-{random.randint(1000, 9999)}",
                "similarity_score": random.uniform(0.7, 0.99),
                "timestamp": (datetime.now() - timedelta(minutes=random.randint(1, 120))).isoformat(),
                "price_at_pattern": random.uniform(40000, 50000)
            }
            for _ in range(random.randint(1, 3))
        ]
    }

def generate_chart_data():
    now = datetime.now()
    data = []
    for i in range(60):
        timestamp = (now - timedelta(minutes=i)).isoformat()
        base_price = 45000 + random.uniform(-2000, 2000)
        data.insert(0, {
            "timestamp": timestamp,
            "open": base_price,
            "high": base_price + random.uniform(0, 500),
            "low": base_price - random.uniform(0, 500),
            "close": base_price + random.uniform(-500, 500),
            "volume": random.uniform(100, 500),
            "whale_volume": random.uniform(10, 100)
        })
    return data

# REST Endpoints
@app.get("/")
async def health_check():
    return {"status": "ok", "message": "Whale Watcher Pro API is running"}

@app.get("/api/health")
async def health_status():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "binance_connected": True,
        "database_connected": True
    }

@app.get("/api/whale-trades")
async def get_whale_trades(limit: int = 50):
    trades = [generate_whale_alert() for _ in range(min(limit, 50))]
    return {"trades": trades, "count": len(trades)}

@app.get("/api/statistics")
async def get_statistics():
    return {
        "total_whale_trades": random.randint(100, 500),
        "total_volume_24h": random.uniform(1000000, 5000000),
        "average_trade_value": random.uniform(500000, 1500000),
        "bull_power": random.uniform(-1, 1),
        "bear_power": random.uniform(-1, 1),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/chart-data")
async def get_chart_data(minutes: int = 60):
    return {"data": generate_chart_data(), "period_minutes": minutes}

# Track connected clients
connected_clients = set()

# WebSocket endpoint for Socket.io fallback
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info("Client connected via WebSocket")
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to Whale Watcher Pro",
            "timestamp": datetime.now().isoformat()
        })
        
        while True:
            # Keep connection alive
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        connected_clients.discard(websocket)

# Background task to emit real-time updates
async def emit_realtime_updates():
    while True:
        try:
            await asyncio.sleep(random.uniform(3, 5))
            
            # Generate whale alert
            alert = generate_whale_alert()
            alert["type"] = "whale_alert"
            
            # Send to all connected WebSocket clients
            for client in list(connected_clients):
                try:
                    await client.send_json(alert)
                except:
                    connected_clients.discard(client)
            
            # Send bull/bear metrics occasionally
            if random.random() > 0.6:
                metrics = {
                    "type": "bull_bear_metrics",
                    "net_buy_volume": random.uniform(1000, 5000),
                    "net_sell_volume": random.uniform(1000, 5000),
                    "bull_power": random.uniform(-1, 1),
                    "momentum": random.uniform(-1, 1),
                    "timestamp": datetime.now().isoformat()
                }
                for client in list(connected_clients):
                    try:
                        await client.send_json(metrics)
                    except:
                        connected_clients.discard(client)
                        
        except Exception as e:
            logger.error(f"Error in realtime updates: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(emit_realtime_updates())
    logger.info("Real-time updates task started")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
