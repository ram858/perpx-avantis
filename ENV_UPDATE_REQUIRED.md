# Environment Variable Update Required

## Issue: Testnet Banner Still Showing

The `.env.local` file has testnet configuration. Update it to mainnet:

### Update `.env.local`:

Change these lines:
```bash
# OLD (testnet):
AVANTIS_NETWORK=base-testnet
NEXT_PUBLIC_AVANTIS_NETWORK=base-testnet

# NEW (mainnet):
AVANTIS_NETWORK=base-mainnet
NEXT_PUBLIC_AVANTIS_NETWORK=base-mainnet
```

### After updating:

1. Restart the frontend server (npm run dev)
2. The testnet banner should disappear
3. Network will be set to mainnet

## Current Status

- ✅ Wallet creation fixed (will error if fails)
- ✅ Positions API fixed (supports web users, requires auth token)
- ⚠️ Network config needs manual update in `.env.local`

