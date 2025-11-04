"""Trade execution operations."""
from typing import Optional, Dict, Any
from avantis_client import get_avantis_client
from symbols import get_pair_index, SymbolNotFoundError
from config import settings
from utils import retry_on_network_error
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
    private_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Open a trading position.
    
    Args:
        symbol: Trading symbol (e.g., "BTC", "ETH")
        collateral: Collateral amount in USDC
        leverage: Leverage multiplier (e.g., 10 for 10x)
        is_long: True for long position, False for short
        tp: Take profit price (optional)
        sl: Stop loss price (optional)
        private_key: Optional private key for this operation
        
    Returns:
        Dictionary with operation result
    """
    try:
        # Get pair index for symbol
        pair_index = get_pair_index(symbol)
        if pair_index is None:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in registry")
        
        # Get Avantis client
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Check and approve USDC if needed
        await _ensure_usdc_approval(client, collateral)
        
        # Open position using Avantis SDK
        # Note: Adjust method call based on actual SDK API
        result = await trader_client.open_position(
            pair_index=pair_index,
            collateral_amount=collateral,
            leverage=leverage,
            is_long=is_long,
            take_profit=tp,
            stop_loss=sl
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
            "tx_hash": result.get("tx_hash"),
            "position_id": result.get("position_id")
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
    private_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Close a specific position by pair index.
    
    Args:
        pair_index: Avantis pair index
        private_key: Optional private key for this operation
        
    Returns:
        Dictionary with operation result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Close position using Avantis SDK
        result = await trader_client.close_position(pair_index=pair_index)
        
        logger.info(f"Closed position: pair_index={pair_index}")
        
        return {
            "success": True,
            "pair_index": pair_index,
            "tx_hash": result.get("tx_hash"),
            "pnl": result.get("pnl")
        }
        
    except Exception as e:
        logger.error(f"Error closing position: {e}")
        raise


@retry_on_network_error()
async def close_all_positions(
    private_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Close all open positions.
    
    Args:
        private_key: Optional private key for this operation
        
    Returns:
        Dictionary with operation result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Close all positions using Avantis SDK
        result = await trader_client.close_all_positions()
        
        logger.info(f"Closed all positions for address: {client.get_address()}")
        
        return {
            "success": True,
            "closed_count": result.get("closed_count", 0),
            "tx_hashes": result.get("tx_hashes", []),
            "total_pnl": result.get("total_pnl", 0)
        }
        
    except Exception as e:
        logger.error(f"Error closing all positions: {e}")
        raise


async def _ensure_usdc_approval(client, amount: float) -> None:
    """
    Ensure USDC is approved for trading.
    
    Args:
        client: AvantisClient instance
        amount: Amount to approve
    """
    try:
        trader_client = client.get_client()
        
        # Check current allowance
        allowance = await trader_client.get_usdc_allowance()
        
        if allowance < amount:
            # Approve USDC
            logger.info(f"Approving USDC: {amount} (current allowance: {allowance})")
            await trader_client.approve_usdc(amount=amount)
            
    except Exception as e:
        logger.warning(f"USDC approval check failed: {e}")
        # Continue anyway - the trade will fail if approval is actually needed

