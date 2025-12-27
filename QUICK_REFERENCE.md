# Whale Watcher Pro - Quick Reference Card

## 🚀 5-Minute Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with Supabase credentials
python main.py
```
→ Server runs on `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
# Create .env.local with API_URL
npm run dev
```
→ Dashboard on `http://localhost:3000`

---

## 🔗 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Backend API** | http://localhost:8000 | REST endpoints |
| **WebSocket** | ws://localhost:8000/ws/trades | Real-time updates |
| **Frontend** | http://localhost:3000 | Dashboard UI |
| **Supabase** | https://supabase.com | Database |
| **Binance** | wss://stream.binance.com:9443 | Trade stream |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI application |
| `backend/services/whale_detection.py` | Detection logic |
| `frontend/app/page.tsx` | Main dashboard |
| `frontend/src/components/` | React components |
| `backend/.env` | Backend config (create from .example) |
| `frontend/.env.local` | Frontend config |

---

## 🐋 Whale Trade Detection

```python
# Threshold: $500,000 USD
# Formula: Price × Quantity > $500,000
# Example: 42,500 × 12 BTC = $510,000 ✅ WHALE

# Whale Score: (value - threshold) / 5M (normalized 0-1)
# Bull Power: (buy_volume - sell_volume) / total (range -1 to 1)
```

---

## 🔌 WebSocket Events

```javascript
// Connect
const socket = io('http://localhost:8000');

// Receive whale alert
socket.on('whale_alert', (event) => {
  const { trade_value, is_buy, whale_score } = event.data;
});

// Receive metrics
socket.on('bull_bear_metrics', (event) => {
  const { bull_power, momentum } = event.data;
});
```

---

## 🛠️ Configuration

| Setting | File | Change |
|---------|------|--------|
| Whale threshold | `whale_detection.py` | `WHALE_THRESHOLD = 500_000` |
| Chart window | `page.tsx` | `?minutes=60` parameter |
| Database | `.env` | `SUPABASE_URL` & `SUPABASE_KEY` |
| Discord alerts | `.env` | `DISCORD_WEBHOOK_URL` |
| Telegram alerts | `.env` | `TELEGRAM_BOT_TOKEN` |

---

## 📊 Data Structures

### WhaleAlert
```json
{
  "trade_id": 587654321,
  "timestamp": "2024-01-15T10:25:30Z",
  "price": 42500.50,
  "quantity": 15.25,
  "trade_value": 648131.13,
  "is_buy": true,
  "whale_score": 0.89,
  "bull_bear_sentiment": 0.32,
  "similar_patterns": [...]
}
```

### BullBearMetrics
```json
{
  "net_buy_volume": 5420000.00,
  "net_sell_volume": 3180000.00,
  "bull_power": 0.2634,
  "momentum": 0.8750
}
```

---

## 🎨 Component Hierarchy

```
App (page.tsx)
├── Header (Status, Title)
├── Left Sidebar
│   ├── BitcoinInfo
│   └── Action Buttons
├── Main Content
│   ├── WhaleAlertFeed
│   │   └── WhaleAlertCard (x5)
│   ├── PriceChart
│   ├── BullBearMeter
│   ├── Sentiment Overlay
│   └── ThreeDVisualizer
└── Footer
```

---

## 🔐 Required Credentials

| Credential | Where | Get From |
|-----------|-------|----------|
| `SUPABASE_URL` | .env | Supabase Settings → API |
| `SUPABASE_KEY` | .env | Supabase Settings → API |
| `DISCORD_WEBHOOK_URL` | .env | Discord Settings → Webhooks |
| `TELEGRAM_BOT_TOKEN` | .env | @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | .env | @userinfobot on Telegram |

---

## ⚡ Common Commands

```bash
# Backend
cd backend
python main.py                    # Start server
python -m pip install -r requirements.txt  # Install deps
source venv/bin/activate         # Activate venv

# Frontend
cd frontend
npm run dev                        # Start dev server
npm run build                      # Build for production
npm run start                      # Run production build
npm run lint                       # Run ESLint

# Database
# Access Supabase SQL editor at: https://supabase.com/dashboard
```

---

## 🔍 Debugging

