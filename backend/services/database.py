"""
Supabase Database Manager
Handles all database operations for whale trades, history, and user preferences
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

from supabase import create_client, Client

logger = logging.getLogger(__name__)

class SupabaseManager:
    """
    Manages Supabase (PostgreSQL) database operations
    Tables:
    - whale_trades: Detected whale transactions
    - trade_history: Historical trade data (rolling 60 mins)
    - user_alerts: User alert preferences
    - sentiment_data: Social sentiment scores
    - whale_patterns: Similar trade patterns for echo prediction
    """
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_KEY", "")
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not configured")
            self.client: Optional[Client] = None
        else:
            try:
                self.client = create_client(supabase_url, supabase_key)
                logger.info("Supabase client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase: {e}")
                self.client = None
    
    async def insert_whale_trade(self, whale_alert: Dict[str, Any]) -> bool:
        """Insert detected whale trade into database"""
        if not self.client:
            logger.warning("Supabase not initialized")
            return False
        
        try:
            data = {
                'trade_id': whale_alert['trade_id'],
                'timestamp': whale_alert['timestamp'].isoformat(),
                'price': whale_alert['price'],
                'quantity': whale_alert['quantity'],
                'trade_value': whale_alert['trade_value'],
                'is_buy': whale_alert['is_buy'],
                'whale_score': whale_alert['whale_score'],
                'bull_bear_sentiment': whale_alert['bull_bear_sentiment'],
                'similar_patterns': whale_alert.get('similar_patterns', [])
            }
            
            response = self.client.table('whale_trades').insert(data).execute()
            
            if response.data:
                logger.info(f"Whale trade inserted: {whale_alert['trade_id']}")
                return True
            else:
                logger.error(f"Failed to insert whale trade: {response}")
                return False
        
        except Exception as e:
            logger.error(f"Error inserting whale trade: {e}")
            return False
    
    async def insert_trade_history(self, trade: Dict[str, Any]) -> bool:
        """Insert trade into rolling history"""
        if not self.client:
            return False
        
        try:
            data = {
                'trade_id': trade['trade_id'],
                'timestamp': trade['timestamp'].isoformat(),
                'price': trade['price'],
                'quantity': trade['quantity'],
                'value': trade['value'],
                'is_buy': trade['is_buy']
            }
            
            self.client.table('trade_history').insert(data).execute()
            return True
        
        except Exception as e:
            logger.error(f"Error inserting trade history: {e}")
            return False
    
    async def get_recent_whale_trades(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch recent whale trades"""
        if not self.client:
            return []
        
        try:
            response = self.client.table('whale_trades') \
                .select('*') \
                .order('timestamp', desc=True) \
                .limit(limit) \
                .execute()
            
            return response.data if response.data else []
        
        except Exception as e:
            logger.error(f"Error fetching whale trades: {e}")
            return []
    
    async def get_trade_history(
        self,
        minutes: int = 60,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Fetch trade history for a time window"""
        if not self.client:
            return []
        
        try:
            # This would typically use a time range filter
            response = self.client.table('trade_history') \
                .select('*') \
                .order('timestamp', desc=True) \
                .limit(limit) \
                .execute()
            
            return response.data if response.data else []
        
        except Exception as e:
            logger.error(f"Error fetching trade history: {e}")
            return []
    
    async def get_whale_trades_by_type(
        self,
        is_buy: bool,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Fetch whale trades filtered by buy/sell"""
        if not self.client:
            return []
        
        try:
            response = self.client.table('whale_trades') \
                .select('*') \
                .eq('is_buy', is_buy) \
                .order('timestamp', desc=True) \
                .limit(limit) \
                .execute()
            
            return response.data if response.data else []
        
        except Exception as e:
            logger.error(f"Error fetching whale trades by type: {e}")
            return []
    
    async def insert_sentiment_data(
        self,
        timestamp: datetime,
        sentiment_score: float,
        source: str
    ) -> bool:
        """Insert sentiment data"""
        if not self.client:
            return False
        
        try:
            data = {
                'timestamp': timestamp.isoformat(),
                'sentiment_score': sentiment_score,
                'source': source
            }
            
            self.client.table('sentiment_data').insert(data).execute()
            return True
        
        except Exception as e:
            logger.error(f"Error inserting sentiment data: {e}")
            return False
    
    async def get_recent_sentiment(self, hours: int = 1) -> Optional[float]:
        """Get most recent sentiment score"""
        if not self.client:
            return None
        
        try:
            response = self.client.table('sentiment_data') \
                .select('sentiment_score') \
                .order('timestamp', desc=True) \
                .limit(1) \
                .execute()
            
            if response.data:
                return response.data[0]['sentiment_score']
            return None
        
        except Exception as e:
            logger.error(f"Error fetching sentiment: {e}")
            return None
    
    async def store_user_preference(
        self,
        user_id: str,
        alert_type: str,
        enabled: bool
    ) -> bool:
        """Store user alert preferences"""
        if not self.client:
            return False
        
        try:
            data = {
                'user_id': user_id,
                'alert_type': alert_type,
                'enabled': enabled,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Upsert (update or insert)
            self.client.table('user_alerts') \
                .upsert(data) \
                .execute()
            
            return True
        
        except Exception as e:
            logger.error(f"Error storing user preference: {e}")
            return False
    
    async def get_user_preferences(self, user_id: str) -> Dict[str, bool]:
        """Get user alert preferences"""
        if not self.client:
            return {}
        
        try:
            response = self.client.table('user_alerts') \
                .select('*') \
                .eq('user_id', user_id) \
                .execute()
            
            if response.data:
                return {item['alert_type']: item['enabled'] for item in response.data}
            return {}
        
        except Exception as e:
            logger.error(f"Error fetching user preferences: {e}")
            return {}
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics"""
        if not self.client:
            return {}
        
        try:
            whales = self.client.table('whale_trades').select('count').execute()
            buys = self.client.table('whale_trades').select('count').eq('is_buy', True).execute()
            sells = self.client.table('whale_trades').select('count').eq('is_buy', False).execute()
            
            return {
                'total_whales': whales.count if hasattr(whales, 'count') else 0,
                'total_buys': buys.count if hasattr(buys, 'count') else 0,
                'total_sells': sells.count if hasattr(sells, 'count') else 0
            }
        
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return {}
