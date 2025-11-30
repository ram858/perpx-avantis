"""Position and balance query operations."""
from typing import List, Dict, Any, Optional
from eth_account import Account
from web3 import Web3
from avantis_client import get_avantis_client
from symbols import get_symbol
from config import settings
from utils import retry_on_network_error
from contract_operations import (
    get_positions_via_contract,
    get_all_open_trades_for_trader,
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
        # Derive address from private key if provided
        if private_key:
            account = Account.from_key(private_key)
            trader_address = account.address
        else:
            trader_address = Web3.to_checksum_address(address)
        
        # Get all open trades with full enrichment (Trade + TradeInfo + OpenLimitOrder)
        trades = await get_all_open_trades_for_trader(
            trader_address=trader_address
        )
        
        # Format positions for API response and add symbol information
        formatted_positions = []
        for trade in trades:
            pair_index = trade.get("pair_index")
            symbol = get_symbol(pair_index) if pair_index is not None else None
            
            # Extract trade data
            open_price = trade.get("open_price", 0)
            leverage = trade.get("leverage", 1)
            is_long = trade.get("is_long", False)
            position_size_usdc = trade.get("position_size_usdc", 0)
            
            # Calculate liquidation price
            # Formula: For LONG: Entry * (1 - (1/Leverage)), For SHORT: Entry * (1 + (1/Leverage))
            # This is a simplified calculation - actual Avantis liquidation considers maintenance margin
            liquidation_price = None
            if open_price > 0 and leverage > 0:
                if is_long:
                    # Long position: liquidates when price drops
                    liquidation_price = open_price * (1 - (1.0 / leverage))
                else:
                    # Short position: liquidates when price rises
                    liquidation_price = open_price * (1 + (1.0 / leverage))
            
            # Extract trade info if available
            trade_info = trade.get("info", {})
            open_limit_order = trade.get("open_limit_order")
            
            formatted_positions.append({
                "pair_index": pair_index,
                "symbol": symbol,
                "is_long": is_long,
                "size": position_size_usdc,  # Position size in USDC
                "entry_price": open_price,
                "current_price": open_price,  # TODO: Fetch current price from oracle if needed
                "leverage": leverage,
                "collateral": position_size_usdc / leverage if leverage > 0 else 0,  # Collateral = size / leverage
                "pnl": 0,  # TODO: Calculate PnL from current price if needed
                "pnl_percentage": 0,  # TODO: Calculate PnL percentage if needed
                "liquidation_price": liquidation_price,
                "take_profit": trade.get("tp"),
                "stop_loss": trade.get("sl"),
                "timestamp": trade.get("timestamp"),
                # Additional enriched data for chat page
                "open_interest_usdc": trade_info.get("open_interest_usdc", 0),
                "tp_last_updated": trade_info.get("tp_last_updated"),
                "sl_last_updated": trade_info.get("sl_last_updated"),
                "being_market_closed": trade_info.get("being_market_closed", False),
                "loss_protection": trade_info.get("loss_protection", 0),
                "open_limit_order": open_limit_order,
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
    
    Uses direct Web3 contract calls to get wallet USDC balance (not vault balance).
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
        # Derive address from private key if provided
        if private_key:
            account = Account.from_key(private_key)
            user_address = account.address
        else:
            user_address = Web3.to_checksum_address(address)
        
        # Get Web3 instance
        rpc_url = settings.get_effective_rpc_url()
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")
        
        # Get wallet USDC balance directly from contract
        usdc_address = Web3.to_checksum_address(settings.usdc_token_address)
        usdc_abi = [
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }
        ]
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        balance_wei = usdc_contract.functions.balanceOf(user_address).call()
        usdc_balance = float(balance_wei) / 1e6  # USDC has 6 decimals
        
        # Get USDC allowance for trading
        try:
            usdc_allowance = await get_usdc_allowance(private_key=private_key) if private_key else 0.0
        except Exception:
            usdc_allowance = 0.0
        
        # Get positions to calculate margin used
        try:
            positions = await get_positions(private_key=private_key, address=address)
            margin_used = sum(pos.get("collateral", 0) for pos in positions)
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
    Get USDC allowance for trading contract using direct Web3 calls.
    
    Args:
        private_key: User's private key (required - backend wallet)
        
    Returns:
        USDC allowance amount in USDC units (not wei)
    """
    if not private_key:
        raise ValueError("private_key is required")
    
    try:
        # Derive address from private key
        account = Account.from_key(private_key)
        owner_address = account.address
        
        # Get Web3 instance
        rpc_url = settings.get_effective_rpc_url()
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")
        
        # Get USDC contract
        usdc_address = Web3.to_checksum_address(settings.usdc_token_address)
        spender_address = Web3.to_checksum_address(settings.avantis_trading_contract_address)
        
        usdc_abi = [
            {
                "constant": True,
                "inputs": [
                    {"name": "_owner", "type": "address"},
                    {"name": "_spender", "type": "address"}
                ],
                "name": "allowance",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }
        ]
        
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        allowance_wei = usdc_contract.functions.allowance(owner_address, spender_address).call()
        
        # Convert from wei to USDC (6 decimals)
        allowance_usdc = float(allowance_wei) / 1e6
        
        return allowance_usdc
        
    except Exception as e:
        logger.error(f"Error getting USDC allowance: {e}")
        raise


@retry_on_network_error()
async def approve_usdc(
    amount: float,
    private_key: str
) -> Dict[str, Any]:
    """
    Approve USDC for trading contract using direct Web3 calls.
    
    Args:
        amount: Amount to approve (0 for unlimited, use max uint256)
        private_key: User's private key (required - each user provides their own)
        
    Returns:
        Dictionary with approval result
    """
    try:
        # Derive address from private key
        account = Account.from_key(private_key)
        owner_address = account.address
        
        # Get Web3 instance
        rpc_url = settings.get_effective_rpc_url()
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")
        
        # Get USDC contract
        usdc_address = Web3.to_checksum_address(settings.usdc_token_address)
        spender_address = Web3.to_checksum_address(settings.avantis_trading_contract_address)
        
        # Convert amount to wei (USDC has 6 decimals)
        if amount == 0:
            # Unlimited approval
            amount_wei = 2**256 - 1
        else:
            amount_wei = int(amount * 1e6)
        
        usdc_abi = [
            {
                "constant": False,
                "inputs": [
                    {"name": "_spender", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ]
        
        usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        
        # Build transaction
        nonce = w3.eth.get_transaction_count(owner_address, "pending")
        tx = usdc_contract.functions.approve(spender_address, amount_wei).build_transaction({
            "from": owner_address,
            "nonce": nonce,
            "chainId": w3.eth.chain_id,
        })
        
        # Estimate gas
        try:
            gas = w3.eth.estimate_gas(tx)
            tx["gas"] = gas
        except Exception as e:
            logger.warning(f"Gas estimation failed: {e}, using default")
            tx["gas"] = 100000  # Default gas limit for approve
        
        # Sign and send transaction
        signed_tx = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_hash_hex = tx_hash.hex()
        
        logger.info(f"✅ USDC approval transaction sent: {tx_hash_hex}")
        
        return {
            "success": True,
            "amount": amount,
            "tx_hash": tx_hash_hex,
            "address": owner_address
        }
        
    except Exception as e:
        logger.error(f"❌ USDC approval failed: {e}", exc_info=True)
        raise

