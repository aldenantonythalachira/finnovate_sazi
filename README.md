# Whale Watcher Pro - Comprehensive Setup Guide

## 🐋 Project Overview

**Whale Watcher Pro** is a real-time cryptocurrency whale detection system that identifies and visualizes massive institutional trades ($500k+ USD) in Bitcoin/USDT markets. The system provides instant alerts, 3D visualizations, sentiment analysis, and market impact predictions.

### Key Features

✅ **Real-Time Whale Detection**: Identifies trades > $500,000 USD instantly  
✅ **Multi-Channel Alerts**: Discord & Telegram webhooks  
✅ **3D Visualization**: Three.js bubble visualization of whale trades  
✅ **Bull/Bear Sentiment**: Real-time market sentiment analysis  
✅ **Historical Patterns**: Echo prediction from similar past trades  
✅ **WebSocket Streaming**: Live updates via Socket.io  
✅ **Supabase Integration**: PostgreSQL database with real-time subscriptions  
✅ **Framer Motion**: Smooth, polished UI animations  

---

## 📋 System Architecture

```
Binance WebSocket Stream
    ↓
Python FastAPI Backend (Whale Detection Engine)
    ├── Real-time filtering
    ├── Bull/Bear calculation
    ├── External API integration
    └── Socket.io broadcasting
    ↓
Supabase (PostgreSQL)
    ├── whale_trades table
    ├── trade_history table
    ├── sentiment_data table
    └── user_alerts table
    ↓
Next.js Frontend (React)
    ├── Real-time alert feed
    ├── Price/Volume charts
    ├── 3D trade visualization
    └── Dashboard with metrics
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+**
- **Node.js 18+** (for Next.js)
- **npm or yarn**
- **Supabase account** (free tier available at supabase.com)
- **Discord/Telegram webhooks** (optional for alerts)

### Backend Setup

#### 1. Navigate to backend directory
```bash
cd backend
```

#### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 3. Install dependencies
```bash
pip install -r requirements.txt
```

#### 4. Create `.env` file
```bash
cp .env.example .env
```

#### 5. Configure environment variables
Edit `.env` and fill in:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
```

#### 6. Set up Supabase database

Create these tables in Supabase SQL Editor:

```sql
-- Whale trades table
CREATE TABLE whale_trades (
  id BIGSERIAL PRIMARY KEY,
  trade_id BIGINT NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  trade_value DECIMAL(20, 2) NOT NULL,
  is_buy BOOLEAN NOT NULL,
  whale_score DECIMAL(5, 4) NOT NULL,
  bull_bear_sentiment DECIMAL(5, 4),
  similar_patterns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for queries
CREATE INDEX idx_whale_trades_timestamp ON whale_trades(timestamp DESC);
CREATE INDEX idx_whale_trades_value ON whale_trades(trade_value DESC);

-- Trade history table (rolling 60 min window)
CREATE TABLE trade_history (
  id BIGSERIAL PRIMARY KEY,
  trade_id BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  value DECIMAL(20, 2) NOT NULL,
  is_buy BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sentiment data table
CREATE TABLE sentiment_data (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  sentiment_score DECIMAL(5, 4) NOT NULL,
  source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User alerts preferences
CREATE TABLE user_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_type)
);
```

#### 7. Run the backend server
```bash
python main.py
```

Server will start on `http://localhost:8000`

### Frontend Setup

#### 1. Navigate to frontend directory
```bash
cd frontend
```

#### 2. Install dependencies
```bash
npm install
```

#### 3. Create `.env.local` file
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 4. Run development server
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

### Optional: Configure External Services

#### Discord Webhook
1. Go to your Discord server settings
2. Create a webhook in a channel
3. Copy the webhook URL to `.env`

