"""
Whale Detection Engine
Filters trades and identifies whale transactions
"""

import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)

class WhaleDetectionEngine:
    """
    Detects and analyzes whale trades
    A whale trade is defined as a transaction value > $500,000 USD
    """
    
    WHALE_THRESHOLD = 500_000  # $500k USD minimum
    
    def __init__(self):
        self.detected_whales: List[Dict] = []
        self.historical_patterns: defaultdict = defaultdict(list)
    
    def is_whale_trade(self, trade_value: float) -> bool:
        """Check if trade value exceeds whale threshold"""
        return trade_value >= self.WHALE_THRESHOLD
    
    def calculate_whale_score(self, trade_value: float) -> float:
        """
        Calculate whale magnitude score (0-1)
        Based on how much the trade exceeds the threshold
        """
        if not self.is_whale_trade(trade_value):
            return 0.0
        
        # Normalize: $500k = 0.1, $5M = 1.0
        score = min((trade_value - self.WHALE_THRESHOLD) / (5_000_000 - self.WHALE_THRESHOLD), 1.0)
        return max(score, 0.1)  # Minimum 0.1 for any whale
    
    def find_similar_patterns(
        self,
        trade_value: float,
        is_buy: bool,
        recent_trades: List[Dict[str, Any]],
        lookback_count: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Find similar whale patterns from recent history
        Returns up to 3 most similar previous trades
        """
        similar = []
        
        try:
            # Filter whale trades
            whale_trades = [
                t for t in recent_trades[-lookback_count:]
                if self.is_whale_trade(t['value']) and t['is_buy'] == is_buy
            ]
            
            # Score by similarity (value proximity)
            scored_trades = [
                {
                    'trade_id': t['trade_id'],
                    'timestamp': t['timestamp'].isoformat(),
                    'price': t['price'],
                    'value': t['value'],
                    'is_buy': t['is_buy'],
                    'similarity_score': 1.0 - (abs(t['value'] - trade_value) / max(t['value'], trade_value))
                }
                for t in whale_trades
            ]
            
            # Sort by similarity and return top 3
            similar = sorted(
                scored_trades,
                key=lambda x: x['similarity_score'],
                reverse=True
            )[:3]
        
        except Exception as e:
            logger.error(f"Error finding similar patterns: {e}")
        
        return similar
    
    def calculate_bull_bear_power(self, trades: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate market sentiment based on whale activity
        Analyzes buy vs sell whale volume over last 10 minutes
        
        Returns:
            bull_power: -1 (all sells) to 1 (all buys)
            momentum: Trend strength
        """
        if not trades:
            return {
                'net_buy_volume': 0,
                'net_sell_volume': 0,
                'bull_power': 0.0,
                'momentum': 0.0
            }
        
        try:
            buy_volume = 0
            sell_volume = 0
            
            for trade in trades:
                if self.is_whale_trade(trade['value']):
                    if trade['is_buy']:
                        buy_volume += trade['value']
                    else:
                        sell_volume += trade['value']
            
            total_volume = buy_volume + sell_volume
            
            if total_volume == 0:
                bull_power = 0.0
            else:
                # -1 (all sells) to 1 (all buys)
                bull_power = (buy_volume - sell_volume) / total_volume
            
            # Calculate momentum (trend strength)
            momentum = min(abs(bull_power) * (total_volume / 10_000_000), 1.0)
            
            return {
                'net_buy_volume': buy_volume,
                'net_sell_volume': sell_volume,
                'bull_power': round(bull_power, 4),
                'momentum': round(momentum, 4)
            }
        
        except Exception as e:
            logger.error(f"Error calculating bull/bear power: {e}")
            return {
                'net_buy_volume': 0,
                'net_sell_volume': 0,
                'bull_power': 0.0,
                'momentum': 0.0
            }
    
    def analyze_hype_vs_reality(self, sentiment_score: float, whale_volume: float) -> Dict[str, Any]:
        """
        Compare social sentiment vs actual whale activity
        
        Args:
            sentiment_score: -1 to 1 from sentiment API
            whale_volume: Total whale buy/sell volume
        
        Returns:
            Hype vs Reality analysis
        """
        # This would integrate with sentiment APIs
        # Placeholder implementation
        return {
            'sentiment_score': sentiment_score,
            'whale_volume_usd': whale_volume,
            'hype_reality_ratio': sentiment_score / max(whale_volume / 10_000_000, 0.1)
        }
    
    def record_whale_trade(self, trade: Dict[str, Any]):
        """Record detected whale trade for pattern analysis"""
        self.detected_whales.append(trade)
        
        # Keep only last 1000 whales
        if len(self.detected_whales) > 1000:
            self.detected_whales = self.detected_whales[-1000:]
    
    def get_latest_whales(self, count: int = 20) -> List[Dict]:
        """Get most recent detected whale trades"""
        return self.detected_whales[-count:]
