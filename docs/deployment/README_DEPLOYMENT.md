# 📚 Deployment Documentation Index

This repository contains comprehensive deployment documentation for the Perpx-Avantis application.

## 📖 Documentation Files

### 1. **SERVER_DEPLOYMENT_PLAN.md** ⭐
   **Complete step-by-step guide for deploying all 3 services on a single server.**
   - Server setup and prerequisites
   - Installation of Node.js, Python, PM2, Nginx
   - Environment variable configuration
   - PM2 process management
   - Nginx reverse proxy setup
   - SSL certificate configuration
   - Service verification and troubleshooting
   - **Use this for production server deployment**

### 2. **DEPLOYMENT_QUICK_START.md** 🚀
   **Quick reference guide for fast deployment (30 minutes).**
   - Prerequisites checklist
   - Step-by-step commands
   - Common maintenance commands
   - Quick troubleshooting tips
   - **Use this if you're familiar with server deployment**

### 3. **DEPLOYMENT_ENV_VARS.md** ⚙️
   **Complete environment variable reference.**
   - Server deployment variables
   - Cloud deployment variables (Vercel + Railway)
   - How to set variables in each platform
   - Important security notes
   - **Reference this when configuring environment variables**

### 4. **AVANTIS_API_URL_EXPLANATION.md** 🔗
   **Explanation of the Avantis Service and AVANTIS_API_URL.**
   - What is the Avantis Service?
   - Architecture overview
   - How to deploy the Avantis Service
   - How it's used in the application
   - **Read this to understand the Avantis Service component**

### 5. **../BASE_ACCOUNT_INTEGRATION.md** 👤
   **Base Account integration details.**
   - Base Account authentication flow
   - Transaction signing implementation
   - Fallback wallet creation
   - API changes and limitations
   - **Reference for Base Account features**

### 6. **../BASE_ACCOUNT_VERIFICATION.md** ✅
   **Checklist for verifying Base Account integration.**
   - Authentication verification
   - Trading flow verification
   - API endpoint verification
   - **Use this to verify your Base Account setup**

### 7. **../FINAL_CHECKLIST.md** 📋
   **Pre-deployment checklist.**
   - Code quality checks
   - Environment variable verification
   - Service health checks
   - Base Mini App configuration
   - **Review before going live**

## 🎯 Quick Navigation

### I want to...
- **Deploy on my own server** → Start with `SERVER_DEPLOYMENT_PLAN.md`
- **Deploy quickly** → Use `DEPLOYMENT_QUICK_START.md`
- **Configure environment variables** → See `DEPLOYMENT_ENV_VARS.md`
- **Understand the Avantis Service** → Read `AVANTIS_API_URL_EXPLANATION.md`
- **Verify Base Account integration** → Check `../BASE_ACCOUNT_VERIFICATION.md`
- **Do a final check before deployment** → Review `../FINAL_CHECKLIST.md`

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Next.js App │  │   Trading    │  │   Avantis    │ │
│  │   (PM2)      │  │   Engine     │  │   Service    │ │
│  │  Port 3000   │  │   (PM2)      │  │ (systemd)    │ │
│  │              │  │  Port 3001   │  │  Port 8000   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┴─────────────────┘          │
│                         │                              │
│                    ┌─────▼─────┐                        │
│                    │   Nginx   │                        │
│                    │ (Port 80) │                        │
│                    │ (Port 443)│                       │
│                    └─────┬─────┘                        │
└──────────────────────────┼──────────────────────────────┘
                           │
                           │ HTTPS
                           │
                    ┌──────▼──────┐
                    │   Internet  │
                    │             │
                    │ Base Mini   │
                    │    Apps     │
                    └─────────────┘
```

## 📦 Deployment Files

### Configuration Files
- `ecosystem.config.js` - PM2 configuration for Node.js services
- `nginx-perpx-avantis.conf` - Nginx reverse proxy configuration
- `avantis-service.service` - systemd service file for Avantis Service
- `deploy.sh` - Automated deployment script

### Usage
1. Copy `nginx-perpx-avantis.conf` to `/etc/nginx/sites-available/perpx-avantis`
2. Copy `avantis-service.service` to `/etc/systemd/system/`
3. Run `deploy.sh` to install dependencies and start services

## 🔐 Security Notes

1. **Never commit `.env` files** to git
2. **Use strong secrets** for JWT_SECRET and ENCRYPTION_SECRET
3. **Keep services updated** regularly
4. **Use SSL certificates** (Let's Encrypt) for production
5. **Configure firewall** to only allow necessary ports
6. **Monitor logs** regularly for suspicious activity

## 🆘 Getting Help

If you encounter issues:
1. Check the relevant documentation file
2. Review logs: `pm2 logs` and `sudo journalctl -u avantis-service`
3. Verify environment variables are set correctly
4. Check service status: `pm2 list` and `sudo systemctl status avantis-service`
5. Review Nginx logs: `sudo tail -f /var/log/nginx/error.log`

## 📝 Next Steps

After deployment:
1. ✅ Verify all services are running
2. ✅ Test Base Account authentication
3. ✅ Configure Base Mini App URL in Base dashboard
4. ✅ Test trading functionality
5. ✅ Monitor logs for errors
6. ✅ Set up monitoring/alerting (optional)

---

**Happy Deploying! 🚀**