#### Telegram Bot
1. Create bot with [@BotFather](https://t.me/botfather)
2. Get your Chat ID from your messages
3. Add both to `.env`

---

## 📊 API Endpoints

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/health` | Detailed health status |
| GET | `/api/whale-trades` | Recent whale trades (limit=50) |
| GET | `/api/statistics` | Trading statistics |
| GET | `/api/chart-data` | Aggregated chart data (minutes=60) |

### WebSocket Endpoint

```javascript
ws://localhost:8000/ws/trades
```

**Events:**
- `whale_alert`: New whale trade detected
- `bull_bear_metrics`: Bull/Bear power update (every 10 trades)
- `connection`: Initial connection message

---

## 🎯 Core Components

### Backend Services

#### `binance_stream.py`
- Manages persistent WebSocket connection to Binance
- Handles reconnection logic
- Yields trade data stream

#### `whale_detection.py`
- Filters trades by $500k threshold
- Calculates whale magnitude scores
- Finds similar historical patterns
- Computes bull/bear sentiment

#### `external_api.py`
- CoinGecko API integration (metadata)
- Discord webhook sender
- Telegram bot integration
- Sentiment score fetching

#### `database.py`
- Supabase client management
- CRUD operations for whale trades
- User preferences storage
- Statistics queries

#### `alerts.py`
- Manages alert broadcasting
- Cooldown logic to prevent spam
- Async multi-channel sending

### Frontend Components

#### `WhaleAlertFeed`
- Displays live whale alerts
- Framer Motion animations
- Dismissible cards
- Shows recent patterns

#### `PriceChart`
- Recharts candlestick visualization
- 60-minute rolling window
- Volume overlay
- Whale volume highlighting

#### `BullBearMeter`
- Real-time market sentiment gauge
- Buy/Sell volume comparison
- Momentum strength indicator
- Market insight text

#### `ThreeDVisualizer`
- Three.js 3D canvas
- Bubble size = trade value
- Green (buys) vs Red (sells)
- Interactive rotation/zoom

#### `BitcoinInfo`
- Current BTC price (CoinGecko)
- Market cap and volume
- 24h price change
- Live data fetching

---

## 🔧 Configuration

### Backend Whale Threshold

Edit in `backend/services/whale_detection.py`:

```python
WHALE_THRESHOLD = 500_000  # Change this value in USD
```

### Update Frequency

In `backend/main.py`, modify broadcast interval:

```python
# Currently broadcasts every 10 trades
if len(trade_history) % 10 == 0:
    await manager.broadcast(...)
```

### Chart Data Window

In `frontend/app/page.tsx`:

```javascript
const res = await fetch('http://localhost:8000/api/chart-data?minutes=60');
// Change 60 to desired minutes
```

---

## 📈 Performance Tuning

### Database Optimization

1. **Add indexes** (already in SQL above)
2. **Archive old trades**:
   ```sql
   DELETE FROM trade_history 
   WHERE timestamp < NOW() - INTERVAL '7 days';
   ```

3. **Connection pooling** - Supabase handles automatically

### Backend Optimization

1. **Use Redis caching** (future enhancement)
2. **Horizontal scaling** - Deploy multiple instances
3. **Message queuing** - Consider RabbitMQ for high volume

### Frontend Optimization

1. **Code splitting** - Next.js automatic
2. **Image optimization** - Enabled in next.config.js
3. **Lazy loading** - React components

---

## 🐛 Troubleshooting

### Backend Won't Connect to Binance

```
Error: Connection failed to Binance stream
```

**Solution:**
- Check internet connection
- Verify Binance is accessible (not geo-blocked)
- Check firewall/VPN settings

### WebSocket Connection Failing

```
Error: WebSocket error
```

**Solution:**
- Ensure backend is running on port 8000
- Check CORS settings in FastAPI (should be * for dev)
- Verify frontend API URL in `.env.local`

### No Data in Supabase

**Solution:**
- Check SUPABASE_URL and KEY in `.env`
- Verify tables exist in Supabase dashboard
- Check Network tab in browser for errors

### Frontend Shows "Waiting for data..."

**Solution:**
- Ensure backend WebSocket is connected
- Check browser console for errors
- Verify Socket.io client version matches backend

---

## 🚢 Deployment

### Deploy Backend (Heroku)

```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=... SUPABASE_KEY=...
git push heroku main
```

### Deploy Frontend (Vercel)

```bash
npm install -g vercel
vercel
# Follow prompts to connect repository
```

### Docker Setup

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

Build and run:

```bash
docker build -t whale-watcher .
docker run -p 8000:8000 -e SUPABASE_URL=... whale-watcher
```

---

## 📚 Advanced Features

### Custom Sentiment Analysis

Edit `external_api.py` `get_sentiment_score()` to integrate:
- Santiment API
- Lunarcrush
- Glassnode
- Twitter sentiment

### Machine Learning Integration

Predict whale movements using historical patterns:

```python
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

# Cluster similar whale patterns
scaler = StandardScaler()
X = scaler.fit_transform([[t['value'], t['is_buy']] for t in trades])
kmeans = KMeans(n_clusters=5)
clusters = kmeans.fit_predict(X)
```

### Push Notifications

Add to `alerts.py`:

```python
from firebase_admin import messaging

message = messaging.Message(
    notification=messaging.Notification(
        title='Whale Alert',
        body=f'${alert["trade_value"]:,.0f} {direction}'
    ),
    topic='whale-alerts',
)
```

---

## 📞 Support & Resources

- **Binance API Docs**: https://binance-docs.github.io/apidocs/
- **Supabase Docs**: https://supabase.com/docs
- **FastAPI**: https://fastapi.tiangolo.com
- **Next.js**: https://nextjs.org/docs
- **Framer Motion**: https://www.framer.com/motion/
- **Three.js**: https://threejs.org/

---

## 📄 License

MIT License - Feel free to use and modify!

---

## 🎉 What's Next?

- [ ] Add additional crypto pairs (ETH, BNB, etc.)
- [ ] Implement user authentication
- [ ] Build mobile app (React Native)
- [ ] Add webhooks for trading bots
- [ ] Sentiment API integration
- [ ] Advanced pattern recognition with ML
- [ ] Trading signal generation
- [ ] Portfolio tracking integration

---

**Happy Whale Watching! 🐋**
