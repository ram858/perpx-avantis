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
MIN_COLLATERAL_USDC = 11.5  # Protocol minimum (actual contract requires ~$11.5)
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
    """Fast validation to catch errors before network calls."""
    if collateral_amount < MIN_COLLATERAL_USDC:
        raise ValueError(f"Collateral ${collateral_amount} is below protocol minimum ${MIN_COLLATERAL_USDC}.")
    
    if not 2 <= leverage <= 100:
        raise ValueError(f"Leverage {leverage}x is out of range (2x-100x).")
    
    if pair_index < 0:
        raise ValueError(f"Invalid pair index: {pair_index}")

async def deposit_to_vault_if_needed(
    trader_client,
    trader_address: str,
    required_amount: float
) -> None:
    """
    Auto-deposit wallet USDC to Avantis vault if vault balance is insufficient.
    This makes the wallet work as the vault automatically.
    """
    try:
        # Check vault balance (what get_usdc_balance returns)
        vault_balance_raw = await trader_client.get_usdc_balance()
        vault_balance = float(vault_balance_raw) if vault_balance_raw else 0
        
        # Check wallet USDC balance directly
        w3 = trader_client.web3 if hasattr(trader_client, 'web3') else None
        if not w3:
            # Fallback: get web3 from client
            from avantis_client import get_avantis_client
            from config import settings
            from web3 import Web3
            rpc_url = settings.avantis_rpc_url or "https://mainnet.base.org"
            w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        from web3 import Web3 as Web3Type
        usdc_address = Web3Type.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")  # Base mainnet USDC
        usdc_abi = [{"constant":True,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}]
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        wallet_balance_wei = usdc_contract.functions.balanceOf(trader_address).call()
        wallet_balance = float(wallet_balance_wei) / 1e6
        
        logger.info(f"💰 Vault balance: ${vault_balance:.2f} | Wallet balance: ${wallet_balance:.2f} | Required: ${required_amount:.2f}")
        
        # If vault balance is insufficient but wallet has funds, deposit to vault
        if vault_balance < required_amount and wallet_balance >= required_amount:
            deposit_amount = min(required_amount * 1.5, wallet_balance * 0.95)  # Deposit 1.5x required or 95% of wallet (leave some for gas)
            
            logger.info(f"🏦 Auto-depositing ${deposit_amount:.2f} USDC from wallet to Avantis vault...")
            
            # Get vault contract address (avUSDC vault)
            # Avantis uses ERC-4626 vault - need to find the vault address
            # For now, try to deposit via Trading contract's deposit function if available
            try:
                # Check if Trading contract has deposit function
                TradingContract = trader_client.contracts.get("Trading")
                if TradingContract and hasattr(TradingContract.functions, 'deposit'):
                    deposit_amount_wei = int(deposit_amount * 1e6)
                    # Approve USDC to trading contract first
                    trader_address_checksum = Web3Type.to_checksum_address(trader_address)
                    usdc_contract_approve = w3.eth.contract(
                        address=usdc_address,
                        abi=[{
                            "constant": False,
                            "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
                            "name": "approve",
                            "outputs": [{"name": "", "type": "bool"}],
                            "type": "function"
                        }]
                    )
                    approve_tx = usdc_contract_approve.functions.approve(
                        TradingContract.address,
                        deposit_amount_wei
                    ).build_transaction({
                        "from": trader_address_checksum,
                        "nonce": w3.eth.get_transaction_count(trader_address_checksum),
                    })
                    approve_receipt = await trader_client.sign_and_get_receipt(approve_tx)
                    logger.info(f"✅ USDC approved for vault deposit")
                    
                    # Wait for approval to propagate
                    await asyncio.sleep(2)
                    
                    # Deposit to vault
                    deposit_tx = TradingContract.functions.deposit(deposit_amount_wei).build_transaction({
                        "from": trader_address_checksum,
                        "nonce": w3.eth.get_transaction_count(trader_address_checksum),
                    })
                    deposit_receipt = await trader_client.sign_and_get_receipt(deposit_tx)
                    logger.info(f"✅ Deposited ${deposit_amount:.2f} USDC to Avantis vault")
                    
                    # Wait for deposit to propagate
                    await asyncio.sleep(3)
                else:
                    logger.warning("⚠️ Vault deposit function not found. Manual deposit may be required.")
            except Exception as deposit_error:
                logger.warning(f"⚠️ Auto-deposit failed: {deposit_error}. Continuing with available vault balance.")
        
        # Check vault balance again after potential deposit
        vault_balance_raw = await trader_client.get_usdc_balance()
        vault_balance = float(vault_balance_raw) if vault_balance_raw else 0
        
        if vault_balance < required_amount:
            raise ValueError(
                f"Insufficient USDC in vault. Need ${required_amount:.2f}, Have ${vault_balance:.2f}. "
                f"Wallet has ${wallet_balance:.2f} but auto-deposit failed or not available."
            )
    except ValueError:
        raise  # Re-raise ValueError as-is
    except Exception as e:
        logger.error(f"❌ Vault deposit check failed: {e}")
        # Don't fail the trade if deposit check fails - might still work
        pass

