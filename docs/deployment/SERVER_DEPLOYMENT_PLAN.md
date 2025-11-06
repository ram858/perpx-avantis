# 🚀 Server Deployment Plan

Complete deployment guide for all 3 services on a single server.

## 📋 Overview

Deploying:
1. **Next.js App** (Port 3000) - Frontend + API routes
2. **Trading Engine** (Port 3001) - Node.js service
3. **Avantis Service** (Port 8000) - Python FastAPI service

Using:
- **Nginx** as reverse proxy
- **PM2** for Node.js process management
- **systemd** or **supervisor** for Python service
- **Let's Encrypt** for SSL certificates

---

## 🛠️ Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM**: Minimum 2GB (4GB+ recommended)
- **CPU**: 2+ cores
- **Storage**: 20GB+ free space
- **Node.js**: v18+ (for Next.js and Trading Engine)
- **Python**: 3.11+ (for Avantis Service)
- **Nginx**: Latest stable version
- **PM2**: Global npm package
- **Git**: For cloning repository

### Domain Setup
- Domain or subdomain pointing to your server IP
- DNS A record configured
- Ports 80, 443 open in firewall

---

## 📦 Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v18+
```

### 1.3 Install Python 3.11+
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
python3 --version  # Should be 3.11+
```

### 1.4 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 --version
```

### 1.5 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 1.6 Install Certbot (SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 1.7 Configure Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 📁 Step 2: Clone and Prepare Repository

### 2.1 Create App Directory
```bash
sudo mkdir -p /var/www/perpx-avantis
sudo chown $USER:$USER /var/www/perpx-avantis
cd /var/www/perpx-avantis
```

### 2.2 Clone Repository
```bash
git clone <your-repo-url> .
# Or if you're uploading files:
# scp -r /path/to/perpx-avantis/* user@server:/var/www/perpx-avantis/
```

### 2.3 Create Environment Files
```bash
# Create .env files for each service
touch .env                    # Next.js root
touch trading-engine/.env     # Trading Engine
touch avantis-service/.env    # Avantis Service
```

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Next.js App (.env)
```bash
nano /var/www/perpx-avantis/.env
```

```env
# Base Mini App Configuration
NEXT_PUBLIC_BASE_MINI_APP_URL=https://your-domain.com
NEXT_PUBLIC_FARCASTER_DEVELOPER_MNEMONIC=your_farcaster_mnemonic

# Trading Engine URL (internal)
TRADING_ENGINE_URL=http://localhost:3001

# Avantis Service URL (internal)
AVANTIS_API_URL=http://localhost:8000
NEXT_PUBLIC_AVANTIS_API_URL=http://localhost:8000

# Avantis Network
AVANTIS_NETWORK=base-mainnet
# or base-testnet for testing

# Database (if using)
DATABASE_URL=postgresql://user:password@localhost:5432/perpx

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Node Environment
NODE_ENV=production
```

### 3.2 Trading Engine (.env)
```bash
nano /var/www/perpx-avantis/trading-engine/.env
```

```env
# Server Configuration
API_PORT=3001
NODE_ENV=production

# CORS - Allow your domain
ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000

# Avantis Configuration
AVANTIS_NETWORK=base-mainnet
AVANTIS_API_URL=http://localhost:8000

# Note: AVANTIS_PK is NOT set here - it's per-user and passed in API requests
```

### 3.3 Avantis Service (.env)
```bash
nano /var/www/perpx-avantis/avantis-service/.env
```

```env
# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=false

# Avantis Configuration
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
# For testnet: https://sepolia.base.org

# CORS - Allow your domain and trading engine
CORS_ORIGINS=https://your-domain.com,http://localhost:3001

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY=1.0

# Note: AVANTIS_PK is usually passed per-request, not as env var
# But you can set a default fallback here if needed
# AVANTIS_PK=0x_your_private_key_here
```

---

## 🔧 Step 4: Install Dependencies

### 4.1 Next.js App
```bash
cd /var/www/perpx-avantis
npm install
npm run build
```

### 4.2 Trading Engine
```bash
cd /var/www/perpx-avantis/trading-engine
npm install
```

### 4.3 Avantis Service
```bash
cd /var/www/perpx-avantis/avantis-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 🚀 Step 5: Configure PM2 (Node.js Services)

### 5.1 Create PM2 Ecosystem File
```bash
nano /var/www/perpx-avantis/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'perpx-nextjs',
      cwd: '/var/www/perpx-avantis',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/pm2/perpx-nextjs-error.log',
      out_file: '/var/log/pm2/perpx-nextjs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'perpx-trading-engine',
      cwd: '/var/www/perpx-avantis/trading-engine',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/perpx-trading-engine-error.log',
      out_file: '/var/log/pm2/perpx-trading-engine-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
```

### 5.2 Create Log Directory
```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2
```

