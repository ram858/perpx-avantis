# 🚀 Quick Deployment Guide

## Prerequisites Checklist
- [ ] Ubuntu/Debian server with root access
- [ ] Domain name pointing to server IP
- [ ] Ports 80, 443, 22 open in firewall
- [ ] SSH access to server

## Quick Setup (30 minutes)

### 1. Initial Server Setup (5 min)
```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Clone Repository (2 min)
```bash
sudo mkdir -p /var/www/perpx-avantis
sudo chown $USER:$USER /var/www/perpx-avantis
cd /var/www/perpx-avantis
git clone <your-repo-url> .
# OR upload files via SCP/SFTP
```

### 3. Create Environment Files (5 min)
```bash
# Create .env files
nano .env                    # Next.js
nano trading-engine/.env     # Trading Engine  
nano avantis-service/.env    # Avantis Service
```

**Copy environment variables from `docs/deployment/DEPLOYMENT_ENV_VARS.md`**

### 4. Run Deployment Script (10 min)
```bash
cd /var/www/perpx-avantis
chmod +x deploy.sh
./deploy.sh
```

### 5. Setup Avantis Service (3 min)
```bash
# Copy systemd service file
sudo cp avantis-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable avantis-service
sudo systemctl start avantis-service
```

### 6. Configure Nginx (5 min)
```bash
# Copy and edit nginx config
sudo cp nginx-perpx-avantis.conf /etc/nginx/sites-available/perpx-avantis
sudo nano /etc/nginx/sites-available/perpx-avantis
# Replace 'your-domain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/perpx-avantis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Setup SSL (5 min)
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 8. Verify (2 min)
```bash
# Check all services
pm2 list
sudo systemctl status avantis-service
curl https://your-domain.com
```

## ✅ Done!

Your app is now live at `https://your-domain.com`

## Common Commands

```bash
# View logs
pm2 logs
sudo journalctl -u avantis-service -f

# Restart services
pm2 restart all
sudo systemctl restart avantis-service

# Update app
cd /var/www/perpx-avantis
git pull
./deploy.sh
```

## Troubleshooting

**502 Bad Gateway?**
- Check services: `pm2 list` and `sudo systemctl status avantis-service`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

**Service not starting?**
- Check logs: `pm2 logs` or `sudo journalctl -u avantis-service`
- Verify environment variables are set correctly

**SSL issues?**
- Renew: `sudo certbot renew`
- Check: `sudo certbot certificates`

For detailed instructions, see `docs/deployment/SERVER_DEPLOYMENT_PLAN.md`

