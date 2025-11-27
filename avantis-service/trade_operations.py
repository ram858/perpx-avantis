"""Trade execution operations."""
from typing import Optional, Dict, Any
from avantis_client import get_avantis_client
from symbols import get_pair_index, SymbolNotFoundError
from config import settings
from utils import retry_on_network_error
from contract_operations import (
    open_position_via_contract,
    close_position_via_contract,
    close_all_positions_via_contract
)
from position_queries import get_usdc_allowance, approve_usdc
import logging

logger = logging.getLogger(__name__)


@retry_on_network_error()
async def open_position(
    symbol: str,
    collateral: float,
    leverage: int,
    is_long: bool,
    tp: Optional[float] = None,
    sl: Optional[float] = None,
    private_key: str = ""
) -> Dict[str, Any]:
    """
    Open a trading position for a user.
    
    Args:
        symbol: Trading symbol (e.g., "BTC", "ETH")
        collateral: Collateral amount in USDC
        leverage: Leverage multiplier (e.g., 10 for 10x)
        is_long: True for long position, False for short
        tp: Take profit price (optional)
        sl: Stop loss price (optional)
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with operation result
    """
    if not private_key:
        raise ValueError("Private key is required. Each user must provide their own private key.")
    
    try:
        # CRITICAL: Verify private key derives to expected address BEFORE creating client
        from eth_account import Account
        from web3 import Web3
        
        # Derive address from private key
        account = Account.from_key(private_key)
        derived_address = account.address
        
        logger.info(f"🔍 [TRADE_OPS] Private key provided: {private_key[:10]}...{private_key[-4:]}")
        logger.info(f"🔍 [TRADE_OPS] Derived address from private key: {derived_address}")
        logger.info(f"🔍 [TRADE_OPS] This address will be used for trading operations")
        
        # Get Avantis client
        client = get_avantis_client(private_key=private_key)
        
        # Verify client address matches derived address
        client_address = client.get_address()
        if client_address.lower() != derived_address.lower():
            logger.error(f"❌ [TRADE_OPS] ADDRESS MISMATCH!")
            logger.error(f"   Derived from PK: {derived_address}")
            logger.error(f"   Client address: {client_address}")
            raise ValueError(f"Address mismatch: Private key derives to {derived_address} but client shows {client_address}")
        
        logger.info(f"✅ [TRADE_OPS] Address verified: {client_address}")
        trader_client = client.get_client()
        
        # Get pair index using SDK's official method (preferred) or fallback to our registry
        pair_index = None
        try:
            # Try SDK's official method first
            if hasattr(trader_client, 'pairs_cache') and hasattr(trader_client.pairs_cache, 'get_pair_index'):
                pair_index = await trader_client.pairs_cache.get_pair_index(f"{symbol}/USD")
                logger.info(f"✅ Got pair index from SDK: {pair_index} for {symbol}/USD")
        except Exception as sdk_error:
            logger.warning(f"SDK pair index lookup failed: {sdk_error}. Using fallback registry.")
        
        # Fallback to our own registry if SDK method failed
        if pair_index is None:
            pair_index = get_pair_index(symbol)
            if pair_index is None:
                raise SymbolNotFoundError(f"Symbol {symbol} not found in registry and SDK lookup failed")
            logger.info(f"Using fallback pair index: {pair_index} for {symbol}")
        
        # Check and approve USDC if needed
        await _ensure_usdc_approval(client, collateral)
        
        # Open position using official SDK method
        result = await open_position_via_contract(
            trader_client=trader_client,
            pair_index=pair_index,
            collateral_amount=collateral,
            leverage=leverage,
            is_long=is_long,
            take_profit=tp,
            stop_loss=sl,
            slippage_percentage=1.0  # Default 1% slippage
        )
        
        logger.info(f"Opened position: {symbol} | {('LONG' if is_long else 'SHORT')} | "
                   f"Collateral: ${collateral} | Leverage: {leverage}x")
        
        return {
            "success": True,
            "pair_index": pair_index,
            "symbol": symbol,
            "is_long": is_long,
            "collateral": collateral,
            "leverage": leverage,
            "tx_hash": result.get("tx_hash") if isinstance(result, dict) else str(result),
            "status": result.get("status", "pending") if isinstance(result, dict) else "pending"
        }
        
    except SymbolNotFoundError as e:
        logger.error(f"Symbol not found: {e}")
        raise
    except Exception as e:
        logger.error(f"Error opening position: {e}")
        raise


@retry_on_network_error()
async def close_position(
    pair_index: int,
    private_key: str
) -> Dict[str, Any]:
    """
    Close a specific position by pair index for a user.
    
    Args:
        pair_index: Avantis pair index
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with operation result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Close position using contract methods
        result = await close_position_via_contract(
            trader_client=trader_client,
            pair_index=pair_index
        )
        
        logger.info(f"Closed position: pair_index={pair_index}")
        
        return {
            "success": True,
            "pair_index": pair_index,
            "tx_hash": result.get("tx_hash") if isinstance(result, dict) else str(result),
            "status": result.get("status", "pending") if isinstance(result, dict) else "pending"
        }
        
    except Exception as e:
        logger.error(f"Error closing position: {e}")
        raise


@retry_on_network_error()
async def close_all_positions(
    private_key: str
) -> Dict[str, Any]:
    """
    Close all open positions for a user.
    
    Args:
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with operation result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Close all positions using contract methods
        result = await close_all_positions_via_contract(trader_client=trader_client)
        
        logger.info(f"Closed all positions for address: {client.get_address()}")
        
        return {
            "success": True,
            "closed_count": result.get("closed_count", 0) if isinstance(result, dict) else 0,
            "tx_hashes": result.get("tx_hashes", []) if isinstance(result, dict) else [],
            "total_pnl": result.get("total_pnl", 0) if isinstance(result, dict) else 0
        }
        
    except Exception as e:
        logger.error(f"Error closing all positions: {e}")
        raise


async def _ensure_usdc_approval(client, amount: float) -> None:
    """
    🔐 SAFE USDC Approval Check
    
    Ensure USDC is approved for trading using safe functions.
    Uses the safe get_usdc_allowance and approve_usdc functions.
    
    Args:
        client: AvantisClient instance (must have private_key)
        amount: Amount to approve
    """
    try:
        # Get private key from client (required for safe functions)
        if not client.private_key:
            raise ValueError("Client must have private_key for safe USDC approval")
        
        # Use safe function to check current allowance
        try:
            allowance = await get_usdc_allowance(private_key=client.private_key)
        except Exception as e:
            logger.warning(f"Could not check USDC allowance: {e}. Assuming approval needed.")
            allowance = 0
        
        if allowance < amount:
            # Use safe function to approve USDC
            logger.info(f"🔐 SAFE: Approving USDC: {amount} (current allowance: {allowance})")
            
            try:
                result = await approve_usdc(
                    amount=amount,
                    private_key=client.private_key
                )
                logger.info(f"✅ SAFE USDC approval successful: {result.get('tx_hash', 'N/A')}")
            except Exception as approval_error:
                logger.error(f"❌ SAFE approval failed: {approval_error}")
                raise ValueError(f"USDC approval failed: {approval_error}")
        else:
            logger.debug(f"USDC allowance sufficient: {allowance} >= {amount}")
            
    except Exception as e:
        logger.error(f"USDC approval check failed: {e}")
        # Don't continue - approval is critical for trading
        raise

