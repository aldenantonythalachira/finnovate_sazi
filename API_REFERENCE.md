# Whale Watcher Pro - API Reference

## Base URL

```
http://localhost:8000
```

## Authentication

Currently no authentication required (add with JWT tokens for production).

---

## REST API Endpoints

### Health & Status

#### GET `/`
Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "running",
  "service": "Whale Watcher Pro",
  "version": "1.0.0",
  "connected_clients": 5
}
```

#### GET `/api/health`
Detailed health check with metrics.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "active_connections": 5,
  "trades_in_window": 847
}
```

---

### Whale Trades

#### GET `/api/whale-trades`
Fetch recent whale trades from database.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 50 | Number of trades to return |

**Example:**
```
GET /api/whale-trades?limit=100
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "trades": [
    {
      "id": 1001,
      "trade_id": 587654321,
      "timestamp": "2024-01-15T10:25:30Z",
      "price": 42500.50,
      "quantity": 15.25,
      "trade_value": 648131.13,
      "is_buy": true,
      "whale_score": 0.89,
      "bull_bear_sentiment": 0.32,
      "similar_patterns": [
        {
          "trade_id": 587654310,
          "timestamp": "2024-01-14T16:45:20Z",
          "value": 620000.00,
          "is_buy": true,
          "similarity_score": 0.91
        }
      ],
      "created_at": "2024-01-15T10:25:31Z"
    }
  ]
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

### Statistics

#### GET `/api/statistics`
Get aggregated trading statistics.

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total_trades": 2847,
    "whale_trades": 23,
    "avg_price": 42450.75,
    "high_price": 42750.00,
    "low_price": 42150.00,
    "volume_24h": 45230.50
  }
}
```

---

### Chart Data

#### GET `/api/chart-data`
Get aggregated chart data for visualization.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| minutes | integer | 60 | Time window in minutes |

**Example:**
```
GET /api/chart-data?minutes=120
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-15T09:00:00Z",
      "open": 42200.00,
      "high": 42500.00,
      "low": 42150.00,
      "close": 42350.00,
      "volume": 125.50,
      "whale_volume": 15.25
    },
    {
      "timestamp": "2024-01-15T09:01:00Z",
      "open": 42350.00,
      "high": 42600.00,
      "low": 42300.00,
      "close": 42500.00,
      "volume": 118.75,
      "whale_volume": 0.00
    }
  ]
}
```

---

## WebSocket API

### Connection

**URL:**
```
ws://localhost:8000/ws/trades
```

**JavaScript Client Example:**
```javascript
const socket = new WebSocket('ws://localhost:8000/ws/trades');

socket.addEventListener('open', (event) => {
  console.log('Connected to whale watcher');
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
});
```

### Events

#### `connection`
Sent when client connects.

