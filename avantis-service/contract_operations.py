"""
Contract interaction operations for Avantis trading.

Refactored, Optimized, and Battle-Tested.
"""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from decimal import Decimal

# Import Web3 libraries (needed for manual fallback)
from web3 import Web3, AsyncWeb3

logger = logging.getLogger(__name__)

# --- Constants ---
# Updated: Avantis UI allows $10 minimum, so we match that
# Previous $20 was too conservative - actual minimum is $10 as confirmed by Avantis UI
MIN_COLLATERAL_USDC = 10.0  # Protocol minimum (matches Avantis UI - allows $10 minimum)
USDC_DECIMALS = 6
PRICE_DECIMALS = 10         # Avantis uses 10 decimals for price/TP/SL in structs
SLIPPAGE_DEFAULT = 1.0      # 1%

# --- SDK Import Handling ---
try:
    from avantis_trader_sdk.types import TradeInput, TradeInputOrderType
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    TradeInput = None  # type: ignore
    TradeInputOrderType = None  # type: ignore
    logger.warning("⚠️ Avantis SDK not found. Install via: pip install avantis-trader-sdk")

# ==========================================
# 1. Validation & Pre-flight Checks
# ==========================================

def validate_trade_params(
    collateral_amount: float,
    leverage: int,
    pair_index: int,
) -> None:
    """
    Fast validation to catch errors before network calls.
    CRITICAL: This prevents fund loss by catching errors BEFORE any transfers.
    
    Note on Leverage Limits:
    - Current validation: 2x-50x (conservative default)
    - Actual Avantis limits vary by asset class:
      * Crypto assets: typically up to 100x
      * Forex: up to 75x
      * Commodities: varies by asset
    - The 50x cap here is a conservative safety limit
    - To support higher leverage for crypto, consider adding asset-specific validation
    """
    if collateral_amount < MIN_COLLATERAL_USDC:
        raise ValueError(
            f"❌ CRITICAL: Collateral ${collateral_amount} is below protocol minimum ${MIN_COLLATERAL_USDC}. "
            f"DO NOT attempt trade - funds will be transferred but position will fail with BELOW_MIN_POS!"
        )
    
    if not 2 <= leverage <= 50:
        raise ValueError(f"Leverage {leverage}x is out of range (2x-50x).")
    
    if pair_index < 0:
        raise ValueError(f"Invalid pair index: {pair_index}")

