# Whale Watcher Pro

Real-time BTC/USDT whale detection and market visualization. The app streams Binance trades and order book data, detects institutional execution behavior, and presents a multi-tab dashboard for analysis and replay.

## Features

- Live whale alerts feed (buy/sell, whale score, severity, sentiment)
- Executed trades tape (raw Binance trades)
- Order book with depth intensity bars, liquidity wall glow, and whale interaction ripples
- Bubble Space 3D view (price-axis mapped bubbles with trails and whale emphasis)
- Bull vs Bear power meter + Hype vs Reality sentiment
- Replay mode for the last 60 minutes
- CoinDesk news feed
- Supabase persistence for whale trades and sentiment data

## Tech Stack

Backend:
- FastAPI (API + WebSocket)
- httpx (REST calls to Binance and RSS)
- websockets (Binance WS client)
- supabase-py (database writes)
- python-dotenv (env loading)

Frontend:
- Next.js (App Router)
- React + TypeScript
- Zustand (state store)
- Framer Motion (animations)
- Recharts (charts)
- Three.js (Bubble Space)
- Lucide React (icons)

## Project Structure

- `backend/` FastAPI app + Binance stream + detection + Supabase writer
- `frontend/` Next.js app with multiple tabs
- `docs/` Additional documentation

## Setup

### Clone

```bash
git clone <your-repo-url>
cd finnovate_sazi
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

Create `backend/.env` and set:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
```

Run:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Tables

Create these tables in Supabase:

```sql
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

CREATE INDEX idx_whale_trades_timestamp ON whale_trades(timestamp DESC);
CREATE INDEX idx_whale_trades_value ON whale_trades(trade_value DESC);

CREATE TABLE sentiment_data (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  sentiment_score DECIMAL(5, 4) NOT NULL,
  source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Notes

- The backend uses Binance public endpoints only.
- News is pulled from CoinDesk RSS (cached in-memory).
- WebSocket is used for live updates; HTTP is used for charts and fallback data.
