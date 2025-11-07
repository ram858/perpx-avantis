"""Position and balance query operations."""
from typing import List, Dict, Any, Optional
from avantis_client import get_avantis_client
from symbols import get_symbol
from config import settings
from utils import retry_on_network_error
from contract_operations import (
    get_positions_via_contract,
    get_balance_via_contract
)
import logging

logger = logging.getLogger(__name__)


@retry_on_network_error()
async def get_positions(
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all open positions for a user.
    
    Args:
        private_key: User's private key (for traditional wallets)
        address: User's address (for Base Accounts - required if no private_key)
        
    Returns:
        List of position dictionaries
    """
    if not private_key and not address:
        raise ValueError("Either private_key or address must be provided")
    
    try:
        client = get_avantis_client(private_key=private_key, address=address)
        trader_client = client.get_client()
        user_address = client.get_address()
        
        # Get positions using contract methods
        positions = await get_positions_via_contract(trader_client, address=user_address)
        
        # Format positions for API response and add symbol information
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
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get account balance information for a user.
    
    Args:
        private_key: User's private key (for traditional wallets)
        address: User's address (for Base Accounts - required if no private_key)
        
    Returns:
        Dictionary with balance information
    """
    if not private_key and not address:
        raise ValueError("Either private_key or address must be provided")
    
    try:
        client = get_avantis_client(private_key=private_key, address=address)
        trader_client = client.get_client()
        user_address = client.get_address()
        
        # Get balance using contract methods
        balance_info = await get_balance_via_contract(trader_client, address=user_address)
        
        return {
            "address": balance_info.get("address") or client.get_address(),
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
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> float:
    """
    Get total unrealized PnL across all positions for a user.
    
    Args:
        private_key: User's private key (for traditional wallets)
        address: User's address (for Base Accounts - required if no private_key)
        
    Returns:
        Total PnL value
    """
    try:
        positions = await get_positions(private_key=private_key, address=address)
        total_pnl = sum(pos.get("pnl", 0) for pos in positions)
        return total_pnl
        
    except Exception as e:
        logger.error(f"Error getting total PnL: {e}")
        raise


@retry_on_network_error()
async def get_usdc_allowance(
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> float:
    """
    Get current USDC allowance for trading for a user.
    
    Args:
        private_key: User's private key (for traditional wallets)
        address: User's address (for Base Accounts - required if no private_key)
        
    Returns:
        USDC allowance amount
    """
    if not private_key and not address:
        raise ValueError("Either private_key or address must be provided")
    
    try:
        client = get_avantis_client(private_key=private_key, address=address)
        trader_client = client.get_client()
        user_address = client.get_address()
        
        # Get allowance using SDK method (requires signer) or from balance info
        if trader_client.has_signer():
            if hasattr(trader_client, 'get_usdc_allowance_for_trading'):
                try:
                    allowance_wei = await trader_client.get_usdc_allowance_for_trading()
                    return float(allowance_wei) / 1e6  # Convert from wei
                except:
                    pass
            elif hasattr(trader_client, 'get_usdc_allowance'):
                try:
                    return await trader_client.get_usdc_allowance()
                except:
                    pass
        
        # Fallback: get from balance info
        balance_info = await get_balance_via_contract(trader_client, address=user_address)
        return balance_info.get("usdc_allowance", 0)
        
    except Exception as e:
        logger.error(f"Error getting USDC allowance: {e}")
        raise


@retry_on_network_error()
async def approve_usdc(
    amount: float,
    private_key: str
) -> Dict[str, Any]:
    """
    Approve USDC for trading for a user.
    
    Args:
        amount: Amount to approve (0 for unlimited)
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with approval result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # Approve USDC using SDK method
        amount_wei = int(amount * 1e6)  # Convert to wei (USDC has 6 decimals)
        
        if hasattr(trader_client, 'approve_usdc_for_trading'):
            tx_hash = await trader_client.approve_usdc_for_trading(amount=amount_wei)
        elif hasattr(trader_client, 'approve_usdc'):
            tx_hash = await trader_client.approve_usdc(amount=amount)
        else:
            raise ValueError("USDC approval method not available on TraderClient")
        
        # Convert tx_hash to string if needed
        tx_hash_str = tx_hash.hex() if hasattr(tx_hash, 'hex') else str(tx_hash)
        
        logger.info(f"Approved USDC: {amount} for address: {client.get_address()}")
        
        return {
            "success": True,
            "amount": amount,
            "tx_hash": tx_hash_str,
            "address": client.get_address()
        }
        
    except Exception as e:
        logger.error(f"Error approving USDC: {e}")
        raise