async def _manual_approve_usdc(
    trader_client,
    trader_address: str,
    amount: float
) -> None:
    """
    Manual USDC approval with fixed gas limit (fallback when SDK gas estimation fails).
    """
    try:
        from web3 import Web3 as Web3Type
        import inspect
        w3 = trader_client.web3 if hasattr(trader_client, 'web3') else None
        if not w3:
            from avantis_client import get_avantis_client
            from config import settings
            from web3 import Web3
            rpc_url = settings.avantis_rpc_url or "https://mainnet.base.org"
            w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        # Get trading contract address from SDK
        TradingContract = trader_client.contracts.get("Trading")
        if not TradingContract:
            raise ValueError("Could not find Trading contract")
        
        trading_contract_address = TradingContract.address if hasattr(TradingContract, 'address') else str(TradingContract)
        
        # USDC contract
        usdc_address = Web3Type.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
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
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        
        # Convert amount to wei (USDC has 6 decimals)
        amount_wei = int(amount * 1e6)
        
        # Build transaction with manual gas limit
        trader_address_checksum = Web3Type.to_checksum_address(trader_address)
        # FIXED: Use "pending" state to include pending transactions and prevent nonce errors
        nonce = w3.eth.get_transaction_count(trader_address_checksum, 'pending')
        
        approve_tx = usdc_contract.functions.approve(
            Web3Type.to_checksum_address(trading_contract_address),
            amount_wei
        ).build_transaction({
            "from": trader_address_checksum,
            "nonce": nonce,
            "gas": 100000,  # Fixed gas limit for approval (usually ~46k, using 100k for safety)
            "gasPrice": w3.eth.gas_price,
        })
        
        # Sign and send directly with web3 (bypass SDK's gas estimation)
        if hasattr(trader_client, 'signer') and hasattr(trader_client.signer, 'private_key'):
            private_key = trader_client.signer.private_key
        elif hasattr(trader_client, 'private_key'):
            private_key = trader_client.private_key
        else:
            raise ValueError("Could not find private key for signing")
        
        # Sign transaction
        signed_tx = w3.eth.account.sign_transaction(approve_tx, private_key)
        
        # Send transaction - run sync web3 calls in executor for async context
        import asyncio
        tx_hash = await asyncio.to_thread(w3.eth.send_raw_transaction, signed_tx.rawTransaction)
        
        # Wait for receipt - run sync web3 calls in executor for async context
        receipt = await asyncio.to_thread(w3.eth.wait_for_transaction_receipt, tx_hash)
        
        # Get transaction hash (handle both dict and object formats)
        tx_hash_str = receipt.get('transactionHash') if isinstance(receipt, dict) else getattr(receipt, 'transactionHash', None)
        if tx_hash_str:
            if hasattr(tx_hash_str, 'hex'):
                tx_hash_str = tx_hash_str.hex()
            elif isinstance(tx_hash_str, bytes):
                tx_hash_str = tx_hash_str.hex()
            else:
                tx_hash_str = str(tx_hash_str)
        else:
            tx_hash_str = "unknown"
        
        logger.info(f"✅ Manual approval successful: {tx_hash_str}")
        
    except Exception as e:
        logger.error(f"❌ Manual approval failed: {e}")
        raise

async def check_and_approve_usdc(
    trader_client,
    trader_address: str,
    required_amount: float
) -> None:
    """
    Checks wallet balance and allowance. Approves if necessary.
    Does NOT move funds - only grants permission for openTrade to pull funds.
    """
    try:
        # 1. Check WALLET Balance (Not Vault Balance)
        # We need to make sure your wallet has the cash.
        w3 = trader_client.web3 if hasattr(trader_client, 'web3') else None
        if not w3:
            # Fallback: get web3 from client
            from config import settings
            from web3 import Web3
            rpc_url = settings.avantis_rpc_url or "https://mainnet.base.org"
            w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        from web3 import Web3 as Web3Type
        usdc_address = Web3Type.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")  # Base mainnet USDC
        usdc_abi = [{"constant":True,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}]
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        wallet_balance_wei = usdc_contract.functions.balanceOf(trader_address).call()
        balance_usdc = float(wallet_balance_wei) / 1e6
        
        logger.info(f"💰 Wallet Balance: ${balance_usdc:.2f} | Required: ${required_amount:.2f}")
        
        if balance_usdc < required_amount:
            raise ValueError(f"Insufficient USDC in Wallet. Have ${balance_usdc:.2f}, Need ${required_amount:.2f}")

        # 2. Check Allowance
        allowance_raw = await trader_client.get_usdc_allowance_for_trading()
        allowance_usdc = float(allowance_raw) if allowance_raw else 0
        
        # 3. Approve if needed
        if allowance_usdc < required_amount:
            logger.info(f"🔓 Approving contract (Current allowance: ${allowance_usdc:.2f})...")
            
            # This grants Permission, it does not move money yet.
            await _manual_approve_usdc(trader_client, trader_address, required_amount * 10) 
            logger.info("✅ USDC Approved.")
            await asyncio.sleep(2)
        else:
            logger.info("✅ Allowance sufficient.")
        
    except Exception as e:
        logger.error(f"❌ Pre-flight check failed: {e}")
        raise

# ==========================================
# 2. Main Trading Functions
# ==========================================

