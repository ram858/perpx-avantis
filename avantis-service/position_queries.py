"""Position and balance query operations."""
from typing import List, Dict, Any, Optional
from avantis_client import get_avantis_client
from symbols import get_symbol
from config import settings
from utils import retry_on_network_error
from contract_operations import (
    get_positions_via_contract
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
            
            entry_price = pos.get("entry_price", 0)
            leverage = pos.get("leverage", 1)
            is_long = pos.get("is_long", False)
            liquidation_price = pos.get("liquidation_price")
            
            # Calculate liquidation price if not provided by SDK
            # Formula: For LONG: Entry * (1 - (1/Leverage)), For SHORT: Entry * (1 + (1/Leverage))
            # This is a simplified calculation - actual Avantis liquidation considers maintenance margin
            if not liquidation_price and entry_price > 0 and leverage > 0:
                if is_long:
                    # Long position: liquidates when price drops
                    liquidation_price = entry_price * (1 - (1.0 / leverage))
                else:
                    # Short position: liquidates when price rises
                    liquidation_price = entry_price * (1 + (1.0 / leverage))
            
            formatted_positions.append({
                "pair_index": pair_index,
                "symbol": symbol,
                "is_long": is_long,
                "size": pos.get("size", 0),
                "entry_price": entry_price,
                "current_price": pos.get("current_price", 0),
                "leverage": leverage,
                "collateral": pos.get("collateral", 0),
                "pnl": pos.get("pnl", 0),
                "pnl_percentage": pos.get("pnl_percentage", 0),
                "liquidation_price": liquidation_price,
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
    
    Uses SDK's get_usdc_balance() which returns wallet balance (not vault balance).
    This allows trading directly from wallet without manual deposit to vault.
    
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
        
        # Get wallet USDC balance directly from contract (not vault)
        # SDK's get_usdc_balance() checks vault, we need wallet balance for trading
        w3 = client.web3  # Use client's web3 instance
        usdc_address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # Base mainnet USDC
        usdc_abi = [{"constant":True,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}]
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        balance_wei = usdc_contract.functions.balanceOf(user_address).call()
        usdc_balance = float(balance_wei) / 1e6  # USDC has 6 decimals
        
        # Get USDC allowance for trading
        try:
            allowance_raw = await trader_client.get_usdc_allowance_for_trading()
            usdc_allowance = float(allowance_raw) if allowance_raw else 0.0
        except Exception:
            usdc_allowance = 0.0
        
        # Get positions to calculate margin used
        try:
            positions, _ = await trader_client.trade.get_trades(user_address)
            margin_used = sum(
                float(getattr(t.trade if hasattr(t, 'trade') else t, 'open_collateral', 0)) / 1e6
                for t in positions
            )
        except Exception:
            margin_used = 0.0
        
        # Available balance = wallet balance - margin used
        available_balance = max(0.0, usdc_balance - margin_used)
        
        return {
            "address": user_address,
            "total_balance": usdc_balance,
            "available_balance": available_balance,
            "margin_used": margin_used,
            "usdc_balance": usdc_balance,  # Wallet USDC balance (for trading)
            "usdc_allowance": usdc_allowance,
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
    private_key: str
) -> float:
    """
    💳 SAFE ALLOWANCE FETCHING (NO WRONG ABI CALLS)
    
    Safely fetch USDC allowance.
    WILL NOT call any unknown SDK function that may be wrong.
    
    Args:
        private_key: User's private key (required - backend wallet)
        
    Returns:
        USDC allowance amount
    """
    if not private_key:
        raise ValueError("private_key is required")
    
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        import inspect
        
        # Allowed safe functions
        safe_methods = [
            "get_usdc_allowance_for_trading",
            "get_usdc_allowance",
        ]
        
        for m in safe_methods:
            if hasattr(trader_client, m):
                method = getattr(trader_client, m)
                
                try:
                    if inspect.iscoroutinefunction(method):
                        allowance = await method()
                    else:
                        allowance = method()
                    
                    # Convert wei to USDC
                    return float(allowance) / 1e6
                    
                except Exception:
                    continue  # try next safe method
        
        # Final fallback — return 0 if all methods fail
        logger.warning("Could not fetch USDC allowance using any method")
        return 0.0
        
    except Exception as e:
        logger.error(f"Error getting safe USDC allowance: {e}")
        raise


@retry_on_network_error()
async def approve_usdc(
    amount: float,
    private_key: str
) -> Dict[str, Any]:
    """
    🔐 SAFE APPROVAL (ONLY CALLS APPROVE — NEVER TRANSFER)
    
    Safely approve USDC for trading.
    Ensures the SDK never calls a transfer() by mistake.
    
    Args:
        amount: Amount to approve (0 for unlimited)
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with approval result
    """
    try:
        client = get_avantis_client(private_key=private_key)
        trader_client = client.get_client()
        
        # USDC has 6 decimals
        amount_wei = int(amount * 1e6)
        
        logger.info(f"Requesting USDC approval of {amount} (wei={amount_wei})")
        
        import inspect
        
        # 1) SAFE APPROVAL CHAIN — Strictly controlled
        safe_methods = [
            "approve_usdc_for_trading",
            "approve_usdc",
        ]
        
        method_to_use = None
        
        # Find a SAFE approve function only
        for m in safe_methods:
            if hasattr(trader_client, m):
                method_to_use = getattr(trader_client, m)
                break
        
        # If no safe method exists → block the action
        if method_to_use is None:
            raise RuntimeError(
                "No SAFE approval method found on TraderClient. "
                "Refusing to call any fallback to prevent accidental transfer()."
            )
        
        # Call safely (sync or async)
        if inspect.iscoroutinefunction(method_to_use):
            tx_hash = await method_to_use(amount=amount_wei)
        else:
            tx_hash = method_to_use(amount=amount_wei)
        
        if tx_hash is None:
            raise RuntimeError("Approval returned None. Possible SDK issue.")
        
        # Convert tx_hash to string
        if hasattr(tx_hash, "hex"):
            tx_hash_str = tx_hash.hex()
        else:
            tx_hash_str = str(tx_hash)
        
        logger.info(f"SAFE Approval TX: {tx_hash_str}")
        
        return {
            "success": True,
            "amount": amount,
            "tx_hash": tx_hash_str,
            "address": client.get_address()
        }
        
    except Exception as e:
        logger.error(f"SAFE approval error: {e}")
        raise

