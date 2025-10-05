# Docker Setup Guide for PrepX

This guide will help you install Docker and get the full monitoring stack running.

## 🐳 Install Docker on macOS

### Option 1: Docker Desktop (Recommended)

1. **Download Docker Desktop**:
   ```bash
   # Using Homebrew (requires password)
   brew install --cask docker
   
   # Or download manually from:
   # https://www.docker.com/products/docker-desktop/
   ```

2. **Start Docker Desktop**:
   ```bash
   open -a Docker
   ```

3. **Verify Installation**:
   ```bash
   docker --version
   docker-compose --version
   ```

### Option 2: Manual Installation

1. **Download Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/)
2. **Install the .dmg file**
3. **Launch Docker Desktop** from Applications
4. **Complete the setup wizard**

## 🚀 Deploy Full Monitoring Stack

Once Docker is installed, you can deploy the complete monitoring stack:

### 1. Create Environment File

```bash
# Create .env file with secure passwords
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_REPLICATION_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
INFLUXDB_PASSWORD=$(openssl rand -base64 32)
INFLUXDB_TOKEN=$(openssl rand -base64 64)
GRAFANA_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 64)
EOF
```

### 2. Start Monitoring Services

```bash
# Start only monitoring services
docker-compose up -d prometheus grafana

# Or start the full stack
docker-compose up -d
```

### 3. Access Monitoring Dashboards

- **Grafana**: http://localhost:3000 (admin/your_grafana_password)
- **Prometheus**: http://localhost:9090
- **InfluxDB**: http://localhost:8086 (admin/your_influxdb_password)

## 📊 Monitoring Features

### Grafana Dashboards
- **Database Performance**: PostgreSQL metrics, connection counts, query performance
- **System Resources**: CPU, memory, disk usage
- **Application Metrics**: Trading bot performance, user sessions
- **Real-time Alerts**: Database issues, high resource usage

### Prometheus Metrics
- `pg_up`: Database availability
- `pg_stat_database_tup_returned`: Query performance
- `redis_up`: Redis availability
- `kafka_consumer_lag`: Message queue lag

### InfluxDB Time Series
- Trading performance data
- Market data metrics
- User activity patterns

## 🔧 Troubleshooting

### Docker Not Starting
```bash
# Check Docker daemon
docker info

# Restart Docker Desktop
killall Docker && open -a Docker

# Check system requirements
system_profiler SPHardwareDataType
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000  # Grafana
lsof -i :9090  # Prometheus
lsof -i :8086  # InfluxDB

# Kill processes if needed
kill -9 <PID>
```

### Permission Issues
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER

# For macOS, restart Docker Desktop
```

## 🚀 Quick Start Commands

```bash
# 1. Install Docker
brew install --cask docker

# 2. Start Docker Desktop
open -a Docker

# 3. Wait for Docker to start, then:
docker --version

# 4. Deploy monitoring stack
docker-compose up -d prometheus grafana

# 5. Access dashboards
open http://localhost:3000  # Grafana
open http://localhost:9090  # Prometheus
```

## 📈 Next Steps

1. **Configure Grafana Dashboards**: Import custom dashboards for PrepX
2. **Set up Alerting**: Configure email/Slack notifications
3. **Add Custom Metrics**: Instrument your application code
4. **Scale Monitoring**: Add more exporters and metrics

## 🔗 Useful Links

- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [InfluxDB Documentation](https://docs.influxdata.com/influxdb/)

---

**Note**: The simple monitoring server (without Docker) is already running and provides basic health checks and metrics. The Docker-based monitoring stack provides more advanced features and visualizations.
