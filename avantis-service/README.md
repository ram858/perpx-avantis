# Avantis Trading Service

FastAPI microservice for integrating Avantis trading protocol into the PrepX application.

## 🚀 Features

- **Position Management**: Open, close, and monitor trading positions
- **Balance Queries**: Get account balance and USDC allowance
- **Symbol Support**: Registry-based symbol to pair index mapping
- **USDC Approval**: Automatic USDC approval for trading
- **Error Handling**: Comprehensive error handling with retry logic
- **Docker Support**: Containerized deployment ready

## 📋 Prerequisites

- Python 3.11+
- Docker and Docker Compose (optional, for containerized deployment)
- Avantis testnet/mainnet access
- Ethereum private key for trading

## 🛠️ Installation

### Local Development

**Quick Setup (Recommended):**

- **Windows (PowerShell):**
  ```powershell
  .\setup.ps1
  ```

- **Linux/Mac:**
  ```bash
  chmod +x setup.sh
  ./setup.sh
  ```

**Manual Setup:**

1. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the service**
   ```bash
   python main.py
   # Or with uvicorn directly:
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Or build and run manually**
   ```bash
   docker build -t avantis-service .
   docker run -p 8000:8000 --env-file .env avantis-service
   ```

## 🔧 Configuration

### Environment Variables

- `HOST`: Server host (default: `0.0.0.0`)
- `PORT`: Server port (default: `8000`)
- `DEBUG`: Debug mode (default: `false`)
- `AVANTIS_NETWORK`: Network (`base-testnet` or `base-mainnet`)
- `AVANTIS_PK`: Ethereum private key (required)
- `AVANTIS_RPC_URL`: Base network RPC URL
- `MAX_RETRIES`: Maximum retry attempts (default: `3`)
- `RETRY_DELAY`: Retry delay in seconds (default: `1.0`)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

## 📡 API Endpoints

### Health Check
- `GET /health` - Service health status

### Trading Operations
- `POST /api/open-position` - Open a trading position
- `POST /api/close-position` - Close a specific position
- `POST /api/close-all-positions` - Close all positions

### Queries
- `GET /api/positions` - Get all open positions
- `GET /api/balance` - Get account balance
- `GET /api/total-pnl` - Get total unrealized PnL
- `GET /api/usdc-allowance` - Get USDC allowance
- `POST /api/approve-usdc` - Approve USDC for trading

### Utilities
- `GET /api/symbols` - Get all supported symbols

## 📝 API Examples

### Open Position
```bash
curl -X POST "http://localhost:8000/api/open-position" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "collateral": 100.0,
    "leverage": 10,
    "is_long": true,
    "tp": 45000.0,
    "sl": 40000.0
  }'
```

### Get Positions
```bash
curl "http://localhost:8000/api/positions"
```

### Get Balance
```bash
curl "http://localhost:8000/api/balance"
```

### Approve USDC
```bash
curl -X POST "http://localhost:8000/api/approve-usdc" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000.0
  }'
```

## 🔍 Symbol Registry

The service includes a symbol registry mapping common trading symbols to Avantis pair indices. Supported symbols:

- BTC, ETH, SOL, AVAX, MATIC
- ARB, OP, LINK, UNI, AAVE
- ATOM, DOT, ADA, XRP, DOGE, BNB

**Note**: Pair indices need to be updated based on actual Avantis API or configuration.

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test with Python
python -c "import requests; print(requests.get('http://localhost:8000/health').json())"
```

## 📦 Project Structure

```
avantis-service/
├── main.py                 # FastAPI application
├── config.py               # Configuration management
├── avantis_client.py       # Avantis SDK client wrapper
├── trade_operations.py     # Trade execution functions
├── position_queries.py     # Position and balance queries
├── symbols/
│   ├── __init__.py
│   └── symbol_registry.py  # Symbol to pair index mapping
├── requirements.txt        # Python dependencies
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
├── .env.example           # Environment variables template
└── README.md              # This file
```

## 🔐 Security Notes

- Private keys should never be committed to version control
- Use environment variables for sensitive configuration
- Enable HTTPS in production
- Implement rate limiting for production use
- Add authentication/authorization for production

## 🐛 Troubleshooting

### Connection Issues
- Verify RPC URL is correct for the network
- Check network connectivity
- Ensure private key is correctly formatted (with 0x prefix)

### SDK Errors
- Verify Avantis SDK is installed: `pip show avantis-trader-sdk`
- Check SDK version compatibility
- Review Avantis SDK documentation for API changes

### Symbol Not Found
- Verify symbol is in the registry
- Check symbol format (uppercase, no spaces)
- Update symbol registry if needed

## 📄 License

MIT License - See LICENSE file for details

