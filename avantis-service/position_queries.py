"""Position and balance query operations."""
from typing import List, Dict, Any, Optional
from eth_account import Account
from web3 import Web3
from avantis_client import get_avantis_client
from symbols import get_symbol
from config import settings
from utils import retry_on_network_error
import logging

logger = logging.getLogger(__name__)

# Try to import SDK for position fetching (more reliable than direct contract calls)
try:
    from avantis_trader_sdk import TraderClient, FeedClient
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    logger.debug("Avantis SDK not available; using direct contract calls for positions.")


async def _get_positions_via_sdk(trader_address: str) -> List[Dict[str, Any]]:
    """
    Get positions using Avantis SDK (more reliable than direct contract calls).
    """
    if not SDK_AVAILABLE:
        raise RuntimeError("SDK not available")
    
    feed_client = FeedClient()
    rpc_url = settings.get_effective_rpc_url()
    trader_client = TraderClient(provider_url=rpc_url, feed_client=feed_client)
    
    # get_trades returns (long_trades, short_trades) tuples
    long_trades, short_trades = await trader_client.trade.get_trades(trader_address)
    
    positions = []
    
    # Process long trades
    for trade in long_trades:
        symbol = get_symbol(trade.trade.pair_index)
        positions.append({
            "pair_index": trade.trade.pair_index,
            "trade_index": trade.trade.trade_index,
            "symbol": symbol,
            "is_long": trade.trade.is_long,
            "collateral": trade.trade.open_collateral,
            "leverage": trade.trade.leverage,
            "entry_price": trade.trade.open_price,
            "current_price": trade.trade.open_price,  # Will be updated from price fetch
            "pnl": 0,  # Will calculate from price difference
            "pnl_percentage": 0,
            "take_profit": trade.trade.tp if trade.trade.tp > 0 else None,
            "stop_loss": trade.trade.sl if trade.trade.sl > 0 else None,
            "liquidation_price": trade.liquidation_price,
            "open_interest_usdc": trade.additional_info.open_interest_usdc if trade.additional_info else 0,
            "timestamp": trade.trade.timestamp,
        })
    
    # Process short trades
    for trade in short_trades:
        symbol = get_symbol(trade.trade.pair_index)
        positions.append({
            "pair_index": trade.trade.pair_index,
            "trade_index": trade.trade.trade_index,
            "symbol": symbol,
            "is_long": trade.trade.is_long,
            "collateral": trade.trade.open_collateral,
            "leverage": trade.trade.leverage,
            "entry_price": trade.trade.open_price,
            "current_price": trade.trade.open_price,
            "pnl": 0,
            "pnl_percentage": 0,
            "take_profit": trade.trade.tp if trade.trade.tp > 0 else None,
            "stop_loss": trade.trade.sl if trade.trade.sl > 0 else None,
            "liquidation_price": trade.liquidation_price,
            "open_interest_usdc": trade.additional_info.open_interest_usdc if trade.additional_info else 0,
            "timestamp": trade.trade.timestamp,
        })
    
    # Try to get current prices to calculate PnL
    if positions and SDK_AVAILABLE:
        try:
            pair_names = []
            for pos in positions:
                if pos["symbol"]:
                    pair_names.append(f"{pos['symbol']}/USD")
            
            if pair_names:
                price_data = await feed_client.get_latest_price_updates(list(set(pair_names)))
                
                if price_data and hasattr(price_data, 'parsed') and price_data.parsed:
                    price_map = {}
                    for p in price_data.parsed:
                        # Extract symbol from feed
                        if hasattr(p, 'id') or hasattr(p, 'symbol'):
                            sym = getattr(p, 'symbol', None) or str(getattr(p, 'id', ''))
                            if '/' in sym:
                                sym = sym.split('/')[0]
                            price_map[sym.upper()] = p.converted_price
                    
                    # Update positions with current prices and PnL
                    for pos in positions:
                        sym = pos.get("symbol", "").upper()
                        if sym in price_map:
                            current_price = price_map[sym]
                            pos["current_price"] = current_price
                            
                            # Calculate PnL
                            entry_price = pos["entry_price"]
                            collateral = pos["collateral"]
                            leverage = pos["leverage"]
                            is_long = pos["is_long"]
                            
                            if entry_price > 0:
                                price_diff = current_price - entry_price
                                if not is_long:
                                    price_diff = -price_diff  # Reverse for shorts
                                
                                pnl_pct = (price_diff / entry_price) * leverage * 100
                                pnl_usd = (price_diff / entry_price) * collateral * leverage
                                
                                pos["pnl"] = pnl_usd
                                pos["pnl_percentage"] = pnl_pct
        except Exception as e:
            logger.warning(f"Could not fetch current prices: {e}")
    
    return positions


@retry_on_network_error()
async def get_positions(
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all open positions for a user.
    
    Uses Avantis SDK for more reliable position fetching.
    
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
        
        # Use SDK for position fetching (more reliable)
        if SDK_AVAILABLE:
            positions = await _get_positions_via_sdk(trader_address)
            logger.debug(f"Retrieved {len(positions)} positions via SDK")
            return positions
        
        # Fallback to direct contract calls if SDK not available
        from contract_operations import get_all_open_trades_for_trader
        
        trades = await get_all_open_trades_for_trader(trader_address=trader_address)
        
        # Format positions for API response
        formatted_positions = []
        for trade in trades:
            pair_index = trade.get("pair_index")
            symbol = get_symbol(pair_index) if pair_index is not None else None
            
            open_price = trade.get("open_price", 0)
            leverage = trade.get("leverage", 1)
            is_long = trade.get("is_long", False)
            position_size_usdc = trade.get("position_size_usdc", 0)
            
            liquidation_price = None
            if open_price > 0 and leverage > 0:
                if is_long:
                    liquidation_price = open_price * (1 - (1.0 / leverage))
                else:
                    liquidation_price = open_price * (1 + (1.0 / leverage))
            
            trade_info = trade.get("info", {})
            
            formatted_positions.append({
                "pair_index": pair_index,
                "symbol": symbol,
                "is_long": is_long,
                "collateral": position_size_usdc / leverage if leverage > 0 else 0,
                "leverage": leverage,
                "entry_price": open_price,
                "current_price": open_price,
                "pnl": 0,
                "pnl_percentage": 0,
                "liquidation_price": liquidation_price,
                "take_profit": trade.get("tp"),
                "stop_loss": trade.get("sl"),
                "timestamp": trade.get("timestamp"),
                "open_interest_usdc": trade_info.get("open_interest_usdc", 0),
            })
        
        logger.debug(f"Retrieved {len(formatted_positions)} positions via direct contract")
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
        
        # Total balance = wallet USDC + collateral in positions (margin used)
        # Available balance = wallet USDC only (not in positions)
        total_balance = usdc_balance + margin_used
        available_balance = usdc_balance
        
        return {
            "address": user_address,
            "total_balance": total_balance,  # USDC + collateral in positions
            "available_balance": available_balance,  # Free USDC in wallet
            "margin_used": margin_used,  # Collateral locked in positions
            "usdc_balance": usdc_balance,  # Wallet USDC balance (for trading)
            "usdc_allowance": usdc_allowance,
            "total_collateral": margin_used,  # Alias for margin_used (backwards compat)
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