async def open_position_via_contract(
    trader_client,
    pair_index: int,
    collateral_amount: float,
    leverage: int,
    is_long: bool,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None,
    slippage_percentage: float = SLIPPAGE_DEFAULT
) -> Dict[str, Any]:
    """
    Opens a position using Direct Manual Method (fast, reliable, proven).
    Uses manual transaction construction that matches the contract ABI exactly.
    """
    if not SDK_AVAILABLE:
        raise ImportError("Avantis SDK is required to execute trades.")
    
    if TradeInput is None or TradeInputOrderType is None:
        raise ImportError("TradeInput or TradeInputOrderType not available - SDK not properly imported.")

    # ==========================================
    # 🛡️ LAYER 2: Parameter Validation
    # ==========================================
    # GUARANTEE: Invalid parameters rejected before any network calls
    validate_trade_params(collateral_amount, leverage, pair_index)

    # Step 2: Get Address & Run Checks
    signer = trader_client.get_signer()
    trader_address = signer.get_ethereum_address()
    
    # CRITICAL: Log the address being used for trading
    logger.info(f"🔍 [CONTRACT_OPS] Trading address from signer: {trader_address}")
    logger.info(f"🔍 [CONTRACT_OPS] This address will receive/use funds for position opening")
    
    # ==========================================
    # 🛡️ LAYER 3: Minimum Collateral Check
    # ==========================================
    # Additional safety: Check if collateral meets minimum (prevent BELOW_MIN_POS)
    # GUARANTEE: Below-minimum collateral blocks trade BEFORE any transfers
    if collateral_amount < MIN_COLLATERAL_USDC:
        raise ValueError(
            f"❌ COLLATERAL TOO LOW: ${collateral_amount:.2f} is below minimum ${MIN_COLLATERAL_USDC:.2f}. "
            f"DO NOT attempt trade - funds will be transferred but position will fail with BELOW_MIN_POS!"
        )
    
    logger.info(f"✅ Pre-validation passed: Collateral ${collateral_amount:.2f} >= Minimum ${MIN_COLLATERAL_USDC:.2f}")

    # Step 3: Prepare Data
    # Get current price estimate (needed for manual fallback limit price)
    try:
        pair_name = await trader_client.pairs_cache.get_pair_name_from_index(pair_index)
        price_data = await trader_client.feed_client.get_latest_price_updates([pair_name])
        # Use a high precision int for contract interaction
        current_price_int = int(price_data.parsed[0].converted_price * (10 ** PRICE_DECIMALS))
        logger.info(f"📊 Fetched price for {pair_name}: {price_data.parsed[0].converted_price} (int: {current_price_int})")
    except Exception as price_error:
        # For market orders, price can be 0, but contract might need a valid price
        logger.warning(f"Could not fetch real-time price: {price_error}, using market order (price=0)")
        current_price_int = 0  # Market order usually handles this
        pair_name = f"Pair-{pair_index}"

    # Create SDK Input Object
    # Convert to proper types (TradeInput expects int for amounts)
    collateral_wei = int(collateral_amount * (10 ** USDC_DECIMALS))
    
    # Store original collateral_wei for manual fallback (TradeInput may transform it)
    original_collateral_wei = collateral_wei
    
    trade_input = TradeInput(
        trader=trader_address,
        pair_index=pair_index,
        trade_index=0,
        open_collateral=collateral_wei,
        collateral_in_trade=collateral_wei,
        open_price=0,  # 0 implies Market Order in SDK
        is_long=is_long,
        leverage=leverage,
        tp=int(take_profit * (10 ** PRICE_DECIMALS)) if take_profit else 0,
        sl=int(stop_loss * (10 ** PRICE_DECIMALS)) if stop_loss else 0,
        timestamp=0
    )
    
    logger.info(f"📝 Created TradeInput: open_collateral={collateral_wei}, original_collateral_wei={original_collateral_wei}")

    # ==========================================
    # 💰 CRITICAL: Opening Fee Calculation
    # ==========================================
    # Calculate opening fee (0.04% - 0.1% of position size, varies by market skew)
    # This must be done BEFORE approval to ensure wallet has sufficient balance
    opening_fee = 0.0
    opening_fee_percentage = 0.0
    try:
        if hasattr(trader_client, 'fee_parameters') and hasattr(trader_client.fee_parameters, 'get_opening_fee'):
            opening_fee_raw = await trader_client.fee_parameters.get_opening_fee(trade_input=trade_input)
            # Convert from wei to USDC (6 decimals)
            opening_fee = float(opening_fee_raw) / (10 ** USDC_DECIMALS) if opening_fee_raw else 0.0
            opening_fee_percentage = (opening_fee / collateral_amount * 100) if collateral_amount > 0 else 0.0
            logger.info(f"💰 Opening fee: ${opening_fee:.4f} USDC ({opening_fee_percentage:.4f}%)")
        else:
            logger.warning("⚠️ Fee parameters not available, using 0 for opening fee calculation")
    except Exception as fee_error:
        logger.warning(f"⚠️ Could not calculate opening fee: {fee_error}. Continuing with collateral only.")
        opening_fee = 0.0
    
    # Calculate total required funds (collateral + opening fee)
    total_required = collateral_amount + opening_fee
    
    # ==========================================
    # 🛡️ Loss Protection Information (Optional)
    # ==========================================
    # Avantis provides loss rebates on trades that help balance platform OI skew
    loss_protection_percentage = None
    loss_protection_amount = None
    try:
        if hasattr(trader_client, 'trading_parameters') and hasattr(trader_client.trading_parameters, 'get_loss_protection_for_trade_input'):
            loss_protection_info = await trader_client.trading_parameters.get_loss_protection_for_trade_input(
                trade_input,
                opening_fee_usdc=opening_fee
            )
            if loss_protection_info:
                # Extract loss protection data (structure may vary by SDK version)
                loss_protection_percentage = getattr(loss_protection_info, 'percentage', getattr(loss_protection_info, 'loss_protection_percentage', None))
                loss_protection_amount = getattr(loss_protection_info, 'amount', getattr(loss_protection_info, 'loss_protection_amount', None))
                
                if loss_protection_percentage is not None:
                    if loss_protection_amount is None:
                        # Calculate amount if not provided
                        loss_protection_amount = collateral_amount * (loss_protection_percentage / 100)
                    logger.info(f"🛡️ Loss protection: {loss_protection_percentage:.2f}% (up to ${loss_protection_amount:.2f})")
    except Exception as loss_prot_error:
        # This is informational only - don't fail if it errors
        logger.debug(f"Could not fetch loss protection info: {loss_prot_error}")
    
    # ==========================================
    # 💰 Trade Cost Breakdown
    # ==========================================
    logger.info(f"💰 Trade Cost Breakdown:")
    logger.info(f"   - Collateral: ${collateral_amount:.2f}")
    logger.info(f"   - Opening Fee: ${opening_fee:.4f} ({opening_fee_percentage:.4f}%)")
    logger.info(f"   - Total Required: ${total_required:.2f}")
    
    # ==========================================
    # 🛡️ LAYER 4: USDC Approval (Wallet Balance Check + Approval)
    # ==========================================
    # GUARANTEE: No USDC operations until all safeguards pass
    # check_and_approve_usdc checks wallet balance and approves if needed
    # It does NOT transfer funds - only grants permission for openTrade to pull funds
    # CRITICAL: Use total_required (collateral + fee) to ensure sufficient balance
    await check_and_approve_usdc(trader_client, trader_address, total_required)

    # Step 4: Build & Execute Transaction
    # Use Manual Fallback directly (proven to work reliably)
    try:
        logger.info(f"🚀 Opening Position: {pair_name} | {leverage}x {'LONG' if is_long else 'SHORT'} | ${collateral_amount}")
        
        # Build transaction using manual fallback (direct, fast, reliable)
        open_tx = await _build_manual_open_tx(
            trader_client, 
            trader_address, 
            trade_input,
            current_price_int, 
            slippage_percentage,
            original_collateral_wei,  # Use the original value we calculated
            leverage  # Pass leverage directly (TradeInput.leverage is wrong)
        )
        logger.info("✅ Transaction built via Manual Method.")
        
        # Step 5: Sign & Send (Securely)
        receipt = await trader_client.sign_and_get_receipt(open_tx)
        
        # Format receipt with opening fee information
        return _format_receipt(
            receipt, 
            pair_index, 
            "open",
            opening_fee=opening_fee,
            total_cost=total_required,
            collateral_amount=collateral_amount
        )
    except Exception as e:
        error_msg = str(e)
        # Check for BELOW_MIN_POS error (contract-level validation)
        if 'BELOW_MIN_POS' in error_msg or 'execution reverted: BELOW_MIN_POS' in error_msg:
            logger.error(f"❌ Position size below minimum: {error_msg}")
            raise ValueError(
                f"Position size ${collateral_amount} is below the contract's minimum requirement. "
                f"Please increase your collateral amount. The minimum is ${MIN_COLLATERAL_USDC} USDC."
            )
        logger.error(f"❌ Trade Failed: {e}", exc_info=True)
        raise

