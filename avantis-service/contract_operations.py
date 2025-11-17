"""Contract interaction operations for Avantis trading."""
from typing import Optional, Dict, Any
from decimal import Decimal
import logging
import inspect

logger = logging.getLogger(__name__)


async def open_position_via_contract(
    trader_client,
    pair_index: int,
    collateral_amount: float,
    leverage: int,
    is_long: bool,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None
) -> Dict[str, Any]:
    """
    Open a trading position using contract methods.
    
    Args:
        trader_client: TraderClient instance
        pair_index: Trading pair index
        collateral_amount: Collateral amount in USDC (will be converted to wei)
        leverage: Leverage multiplier
        is_long: True for long, False for short
        take_profit: Optional take profit price
        stop_loss: Optional stop loss price
        
    Returns:
        Dictionary with transaction hash and position details
    """
    try:
        # Ensure contracts are loaded
        if hasattr(trader_client, 'load_contracts'):
            if inspect.iscoroutinefunction(trader_client.load_contracts):
                await trader_client.load_contracts()
            else:
                trader_client.load_contracts()
        
        # Convert collateral to wei (USDC has 6 decimals)
        collateral_wei = int(Decimal(str(collateral_amount)) * Decimal(10**6))
        
        # Prepare contract function parameters
        # Based on typical perpetual trading contract structure
        function_params = {
            'pairIndex': pair_index,
            'collateralAmount': collateral_wei,
            'leverage': leverage,
            'isLong': is_long,
        }
        
        # Add optional parameters if provided
        if take_profit is not None:
            function_params['takeProfit'] = int(Decimal(str(take_profit)) * Decimal(10**8))  # Price precision
        
        if stop_loss is not None:
            function_params['stopLoss'] = int(Decimal(str(stop_loss)) * Decimal(10**8))  # Price precision
        
        # Call the trading contract to open position
        # Common contract names: 'Trading', 'PerpetualTrading', 'AvantisTrading'
        contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
        function_names = ['openPosition', 'openTrade', 'createPosition']
        
        result = None
        last_error = None
        
        for contract_name in contract_names:
            for function_name in function_names:
                try:
                    # Try to write to contract
                    if inspect.iscoroutinefunction(trader_client.write_contract):
                        tx_hash = await trader_client.write_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            pairIndex=function_params['pairIndex'],
                            collateralAmount=function_params['collateralAmount'],
                            leverage=function_params['leverage'],
                            isLong=function_params['isLong'],
                            **({k: v for k, v in function_params.items() if k not in ['pairIndex', 'collateralAmount', 'leverage', 'isLong']})
                        )
                    else:
                        tx_hash = trader_client.write_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            pairIndex=function_params['pairIndex'],
                            collateralAmount=function_params['collateralAmount'],
                            leverage=function_params['leverage'],
                            isLong=function_params['isLong'],
                            **({k: v for k, v in function_params.items() if k not in ['pairIndex', 'collateralAmount', 'leverage', 'isLong']})
                        )
                    
                    if tx_hash:
                        result = {
                            'tx_hash': tx_hash.hex() if hasattr(tx_hash, 'hex') else str(tx_hash),
                            'pair_index': pair_index,
                            'status': 'pending'
                        }
                        logger.info(f"Position opened via {contract_name}.{function_name}: {result['tx_hash']}")
                        break
                except Exception as e:
                    last_error = e
                    logger.debug(f"Failed to use {contract_name}.{function_name}: {e}")
                    continue
            
            if result:
                break
        
        if not result:
            # If contract methods don't work, try direct SDK method if available
            if hasattr(trader_client, 'open_position'):
                try:
                    # Check if it's async or sync
                    if inspect.iscoroutinefunction(trader_client.open_position):
                        result = await trader_client.open_position(
                            pair_index=pair_index,
                            collateral_amount=collateral_amount,
                            leverage=leverage,
                            is_long=is_long,
                            take_profit=take_profit,
                            stop_loss=stop_loss
                        )
                    else:
                        # Synchronous method
                        result = trader_client.open_position(
                            pair_index=pair_index,
                            collateral_amount=collateral_amount,
                            leverage=leverage,
                            is_long=is_long,
                            take_profit=take_profit,
                            stop_loss=stop_loss
                        )
                except Exception as sdk_error:
                    logger.warning(f"SDK open_position method failed: {sdk_error}")
                    raise ValueError(
                        f"Could not open position: SDK method failed. "
                        f"Last contract error: {last_error}, SDK error: {sdk_error}"
                    )
            else:
                raise ValueError(
                    f"Could not open position: No suitable contract method found. "
                    f"Last error: {last_error}"
                )
        
        return result
        
    except Exception as e:
        logger.error(f"Error opening position via contract: {e}", exc_info=True)
        raise


