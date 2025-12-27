"""
Whale Detection Engine
Filters trades and identifies whale transactions
Includes institutional execution detection.
"""

from __future__ import annotations

import logging
import math
import statistics
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Deque, Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

EPS = 1e-9


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def median(values: List[float]) -> float:
    if not values:
        return 0.0
    values_sorted = sorted(values)
    mid = len(values_sorted) // 2
    if len(values_sorted) % 2 == 1:
        return values_sorted[mid]
    return 0.5 * (values_sorted[mid - 1] + values_sorted[mid])


@dataclass
class TradePoint:
    ts: float
    price: float
    qty: float
    quote_qty: float
    aggressor_side: str
    signed_quote: float
    log_quote: float
    bucket: int

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
    
    def calculate_bull_bear_power(
        self,
        trades: List[Dict[str, Any]],
        whales_only: bool = True,
    ) -> Dict[str, float]:
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
                if whales_only and not self.is_whale_trade(trade['value']):
                    continue
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


class InstitutionalExecutionDetector:
    """
    Detects institutional execution patterns: slicing, absorption, and aggression.
    """

    def __init__(self, symbol: str, low_liquidity: bool = False) -> None:
        self.symbol = symbol
        self.low_liquidity = low_liquidity

        self.trades_10s: Deque[TradePoint] = deque()
        self.trades_60s: Deque[TradePoint] = deque()
        self.bucket_history: Deque[Tuple[float, float, float]] = deque(maxlen=30)

        self.sum_quote_10s = 0.0
        self.sum_signed_10s = 0.0

        self.sum_quote_60s = 0.0
        self.sum_signed_60s = 0.0
        self.count_60s = 0
        self.sum_log_60s = 0.0
        self.sum_sq_log_60s = 0.0
        self.side_counts_60s = {"BUY": 0, "SELL": 0}

        self.bucket_counts: Dict[Tuple[str, int], int] = defaultdict(int)
        self.bucket_times: Dict[Tuple[str, int], Deque[float]] = defaultdict(deque)

        self.last_eval_ts = 0.0
        self.last_bucket_id: Optional[int] = None

        self.consecutive_strong = 0
        self.consecutive_likely = 0

    def ingest_trade(self, price: float, qty: float, is_buyer_maker: bool, ts_ms: int) -> None:
        quote_qty = price * qty
        aggressor_side = "SELL" if is_buyer_maker else "BUY"
        signed_quote = quote_qty if aggressor_side == "BUY" else -quote_qty
        log_quote = math.log(max(quote_qty, EPS))
        bucket = int(math.floor(math.log10(max(quote_qty, EPS)) / 0.25))

        trade = TradePoint(
            ts=ts_ms / 1000.0,
            price=price,
            qty=qty,
            quote_qty=quote_qty,
            aggressor_side=aggressor_side,
            signed_quote=signed_quote,
            log_quote=log_quote,
            bucket=bucket,
        )

        self.trades_10s.append(trade)
        self.sum_quote_10s += quote_qty
        self.sum_signed_10s += signed_quote

        self.trades_60s.append(trade)
        self.sum_quote_60s += quote_qty
        self.sum_signed_60s += signed_quote
        self.count_60s += 1
        self.sum_log_60s += log_quote
        self.sum_sq_log_60s += log_quote * log_quote
        self.side_counts_60s[aggressor_side] += 1

        key = (aggressor_side, bucket)
        self.bucket_counts[key] += 1
        self.bucket_times[key].append(trade.ts)

        self._evict_old(trade.ts)

    def maybe_evaluate(self) -> Optional[Dict[str, object]]:
        now = time.time()
        if now - self.last_eval_ts < 1.0:
            return None
        self.last_eval_ts = now
        return self._evaluate(now)

    def _evict_old(self, now: float) -> None:
        cutoff_10s = now - 10.0
        cutoff_60s = now - 60.0

        while self.trades_10s and self.trades_10s[0].ts < cutoff_10s:
            old = self.trades_10s.popleft()
            self.sum_quote_10s -= old.quote_qty
            self.sum_signed_10s -= old.signed_quote

        while self.trades_60s and self.trades_60s[0].ts < cutoff_60s:
            old = self.trades_60s.popleft()
            self.sum_quote_60s -= old.quote_qty
            self.sum_signed_60s -= old.signed_quote
            self.count_60s -= 1
            self.sum_log_60s -= old.log_quote
            self.sum_sq_log_60s -= old.log_quote * old.log_quote
            self.side_counts_60s[old.aggressor_side] -= 1

            key = (old.aggressor_side, old.bucket)
            if self.bucket_counts.get(key):
                self.bucket_counts[key] -= 1
            if self.bucket_times.get(key):
                times = self.bucket_times[key]
                if times and times[0] == old.ts:
                    times.popleft()

    def _evaluate(self, now: float) -> Optional[Dict[str, object]]:
        if not self.trades_10s:
            return None

        trade_count_10s = len(self.trades_10s)

        prices_10s = [t.price for t in self.trades_10s]
        price_open_10s = prices_10s[0]
        price_last_10s = prices_10s[-1]
        price_high_10s = max(prices_10s)
        price_low_10s = min(prices_10s)

        total_quote_10s = self.sum_quote_10s
        total_quote_60s = self.sum_quote_60s
        signed_flow_10s = self.sum_signed_10s
        signed_flow_60s = self.sum_signed_60s

        range_10s = (price_high_10s - price_low_10s) / max(price_last_10s, EPS)

        bucket_id = int(now // 10)
        if self.last_bucket_id is None or bucket_id != self.last_bucket_id:
            move_10s = abs(price_last_10s - price_open_10s) / max(price_open_10s, EPS)
            impact = move_10s / max(total_quote_10s, EPS)
            self.bucket_history.append((now, total_quote_10s, impact))
            self.last_bucket_id = bucket_id

        baseline_volumes = [b[1] for b in self.bucket_history]
        baseline_impacts = [b[2] for b in self.bucket_history if b[2] > 0]
        median_total_quote_10s = median(baseline_volumes) or total_quote_10s
        median_impact_10s = median(baseline_impacts) or (
            abs(price_last_10s - price_open_10s) / max(price_open_10s, EPS) / max(total_quote_10s, EPS)
        )

        max_trade_quote_10s = max(t.quote_qty for t in self.trades_10s)
        if self.count_60s > 5:
            mean_log = self.sum_log_60s / max(self.count_60s, 1)
            variance = (self.sum_sq_log_60s / max(self.count_60s, 1)) - (mean_log * mean_log)
            std_log = math.sqrt(max(variance, 0.0))
            size_z = (math.log(max(max_trade_quote_10s, EPS)) - mean_log) / (std_log + EPS)
            size_score = sigmoid((size_z - 2.0) / 1.0)
        else:
            sample_quotes = [t.quote_qty for t in list(self.trades_60s)[:500]]
            median_quote = median(sample_quotes)
            size_score = clamp(max_trade_quote_10s / max(8 * median_quote, EPS))

        dominant_side = "BUY" if self.side_counts_60s["BUY"] >= self.side_counts_60s["SELL"] else "SELL"
        max_bucket_count = 0
        dominant_bucket = None
        for (side, bucket), count in self.bucket_counts.items():
            if side != dominant_side:
                continue
            if count > max_bucket_count:
                max_bucket_count = count
                dominant_bucket = bucket

        repetition_score = clamp((max_bucket_count - 6) / 12.0)

        periodicity_score = 0.0
        if dominant_bucket is not None:
            times = list(self.bucket_times.get((dominant_side, dominant_bucket), []))
            if len(times) >= 4:
                intervals = [b - a for a, b in zip(times, times[1:]) if b > a]
                if intervals:
                    mean_interval = sum(intervals) / len(intervals)
                    if mean_interval > 0:
                        std_interval = statistics.pstdev(intervals)
                        cv = std_interval / mean_interval
                        periodicity_score = clamp((0.6 - cv) / 0.6)

        slicing_score = 0.6 * repetition_score + 0.4 * periodicity_score

        vol_norm = total_quote_10s / max(median_total_quote_10s, EPS)
        volume_burst_score = clamp((math.log(max(vol_norm, EPS)) - math.log(2)) / math.log(8))
        tight_range_score = clamp((0.002 - range_10s) / 0.002)
        absorption_score = volume_burst_score * tight_range_score

        flow_ratio_10s = abs(signed_flow_10s) / max(total_quote_10s, EPS)
        flow_ratio_60s = abs(signed_flow_60s) / max(total_quote_60s, EPS)
        aggression_score = 0.5 * clamp((flow_ratio_10s - 0.55) / 0.35) + 0.5 * clamp(
            (flow_ratio_60s - 0.55) / 0.35
        )

        move_10s = abs(price_last_10s - price_open_10s) / max(price_open_10s, EPS)
        impact = move_10s / max(total_quote_10s, EPS)
        low_impact_score = clamp((median_impact_10s - impact) / max(median_impact_10s, EPS))
        impact_anomaly_score = volume_burst_score * low_impact_score

        score_raw = (
            0.20 * size_score
            + 0.25 * slicing_score
            + 0.25 * absorption_score
            + 0.20 * aggression_score
            + 0.10 * impact_anomaly_score
        )
        score_raw = clamp(score_raw)
        score = round(100 * score_raw)

        if trade_count_10s < 20:
            self._reset_persistence()
            return None
        if range_10s > 0.01:
            self._reset_persistence()
            return None
        if max_trade_quote_10s > 0.8 * max(total_quote_10s, EPS) and slicing_score < 0.2:
            self._reset_persistence()
            return None

        if self.low_liquidity:
            strong_threshold = 80
            likely_threshold = 65
        else:
            strong_threshold = 75
            likely_threshold = 60

        label = None
        if score >= strong_threshold:
            self.consecutive_strong += 1
            self.consecutive_likely += 1
        elif score >= likely_threshold:
            self.consecutive_likely += 1
            self.consecutive_strong = 0
        else:
            self._reset_persistence()

        if score >= strong_threshold and self.consecutive_strong >= 3:
            label = "INSTITUTIONAL_EXECUTION_STRONG"
        elif score >= likely_threshold and self.consecutive_likely >= 5:
            label = "INSTITUTIONAL_EXECUTION_LIKELY"
        elif size_score >= 0.9 and max(slicing_score, absorption_score, aggression_score, impact_anomaly_score) < 0.2:
            label = "LARGE_TRADE_ONLY"

        if not label:
            return None

        consecutive_hits = max(self.consecutive_strong, self.consecutive_likely)
        persistence_factor = clamp(consecutive_hits / 5.0)
        confidence = clamp(0.5 * score_raw + 0.5 * persistence_factor)

        direction = "BUY" if signed_flow_60s > 0 else "SELL"

        return {
            "symbol": self.symbol,
            "side": direction,
            "label": label,
            "score": score,
            "confidence": round(confidence, 3),
            "features": {
                "size_score": round(size_score, 3),
                "slicing_score": round(slicing_score, 3),
                "absorption_score": round(absorption_score, 3),
                "aggression_score": round(aggression_score, 3),
                "impact_anomaly_score": round(impact_anomaly_score, 3),
                "flow_ratio_10s": round(flow_ratio_10s, 3),
                "flow_ratio_60s": round(flow_ratio_60s, 3),
                "range_10s": round(range_10s, 6),
                "vol_10s": round(total_quote_10s, 2),
            },
            "ts": datetime.utcnow().isoformat(),
        }

    def _reset_persistence(self) -> None:
        self.consecutive_strong = 0
        self.consecutive_likely = 0
