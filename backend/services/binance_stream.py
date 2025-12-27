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
        self.reconnect_delay = 1  # Start with 1 second
        self.max_reconnect_delay = 60  # Max 60 seconds
    
    async def connect(self):
        """Establish WebSocket connection"""
        try:
            self.websocket = await websockets.connect(self.ws_url)
            self.reconnect_delay = 1  # Reset on successful connection
            logger.info(f"Connected to Binance stream: {self.symbol}")
            return True
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            return False
    
    async def disconnect(self):
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            logger.info("Disconnected from Binance stream")
    
    async def stream_trades(self) -> AsyncGenerator:
        """
        Stream trades from Binance
        Yields raw trade data dictionaries
        """
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
                        
                        # Parse Binance trade format
                        trade = {
                            'event_type': data.get('e'),
                            'event_time': data.get('E'),
                            'symbol': data.get('s'),
                            'trade_id': data.get('t'),
                            'price': data.get('p'),
                            'quantity': data.get('q'),
                            'buyer_order_id': data.get('b'),
                            'seller_order_id': data.get('a'),
                            'trade_time': data.get('T'),
                            'is_buyer_maker': data.get('m'),
                            'ignore': data.get('M')
                        }
                        
                        yield trade
                    
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON parse error: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"Error processing trade: {e}")
                        continue
            
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Connection closed, attempting reconnect...")
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
            
            except Exception as e:
                logger.error(f"Stream error: {e}")
                await self.disconnect()
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
    
    async def close(self):
        """Close connection gracefully"""
        await self.disconnect()