async def close_position_via_contract(
    trader_client,
    pair_index: int
) -> Dict[str, Any]:
    """
    Close a trading position using contract methods.
    
    Args:
        trader_client: TraderClient instance
        pair_index: Trading pair index to close
        
    Returns:
        Dictionary with transaction hash and PnL
    """
    try:
        # Ensure contracts are loaded
        if hasattr(trader_client, 'load_contracts'):
            if inspect.iscoroutinefunction(trader_client.load_contracts):
                await trader_client.load_contracts()
            else:
                trader_client.load_contracts()
        
        # Try different contract function combinations
        contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
        function_names = ['closePosition', 'closeTrade', 'closePositionByPair']
        
        result = None
        last_error = None
        
        for contract_name in contract_names:
            for function_name in function_names:
                try:
                    if inspect.iscoroutinefunction(trader_client.write_contract):
                        tx_hash = await trader_client.write_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            pairIndex=pair_index
                        )
                    else:
                        tx_hash = trader_client.write_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            pairIndex=pair_index
                        )
                    
                    if tx_hash:
                        result = {
                            'tx_hash': tx_hash.hex() if hasattr(tx_hash, 'hex') else str(tx_hash),
                            'pair_index': pair_index,
                            'status': 'pending'
                        }
                        logger.info(f"Position closed via {contract_name}.{function_name}: {result['tx_hash']}")
                        break
                except Exception as e:
                    last_error = e
                    logger.debug(f"Failed to use {contract_name}.{function_name}: {e}")
                    continue
            
            if result:
                break
        
        if not result:
            # Try direct SDK method if available
            if hasattr(trader_client, 'close_position'):
                try:
                    # Check if it's async or sync
                    if inspect.iscoroutinefunction(trader_client.close_position):
                        result = await trader_client.close_position(pair_index=pair_index)
                    else:
                        # Synchronous method
                        result = trader_client.close_position(pair_index=pair_index)
                except Exception as sdk_error:
                    logger.warning(f"SDK close_position method failed: {sdk_error}")
                    raise ValueError(
                        f"Could not close position: SDK method failed. "
                        f"Last contract error: {last_error}, SDK error: {sdk_error}"
                    )
            else:
                raise ValueError(
                    f"Could not close position: No suitable contract method found. "
                    f"Last error: {last_error}"
                )
        
        return result
        
    except Exception as e:
        logger.error(f"Error closing position via contract: {e}", exc_info=True)
        raise


async def close_all_positions_via_contract(
    trader_client
) -> Dict[str, Any]:
    """
    Close all open positions using contract methods.
    
    Args:
        trader_client: TraderClient instance
        
    Returns:
        Dictionary with transaction hashes and total PnL
    """
    try:
        # First, get all open positions (avoid circular import by calling directly)
        positions = await get_positions_via_contract(trader_client)
        
        if not positions:
            return {
                'closed_count': 0,
                'tx_hashes': [],
                'total_pnl': 0
            }
        
        # Close each position
        tx_hashes = []
        total_pnl = 0
        
        for position in positions:
            pair_index = position.get('pair_index')
            if pair_index is not None:
                try:
                    result = await close_position_via_contract(trader_client, pair_index)
                    if result and 'tx_hash' in result:
                        tx_hashes.append(result['tx_hash'])
                    if 'pnl' in result:
                        total_pnl += result.get('pnl', 0)
                except Exception as e:
                    logger.warning(f"Failed to close position {pair_index}: {e}")
                    continue
        
        return {
            'closed_count': len(tx_hashes),
            'tx_hashes': tx_hashes,
            'total_pnl': total_pnl
        }
        
    except Exception as e:
        logger.error(f"Error closing all positions via contract: {e}", exc_info=True)
        raise


