# Environment Configuration Guide

## Backend Environment Variables (.env)

Create a `.env` file in the `backend/` directory:

```bash
# ============================================================================
# REQUIRED SETTINGS
# ============================================================================

# Supabase (Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEBUG=False

# ============================================================================
# OPTIONAL SETTINGS (Alerts)
# ============================================================================

# Discord Webhook (for whale alerts)
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Telegram Bot (for whale alerts)
TELEGRAM_BOT_TOKEN=123456789:ABCDefGHIjKlMNOpQRStUVWxYz1234567890
TELEGRAM_CHAT_ID=987654321

# Sentiment API (optional)
SENTIMENT_API_KEY=your_sentiment_api_key_here

# Binance API (future use)
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_api_secret_here
```

### Getting Credentials

#### Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy `URL` and `anon` key

#### Discord Webhook

1. Right-click channel → Edit Channel → Integrations
2. Click "Webhooks" → Create Webhook
3. Copy the webhook URL

#### Telegram Bot

1. DM [@BotFather](https://t.me/botfather) on Telegram
2. `/newbot` and follow prompts
3. Get your Chat ID by messaging @userinfobot

---

## Frontend Environment Variables (.env.local)

Create a `.env.local` file in the `frontend/` directory:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Feature Flags
NEXT_PUBLIC_ENABLE_3D=true
NEXT_PUBLIC_ENABLE_SENTIMENT=true
NEXT_PUBLIC_ENABLE_ALERTS=true

# Analytics (optional)
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

### Environment-Specific Configs

#### Development
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
DEBUG=true
```

#### Production (Heroku Backend)
```bash
NEXT_PUBLIC_API_URL=https://whale-watcher-api.herokuapp.com
NEXT_PUBLIC_WS_URL=wss://whale-watcher-api.herokuapp.com
DEBUG=false
```

#### Production (Vercel Frontend)
```bash
NEXT_PUBLIC_API_URL=https://whale-watcher-api.herokuapp.com
NEXT_PUBLIC_WS_URL=wss://whale-watcher-api.herokuapp.com
```

---

## Docker Deployment

### Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/health')"

# Run application
CMD ["python", "main.py"]
```

### Docker Compose

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: whale-watcher-backend
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    restart: unless-stopped
    networks:
      - whale-network

  frontend:
    build: ./frontend
    container_name: whale-watcher-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
      - NEXT_PUBLIC_WS_URL=ws://backend:8000
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - whale-network

networks:
  whale-network:
    driver: bridge
```

### Run with Docker Compose

```bash
# Create .env file with your credentials
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down
```

---

## Heroku Deployment (Backend)

### 1. Create Heroku App

```bash
heroku login
heroku create whale-watcher-api
```

### 2. Set Environment Variables

```bash
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_KEY=your_key_here
heroku config:set DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/...
heroku config:set TELEGRAM_BOT_TOKEN=...
heroku config:set TELEGRAM_CHAT_ID=...
```

### 3. Create Procfile

Create `backend/Procfile`:

```
web: python main.py
```

### 4. Create runtime.txt

Create `backend/runtime.txt`:

```
python-3.11.5
```

### 5. Deploy

```bash
cd backend
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a whale-watcher-api
git push heroku main
```

### 6. Check Logs

```bash
heroku logs --tail
```

---

## Vercel Deployment (Frontend)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/whale-watcher.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select `frontend` as root directory
5. Add environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_WS_URL`
6. Deploy!

### 3. Add Custom Domain

In Vercel project settings → Domains

---

## Production Checklist

### Backend
- [ ] Set `DEBUG=False` in production
- [ ] Use environment-specific database
- [ ] Configure proper CORS for frontend URL
- [ ] Enable HTTPS/WSS
- [ ] Set up monitoring/logging (Sentry, LogRocket)
- [ ] Configure rate limiting
- [ ] Add request logging
- [ ] Test database backups
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx)

### Frontend
- [ ] Build optimized bundle: `npm run build`
- [ ] Test production build: `npm run start`
- [ ] Configure analytics
- [ ] Add error tracking (Sentry)
- [ ] Optimize images
- [ ] Enable caching headers
- [ ] Test responsiveness on all devices
- [ ] Performance audit with Lighthouse
- [ ] Security headers configured
- [ ] HTTPS enabled

### Database
- [ ] Create regular backups
- [ ] Enable automatic backups (Supabase: Settings → Database Backups)
- [ ] Test restore procedure
- [ ] Monitor storage usage
- [ ] Set up alerts for high usage
- [ ] Create read replicas for scaling

---

## Scaling Configuration

### For High Traffic

#### Backend

```python
# Add gunicorn for production
# requirements.txt
gunicorn==21.2.0
```

```bash
# Run with multiple workers
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

#### Database

```sql
-- Create read replicas in Supabase dashboard
-- Enable connection pooling
-- Increase cache settings
```

#### Frontend

```javascript
// next.config.js - Add compression
module.exports = {
  compress: true,
  swcMinify: true,
  // ... other config
}
```

---

## Monitoring & Logging

### Backend Monitoring

```python
# Add to main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
```

### Frontend Error Tracking

```javascript
// app/layout.tsx
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}
```

---

## Security Best Practices

### API Keys
- ✅ Store in `.env` files (never commit to git)
- ✅ Use `.gitignore` to exclude `.env`
- ✅ Rotate keys regularly
- ✅ Use different keys for dev/prod

### Database
- ✅ Enable RLS (Row Level Security) in Supabase
- ✅ Use parameterized queries
- ✅ Regular security audits
- ✅ Monitor access logs

### Frontend
- ✅ Use HTTPS only
- ✅ Implement CSP headers
- ✅ Sanitize user input
- ✅ Keep dependencies updated

### Backend
- ✅ Validate all inputs
- ✅ Use CORS properly
- ✅ Implement rate limiting
- ✅ Use HTTPS for external APIs

---

## Troubleshooting Environment Issues

### Backend won't start

```bash
# Check Python version
python --version  # Should be 3.9+

# Verify dependencies
pip list | grep fastapi

# Test import
python -c "import fastapi; print(fastapi.__version__)"
```

### Missing environment variables

```bash
# Check if .env exists
ls -la backend/.env

# Print env vars
env | grep SUPABASE
```

### WebSocket connection issues

```bash
# Backend listening on port 8000?
lsof -i :8000

# Check firewall
sudo ufw allow 8000

# Test connection
curl http://localhost:8000/api/health
```

---

**Last Updated**: January 2024  
**Version**: 1.0.0