async def check_and_approve_usdc(
    trader_client,
    trader_address: str,
    required_amount: float
) -> None:
    """
    Checks balance and allowance. Auto-deposits to vault and approves if necessary.
    Prevents 'Execution Reverted' gas waste.
    """
    try:
        # 1. Auto-deposit wallet funds to vault if needed
        await deposit_to_vault_if_needed(trader_client, trader_address, required_amount)
        
        # 2. Check Vault Balance (after potential deposit)
        balance_raw = await trader_client.get_usdc_balance()
        balance_usdc = float(balance_raw) if balance_raw else 0
        
        logger.info(f"💰 Vault Balance: ${balance_usdc:.2f} | Required: ${required_amount:.2f}")
        if balance_usdc < required_amount:
            raise ValueError(
                f"Insufficient USDC in vault. Need ${required_amount:.2f}, Have ${balance_usdc:.2f}."
            )

        # 3. Check Allowance
        allowance_raw = await trader_client.get_usdc_allowance_for_trading()
        allowance_usdc = float(allowance_raw) if allowance_raw else 0
        
        # 4. Approve if needed
        if allowance_usdc < required_amount:
            logger.info(f"🔓 Approving contract (Current allowance: ${allowance_usdc:.2f})...")
            
            # Approve slightly more to avoid constant re-approvals (e.g., 2x required or Infinite)
            await trader_client.approve_usdc_for_trading(required_amount * 2)
            
            # Wait briefly for propagation
            await asyncio.sleep(2) 
            logger.info("✅ USDC Approved for trading.")
        
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
    Opens a position using a Hybrid Approach:
    1. Tries standard SDK.
    2. Falls back to manual Struct construction if Web3 encoding fails.
    """
    if not SDK_AVAILABLE:
        raise ImportError("Avantis SDK is required to execute trades.")
    
    if TradeInput is None or TradeInputOrderType is None:
        raise ImportError("TradeInput or TradeInputOrderType not available - SDK not properly imported.")

    # Step 1: Validation
    validate_trade_params(collateral_amount, leverage, pair_index)

    # Step 2: Get Address & Run Checks
    signer = trader_client.get_signer()
    trader_address = signer.get_ethereum_address()
    
    # Check balance BEFORE building tx (saves gas)
    await check_and_approve_usdc(trader_client, trader_address, collateral_amount)

    # Step 3: Prepare Data
    # Get current price estimate (needed for manual fallback limit price)
    try:
        pair_name = await trader_client.pairs_cache.get_pair_name_from_index(pair_index)
        price_data = await trader_client.feed_client.get_latest_price_updates([pair_name])
        # Use a high precision int for contract interaction
        current_price_int = int(price_data.parsed[0].converted_price * (10 ** PRICE_DECIMALS))
    except Exception:
        current_price_int = 0  # Market order usually handles this, but good to have for fallback
        logger.warning("Could not fetch real-time price, defaulting open_price to 0")
        pair_name = f"Pair-{pair_index}"

    # Create SDK Input Object
    # Convert to proper types (TradeInput expects int for amounts)
    collateral_wei = int(collateral_amount * (10 ** USDC_DECIMALS))
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

    # Step 4: Build & Execute Transaction
    try:
        logger.info(f"🚀 Opening Position: {pair_name} | {leverage}x {'LONG' if is_long else 'SHORT'} | ${collateral_amount}")
        
        # --- STRATEGY A: Standard SDK Call ---
        try:
            open_tx = await trader_client.trade.build_trade_open_tx(
                trade_input,
                TradeInputOrderType.MARKET,
                slippage_percentage
            )
            logger.info("✅ Transaction built via Standard SDK.")
        
        except Exception as e:
            # Catch all exceptions from SDK (including Web3ValidationError, TypeError, ValueError, etc.)
            error_type = type(e).__name__
            error_msg = str(e)
            
            # Check if it's a struct encoding error (the common issue)
            if 'Could not identify' in error_msg or 'openTrade' in error_msg or 'struct' in error_msg.lower():
                logger.warning(f"⚠️ SDK build failed ({error_type}: {error_msg[:100]}). Switching to Manual Fallback strategy.")
                
                # --- STRATEGY B: Manual Fallback ---
                open_tx = await _build_manual_open_tx(
                    trader_client, 
                    trader_address, 
                    trade_input,
                    current_price_int, 
                    slippage_percentage
                )
                logger.info("✅ Transaction built via Manual Fallback.")
            else:
                # Re-raise if it's a different error (like insufficient balance, etc.)
                logger.error(f"❌ SDK build failed with unexpected error: {error_type}: {error_msg}")
                raise

        # Step 5: Sign & Send (Securely)
        receipt = await trader_client.sign_and_get_receipt(open_tx)
        
        return _format_receipt(receipt, pair_index, "open")
    except Exception as e:
        error_msg = str(e)
        # Check for BELOW_MIN_POS error (contract-level validation)
        if 'BELOW_MIN_POS' in error_msg or 'execution reverted: BELOW_MIN_POS' in error_msg:
            logger.error(f"❌ Position size below minimum: {error_msg}")
            raise ValueError(
                f"Position size ${collateral_amount} is below the contract's minimum requirement. "
                f"Please increase your collateral amount. The minimum is typically around $10.50-$11 USDC."
            )
        logger.error(f"❌ Trade Failed: {e}", exc_info=True)
        raise

async def _build_manual_open_tx(trader_client, trader_address, trade_input, current_price_int, slippage):
    """
    Internal helper to manually construct the openTrade transaction.
    Bypasses SDK wrapper issues by creating the raw dictionary struct.
    """
    TradingContract = trader_client.contracts.get("Trading")
    if not TradingContract:
        raise ValueError("Trading contract not loaded.")

    # Manual Dict Construction (Matches Solidity Struct)
    # Extract values from TradeInput object (handle both attribute access patterns)
    pair_idx = getattr(trade_input, 'pair_index', getattr(trade_input, 'pairIndex', 0))
    # TradeInput stores collateral in wei (already converted)
    collateral_wei = getattr(trade_input, 'collateral_in_trade', getattr(trade_input, 'open_collateral', 0))
    if isinstance(collateral_wei, float):
        collateral_wei = int(collateral_wei)
    is_long_val = getattr(trade_input, 'is_long', getattr(trade_input, 'buy', True))
    leverage_val = getattr(trade_input, 'leverage', 1)
    tp_val = getattr(trade_input, 'tp', 0)
    sl_val = getattr(trade_input, 'sl', 0)
    
    trade_struct = {
        'trader': trader_address,
        'pairIndex': pair_idx,
        'index': 0,
        'initialPosToken': 0,
        'positionSizeUSDC': collateral_wei,
        'openPrice': current_price_int, 
        'buy': is_long_val,
        'leverage': leverage_val,
        'tp': int(tp_val * (10 ** PRICE_DECIMALS)) if tp_val else 0,
        'sl': int(sl_val * (10 ** PRICE_DECIMALS)) if sl_val else 0,
        'timestamp': 0,
    }

    # Get Fees & Nonce
    execution_fee = await trader_client.trade.get_trade_execution_fee()
    nonce = await trader_client.get_transaction_count(trader_address)

    # Build TX
    return await TradingContract.functions.openTrade(
        trade_struct,               # Pass dict, web3 converts to tuple
        0,                          # OrderType.MARKET (uint8)
        int(slippage * 10**10)      # Slippage (uint256)
    ).build_transaction({
        "from": trader_address,
        "value": execution_fee,
        "chainId": trader_client.chain_id,
        "nonce": nonce,
        # Gas limit estimation happens automatically by web3 usually, 
        # but you can add 'gas': 2000000 if needed.
    })

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

def _format_receipt(receipt: Any, pair_index: int, action: str) -> Dict[str, Any]:
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
        return {
            'success': True,
            'tx_hash': str(tx_hash),
            'pair_index': pair_index,
            'status': 'confirmed',
            'block': block_number,
            'receipt': receipt
        }
    else:
        logger.error(f"❌ Transaction Reverted. TX: {tx_hash}")
        raise ValueError(f"Transaction failed/reverted on chain. Hash: {tx_hash}")