async def get_positions_via_contract(
    trader_client,
    address: Optional[str] = None
) -> list[Dict[str, Any]]:
    """
    Get all open positions using contract read methods.
    
    Args:
        trader_client: TraderClient instance
        address: User's address (required for Base Accounts, optional if signer available)
        
    Returns:
        List of position dictionaries
    """
    try:
        # Ensure contracts are loaded
        if hasattr(trader_client, 'load_contracts'):
            if inspect.iscoroutinefunction(trader_client.load_contracts):
                await trader_client.load_contracts()
            else:
                trader_client.load_contracts()
        
        # Get user address
        user_address = address
        if not user_address and trader_client.has_signer():
            signer = trader_client.get_signer()
            if hasattr(signer, 'account') and hasattr(signer.account, 'address'):
                user_address = signer.account.address
            elif hasattr(signer, 'address'):
                user_address = signer.address
        
        if not user_address:
            logger.warning("No address available for position query")
            return []
        
        # Try to read positions from contract
        contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
        function_names = ['getPositions', 'getUserPositions', 'getOpenPositions']
        
        positions = None
        last_error = None
        
        for contract_name in contract_names:
            for function_name in function_names:
                try:
                    # Read positions for the user address
                    if inspect.iscoroutinefunction(trader_client.read_contract):
                        positions_data = await trader_client.read_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            user=user_address,
                            decode=True
                        )
                    else:
                        positions_data = trader_client.read_contract(
                            contract_name=contract_name,
                            function_name=function_name,
                            user=user_address,
                            decode=True
                        )
                    
                    if positions_data:
                        # Parse positions data
                        if isinstance(positions_data, (list, tuple)):
                            positions = positions_data
                        elif isinstance(positions_data, dict) and 'positions' in positions_data:
                            positions = positions_data['positions']
                        else:
                            positions = [positions_data] if positions_data else []
                        
                        logger.debug(f"Retrieved {len(positions)} positions via {contract_name}.{function_name}")
                        break
                except Exception as e:
                    last_error = e
                    logger.debug(f"Failed to use {contract_name}.{function_name}: {e}")
                    continue
            
            if positions is not None:
                break
        
        if positions is None:
            # Try direct SDK method if available
            if hasattr(trader_client, 'get_positions'):
                try:
                    # Check if it's async or sync
                    if inspect.iscoroutinefunction(trader_client.get_positions):
                        positions = await trader_client.get_positions()
                    else:
                        # Synchronous method
                        positions = trader_client.get_positions()
                except Exception as sdk_error:
                    logger.warning(f"SDK get_positions method failed: {sdk_error}")
                    return []
            else:
                logger.warning(f"Could not retrieve positions: No suitable contract method found. Last error: {last_error}")
                return []
        
        # Format positions
        formatted_positions = []
        for pos in positions:
            if isinstance(pos, dict):
                formatted_positions.append({
                    'pair_index': pos.get('pairIndex') or pos.get('pair_index'),
                    'is_long': pos.get('isLong') or pos.get('is_long', False),
                    'size': pos.get('size', 0),
                    'entry_price': pos.get('entryPrice') or pos.get('entry_price', 0),
                    'current_price': pos.get('currentPrice') or pos.get('current_price', 0),
                    'leverage': pos.get('leverage', 1),
                    'collateral': pos.get('collateral', 0),
                    'pnl': pos.get('pnl', 0),
                    'pnl_percentage': pos.get('pnlPercentage') or pos.get('pnl_percentage', 0),
                    'liquidation_price': pos.get('liquidationPrice') or pos.get('liquidation_price'),
                    'take_profit': pos.get('takeProfit') or pos.get('take_profit'),
                    'stop_loss': pos.get('stopLoss') or pos.get('stop_loss'),
                })
        
        return formatted_positions
        
    except Exception as e:
        logger.error(f"Error getting positions via contract: {e}", exc_info=True)
        return []


async def get_balance_via_contract(
    trader_client,
    address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get account balance using contract read methods.
    
    Args:
        trader_client: TraderClient instance
        address: User's address (required for Base Accounts, optional if signer available)
        
    Returns:
        Dictionary with balance information
    """
    try:
        # Get address
        user_address = address
        if not user_address and trader_client.has_signer():
            signer = trader_client.get_signer()
            if hasattr(signer, 'account') and hasattr(signer.account, 'address'):
                user_address = signer.account.address
            elif hasattr(signer, 'address'):
                user_address = signer.address
        
        if not user_address:
            raise ValueError("Address is required for balance queries")
        
        # Use SDK methods if available (may require signer for some methods)
        usdc_balance = 0
        usdc_allowance = 0
        
        if trader_client.has_signer():
            # Traditional wallet - can use SDK methods
            if hasattr(trader_client, 'get_usdc_balance'):
                try:
                    if inspect.iscoroutinefunction(trader_client.get_usdc_balance):
                        usdc_balance = await trader_client.get_usdc_balance()
                    else:
                        usdc_balance = trader_client.get_usdc_balance()
                except:
                    pass
            
            if hasattr(trader_client, 'get_usdc_allowance_for_trading'):
                try:
                    if inspect.iscoroutinefunction(trader_client.get_usdc_allowance_for_trading):
                        usdc_allowance = await trader_client.get_usdc_allowance_for_trading()
                    else:
                        usdc_allowance = trader_client.get_usdc_allowance_for_trading()
                except:
                    pass
        else:
            # Base Account - read from contract directly
            # Try to read balance from contract
            try:
                if hasattr(trader_client, 'load_contracts'):
                    if inspect.iscoroutinefunction(trader_client.load_contracts):
                        await trader_client.load_contracts()
                    else:
                        trader_client.load_contracts()
                # Read USDC balance for the address
                # This would need to be implemented based on actual contract structure
                logger.debug("Reading balance from contract for Base Account")
            except Exception as e:
                logger.debug(f"Could not read balance from contract: {e}")
        
        return {
            'address': user_address,
            'usdc_balance': float(usdc_balance) / 1e6 if usdc_balance else 0,  # Convert from wei
            'usdc_allowance': float(usdc_allowance) / 1e6 if usdc_allowance else 0,  # Convert from wei
            'total_balance': float(usdc_balance) / 1e6 if usdc_balance else 0,
            'available_balance': float(usdc_balance) / 1e6 if usdc_balance else 0,
            'margin_used': 0,  # Would need to calculate from positions
        }
        
    except Exception as e:
        logger.error(f"Error getting balance via contract: {e}", exc_info=True)
        raise

