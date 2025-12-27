"""
Binance WebSocket Stream Manager
Handles persistent connection to Binance public WebSocket
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import websockets

logger = logging.getLogger(__name__)

class BinanceWebSocketManager:
    """
    Manages WebSocket connection to Binance public stream
    Streams real-time trade data for BTC/USDT
    """

    BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@trade"

    def __init__(self, symbol: str = "btcusdt"):
        self.symbol = symbol
        self.ws_url = f"wss://stream.binance.com:9443/ws/{symbol}@trade"
        self.websocket = None
        self.reconnect_delay = 1
        self.max_reconnect_delay = 60

    async def connect(self) -> bool:
        """Establish WebSocket connection"""
        try:
            self.websocket = await websockets.connect(self.ws_url)
            self.reconnect_delay = 1
            logger.info("Connected to Binance trade stream: %s", self.symbol)
            return True
        except Exception as exc:
            logger.error("Trade stream connection failed: %s", exc)
            return False

    async def disconnect(self) -> None:
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("Disconnected from Binance trade stream")

    async def stream_trades(self) -> AsyncGenerator:
        """Stream trades from Binance"""
        while True:
            try:
                if not self.websocket:
                    if not await self.connect():
                        await asyncio.sleep(self.reconnect_delay)
                        self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
                        continue

                async for message in self.websocket:
                    try:
                        data = json.loads(message)
                        trade = {
                            "event_type": data.get("e"),
                            "event_time": data.get("E"),
                            "symbol": data.get("s"),
                            "trade_id": data.get("t"),
                            "price": data.get("p"),
                            "quantity": data.get("q"),
                            "buyer_order_id": data.get("b"),
                            "seller_order_id": data.get("a"),
                            "trade_time": data.get("T"),
                            "is_buyer_maker": data.get("m"),
                            "ignore": data.get("M"),
                        }

                        yield trade

                    except json.JSONDecodeError as exc:
                        logger.error("Trade JSON parse error: %s", exc)
                        continue
                    except Exception as exc:
                        logger.error("Error processing trade: %s", exc)
                        continue

            except websockets.exceptions.ConnectionClosed:
                logger.warning("Trade connection closed, attempting reconnect...")
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

            except Exception as exc:
                logger.error("Trade stream error: %s", exc)
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

    async def close(self) -> None:
        """Close connection gracefully"""
        await self.disconnect()


class BinanceDepthStreamManager:
    """
    Manages WebSocket connection to Binance order book depth stream
    Streams partial order book data (top levels)
    """

    def __init__(self, symbol: str = "btcusdt", depth_level: int = 20):
        self.symbol = symbol
        self.depth_level = depth_level
        self.ws_url = f"wss://stream.binance.com:9443/ws/{symbol}@depth{depth_level}@100ms"
        self.websocket = None
        self.reconnect_delay = 1
        self.max_reconnect_delay = 60

    async def connect(self) -> bool:
        """Establish WebSocket connection"""
        try:
            self.websocket = await websockets.connect(self.ws_url)
            self.reconnect_delay = 1
            logger.info("Connected to Binance depth stream: %s", self.symbol)
            return True
        except Exception as exc:
            logger.error("Depth stream connection failed: %s", exc)
            return False

    async def disconnect(self) -> None:
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("Disconnected from Binance depth stream")

    async def stream_depth(self) -> AsyncGenerator:
        """Stream order book depth from Binance"""
        while True:
            try:
                if not self.websocket:
                    if not await self.connect():
                        await asyncio.sleep(self.reconnect_delay)
                        self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
                        continue

                async for message in self.websocket:
                    try:
                        data = json.loads(message)
                        depth = {
                            "last_update_id": data.get("lastUpdateId"),
                            "bids": data.get("bids", []),
                            "asks": data.get("asks", []),
                        }

                        yield depth

                    except json.JSONDecodeError as exc:
                        logger.error("Depth JSON parse error: %s", exc)
                        continue
                    except Exception as exc:
                        logger.error("Error processing depth update: %s", exc)
                        continue

            except websockets.exceptions.ConnectionClosed:
                logger.warning("Depth connection closed, attempting reconnect...")
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

            except Exception as exc:
                logger.error("Depth stream error: %s", exc)
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

    async def close(self) -> None:
        """Close connection gracefully"""
        await self.disconnect()
