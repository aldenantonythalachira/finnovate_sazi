# Whale Watcher Pro - System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WHALE WATCHER PRO                              │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┐
│        BINANCE WEBSOCKET            │
│   (wss://stream.binance.com:9443)   │
│  BTC/USDT Real-Time Trade Stream    │
└────────────────────────────────────┘
                    │
                    │ Raw Trade Data
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PYTHON FASTAPI BACKEND                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │         WebSocket Connection Manager (Binance)               │    │
│  │  - Persistent connection to Binance stream                   │    │
│  │  - Handle reconnection logic                                 │    │
│  │  - Queue incoming trade data                                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │         Whale Detection Engine (Logic)                        │    │
│  │  - Filter trades by value (Price × Quantity > $500k USD)      │    │
│  │  - Classify Buy/Sell orders                                   │    │
│  │  - Calculate net whale flow (10-minute window)                │    │
│  │  - Identify similar patterns (Echo Prediction)                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │      External Services Integration                            │    │
│  │  - CoinGecko API (Bitcoin metadata/logos)                     │    │
│  │  - Discord/Telegram Webhooks (Alerts)                         │    │
│  │  - Sentiment API (Hype vs Reality)                            │    │
│  │  - Supabase (PostgreSQL Database)                             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │      SocketIO Server (Real-Time Broadcast)                    │    │
│  │  - Emit whale alerts to connected clients                     │    │
│  │  - Broadcast aggregated metrics (Bull/Bear power)             │    │
│  │  - Stream historical data on demand                           │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        │ WebSocket Events      │ REST API
        │ (Real-time stream)    │ (Data endpoints)
        │                       │
        ▼                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 NEXT.JS FRONTEND (React)                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │         Real-Time Whale Alert Feed Component                  │    │
│  │  - Framer Motion animations (pulse, slide-in effects)         │    │
│  │  - Dynamic card display with whale trade details              │    │
│  │  - Color-coded Buy (Green) / Sell (Red) indicators            │    │
│  │  - Historical impact popup (3 similar trades)                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │      2D Analytics Dashboard (Recharts)                         │    │
│  │  - Price chart (60-minute rolling window)                      │    │
│  │  - Volume chart with whale trades highlighted                  │    │
│  │  - Bull vs Bear Power Meter gauge                              │    │
│  │  - Sentiment overlay (Hype vs Reality score)                   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │      3D Visualization Canvas (Three.js)                        │    │
│  │  - Whale trades as 3D bubbles                                  │    │
│  │  - Bubble size = Trade value                                   │    │
│  │  - Color = Buy (Green) or Sell (Red)                           │    │
│  │  - Interactive rotation/zoom controls                          │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │      UI Components (Tailwind CSS + Dark Mode)                  │    │
│  │  - Navigation sidebar                                          │    │
│  │  - Asset info module (BTC logo & metadata)                     │    │
│  │  - Toast notifications for alerts                              │    │
│  │  - Responsive layout (Mobile/Tablet/Desktop)                   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                    │
                    │ Socket.io client
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tables:                                                                │
│  - whale_trades: Detected whale transactions                           │
│  - trade_history: Historical trade data (rolling 60 mins)              │
│  - user_alerts: User alert preferences & subscriptions                 │
│  - sentiment_data: Social sentiment scores                             │
│  - whale_patterns: Similar trade patterns for echo prediction          │
│                                                                         │
│  Auth: Supabase Authentication (Email/OAuth)                           │
│  Realtime: Supabase Realtime subscriptions for live updates            │
└────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Ingestion**: Binance WebSocket → Python Backend (Raw trades)
2. **Processing**: Whale Detection Engine filters trades (value > $500k)
3. **Enrichment**: External APIs add metadata, sentiment, patterns
4. **Persistence**: Filtered data stored in Supabase
5. **Broadcasting**: SocketIO emits events to frontend
6. **Visualization**: React components render real-time alerts & charts
7. **Notifications**: Discord/Telegram webhooks for external alerts

## Component Relationships

```
Frontend (Next.js/React)
    ├── WhaleAlertFeed Component
    │   └── Subscribes to WebSocket events
    ├── Dashboard Component
    │   ├── RechartsPriceChart
    │   ├── BullBearMeter
    │   └── SentimentOverlay
    └── Three3DVisualizer
        └── Renders 3D bubbles from trade data

Backend (Python/FastAPI)
    ├── BinanceWebSocketManager
    │   └── Maintains persistent Binance connection
    ├── WhaleDetectionEngine
    │   ├── Filters by trade value
    │   ├── Calculates bull/bear flow
    │   └── Predicts echoes
    ├── ExternalServicesManager
    │   ├── CoinGecko API calls
    │   ├── Sentiment API integration
    │   └── Discord/Telegram webhooks
    └── SocketIOServer
        └── Broadcasts to all connected clients

Database (Supabase)
    ├── Real-time subscriptions
    └── Historical data persistence
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Websocket Server** | Python (asyncio) | Handle Binance stream |
| **API Server** | FastAPI | REST endpoints & SocketIO |
| **Frontend Framework** | Next.js 13+ (App Router) | React with SSR |
| **Styling** | Tailwind CSS | Dark mode UI |
| **Animations** | Framer Motion | Smooth transitions |
| **2D Charts** | Recharts | Price/volume visualization |
| **3D Graphics** | Three.js | Bubble visualization |
| **Real-time Communication** | Socket.io | Live event broadcasting |
| **Database** | Supabase (PostgreSQL) | Data persistence |
| **Authentication** | Supabase Auth | User management |
| **External APIs** | CoinGecko, Discord, Telegram | Metadata & alerts |

## Scalability Considerations

1. **Connection Pooling**: Use connection pool for Supabase
2. **Caching**: Redis for recently detected whales
3. **Load Balancing**: Multiple FastAPI instances behind reverse proxy
4. **Database Indexing**: Index whale_trades by timestamp and value
5. **Horizontal Scaling**: Stateless SocketIO for easier scaling
