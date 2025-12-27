"""
External Services Manager
Integrates with CoinGecko API, Discord, Telegram, and Sentiment APIs
"""

import logging
import os
from typing import Dict, Any, Optional

import httpx
import aiohttp

logger = logging.getLogger(__name__)

class ExternalServicesManager:
    """
    Manages integrations with external APIs:
    - CoinGecko (Bitcoin metadata)
    - Discord Webhooks
    - Telegram Bot
    - Sentiment APIs
    """
    
    def __init__(self):
        self.coingecko_base = "https://api.coingecko.com/api/v3"
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK_URL", "")
        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.sentiment_api_key = os.getenv("SENTIMENT_API_KEY", "")
    
    async def get_bitcoin_metadata(self) -> Dict[str, Any]:
        """
        Fetch Bitcoin metadata from CoinGecko
        Includes current price, market cap, 24h change, etc.
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.coingecko_base}/simple/price"
                params = {
                    'ids': 'bitcoin',
                    'vs_currencies': 'usd',
                    'include_market_cap': 'true',
                    'include_24hr_vol': 'true',
                    'include_24hr_change': 'true',
                    'include_last_updated_at': 'true'
                }
                
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get('bitcoin', {})
                    else:
                        logger.error(f"CoinGecko API error: {resp.status}")
                        return {}
        except Exception as e:
            logger.error(f"Error fetching Bitcoin metadata: {e}")
            return {}
    
    async def get_bitcoin_logo(self) -> Optional[str]:
        """Fetch Bitcoin logo URL"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.coingecko_base}/coins/bitcoin"
                params = {'localization': 'false'}
                
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get('image', {}).get('large')
                    return None
        except Exception as e:
            logger.error(f"Error fetching Bitcoin logo: {e}")
            return None
    
    async def send_discord_alert(self, whale_alert: Dict[str, Any]) -> bool:
        """Send whale alert to Discord webhook"""
        if not self.discord_webhook:
            logger.warning("Discord webhook not configured")
            return False
        
        try:
            embed = {
                'title': '🐋 WHALE DETECTED!',
                'description': f"{'🟢 BUY' if whale_alert['is_buy'] else '🔴 SELL'} Order Detected",
                'color': 0x00ff00 if whale_alert['is_buy'] else 0xff0000,
                'fields': [
                    {
                        'name': 'Amount (USD)',
                        'value': f"${whale_alert['trade_value']:,.2f}",
                        'inline': True
                    },
                    {
                        'name': 'Price per BTC',
                        'value': f"${whale_alert['price']:,.2f}",
                        'inline': True
                    },
                    {
                        'name': 'Quantity (BTC)',
                        'value': f"{whale_alert['quantity']:.4f}",
                        'inline': True
                    },
                    {
                        'name': 'Whale Score',
                        'value': f"{whale_alert['whale_score']:.2%}",
                        'inline': True
                    },
                    {
                        'name': 'Bull/Bear Sentiment',
                        'value': f"{whale_alert['bull_bear_sentiment']:+.2f}",
                        'inline': True
                    }
                ],
                'timestamp': whale_alert['timestamp'].isoformat()
            }
            
            payload = {'embeds': [embed]}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.discord_webhook,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status in [200, 204]:
                        logger.info(f"Discord alert sent for trade {whale_alert['trade_id']}")
                        return True
                    else:
                        logger.error(f"Discord API error: {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Error sending Discord alert: {e}")
            return False
    
    async def send_telegram_alert(self, whale_alert: Dict[str, Any]) -> bool:
        """Send whale alert to Telegram"""
        if not self.telegram_bot_token or not self.telegram_chat_id:
            logger.warning("Telegram not configured")
            return False
        
        try:
            direction = "🟢 BUY" if whale_alert['is_buy'] else "🔴 SELL"
            message = f"""
🐋 <b>WHALE ALERT!</b>

{direction} Order Detected

<b>Amount:</b> ${whale_alert['trade_value']:,.2f} USD
<b>Price:</b> ${whale_alert['price']:,.2f}
<b>Quantity:</b> {whale_alert['quantity']:.4f} BTC
<b>Whale Score:</b> {whale_alert['whale_score']:.1%}
<b>Bull Power:</b> {whale_alert['bull_bear_sentiment']:+.2f}
<b>Time:</b> {whale_alert['timestamp'].isoformat()}
            """
            
            url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
            payload = {
                'chat_id': self.telegram_chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        logger.info(f"Telegram alert sent for trade {whale_alert['trade_id']}")
                        return True
                    else:
                        logger.error(f"Telegram API error: {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Error sending Telegram alert: {e}")
            return False
    
    async def get_sentiment_score(self, symbol: str = "bitcoin") -> Optional[float]:
        """
        Fetch sentiment score from sentiment API
        Returns score from -1 (very negative) to 1 (very positive)
        """
        if not self.sentiment_api_key:
            logger.warning("Sentiment API not configured")
            return None
        
        try:
            # This is a placeholder - integrate with actual sentiment API
            # Popular options: Santiment, Lunarcrush, Glassnode
            async with aiohttp.ClientSession() as session:
                # Example with a hypothetical sentiment API
                url = "https://sentiment-api.example.com/sentiment"
                params = {
                    'symbol': symbol,
                    'api_key': self.sentiment_api_key
                }
                
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get('sentiment_score')
            
            return None
        except Exception as e:
            logger.warning(f"Error fetching sentiment score: {e}")
            return None
