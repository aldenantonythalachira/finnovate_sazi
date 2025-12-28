<img width="1758" height="674" alt="image" src="https://github.com/user-attachments/assets/6c7de2e9-336f-4ef2-9652-3b791704fe26" /># Whale Watcher Pro

Real-time BTC/USDT whale detection and market visualization. The app streams Binance trades and order book data, detects institutional execution behavior, and presents a multi-tab dashboard for analysis and replay.

## Features

- Live whale alerts feed (buy/sell, whale score, severity, sentiment)
  <img width="1758" height="674" alt="image" src="https://github.com/user-attachments/assets/0142aeda-12bf-44ac-9ae1-165d03780e40" />

- Executed trades tape (raw Binance trades)
  <img width="1563" height="586" alt="image" src="https://github.com/user-attachments/assets/d19e4044-0e71-4b28-ab5e-2e584c006415" />

- Order book with depth intensity bars, liquidity wall glow, and whale interaction ripples
  <img width="1561" height="683" alt="image" src="https://github.com/user-attachments/assets/71d7f14b-71cc-4670-af3a-6d0b2c4678be" />

- Bubble Space (price-axis mapped bubbles and whale emphasis)
  <img width="1587" height="681" alt="image" src="https://github.com/user-attachments/assets/408c0e4e-f63f-4f6e-935e-0e285dececf2" />

- Bull vs Bear power meter + Hype vs Reality sentiment
  <img width="1580" height="619" alt="image" src="https://github.com/user-attachments/assets/699f0c91-be69-43aa-9e47-6eba5d7505ca" />

- Replay mode for the last 60 minutes
  <img width="1224" height="707" alt="image" src="https://github.com/user-attachments/assets/07d4cb02-3c52-4afa-8423-4cdb4ab23d49" />

- CoinDesk news feed
  <img width="1592" height="719" alt="image" src="https://github.com/user-attachments/assets/3b7b19d4-692e-4cd2-9f79-22ebbb8f86b7" />

- Supabase persistence for whale trades and sentiment data

## Tech Stack

Backend:
- FastAPI (API + WebSocket)
- websockets (Binance WS client)
- supabase-py (database writes)
- python-dotenv (env loading)

Frontend:
- Next.js (App Router)
- React + TypeScript
- Zustand (state store)
- Framer Motion (animations)
- Recharts (charts)

## Project Structure

- `backend/` FastAPI app + Binance stream + detection + Supabase writer
- `frontend/` Next.js app with multiple tabs

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
