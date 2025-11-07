"""Transaction preparation for Base Account signing."""
from typing import Optional, Dict, Any
from decimal import Decimal
from avantis_client import get_avantis_client
from symbols import get_pair_index, SymbolNotFoundError
from config import settings
import logging

logger = logging.getLogger(__name__)


async def prepare_open_position_transaction(
    symbol: str,
    collateral: float,
    leverage: int,
    is_long: bool,
    address: str,
    tp: Optional[float] = None,
    sl: Optional[float] = None
) -> Dict[str, Any]:
    """
    Prepare transaction data for opening a position (Base Account).
    
    Args:
        symbol: Trading symbol (e.g., "BTC", "ETH")
        collateral: Collateral amount in USDC
        leverage: Leverage multiplier
        is_long: True for long, False for short
        address: Base Account address
        tp: Take profit price (optional)
        sl: Stop loss price (optional)
        
    Returns:
        Dictionary with transaction data for frontend signing
    """
    try:
        # Get pair index for symbol
        pair_index = get_pair_index(symbol)
        if pair_index is None:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in registry")
        
        # Create read-only client for Base Account
        client = get_avantis_client(address=address)
        trader_client = client.get_client()
        
        # Ensure contracts are loaded
        await trader_client.load_contracts()
        
        # Convert collateral to wei (USDC has 6 decimals)
        collateral_wei = int(Decimal(str(collateral)) * Decimal(10**6))
        
        # Prepare contract function parameters
        function_params = {
            'pairIndex': pair_index,
            'collateralAmount': collateral_wei,
            'leverage': leverage,
            'isLong': is_long,
        }
        
        # Add optional parameters
        if tp is not None:
            function_params['takeProfit'] = int(Decimal(str(tp)) * Decimal(10**8))
        if sl is not None:
            function_params['stopLoss'] = int(Decimal(str(sl)) * Decimal(10**8))
        
        # Get contract address and prepare transaction data
        # Try different contract names
        contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
        function_names = ['openPosition', 'openTrade', 'createPosition']
        
        transaction_data = None
        contract_address = None
        
        for contract_name in contract_names:
            try:
                # Load contract to get address
                contract = await trader_client.load_contract(contract_name)
                if contract and hasattr(contract, 'address'):
                    contract_address = contract.address
                elif isinstance(contract, dict) and 'address' in contract:
                    contract_address = contract['address']
                
                # Prepare transaction data
                # Try to get encoded transaction data from SDK if available
                # Otherwise, return parameters for frontend encoding
                transaction_data = {
                    'to': contract_address or '0x0000000000000000000000000000000000000000',
                    'data': '0x',  # Will be encoded by SDK or frontend
                    'value': '0x0',
                    'from': address,
                }
                
                # Try to encode using SDK if available
                try:
                    # Check if trader_client has encoding capabilities
                    if hasattr(trader_client, 'encode_function_call'):
                        encoded_data = await trader_client.encode_function_call(
                            contract_name=contract_name,
                            function_name=function_names[0],
                            **function_params
                        )
                        if encoded_data:
                            transaction_data['data'] = encoded_data
                    elif hasattr(trader_client, 'encode_transaction'):
                        encoded_data = await trader_client.encode_transaction(
                            contract_name=contract_name,
                            function_name=function_names[0],
                            params=function_params
                        )
                        if encoded_data:
                            transaction_data['data'] = encoded_data
                except Exception as e:
                    logger.debug(f"Could not encode transaction via SDK: {e}. Frontend will handle encoding.")
                
                # Store function parameters for frontend encoding if needed
                transaction_data['function'] = function_names[0]
                transaction_data['contract'] = contract_name
                transaction_data['params'] = function_params
                
                break
            except Exception as e:
                logger.debug(f"Failed to load contract {contract_name}: {e}")
                continue
        
        if not transaction_data:
            raise ValueError("Could not prepare transaction: No suitable contract found")
        
        return {
            'success': True,
            'transaction': transaction_data,
            'params': {
                'symbol': symbol,
                'pair_index': pair_index,
                'collateral': collateral,
                'leverage': leverage,
                'is_long': is_long,
                'take_profit': tp,
                'stop_loss': sl,
            },
            'address': address,
            'note': 'Sign this transaction via Base Account SDK on the frontend using eth_sendTransaction'
        }
        
    except SymbolNotFoundError as e:
        logger.error(f"Symbol not found: {e}")
        raise
    except Exception as e:
        logger.error(f"Error preparing open position transaction: {e}", exc_info=True)
        raise