async def _build_manual_open_tx(trader_client, trader_address, trade_input, current_price_int, slippage, collateral_wei_override=None, leverage_override=None):
    """
    Direct manual construction of openTrade transaction.
    This method is proven to work reliably and is faster than SDK attempts.
    
    IMPORTANT: The struct must match the Solidity contract exactly.
    """
    TradingContract = trader_client.contracts.get("Trading")
    if not TradingContract:
        raise ValueError("Trading contract not loaded.")

    # Extract values from TradeInput object
    pair_idx = getattr(trade_input, 'pairIndex', getattr(trade_input, 'pair_index', 0))
    
    # Use override value (from original calculation) - this is the reliable source
    if collateral_wei_override and collateral_wei_override > 0:
        collateral_wei = collateral_wei_override
    else:
        # Fallback: try to extract from TradeInput (may have wrong decimals)
        collateral_wei = getattr(trade_input, 'open_collateral', 0)
        if collateral_wei == 0:
            collateral_wei = getattr(trade_input, 'collateral_in_trade', 0)
        
        if isinstance(collateral_wei, float):
            collateral_wei = int(collateral_wei)
        
        if collateral_wei == 0:
            raise ValueError("Collateral amount is 0 - cannot open position")
    
    is_long_val = getattr(trade_input, 'buy', getattr(trade_input, 'is_long', True))
    
    # CRITICAL: Use leverage_override if provided (from original function call)
    # TradeInput.leverage can be wrong (shows 100000000000x instead of 10x)
    if leverage_override and 2 <= leverage_override <= 50:
        leverage_val = leverage_override
        logger.info(f"✅ Using override leverage: {leverage_val}x")
    else:
        leverage_val = getattr(trade_input, 'leverage', 1)
        # Validate leverage (standardized to 2x-50x)
        if leverage_val > 50 or leverage_val < 2:
            logger.warning(f"⚠️ Invalid leverage from TradeInput: {leverage_val}, defaulting to 5x")
            leverage_val = 5
    
    # TP/SL are already in wei from trade_input
    tp_val = getattr(trade_input, 'tp', 0)
    sl_val = getattr(trade_input, 'sl', 0)
    if isinstance(tp_val, float):
        tp_val = int(tp_val)
    if isinstance(sl_val, float):
        sl_val = int(sl_val)
    
    # CRITICAL: Verify trader_address is correct before building trade struct
    logger.info(f"🔍 [CONTRACT_OPS] Building trade struct with trader: {trader_address}")
    
    # Build trade struct matching contract ABI exactly
    trade_struct = {
        'trader': trader_address,  # CRITICAL: This must match the signer address
        'pairIndex': pair_idx,
        'index': 0,
        'initialPosToken': 0,
        'positionSizeUSDC': collateral_wei,  # Contract ABI field name
        'openPrice': 0,  # Market orders use 0
        'buy': is_long_val,
        'leverage': leverage_val,
        'tp': tp_val,
        'sl': sl_val,
        'timestamp': 0,
    }
    
    logger.info(f"🔍 [CONTRACT_OPS] Trade struct trader field: {trade_struct['trader']}")

    collateral_usdc = collateral_wei / 1e6
    logger.info(f"🔧 Building TX: {pair_idx} | ${collateral_usdc:.2f} | {leverage_val}x | {'LONG' if is_long_val else 'SHORT'}")

    # Get execution fee and nonce
    try:
        execution_fee = await trader_client.trade.get_trade_execution_fee()
    except Exception as e:
        logger.warning(f"Fee fetch failed, using default: {e}")
        execution_fee = int(0.0001 * 10**18)  # Default for Base
    
    # FIXED: Fetch nonce with "pending" state to include pending transactions
    # This prevents "nonce too low" errors when multiple transactions are sent
    try:
        from web3 import Web3 as Web3Type
        from config import settings
        import asyncio
        
        # Get RPC URL from settings or default
        rpc_url = settings.avantis_rpc_url or 'https://mainnet.base.org'
        
        # Create web3 instance to fetch nonce
        w3 = Web3Type(Web3Type.HTTPProvider(rpc_url))
        trader_address_checksum = Web3Type.to_checksum_address(trader_address)
        
        # Fetch nonce with "pending" state - CRITICAL to include pending transactions
        # This prevents "nonce too low" errors
        nonce = await asyncio.to_thread(
            w3.eth.get_transaction_count, 
            trader_address_checksum, 
            'pending'  # Include pending transactions
        )
        
        logger.info(f"✅ Fetched nonce with pending state: {nonce} (address: {trader_address_checksum[:10]}...)")
    except Exception as e:
        logger.error(f"❌ Failed to fetch nonce: {e}", exc_info=True)
        raise ValueError(f"Could not fetch transaction nonce: {e}")
    
    slippage_contract_units = int(slippage * 1e8)  # 1% = 1e8

    # CRITICAL: Log Trading contract address before building transaction
    trading_contract_address = TradingContract.address if hasattr(TradingContract, 'address') else 'UNKNOWN'
    logger.info(f"🔍 [CONTRACT_OPS] Trading contract address: {trading_contract_address}")
    logger.info(f"🔍 [CONTRACT_OPS] Transaction will be sent TO: {trading_contract_address}")
    logger.info(f"🔍 [CONTRACT_OPS] Funds will be transferred FROM: {trader_address}")
    logger.info(f"🔍 [CONTRACT_OPS] Trade struct trader field: {trade_struct.get('trader', 'MISSING')}")
    
    # Build transaction (async for AsyncContract)
    contract_func = TradingContract.functions.openTrade(
        trade_struct,
        0,  # OrderType.MARKET
        slippage_contract_units
    )
    
    # Get current gas price and add 20% to allow replacing pending transactions
    try:
        from web3 import Web3 as Web3Type
        from config import settings
        rpc_url = settings.avantis_rpc_url or 'https://mainnet.base.org'
        w3_gas = Web3Type(Web3Type.HTTPProvider(rpc_url))
        base_gas_price = await asyncio.to_thread(lambda: w3_gas.eth.gas_price)
        # Add 20% to gas price to allow replacing pending transactions if needed
        gas_price = int(base_gas_price * 1.2)
        logger.info(f"⛽ Gas price: {gas_price / 1e9:.2f} gwei (base: {base_gas_price / 1e9:.2f} gwei)")
    except Exception as e:
        logger.warning(f"Could not fetch gas price, using default: {e}")
        gas_price = None  # Let web3 estimate
    
    tx_params = {
        "from": trader_address,
        "value": execution_fee,
        "chainId": trader_client.chain_id,
        "nonce": nonce,
        "gas": 1000000,  # Fixed gas limit
    }
    
    # Add gas price if we fetched it (allows replacing pending transactions)
    if gas_price:
        tx_params["gasPrice"] = gas_price
    
    # CRITICAL: Build transaction and verify the "to" address
    tx = await contract_func.build_transaction(tx_params)
    
    # CRITICAL: Verify transaction destination address
    if 'to' in tx:
        tx_to_address = tx['to']
        logger.info(f"🔍 [CONTRACT_OPS] Transaction 'to' address: {tx_to_address}")
        
        # Verify it's the Trading contract, not an EOA
        if tx_to_address.lower() == trading_contract_address.lower():
            logger.info(f"✅ [CONTRACT_OPS] Transaction destination is correct: Trading contract")
        else:
            logger.error(f"❌ [CONTRACT_OPS] CRITICAL: Transaction destination mismatch!")
            logger.error(f"   Expected: {trading_contract_address}")
            logger.error(f"   Actual: {tx_to_address}")
            logger.error(f"   This will cause funds to go to the wrong address!")
            raise ValueError(
                f"Transaction destination address mismatch: Expected Trading contract {trading_contract_address}, "
                f"but transaction is being sent to {tx_to_address}. This will cause funds to be lost!"
            )
    else:
        logger.warning(f"⚠️ [CONTRACT_OPS] Transaction missing 'to' field - this is unusual")
    
    # CRITICAL: Verify trader address in trade struct matches signer address
    if trade_struct.get('trader', '').lower() != trader_address.lower():
        logger.error(f"❌ [CONTRACT_OPS] CRITICAL: Trade struct trader mismatch!")
        logger.error(f"   Signer address: {trader_address}")
        logger.error(f"   Trade struct trader: {trade_struct.get('trader', 'MISSING')}")
        logger.error(f"   This will cause funds to go to the wrong address!")
        raise ValueError(
            f"Trade struct trader address mismatch: Signer is {trader_address} but trade struct has {trade_struct.get('trader')}. "
            f"This will cause funds to be sent to the wrong address!"
        )
    
    logger.info(f"✅ [CONTRACT_OPS] All address validations passed")
    
    return tx

