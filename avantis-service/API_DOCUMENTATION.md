# Avantis Trading Service API Documentation

## Base Mini App Integration

This service is designed for **multi-user Base Mini App** deployment. Each user provides their own credentials.

## Authentication Modes

### Base Accounts (Smart Wallets)
- **No Private Keys**: Base Accounts use account abstraction (ERC-4337)
- **Read Operations**: Use `address` parameter (no private key needed)
- **Write Operations**: Use transaction preparation endpoints, frontend signs via Base Account SDK

### Traditional Wallets
- **Private Keys**: Users provide their own private keys
- **All Operations**: Use `private_key` parameter for read and write operations

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

---

### Read Operations (Base Account Compatible)

#### Get Positions
```
GET /api/positions?address=0x...  # Base Account
GET /api/positions?private_key=0x...  # Traditional wallet
```

#### Get Balance
```
GET /api/balance?address=0x...  # Base Account
GET /api/balance?private_key=0x...  # Traditional wallet
```

#### Get Total PnL
```
GET /api/total-pnl?address=0x...  # Base Account
GET /api/total-pnl?private_key=0x...  # Traditional wallet
```

#### Get USDC Allowance
```
GET /api/usdc-allowance?address=0x...  # Base Account
GET /api/usdc-allowance?private_key=0x...  # Traditional wallet
```

---

### Write Operations (Traditional Wallets)

#### Open Position
```
POST /api/open-position
Content-Type: application/json

{
  "symbol": "BTC",
  "collateral": 100.0,
  "leverage": 10,
  "is_long": true,
  "tp": 45000.0,  # optional
  "sl": 40000.0,  # optional
  "private_key": "0x..."
}
```

#### Close Position
```
POST /api/close-position
Content-Type: application/json

{
  "pair_index": 0,
  "private_key": "0x..."
}
```

#### Close All Positions
```
POST /api/close-all-positions
Content-Type: application/json

{
  "private_key": "0x..."
}
```

#### Approve USDC
```
POST /api/approve-usdc
Content-Type: application/json

{
  "amount": 1000.0,  # 0 for unlimited
  "private_key": "0x..."
}
```

---

### Transaction Preparation (Base Accounts)

These endpoints prepare transaction data for Base Account signing. The frontend must sign and send transactions via Base Account SDK.

#### Prepare Open Position
```
POST /api/prepare/open-position
Content-Type: application/json

{
  "symbol": "BTC",
  "collateral": 100.0,
  "leverage": 10,
  "is_long": true,
  "address": "0x...",  # Base Account address
  "tp": 45000.0,  # optional
  "sl": 40000.0  # optional
}

Response:
{
  "success": true,
  "transaction": {
    "to": "0x...",  # Contract address
    "data": "0x",  # Frontend must encode function call
    "value": "0x0",
    "from": "0x..."
  },
  "params": {...},
  "note": "Sign this transaction via Base Account SDK"
}
```

#### Prepare Close Position
```
POST /api/prepare/close-position
Content-Type: application/json

{
  "pair_index": 0,
  "address": "0x..."  # Base Account address
}
```

#### Prepare Approve USDC
```
POST /api/prepare/approve-usdc
Content-Type: application/json

{
  "amount": 1000.0,  # 0 for unlimited
  "address": "0x..."  # Base Account address
}
```

---

### Utilities

#### Get Supported Symbols
```
GET /api/symbols
```

Returns list of all supported trading symbols.

---

## Frontend Integration (Base Accounts)

### Example: Open Position with Base Account

```typescript
// 1. Get Base Account address
const address = await getBaseAccountAddress(); // From Base Account SDK

// 2. Prepare transaction
const response = await fetch('/api/prepare/open-position', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'BTC',
    collateral: 100,
    leverage: 10,
    is_long: true,
    address: address
  })
});

const { transaction, params } = await response.json();

// 3. Encode function call (using ethers.js or web3.js)
const iface = new ethers.Interface(ABI);
const data = iface.encodeFunctionData('openPosition', [
  params.pair_index,
  params.collateral_wei,
  params.leverage,
  params.is_long
]);

// 4. Sign and send via Base Account SDK
const txHash = await sdk.provider.request({
  method: 'eth_sendTransaction',
  params: [{
    to: transaction.to,
    data: data,
    value: transaction.value,
    from: address
  }]
});

// 5. Wait for confirmation
await waitForTransaction(txHash);
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error

Error response format:
```json
{
  "detail": "Error message description"
}
```

---

## Rate Limiting

**Note**: Rate limiting should be implemented in production. Consider:
- Per-address rate limiting for Base Accounts
- Per-private-key rate limiting for traditional wallets
- Global rate limiting

---

## Security Considerations

1. **HTTPS Required**: All API calls must use HTTPS in production
2. **Private Keys**: Never log or store private keys
3. **Address Validation**: All addresses are validated before use
4. **Input Validation**: All inputs are validated using Pydantic models
5. **CORS**: Configured to only allow specified origins

---

## Production Deployment

See `PRODUCTION_CHECKLIST.md` for complete deployment guide.