async def prepare_close_position_transaction(
    pair_index: int,
    address: str
) -> Dict[str, Any]:
    """
    Prepare transaction data for closing a position (Base Account).
    
    Args:
        pair_index: Avantis pair index
        address: Base Account address
        
    Returns:
        Dictionary with transaction data for frontend signing
    """
    try:
        # Create read-only client for Base Account
        client = get_avantis_client(address=address)
        trader_client = client.get_client()
        
        # Ensure contracts are loaded
        await trader_client.load_contracts()
        
        # Get contract address and prepare transaction data
        contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
        function_names = ['closePosition', 'closeTrade', 'closePositionByPair']
        
        transaction_data = None
        
        for contract_name in contract_names:
            try:
                contract = await trader_client.load_contract(contract_name)
                contract_address = None
                if contract and hasattr(contract, 'address'):
                    contract_address = contract.address
                elif isinstance(contract, dict) and 'address' in contract:
                    contract_address = contract['address']
                
                transaction_data = {
                    'to': contract_address or '0x0000000000000000000000000000000000000000',
                    'data': '0x',  # Will be encoded by SDK or frontend
                    'value': '0x0',
                    'from': address,
                }
                
                # Try to encode using SDK if available
                try:
                    if hasattr(trader_client, 'encode_function_call'):
                        encoded_data = await trader_client.encode_function_call(
                            contract_name=contract_name,
                            function_name=function_names[0],
                            pairIndex=pair_index
                        )
                        if encoded_data:
                            transaction_data['data'] = encoded_data
                    elif hasattr(trader_client, 'encode_transaction'):
                        encoded_data = await trader_client.encode_transaction(
                            contract_name=contract_name,
                            function_name=function_names[0],
                            params={'pairIndex': pair_index}
                        )
                        if encoded_data:
                            transaction_data['data'] = encoded_data
                except Exception as e:
                    logger.debug(f"Could not encode transaction via SDK: {e}. Frontend will handle encoding.")
                
                transaction_data['function'] = function_names[0]
                transaction_data['contract'] = contract_name
                transaction_data['params'] = {'pairIndex': pair_index}
                
                break
            except Exception as e:
                logger.debug(f"Failed to load contract {contract_name}: {e}")
                continue
        
        if not transaction_data:
            raise ValueError("Could not prepare transaction: No suitable contract found")
        
        return {
            'success': True,
            'transaction': transaction_data,
            'params': {
                'pair_index': pair_index,
            },
            'address': address,
            'note': 'Sign this transaction via Base Account SDK on the frontend using eth_sendTransaction'
        }
        
    except Exception as e:
        logger.error(f"Error preparing close position transaction: {e}", exc_info=True)
        raise


async def prepare_approve_usdc_transaction(
    amount: float,
    address: str
) -> Dict[str, Any]:
    """
    Prepare transaction data for USDC approval (Base Account).
    
    Args:
        amount: Amount to approve (0 for unlimited)
        address: Base Account address
        
    Returns:
        Dictionary with transaction data for frontend signing
    """
    try:
        # USDC token address from config
        usdc_address = settings.usdc_token_address
        
        # Convert amount to wei (USDC has 6 decimals)
        amount_wei = int(Decimal(str(amount)) * Decimal(10**6)) if amount > 0 else 2**256 - 1  # Max uint256 for unlimited
        
        # Avantis trading contract address
        # Try to get from settings first, then from loaded contract
        trading_contract_address = settings.avantis_trading_contract_address
        
        if not trading_contract_address:
            # Try to get from loaded contract
            client = get_avantis_client(address=address)
            trader_client = client.get_client()
            
            contract_names = ['Trading', 'PerpetualTrading', 'AvantisTrading', 'TradingContract']
            for contract_name in contract_names:
                try:
                    contract = await trader_client.load_contract(contract_name)
                    if contract and hasattr(contract, 'address'):
                        trading_contract_address = contract.address
                        break
                    elif isinstance(contract, dict) and 'address' in contract:
                        trading_contract_address = contract['address']
                        break
                except:
                    continue
        
        if not trading_contract_address:
            raise ValueError(
                "Could not determine Avantis trading contract address. "
                "Please set AVANTIS_TRADING_CONTRACT_ADDRESS in environment variables."
            )
        
        # Prepare approve transaction
        transaction_data = {
            'to': usdc_address,
            'data': '0x',  # Frontend will encode approve(address spender, uint256 amount)
            'value': '0x0',
            'from': address,
        }
        
        transaction_data['function'] = 'approve'
        transaction_data['params'] = {
            'spender': trading_contract_address,
            'amount': amount_wei,
        }
        
        return {
            'success': True,
            'transaction': transaction_data,
            'params': {
                'amount': amount,
                'amount_wei': amount_wei,
                'spender': trading_contract_address,
            },
            'address': address,
            'note': 'Sign this transaction via Base Account SDK on the frontend using eth_sendTransaction'
        }
        
    except Exception as e:
        logger.error(f"Error preparing approve USDC transaction: {e}", exc_info=True)
        raise