### Backend Not Starting?
```bash
# Check Python version
python --version

# Check port 8000 in use
lsof -i :8000
netstat -an | grep 8000

# Test FastAPI
python -c "import fastapi; print(fastapi.__version__)"
```

### Frontend Not Loading?
```bash
# Check port 3000
lsof -i :3000

# Clear Next.js cache
rm -rf .next
npm run dev

# Check API URL
# Browser console → Network tab → check requests
```

### WebSocket Not Connecting?
```bash
# Check backend is running
curl http://localhost:8000/api/health

# Check firewall
sudo ufw allow 8000

# Browser console → Check for errors
```

---

## 📈 Performance Tips

1. **Database**: Indexes already created on `timestamp` & `value`
2. **Frontend**: Use `npm run build` for production
3. **Backend**: Add gunicorn for multiple workers
4. **Charts**: Limit data to last 60 minutes
5. **WebSocket**: Use binary frames for large payloads

---

## 🚀 Deployment Quick Links

| Platform | Guide | Cost |
|----------|-------|------|
| **Heroku** | DEPLOYMENT.md | ~$7-50/month |
| **Vercel** | DEPLOYMENT.md | Free-$20/month |
| **Docker** | DEPLOYMENT.md | Self-hosted |
| **AWS** | Configure similar | Variable |
| **Google Cloud** | Configure similar | Variable |

---

## 🎯 Feature Checklist

| Feature | Status | Component |
|---------|--------|-----------|
| Real-time whale detection | ✅ | whale_detection.py |
| Binance streaming | ✅ | binance_stream.py |
| Alert feed UI | ✅ | WhaleAlertFeed.tsx |
| Price charts | ✅ | PriceChart.tsx |
| 3D visualization | ✅ | ThreeDVisualizer.tsx |
| Bull/Bear meter | ✅ | BullBearMeter.tsx |
| Discord alerts | ✅ | alerts.py |
| Telegram alerts | ✅ | alerts.py |
| Supabase integration | ✅ | database.py |
| WebSocket streaming | ✅ | useWebSocket.ts |
| Bitcoin metadata | ✅ | BitcoinInfo.tsx |
| Pattern matching | ✅ | whale_detection.py |

---

## 💡 Pro Tips

1. **Monitor Whales**: Check `bull_bear_sentiment` for market direction
2. **Pattern Matching**: High similarity score = stronger signal
3. **Alert Tuning**: Adjust `WHALE_THRESHOLD` for more/fewer alerts
4. **Database Cleanup**: Archive trades older than 7 days
5. **Scaling**: Deploy multiple backend instances behind load balancer

---

## 🆘 Getting Help

1. Check **README.md** for detailed setup
2. Review **API_REFERENCE.md** for endpoint docs
3. See **DEPLOYMENT.md** for production setup
4. Check **ARCHITECTURE.md** for design details
5. Search browser console for error messages

---

## 📞 Community Resources

- **Discord**: Join crypto trading communities
- **GitHub**: Fork and contribute
- **Binance Docs**: https://binance-docs.github.io/
- **Supabase Docs**: https://supabase.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com

---

## 🎓 Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Python | 3.9+ |
| **API Framework** | FastAPI | 0.104+ |
| **Real-time** | Socket.io | 4.7+ |
| **Database** | Supabase | Latest |
| **Frontend** | Next.js | 14+ |
| **UI Framework** | React | 18+ |
| **Styling** | Tailwind CSS | 3.3+ |
| **Animations** | Framer Motion | 10+ |
| **Charts** | Recharts | 2.10+ |
| **3D Graphics** | Three.js | r158+ |
| **State** | Zustand | 4.4+ |

---

## 🔐 Security Reminders

✅ Never commit `.env` files  
✅ Rotate API keys regularly  
✅ Use different keys for dev/prod  
✅ Enable HTTPS in production  
✅ Validate all inputs on server  
✅ Use Supabase RLS for database  
✅ Monitor access logs  
✅ Keep dependencies updated  

---

## 📊 Expected Performance

- **Whale Detection**: <1ms latency
- **WebSocket**: <100ms to clients
- **Chart Updates**: Every 30 seconds
- **Bull/Bear Metrics**: Every 10 trades
- **Database Queries**: <100ms

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Status**: Production Ready 🚀

---

Keep this card handy while developing!