**Payload:**
```json
{
  "type": "connection",
  "message": "Connected to Whale Watcher Pro",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

#### `whale_alert`
Emitted when a whale trade is detected.

**Payload:**
```json
{
  "type": "whale_alert",
  "data": {
    "trade_id": 587654321,
    "timestamp": "2024-01-15T10:25:30Z",
    "price": 42500.50,
    "quantity": 15.25,
    "trade_value": 648131.13,
    "is_buy": true,
    "whale_score": 0.89,
    "similar_patterns": [
      {
        "trade_id": 587654310,
        "timestamp": "2024-01-14T16:45:20Z",
        "price": 41000.00,
        "value": 620000.00,
        "is_buy": true,
        "similarity_score": 0.91
      }
    ],
    "bull_bear_sentiment": 0.32
  },
  "timestamp": "2024-01-15T10:25:31.456Z"
}
```

#### `bull_bear_metrics`
Emitted every 10 trades with market sentiment metrics.

**Payload:**
```json
{
  "type": "bull_bear_metrics",
  "data": {
    "net_buy_volume": 5420000.00,
    "net_sell_volume": 3180000.00,
    "bull_power": 0.2634,
    "momentum": 0.8750
  },
  "timestamp": "2024-01-15T10:25:40.789Z"
}
```

#### `pong`
Response to ping message.

**Payload:**
```json
{
  "type": "pong",
  "timestamp": "2024-01-15T10:25:45.123Z"
}
```

### Client Messages

#### Ping
Keep connection alive / test latency.

**Send:**
```javascript
socket.send(JSON.stringify({
  type: 'ping'
}));
```

**Receive:**
```json
{
  "type": "pong",
  "timestamp": "2024-01-15T10:25:45.123Z"
}
```

---

## Data Models

### WhaleAlert
```typescript
interface WhaleAlert {
  trade_id: number;              // Unique trade identifier
  timestamp: string;              // ISO 8601 format
  price: number;                  // BTC price in USD
  quantity: number;               // BTC quantity
  trade_value: number;            // Price × Quantity in USD
  is_buy: boolean;                // true = buy, false = sell
  whale_score: number;            // 0-1, magnitude indicator
  similar_patterns: PatternMatch[]; // Historical similar trades
  bull_bear_sentiment: number;    // -1 to 1, market sentiment
}
```

### PatternMatch
```typescript
interface PatternMatch {
  trade_id: number;               // Previous trade ID
  timestamp: string;              // When it occurred
  price: number;                  // BTC price then
  value: number;                  // Trade value in USD
  is_buy: boolean;                // Direction
  similarity_score: number;       // 0-1, how similar
}
```

### BullBearMetrics
```typescript
interface BullBearMetrics {
  net_buy_volume: number;         // Total whale buy volume (USD)
  net_sell_volume: number;        // Total whale sell volume (USD)
  bull_power: number;             // -1 (bearish) to 1 (bullish)
  momentum: number;               // 0-1, trend strength
}
```

### ChartDataPoint
```typescript
interface ChartDataPoint {
  timestamp: string;              // ISO 8601 format (minute)
  open: number;                   // Opening price
  high: number;                   // Highest price
  low: number;                    // Lowest price
  close: number;                  // Closing price
  volume: number;                 // Total BTC volume
  whale_volume: number;           // Whale BTC volume
}
```

---

## Error Handling

### HTTP Error Responses

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

### WebSocket Errors

```json
{
  "type": "error",
  "message": "Connection timeout",
  "code": "CONNECTION_TIMEOUT"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid parameters |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Backend error |
| 503 | Unavailable | Service temporarily down |

---

## Rate Limiting

No rate limiting currently implemented. For production:

- REST API: 100 requests/minute per IP
- WebSocket: 1 connection per user
- Broadcast: Max 10 events/second

---

## Code Examples

### Python (requests)

```python
import requests

# Get whale trades
response = requests.get(
    'http://localhost:8000/api/whale-trades',
    params={'limit': 10}
)
trades = response.json()['trades']

for trade in trades:
    print(f"Whale {trade['is_buy']} ${trade['trade_value']:,.2f}")
```

### JavaScript (fetch)

```javascript
// Get chart data
const response = await fetch(
  'http://localhost:8000/api/chart-data?minutes=60'
);
const { data } = await response.json();

console.log(`Chart points: ${data.length}`);
```

### JavaScript (WebSocket with Socket.io)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:8000');

socket.on('whale_alert', (event) => {
  const alert = event.data;
  console.log(`🐋 WHALE: $${alert.trade_value} ${alert.is_buy ? 'BUY' : 'SELL'}`);
});

socket.on('bull_bear_metrics', (event) => {
  const metrics = event.data;
  console.log(`Bull Power: ${metrics.bull_power}`);
});
```

---

## Performance Tips

1. **Batch Requests**: Combine multiple data fetches
2. **Cache Results**: Store chart data locally with timestamps
3. **WebSocket Optimization**: Use binary frames for large data
4. **Database Indexes**: Already created for timestamp and value
5. **Connection Pooling**: Supabase manages automatically

---

## Version History

### v1.0.0 (Current)
- Initial release
- Binance WebSocket streaming
- Whale detection ($500k+ threshold)
- Bull/Bear metrics
- 3D visualization
- Multi-channel alerts
- Supabase integration

---

## Future Enhancements

- [ ] GraphQL API
- [ ] Real-time chart updates via WebSocket
- [ ] User authentication & API keys
- [ ] Rate limiting & quotas
- [ ] Webhook subscriptions
- [ ] Advanced pattern ML predictions
- [ ] Mobile app API version
- [ ] Historical data archive

---

## Support

For issues or questions:
1. Check the troubleshooting section in README.md
2. Review browser console for client-side errors
3. Check backend logs for server errors
4. Verify Supabase connection and API keys

---

**Last Updated**: January 2024  
**API Version**: 1.0.0
