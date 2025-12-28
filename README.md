 Whale Watcher Pro - Comprehensive Setup Guide

 🐋 Project Overview

**Whale Watcher Pro** is a real-time cryptocurrency whale detection system that identifies and visualizes massive institutional trades in Bitcoin/USDT markets. The system provides instant alerts, 3D visualizations, sentiment analysis, and market impact predictions.

 Key Features

✅ **Real-Time Whale Detection**: Identifies large trades instantly  
✅ **Bull/Bear Sentiment**: Real-time market sentiment analysis   
✅ **WebSocket Streaming**: Live updates
✅ **Supabase Integration**: PostgreSQL database  
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
    ↓
Supabase (PostgreSQL)
    ├── whale_trades table
    ├── trade_history table
    ├── sentiment_data table
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
