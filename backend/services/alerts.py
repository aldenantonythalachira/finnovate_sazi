"""
Alert Manager
Handles sending alerts to external services
"""

import asyncio
import logging
from typing import Dict, Any

from services.external_api import ExternalServicesManager

logger = logging.getLogger(__name__)

class AlertManager:
    """
    Manages sending whale alerts to multiple channels:
    - Discord webhooks
    - Telegram bot
    - Email notifications (future)
    """
    
    def __init__(self, external_services: ExternalServicesManager):
        self.external_services = external_services
        self.alert_cooldown = {}  # Trade ID -> last alert timestamp
        self.cooldown_period = 5  # seconds between duplicate alerts
    
    async def send_alerts(self, whale_alert: Dict[str, Any]) -> bool:
        """
        Send whale alert to all configured channels
        Returns True if at least one alert was sent successfully
        """
        try:
            # Create concurrent tasks for all alert channels
            tasks = [
                self.external_services.send_discord_alert(whale_alert),
                self.external_services.send_telegram_alert(whale_alert)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check if at least one alert was sent
            success = any(r is True for r in results)
            
            if success:
                logger.info(f"Alerts sent for whale trade {whale_alert['trade_id']}")
            
            return success
        
        except Exception as e:
            logger.error(f"Error sending alerts: {e}")
            return False
    
    def check_alert_cooldown(self, trade_id: int) -> bool:
        """Check if trade ID has been alerted recently"""
        import time
        
        current_time = time.time()
        
        if trade_id in self.alert_cooldown:
            if current_time - self.alert_cooldown[trade_id] < self.cooldown_period:
                return False
        
        self.alert_cooldown[trade_id] = current_time
        return True
