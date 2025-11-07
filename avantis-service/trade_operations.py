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
        # Get pair index for symbol
        pair_index = get_pair_index(symbol)
        if pair_index is None:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in registry")
        
        # Get Avantis client
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Check and approve USDC if needed
        await _ensure_usdc_approval(client, collateral)
        
        # Open position using contract methods
        result = await open_position_via_contract(
            trader_client=trader_client,
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
    Ensure USDC is approved for trading.
    
    Args:
        client: AvantisClient instance
        amount: Amount to approve
    """
    try:
        trader_client = client.get_client()
        
        # Check current allowance using SDK method
        if hasattr(trader_client, 'get_usdc_allowance_for_trading'):
            allowance_wei = await trader_client.get_usdc_allowance_for_trading()
            allowance = float(allowance_wei) / 1e6  # Convert from wei (USDC has 6 decimals)
        elif hasattr(trader_client, 'get_usdc_allowance'):
            allowance = await trader_client.get_usdc_allowance()
        else:
            # If method doesn't exist, assume we need approval
            allowance = 0
        
        if allowance < amount:
            # Approve USDC using SDK method
            logger.info(f"Approving USDC: {amount} (current allowance: {allowance})")
            if hasattr(trader_client, 'approve_usdc_for_trading'):
                amount_wei = int(amount * 1e6)  # Convert to wei
                await trader_client.approve_usdc_for_trading(amount=amount_wei)
            elif hasattr(trader_client, 'approve_usdc'):
                await trader_client.approve_usdc(amount=amount)
            else:
                logger.warning("USDC approval method not available on TraderClient")
            
    except Exception as e:
        logger.warning(f"USDC approval check failed: {e}")
        # Continue anyway - the trade will fail if approval is actually needed