# ==========================================
# 3. Position Management (Close/Read)
# ==========================================

async def close_position_via_contract(
    trader_client,
    pair_index: int,
    trade_index: int = 0
) -> Dict[str, Any]:
    """Closes a specific position."""
    try:
        signer = trader_client.get_signer()
        trader_address = signer.get_ethereum_address()

        # Find the trade first to get current collateral (needed for closure)
        trades, _ = await trader_client.trade.get_trades(trader_address)
        target_trade = next(
            (t for t in trades if t.trade.pair_index == pair_index and t.trade.trade_index == trade_index), 
            None
        )

        if not target_trade:
            raise ValueError(f"Position not found for Pair {pair_index}")

        # Build Close TX
        logger.info(f"🔒 Closing position on Pair {pair_index}...")
        close_tx = await trader_client.trade.build_trade_close_tx(
            pair_index=pair_index,
            trade_index=trade_index,
            collateral_to_close=target_trade.trade.open_collateral,  # Close 100%
            trader=trader_address
        )

        receipt = await trader_client.sign_and_get_receipt(close_tx)
        return _format_receipt(receipt, pair_index, "close")
    except Exception as e:
        logger.error(f"Error closing position: {e}")
        raise

async def close_all_positions_via_contract(trader_client) -> Dict[str, Any]:
    """Closes all open positions for a trader."""
    try:
        signer = trader_client.get_signer()
        trader_address = signer.get_ethereum_address()
        
        # Get all trades
        trades, _ = await trader_client.trade.get_trades(trader_address)
        
        if not trades:
            return {
                "closed_count": 0,
                "tx_hashes": [],
                "total_pnl": 0.0
            }
        
        tx_hashes = []
        total_pnl = 0.0
        
        # Close each position
        for trade_wrapper in trades:
            trade_obj = trade_wrapper.trade if hasattr(trade_wrapper, 'trade') else trade_wrapper
            pair_index = getattr(trade_obj, 'pair_index', getattr(trade_obj, 'pairIndex', 0))
            trade_index = getattr(trade_obj, 'trade_index', getattr(trade_obj, 'index', 0))
            
            try:
                close_tx = await trader_client.trade.build_trade_close_tx(
                    pair_index=pair_index,
                    trade_index=trade_index,
                    collateral_to_close=trade_obj.open_collateral,
                    trader=trader_address
                )
                receipt = await trader_client.sign_and_get_receipt(close_tx)
                tx_hash = receipt.get('transactionHash') if isinstance(receipt, dict) else getattr(receipt, 'transactionHash', None)
                if tx_hash:
                    tx_hashes.append(str(tx_hash.hex() if hasattr(tx_hash, 'hex') else tx_hash))
                if hasattr(trade_wrapper, 'pnl'):
                    total_pnl += float(trade_wrapper.pnl)
            except Exception as e:
                logger.warning(f"Failed to close position {pair_index}: {e}")
                continue
        
        return {
            "closed_count": len(tx_hashes),
            "tx_hashes": tx_hashes,
            "total_pnl": total_pnl
        }
    except Exception as e:
        logger.error(f"Error closing all positions: {e}")
        raise

