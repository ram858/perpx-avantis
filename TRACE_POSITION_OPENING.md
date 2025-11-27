# Tracing Position Opening - Where Funds Go

## Problem

When opening a position, funds are being transferred to `0x1f4Ef1eD23E38dAA2BD1451D4CEF219C93B2016F`, which is:
- ❌ NOT a contract (it's an EOA - wallet address)
- ❌ NOT in your database
- ❌ NOT your trading wallet (`0x1412C1...`)

## What We Added

### 1. Address Verification in Trade Operations
- Verifies private key derives to expected address BEFORE creating Avantis client
- Logs the derived address for debugging
- Catches address mismatches early

### 2. Trading Address Logging
- Logs the address from the signer when opening positions
- Logs the Trading contract address
- Logs where funds are being transferred FROM and TO

## How to Debug

When you start a position, check the logs for:

```
🔍 [TRADE_OPS] Private key provided: 0xab9c1552...c29e
🔍 [TRADE_OPS] Derived address from private key: 0x...
🔍 [TRADE_OPS] Trading address from signer: 0x...
🔍 [CONTRACT_OPS] Trading contract address: 0x...
🔍 [CONTRACT_OPS] Transaction will be sent TO: 0x...
🔍 [CONTRACT_OPS] Funds will be transferred FROM: 0x...
```

## Expected Flow

1. **Private Key** → Derives to your trading wallet: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`
2. **Trading Contract** → Should be the Avantis Trading contract (not `0x1f4Ef1eD...`)
3. **Funds Transfer** → FROM your wallet TO Trading contract (via approval + openTrade)

## If Address Mismatch Found

If logs show a different address:
1. Check what private key is being passed to the Avantis service
2. Verify the private key in your database matches your UI wallet
3. Check if there's a different private key being used somewhere

## Next Steps

1. **Start a position** and check the logs
2. **Compare addresses** in the logs with your database
3. **Identify** where the wrong address is coming from
4. **Fix** the source of the wrong private key/address