### 5.3 Start Services with PM2
```bash
cd /var/www/perpx-avantis
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### 5.4 Verify PM2 Services
```bash
pm2 list
pm2 logs  # Check logs
```

---

## 🐍 Step 6: Configure Python Service (Avantis)

### Option A: Using systemd (Recommended)

Create systemd service file:
```bash
sudo nano /etc/systemd/system/avantis-service.service
```

```ini
[Unit]
Description=Avantis Trading Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/perpx-avantis/avantis-service
Environment="PATH=/var/www/perpx-avantis/avantis-service/venv/bin"
ExecStart=/var/www/perpx-avantis/avantis-service/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable avantis-service
sudo systemctl start avantis-service
sudo systemctl status avantis-service
```

### Option B: Using Supervisor

Install supervisor:
```bash
sudo apt install -y supervisor
```

Create config:
```bash
sudo nano /etc/supervisor/conf.d/avantis-service.conf
```

```ini
[program:avantis-service]
command=/var/www/perpx-avantis/avantis-service/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
directory=/var/www/perpx-avantis/avantis-service
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/avantis-service/error.log
stdout_logfile=/var/log/avantis-service/out.log
environment=PYTHONUNBUFFERED=1
```

Create log directory and start:
```bash
sudo mkdir -p /var/log/avantis-service
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start avantis-service
```

---

## 🌐 Step 7: Configure Nginx Reverse Proxy

### 7.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/perpx-avantis
```

```nginx
# Upstream servers
upstream nextjs {
    server localhost:3000;
}

upstream trading-engine {
    server localhost:3001;
}

upstream avantis-service {
    server localhost:8000;
}

# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (will be auto-configured by certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/perpx-avantis-access.log;
    error_log /var/log/nginx/perpx-avantis-error.log;

    # Client body size (for file uploads)
    client_max_body_size 10M;

    # Main Next.js App
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Trading Engine API (internal, can be exposed if needed)
    location /api/trading-engine/ {
        rewrite ^/api/trading-engine/(.*) /$1 break;
        proxy_pass http://trading-engine;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Avantis Service API (internal, can be exposed if needed)
    location /api/avantis/ {
        rewrite ^/api/avantis/(.*) /$1 break;
        proxy_pass http://avantis-service;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket support (if needed)
    location /ws {
        proxy_pass http://trading-engine;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 7.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/perpx-avantis /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## 🔒 Step 8: Setup SSL Certificate

### 8.1 Get SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts:
- Enter email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 8.2 Auto-renewal (already configured by certbot)
```bash
sudo certbot renew --dry-run  # Test renewal
```

---

## ✅ Step 9: Verify Deployment

### 9.1 Check Services
```bash
# PM2 services
pm2 list
pm2 logs

# Python service
sudo systemctl status avantis-service
# or
sudo supervisorctl status avantis-service

# Nginx
sudo systemctl status nginx
```

### 9.2 Test Endpoints
```bash
# Next.js app
curl https://your-domain.com

# Trading Engine (internal)
curl http://localhost:3001/health

# Avantis Service (internal)
curl http://localhost:8000/health
```

### 9.3 Check Logs
```bash
# PM2 logs
pm2 logs perpx-nextjs
pm2 logs perpx-trading-engine

# Python service logs
sudo journalctl -u avantis-service -f
# or
sudo tail -f /var/log/avantis-service/out.log

# Nginx logs
sudo tail -f /var/log/nginx/perpx-avantis-access.log
sudo tail -f /var/log/nginx/perpx-avantis-error.log
```

---

## 🔄 Step 10: Update Base Mini App Configuration

In Base Mini App settings, use your deployed URL:
```
https://your-domain.com
```

Update environment variables if needed:
- `NEXT_PUBLIC_BASE_MINI_APP_URL=https://your-domain.com`

---

## 🛠️ Maintenance Commands

### Restart Services
```bash
# Next.js and Trading Engine
pm2 restart all
# or individually
pm2 restart perpx-nextjs
pm2 restart perpx-trading-engine

# Avantis Service
sudo systemctl restart avantis-service
# or
sudo supervisorctl restart avantis-service

# Nginx
sudo systemctl restart nginx
```

### View Logs
```bash
# PM2
pm2 logs

# Avantis Service
sudo journalctl -u avantis-service -n 100

# Nginx
sudo tail -f /var/log/nginx/perpx-avantis-error.log
```

### Update Application
```bash
cd /var/www/perpx-avantis
git pull  # or upload new files

# Rebuild Next.js
npm install
npm run build
pm2 restart perpx-nextjs

# Update Trading Engine
cd trading-engine
npm install
pm2 restart perpx-trading-engine

# Update Avantis Service
cd ../avantis-service
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart avantis-service
```

---

## 📊 Monitoring

### PM2 Monitoring
```bash
pm2 monit  # Real-time monitoring
pm2 status # Service status
```

### System Resources
```bash
htop  # CPU/Memory usage
df -h # Disk usage
```

---

## 🐛 Troubleshooting

### Service Not Starting
1. Check logs: `pm2 logs` or `sudo journalctl -u avantis-service`
2. Verify environment variables
3. Check port availability: `sudo netstat -tulpn | grep :3000`

### 502 Bad Gateway
- Check if services are running: `pm2 list`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify upstream servers are accessible

### SSL Issues
- Renew certificate: `sudo certbot renew`
- Check certificate: `sudo certbot certificates`

### Permission Issues
```bash
sudo chown -R $USER:$USER /var/www/perpx-avantis
sudo chmod -R 755 /var/www/perpx-avantis
```

---

## 📝 Summary

After completing these steps:
- ✅ Next.js app running on port 3000 (PM2)
- ✅ Trading Engine running on port 3001 (PM2)
- ✅ Avantis Service running on port 8000 (systemd/supervisor)
- ✅ Nginx reverse proxy with SSL
- ✅ All services accessible via `https://your-domain.com`
- ✅ Auto-restart on server reboot
- ✅ Logs configured and accessible

Your app is now ready for Base Mini App integration! 🎉