async def get_positions_via_contract(trader_client, address: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches and formats all open positions."""
    try:
        if not trader_client.has_signer() and not address:
            return []
            
        if not address:
            address = trader_client.get_signer().get_ethereum_address()
        
        raw_trades, _ = await trader_client.trade.get_trades(address)
        
        positions = []
        for t in raw_trades:
            # Handle both wrapped and direct trade objects
            trade_obj = t.trade if hasattr(t, 'trade') else t
            positions.append({
                'pair_index': getattr(trade_obj, 'pair_index', getattr(trade_obj, 'pairIndex', 0)),
                'is_long': getattr(trade_obj, 'is_long', getattr(trade_obj, 'buy', False)),
                'collateral': float(getattr(trade_obj, 'open_collateral', getattr(trade_obj, 'collateral', 0))),
                'leverage': getattr(trade_obj, 'leverage', 1),
                'pnl': float(t.pnl) if hasattr(t, 'pnl') else 0.0,
                'entry_price': float(getattr(trade_obj, 'open_price', 0)) / (10**PRICE_DECIMALS) if hasattr(trade_obj, 'open_price') else 0
            })
        return positions
        
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        return []

# ==========================================
# 4. Utilities
# ==========================================

def _format_receipt(
    receipt: Any, 
    pair_index: int, 
    action: str,
    opening_fee: Optional[float] = None,
    total_cost: Optional[float] = None,
    collateral_amount: Optional[float] = None
) -> Dict[str, Any]:
    """Standardizes receipt output."""
    # Handle ReceiptDict or AttributeDict
    tx_hash = receipt.get('transactionHash') if isinstance(receipt, dict) else getattr(receipt, 'transactionHash', None)
    if tx_hash and hasattr(tx_hash, 'hex'):
        tx_hash = tx_hash.hex()
    elif isinstance(tx_hash, bytes):
        tx_hash = tx_hash.hex()
    elif not tx_hash:
        tx_hash = str(tx_hash) if tx_hash else "unknown"
    
    status = receipt.get('status') if isinstance(receipt, dict) else getattr(receipt, 'status', None)
    
    # Check for success (1)
    if status == 1 or status == '0x1':
        block_number = receipt.get('blockNumber', 0) if isinstance(receipt, dict) else getattr(receipt, 'blockNumber', 0)
        logger.info(f"✅ {action.capitalize()} Successful! TX: {tx_hash}")
        
        result = {
            'success': True,
            'tx_hash': str(tx_hash),
            'pair_index': pair_index,
            'status': 'confirmed',
            'block': block_number,
            'receipt': receipt
        }
        
        # Add fee information if provided (for open positions)
        if opening_fee is not None:
            result['opening_fee'] = opening_fee
        if total_cost is not None:
            result['total_cost'] = total_cost
        if collateral_amount is not None:
            result['collateral'] = collateral_amount
        
        return result
    else:
        logger.error(f"❌ Transaction Reverted. TX: {tx_hash}")
        raise ValueError(f"Transaction failed/reverted on chain. Hash: {tx_hash}")
