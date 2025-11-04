"""Position and balance query operations."""
from typing import List, Dict, Any, Optional
from avantis_client import get_avantis_client
from symbols import get_symbol
from config import settings
from utils import retry_on_network_error
import logging

logger = logging.getLogger(__name__)


@retry_on_network_error()
async def get_positions(
    private_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all open positions.
    
    Args:
        private_key: Optional private key for this operation
        
    Returns:
        List of position dictionaries
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Get positions from Avantis SDK
        positions = await trader_client.get_positions()
        
        # Format positions for API response
        formatted_positions = []
        for pos in positions:
            pair_index = pos.get("pair_index")
            symbol = get_symbol(pair_index) if pair_index is not None else None
            
            formatted_positions.append({
                "pair_index": pair_index,
                "symbol": symbol,
                "is_long": pos.get("is_long", False),
                "size": pos.get("size", 0),
                "entry_price": pos.get("entry_price", 0),
                "current_price": pos.get("current_price", 0),
                "leverage": pos.get("leverage", 1),
                "collateral": pos.get("collateral", 0),
                "pnl": pos.get("pnl", 0),
                "pnl_percentage": pos.get("pnl_percentage", 0),
                "liquidation_price": pos.get("liquidation_price"),
                "take_profit": pos.get("take_profit"),
                "stop_loss": pos.get("stop_loss"),
            })
        
        logger.debug(f"Retrieved {len(formatted_positions)} positions")
        return formatted_positions
        
    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        raise


@retry_on_network_error()
async def get_balance(
    private_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get account balance information.
    
    Args:
        private_key: Optional private key for this operation
        
    Returns:
        Dictionary with balance information
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Get balance from Avantis SDK
        balance_info = await trader_client.get_balance()
        
        return {
            "address": client.get_address(),
            "total_balance": balance_info.get("total_balance", 0),
            "available_balance": balance_info.get("available_balance", 0),
            "margin_used": balance_info.get("margin_used", 0),
            "usdc_balance": balance_info.get("usdc_balance", 0),
            "usdc_allowance": balance_info.get("usdc_allowance", 0),
        }
        
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        raise


@retry_on_network_error()
async def get_total_pnl(
    private_key: Optional[str] = None
) -> float:
    """
    Get total unrealized PnL across all positions.
    
    Args:
        private_key: Optional private key for this operation
        
    Returns:
        Total PnL value
    """
    try:
        positions = await get_positions(private_key=private_key)
        total_pnl = sum(pos.get("pnl", 0) for pos in positions)
        return total_pnl
        
    except Exception as e:
        logger.error(f"Error getting total PnL: {e}")
        raise


@retry_on_network_error()
async def get_usdc_allowance(
    private_key: Optional[str] = None
) -> float:
    """
    Get current USDC allowance for trading.
    
    Args:
        private_key: Optional private key for this operation
        
    Returns:
        USDC allowance amount
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        allowance = await trader_client.get_usdc_allowance()
        return allowance
        
    except Exception as e:
        logger.error(f"Error getting USDC allowance: {e}")
        raise


@retry_on_network_error()
async def approve_usdc(
    amount: float,
    private_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Approve USDC for trading.
    
    Args:
        amount: Amount to approve (0 for unlimited)
        private_key: Optional private key for this operation
        
    Returns:
        Dictionary with approval result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Approve USDC using Avantis SDK
        result = await trader_client.approve_usdc(amount=amount)
        
        logger.info(f"Approved USDC: {amount} for address: {client.get_address()}")
        
        return {
            "success": True,
            "amount": amount,
            "tx_hash": result.get("tx_hash"),
            "address": client.get_address()
        }
        
    except Exception as e:
        logger.error(f"Error approving USDC: {e}")
        raise

