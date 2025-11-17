# Indirect Call Analysis: USDC Transfer Bug

## Code Flow Trace

### Position Opening Flow:
1. **Trading Engine** (`trading-engine/avantis-trading.ts`)
   - Calls `openAvantisPosition()`
   - Sends POST to `/api/open-position`

2. **Avantis Service** (`avantis-service/main.py`)
   - Receives request at `/api/open-position`
   - Calls `open_position()` from `trade_operations.py`

3. **Trade Operations** (`avantis-service/trade_operations.py`)
   - `open_position()` function:
     - Line 56: Calls `await _ensure_usdc_approval(client, collateral)`
     - Line 59: Calls `await open_position_via_contract(...)`

4. **USDC Approval** (`_ensure_usdc_approval()`)
   - Line 191-198: Calls `trader_client.approve_usdc_for_trading(amount=amount_wei)`
   - **THIS IS WHERE THE TRANSFER LIKELY HAPPENED**

5. **Position Opening** (`open_position_via_contract()`)
   - Line 74-82: Calls `trader_client.write_contract('openPosition', collateralAmount=...)`
   - This passes `collateralAmount` as a parameter

## Direct Calls Found

### ✅ Direct SDK Method Calls:
1. **`approve_usdc_for_trading()`** - Called directly in `_ensure_usdc_approval()`
   - Location: `trade_operations.py:196`
   - This is the **most likely source** of the USDC transfer

2. **`write_contract('openPosition')`** - Called in `open_position_via_contract()`
   - Location: `contract_operations.py:74`
   - Passes `collateralAmount` as parameter
   - **Less likely** to cause transfer (should just call contract function)

## Root Cause Analysis

### Most Likely: SDK `approve_usdc_for_trading()` Bug

The transaction shows:
- **20 USDC transferred** to `0x763D460bD420111f1b539ce175f7A769b2cAB39E`
- This happened **before** position opening (which failed)
- The transfer amount (20 USDC) matches a typical collateral amount

**Conclusion**: The Avantis SDK's `approve_usdc_for_trading()` method is likely:
- Either doing a `transfer()` instead of `approve()`
- Or the method name is misleading and it's designed to transfer
- Or there's a bug in the SDK implementation

### Less Likely: Contract `openPosition()` Requirement

Some contracts require USDC to be transferred before opening positions, but:
- This is unusual (most use approval pattern)
- The transfer happened before the position opening attempt
- The position opening failed, so the transfer was wasted

### Unlikely: `write_contract()` Issue

The `write_contract()` method should just call the contract function with parameters. It shouldn't transfer USDC unless:
- The contract function itself does the transfer
- The SDK is incorrectly interpreting `collateralAmount` parameter

## Evidence

1. **Transaction timing**: USDC transfer happened before position opening failed
2. **Amount matches**: 20 USDC matches typical collateral amount
3. **Direct call**: `approve_usdc_for_trading()` is called directly before position opening
4. **No other transfer calls**: No direct `transfer()` calls found in our code

## Solution

### Immediate Fix:
1. ✅ **Added error handling** (done)
2. ✅ **Added logging** (done)
3. ⚠️ **TODO**: Verify SDK method behavior
4. ⚠️ **TODO**: Use direct contract calls for approval instead of SDK

### Recommended Approach:
Replace SDK approval with direct USDC contract call:

```python
from web3 import Web3
from eth_account import Account

# Direct USDC approval (bypass SDK)
usdc_abi = [{
    "constant": False,
    "inputs": [
        {"name": "_spender", "type": "address"},
        {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
}]

web3 = Web3(Web3.HTTPProvider(rpc_url))
account = Account.from_key(private_key)
usdc_contract = web3.eth.contract(address=USDC_ADDRESS, abi=usdc_abi)

tx = usdc_contract.functions.approve(
    spender=AVANTIS_TRADING_CONTRACT_ADDRESS,
    amount=amount_wei
).build_transaction({
    'from': account.address,
    'nonce': web3.eth.get_transaction_count(account.address),
    'gas': 100000,
    'gasPrice': web3.eth.gas_price
})

signed_tx = account.sign_transaction(tx)
tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)
```

This ensures we're doing an **approval**, not a **transfer**.

