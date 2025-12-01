# avantis-service/contract_operations.py
"""
Contract interaction operations for Avantis trading (direct Web3, no SDK).

This module integrates with BaseScan transaction examples to ensure
our contract calls match real-world patterns from the blockchain.
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List

from web3 import Web3
from web3.types import HexBytes

from config import settings
from direct_contracts import AvantisTradingContract, TradeParams

logger = logging.getLogger(__name__)

# Optional BaseScan integration (import only if needed)
try:
    from basescan_integration import (
        BaseScanParser,
        validate_against_basescan_example,
        get_basescan_link,
    )
    BASESCAN_AVAILABLE = True
except ImportError:
    BASESCAN_AVAILABLE = False
    logger.debug("BaseScan integration not available")

# --- Constants ---
MIN_COLLATERAL_USDC = 10.0   # Protocol minimum (matches Avantis UI)
USDC_DECIMALS = 6
PRICE_DECIMALS = 10          # Avantis uses 10 decimals for price/TP/SL
SLIPPAGE_DEFAULT = 1.0       # 1%


# ==========================================
# 1. Validation
# ==========================================

def validate_trade_params(
    collateral_amount: float,
    leverage: int,
    pair_index: int,
) -> None:
    if collateral_amount < MIN_COLLATERAL_USDC:
        raise ValueError(
            f"Collateral ${collateral_amount} is below protocol minimum ${MIN_COLLATERAL_USDC}."
        )

    if not 2 <= leverage <= 50:
        raise ValueError(f"Leverage {leverage}x is out of range (2x-50x).")

    if pair_index < 0:
        raise ValueError(f"Invalid pair index: {pair_index}")


def _get_rpc_url(rpc_url: Optional[str] = None) -> str:
    return rpc_url or getattr(settings, "avantis_rpc_url", None) or "https://mainnet.base.org"


# ==========================================
# 2. Main Trading Functions (Direct Contracts)
# ==========================================

async def open_position_via_contract(
    pair_index: int,
    collateral_amount: float,
    leverage: int,
    is_long: bool,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None,
    slippage_percentage: float = SLIPPAGE_DEFAULT,
    private_key: str = "",
    rpc_url: Optional[str] = None,
    execution_fee_wei: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Open a position using Trading.openTrade via Web3.py.
    """
    logger.info("=" * 80)
    logger.info("📝 [TRACE] open_position_via_contract() CALLED (direct Web3)")
    logger.info(
        f"   Pair Index: {pair_index}, Collateral: ${collateral_amount}, "
        f"Leverage: {leverage}x, Long: {is_long}"
    )
    logger.info("=" * 80)

    if not private_key:
        raise ValueError("Private key is required to execute trades.")

    validate_trade_params(collateral_amount, leverage, pair_index)

    rpc = _get_rpc_url(rpc_url)

    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )
    if not trading.address:
        raise ValueError("Failed to derive address from private key")
    trader_address = trading.address
    logger.info(f"🔍 Trading from address: {trader_address}")

    # Convert human values → on-chain units (matching Avantis SDK format)
    # - positionSizeUSDC: 6-decimal format (15 USDC = 15,000,000)
    # - leverage: 10-decimal format (25x = 250,000,000,000) - CRITICAL!
    # - prices (tp, sl, openPrice): 10-decimal format
    LEVERAGE_PRECISION = 10 ** 10  # Avantis uses 1e10 for leverage
    collateral_usdc_int = int(collateral_amount * (10 ** USDC_DECIMALS))  # 6 decimals
    leverage_int = int(leverage * LEVERAGE_PRECISION)  # 10 decimals
    tp_price = int(take_profit * (10 ** PRICE_DECIMALS)) if take_profit else 0
    sl_price = int(stop_loss * (10 ** PRICE_DECIMALS)) if stop_loss else 0

    # ------------------------------------------------------------------
    # Fetch current market price from Avantis SDK
    # The SDK requires openPrice to be set even for market orders
    # Price is in 10-decimal precision (1e10)
    # CRITICAL: Without a valid openPrice, the keeper will CANCEL the order!
    # ------------------------------------------------------------------
    open_price = 0
    try:
        from avantis_trader_sdk import FeedClient
        from symbols.symbol_registry import PAIR_INDEX_TO_SYMBOL
        
        feed_client = FeedClient()
        # Get symbol for this pair index
        symbol = PAIR_INDEX_TO_SYMBOL.get(pair_index)
        if symbol:
            pair_name = f"{symbol}/USD"
            try:
                # Await directly since we're in an async function
                price_data = await feed_client.get_latest_price_updates([pair_name])
                if price_data and hasattr(price_data, 'parsed') and price_data.parsed:
                    open_price = int(price_data.parsed[0].converted_price * (10 ** PRICE_DECIMALS))
                    logger.info(f"📈 Fetched market price for pair {pair_index} ({symbol}): ${open_price / (10 ** PRICE_DECIMALS):.2f}")
            except Exception as e:
                logger.warning(f"Could not fetch price from SDK for {pair_name}: {e}")
        
        if open_price == 0:
            logger.error(f"❌ CRITICAL: Could not fetch market price for pair {pair_index}. Order will likely be cancelled by keeper!")
    except Exception as e:
        logger.error(f"❌ Price fetch error: {e}. Order will likely be cancelled by keeper!")

    # ------------------------------------------------------------------
    # BELOW_MIN_POS protection (on-chain rule):
    # positionSizeUSDC * leverage >= pairMinLevPosUSDC(pairIndex)
    # ------------------------------------------------------------------
    logger.info(
        f"ℹ️ Position details: Collateral: ${collateral_amount:.2f} USDC, "
        f"Leverage: {leverage}x, Notional: ${collateral_amount * leverage:.2f}"
    )

    params = TradeParams(
        trader=trader_address,
        pair_index=pair_index,
        collateral_usdc=collateral_usdc_int,  # 1e12 precision
        leverage=leverage_int,  # 1e10 precision
        is_long=is_long,
        tp_price=tp_price,
        sl_price=sl_price,
        open_price=open_price,  # Set actual market price (1e10 precision)
        index=0,
        initial_pos_token=0,
        timestamp=0,
    )
    
    logger.info(
        f"📊 Trade params (Avantis precision): positionSizeUSDC={collateral_usdc_int}, "
        f"leverage={leverage_int}, openPrice={open_price}"
    )

    # Slippage percentage: 1% = 10000000000 (1e10) matching SDK format
    slippage_p = int(slippage_percentage * (10 ** PRICE_DECIMALS))

    if execution_fee_wei is None:
        # default for Base – you can tune this or estimate via a view method if Avantis exposes one
        execution_fee_wei = int(0.0001 * 10 ** 18)

    logger.info(
        f"💰 openTrade: positionSizeUSDC={collateral_usdc_int}, tp={tp_price}, "
        f"sl={sl_price}, slippageP={slippage_p}, execution_fee_wei={execution_fee_wei}"
    )

    tx = trading.build_open_trade_tx(
        params=params,
        order_type=0,   # OpenLimitOrderType.MARKET
        slippage_p=slippage_p,
        execution_fee_wei=execution_fee_wei,
    )
    tx_hash = trading.sign_and_send(tx)
    logger.info(f"🚀 Sent openTrade tx: {tx_hash}")
    
    # Log BaseScan link for verification
    if BASESCAN_AVAILABLE:
        basescan_url = get_basescan_link(tx_hash)
        logger.info(f"🔗 View on BaseScan: {basescan_url}")

    # Convert string hash to HexBytes for type checker
    tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
    receipt = await asyncio.to_thread(trading.web3.eth.wait_for_transaction_receipt, tx_hash_bytes)

    result = _format_receipt(
        receipt,
        pair_index=pair_index,
        action="open",
        collateral_amount=collateral_amount,
    )
    
    # Add BaseScan link to result
    if BASESCAN_AVAILABLE:
        result["basescan_url"] = get_basescan_link(tx_hash)
    
    return result


# ==========================================
# 3. Position Management (Close / Read / TP-SL)
# ==========================================

TRADING_STORAGE_ABI = [
    # openTrades(address _trader, uint256 _pairIndex, uint256 _index) -> Trade
    {
        "inputs": [
            {"internalType": "address", "name": "_trader", "type": "address"},
            {"internalType": "uint256", "name": "_pairIndex", "type": "uint256"},
            {"internalType": "uint256", "name": "_index", "type": "uint256"},
        ],
        "name": "openTrades",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "trader", "type": "address"},
                    {"internalType": "uint256", "name": "pairIndex", "type": "uint256"},
                    {"internalType": "uint256", "name": "index", "type": "uint256"},
                    {"internalType": "uint256", "name": "initialPosToken", "type": "uint256"},
                    {"internalType": "uint256", "name": "positionSizeUSDC", "type": "uint256"},
                    {"internalType": "uint256", "name": "openPrice", "type": "uint256"},
                    {"internalType": "bool", "name": "buy", "type": "bool"},
                    {"internalType": "uint256", "name": "leverage", "type": "uint256"},
                    {"internalType": "uint256", "name": "tp", "type": "uint256"},
                    {"internalType": "uint256", "name": "sl", "type": "uint256"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                ],
                "internalType": "struct ITradingStorage.Trade",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # openTradesInfo(address _trader, uint256 _pairIndex, uint256 _index) -> TradeInfo
    {
        "inputs": [
            {"internalType": "address", "name": "_trader", "type": "address"},
            {"internalType": "uint256", "name": "_pairIndex", "type": "uint256"},
            {"internalType": "uint256", "name": "_index", "type": "uint256"},
        ],
        "name": "openTradesInfo",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "openInterestUSDC", "type": "uint256"},
                    {"internalType": "uint256", "name": "tpLastUpdated", "type": "uint256"},
                    {"internalType": "uint256", "name": "slLastUpdated", "type": "uint256"},
                    {"internalType": "bool", "name": "beingMarketClosed", "type": "bool"},
                    {"internalType": "uint256", "name": "lossProtection", "type": "uint256"},
                ],
                "internalType": "struct ITradingStorage.TradeInfo",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # getOpenLimitOrder(address _trader, uint256 _pairIndex, uint256 _index) -> OpenLimitOrder
    {
        "inputs": [
            {"internalType": "address", "name": "_trader", "type": "address"},
            {"internalType": "uint256", "name": "_pairIndex", "type": "uint256"},
            {"internalType": "uint256", "name": "_index", "type": "uint256"},
        ],
        "name": "getOpenLimitOrder",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "trader", "type": "address"},
                    {"internalType": "uint256", "name": "pairIndex", "type": "uint256"},
                    {"internalType": "uint256", "name": "index", "type": "uint256"},
                    {"internalType": "uint256", "name": "positionSize", "type": "uint256"},
                    {"internalType": "bool", "name": "buy", "type": "bool"},
                    {"internalType": "uint256", "name": "leverage", "type": "uint256"},
                    {"internalType": "uint256", "name": "tp", "type": "uint256"},
                    {"internalType": "uint256", "name": "sl", "type": "uint256"},
                    {"internalType": "uint256", "name": "price", "type": "uint256"},
                    {"internalType": "uint256", "name": "slippageP", "type": "uint256"},
                    {"internalType": "uint256", "name": "block", "type": "uint256"},
                    {"internalType": "uint256", "name": "executionFee", "type": "uint256"},
                ],
                "internalType": "struct ITradingStorage.OpenLimitOrder",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # openTradesCount(address _trader, uint256 _pairIndex) -> uint256
    {
        "inputs": [
            {"internalType": "address", "name": "_trader", "type": "address"},
            {"internalType": "uint256", "name": "_pairIndex", "type": "uint256"},
        ],
        "name": "openTradesCount",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # openLimitOrdersCount(address _trader, uint256 _pairIndex) -> uint256
    {
        "inputs": [
            {"internalType": "address", "name": "_trader", "type": "address"},
            {"internalType": "uint256", "name": "_pairIndex", "type": "uint256"},
        ],
        "name": "openLimitOrdersCount",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # pairMinLevPosUSDC(uint256 _pairIndex) -> uint256
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "pairMinLevPosUSDC",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _get_trading_storage_contract(rpc_url: str):
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")

    addr = settings.avantis_trading_storage_contract_address
    if not addr:
        raise ValueError("TradingStorage contract address not configured in settings.")

    return w3.eth.contract(
        address=Web3.to_checksum_address(addr),
        abi=TRADING_STORAGE_ABI,
    )


# ==========================================
# Struct Decoders
# ==========================================

def _decode_trade_struct(raw) -> Dict[str, Any]:
    """
    Decode ITradingStorage.Trade into a python dict with both raw + human fields.
    raw is the tuple returned by openTrades(...).
    """
    if not raw or raw[0] == "0x0000000000000000000000000000000000000000":
        return {}

    return {
        "trader": raw[0],
        "pair_index": int(raw[1]),
        "index": int(raw[2]),
        "initial_pos_token_raw": int(raw[3]),
        "position_size_usdc_raw": int(raw[4]),
        "position_size_usdc": float(raw[4]) / float(10 ** USDC_DECIMALS),
        "open_price_raw": int(raw[5]),
        "open_price": float(raw[5]) / float(10 ** PRICE_DECIMALS),
        "is_long": bool(raw[6]),
        "leverage": int(raw[7]),
        "tp_raw": int(raw[8]),
        "tp": float(raw[8]) / float(10 ** PRICE_DECIMALS) if int(raw[8]) > 0 else 0.0,
        "sl_raw": int(raw[9]),
        "sl": float(raw[9]) / float(10 ** PRICE_DECIMALS) if int(raw[9]) > 0 else 0.0,
        "timestamp": int(raw[10]),
    }


def _decode_trade_info_struct(raw) -> Dict[str, Any]:
    """
    Decode ITradingStorage.TradeInfo into a python dict.
    openInterestUSDC uses 6 decimals.
    """
    if not raw:
        return {}

    return {
        "open_interest_usdc_raw": int(raw[0]),
        "open_interest_usdc": float(raw[0]) / float(10 ** USDC_DECIMALS),
        "tp_last_updated": int(raw[1]),
        "sl_last_updated": int(raw[2]),
        "being_market_closed": bool(raw[3]),
        "loss_protection_raw": int(raw[4]),
        "loss_protection": float(raw[4]) / float(10 ** USDC_DECIMALS),
    }


def _decode_open_limit_order_struct(raw) -> Dict[str, Any]:
    """
    Decode ITradingStorage.OpenLimitOrder into a python dict.
    price / tp / sl are 10-decimal prices, positionSize is USDC-like (6 decimals).
    """
    if not raw or raw[0] == "0x0000000000000000000000000000000000000000":
        return {}

    return {
        "trader": raw[0],
        "pair_index": int(raw[1]),
        "index": int(raw[2]),
        "position_size_raw": int(raw[3]),
        "position_size": float(raw[3]) / float(10 ** USDC_DECIMALS),
        "is_long": bool(raw[4]),
        "leverage": int(raw[5]),
        "tp_raw": int(raw[6]),
        "tp": float(raw[6]) / float(10 ** PRICE_DECIMALS) if int(raw[6]) > 0 else 0.0,
        "sl_raw": int(raw[7]),
        "sl": float(raw[7]) / float(10 ** PRICE_DECIMALS) if int(raw[7]) > 0 else 0.0,
        "price_raw": int(raw[8]),
        "price": float(raw[8]) / float(10 ** PRICE_DECIMALS),
        "slippage_p": int(raw[9]),
        "block": int(raw[10]),
        "execution_fee_raw": int(raw[11]),
        # fee is in native (ETH on Base); keep raw and let front-end format.
    }


async def _get_pair_min_lev_pos_usdc(
    pair_index: int,
    rpc_url: Optional[str] = None,
) -> int:
    """
    Fetch pairMinLevPosUSDC(pairIndex) from TradingStorage contract.
    
    Returns the minimum leveraged position size in USDC (raw wei, 6 decimals).
    This is the minimum value of (positionSizeUSDC * leverage) required for this pair.
    
    Args:
        pair_index: Trading pair index
        rpc_url: Optional RPC URL (uses settings default if not provided)
        
    Returns:
        Minimum leveraged position size in USDC wei (6 decimals)
    """
    rpc = _get_rpc_url(rpc_url)
    storage = _get_trading_storage_contract(rpc)
    
    try:
        min_pos_raw = storage.functions.pairMinLevPosUSDC(pair_index).call()
        return int(min_pos_raw)
    except Exception as e:
        logger.warning(f"Failed to fetch pairMinLevPosUSDC for pair_index={pair_index}: {e}")
        raise


async def get_min_position_size_usdc(
    pair_index: int,
    leverage: int,
    rpc_url: Optional[str] = None,
) -> float:
    """
    Get the minimum collateral required for a position at a given leverage.
    
    This is a public function that can be called from the API.
    It calculates: min_collateral = pairMinLevPosUSDC / (leverage * 1e6)
    
    Args:
        pair_index: Trading pair index
        leverage: Leverage multiplier (e.g., 10 for 10x)
        rpc_url: Optional RPC URL (uses settings default if not provided)
        
    Returns:
        Minimum collateral in USDC (human-readable float)
    """
    try:
        min_pos_raw = await _get_pair_min_lev_pos_usdc(pair_index, rpc_url=rpc_url)
        min_collateral_usdc = min_pos_raw / (float(10 ** USDC_DECIMALS) * leverage)
        return min_collateral_usdc
    except Exception as e:
        logger.error(f"Error getting min position size for pair_index={pair_index}, leverage={leverage}: {e}")
        raise


async def get_min_position_size_for_pair(
    pair_index: int,
    leverage: int,
    rpc_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get minimum position size information for a pair at a given leverage.
    
    This function provides detailed information about minimum position requirements
    for API endpoints and validation purposes.
    
    Args:
        pair_index: Trading pair index
        leverage: Leverage multiplier (e.g., 10 for 10x)
        rpc_url: Optional RPC URL (uses settings default if not provided)
        
    Returns:
        Dictionary with:
        - pair_index: The pair index
        - leverage: The leverage multiplier
        - pair_min_lev_pos_usdc: Minimum leveraged position size in USDC (raw wei, 6 decimals)
        - min_collateral_usdc: Minimum collateral required in USDC (human-readable)
        - status: "success" or "error"
        - error: Error message if status is "error"
    """
    try:
        min_pos_raw = await _get_pair_min_lev_pos_usdc(pair_index, rpc_url=rpc_url)
        min_collateral_usdc = min_pos_raw / (float(10 ** USDC_DECIMALS) * leverage)
        
        return {
            "pair_index": pair_index,
            "leverage": leverage,
            "pair_min_lev_pos_usdc": int(min_pos_raw),
            "min_collateral_usdc": min_collateral_usdc,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error getting min position size for pair_index={pair_index}, leverage={leverage}: {e}")
        return {
            "pair_index": pair_index,
            "leverage": leverage,
            "status": "error",
            "error": str(e)
        }


async def close_position_via_contract(
    pair_index: int,
    trade_index: int,
    private_key: str,
    rpc_url: Optional[str] = None,
    execution_fee_wei: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Close a specific position using Trading.closeTradeMarket.
    
    - Resolves the trader address from private_key
    - Reads the current trade from TradingStorage to get the collateral (positionSizeUSDC)
    - Calls closeTradeMarket with that amount and execution fee in value
    """
    from eth_account import Account

    if not private_key:
        raise ValueError("Private key is required to close positions")

    account = Account.from_key(private_key)
    trader_address = account.address

    rpc = _get_rpc_url(rpc_url)

    # 1) Read the trade from TradingStorage to know how much to close
    storage = _get_trading_storage_contract(rpc)

    def _read_trade():
        return storage.functions.openTrades(
            trader_address, int(pair_index), int(trade_index)
        ).call()

    trade_raw = await asyncio.to_thread(_read_trade)
    trade = _decode_trade_struct(trade_raw)

    if not trade:
        raise ValueError(
            f"No open trade found for {trader_address} pair={pair_index} index={trade_index}"
        )

    amount_usdc_raw = trade["position_size_usdc_raw"]  # full close (positionSizeUSDC)

    # 2) Get execution fee for closing (reuse whatever you use for openTrade)
    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )

    if execution_fee_wei is None:
        # Default execution fee for closing (can be tuned)
        execution_fee_wei = int(0.0003 * 10**18)  # e.g. 0.0003 ETH

    logger.info(
        f"🔒 Closing position: trader={trader_address}, pair_index={pair_index}, "
        f"trade_index={trade_index}, amount={amount_usdc_raw / 1e6:.2f} USDC"
    )

    # 3) Build & send tx
    tx = trading.build_close_trade_market_tx(
        pair_index=pair_index,
        index=trade_index,
        amount=amount_usdc_raw,
        execution_fee_wei=execution_fee_wei,
    )
    tx_hash = trading.sign_and_send(tx)
    logger.info(f"🚀 Sent closeTradeMarket tx: {tx_hash}")
    
    # Log BaseScan link for verification
    if BASESCAN_AVAILABLE:
        basescan_url = get_basescan_link(tx_hash)
        logger.info(f"🔗 View on BaseScan: {basescan_url}")

    # 4) Wait for receipt
    tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
    receipt = await asyncio.to_thread(trading.web3.eth.wait_for_transaction_receipt, tx_hash_bytes)

    result = _format_receipt(
        receipt=receipt,
        pair_index=pair_index,
        action="close",
    )
    
    # Add BaseScan link to result
    if BASESCAN_AVAILABLE:
        result["basescan_url"] = get_basescan_link(tx_hash)
    
    return result


async def close_all_positions_via_contract(
    private_key: str,
    rpc_url: Optional[str] = None,
    pair_indices: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Close all open positions across a range of pair indices.
    Uses openTradesCount to find all positions efficiently.
    """
    from eth_account import Account

    if not private_key:
        raise ValueError("Private key is required to close positions.")

    account = Account.from_key(private_key)
    trader_address = account.address

    rpc = _get_rpc_url(rpc_url)

    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )

    if not pair_indices:
        max_pairs = getattr(settings, "avantis_max_pair_index", 32)
        pair_indices = list(range(max_pairs))

    storage = _get_trading_storage_contract(rpc)

    tx_hashes: List[str] = []
    execution_fee_wei = int(0.0003 * 10 ** 18)  # Default execution fee for closing

    def _count_trades(p_idx: int) -> int:
        return storage.functions.openTradesCount(trader_address, p_idx).call()

    for pair_index in pair_indices:
        try:
            # Use openTradesCount to know how many trades exist for this pair
            count = await asyncio.to_thread(_count_trades, pair_index)
            if count == 0:
                continue

            # Close all trades for this pair (indices 0 to count-1)
            for trade_index in range(count):
                try:
                    def _read_trade():
                        return storage.functions.openTrades(
                            trader_address, int(pair_index), int(trade_index)
                        ).call()

                    trade_raw = await asyncio.to_thread(_read_trade)
                    trade = _decode_trade_struct(trade_raw)

                    if not trade:
                        continue

                    amount_usdc_raw = trade["position_size_usdc_raw"]
                    if amount_usdc_raw == 0:
                        continue

                    logger.info(
                        f"🔒 Closing position on pair_index={pair_index}, "
                        f"trade_index={trade_index}, size={amount_usdc_raw / 1e6:.2f} USDC"
                    )

                    tx = trading.build_close_trade_market_tx(
                        pair_index=pair_index,
                        index=trade_index,
                        amount=amount_usdc_raw,
                        execution_fee_wei=execution_fee_wei,
                    )
                    tx_hash = trading.sign_and_send(tx)
                    tx_hashes.append(tx_hash)
                except Exception as e:
                    logger.warning(
                        f"Failed to close position for pair_index={pair_index}, "
                        f"trade_index={trade_index}: {e}"
                    )
        except Exception as e:
            logger.warning(f"Failed to check/close positions for pair_index={pair_index}: {e}")

    return {
        "closed_count": len(tx_hashes),
        "tx_hashes": tx_hashes,
        "total_pnl": 0.0,
    }


async def get_positions_via_contract(
    private_key: Optional[str] = None,
    address: Optional[str] = None,
    rpc_url: Optional[str] = None,
    pair_indices: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch open positions using TradingStorage.openTrades.
    Uses openTradesCount to discover all positions efficiently.
    """
    if not private_key and not address:
        raise ValueError("Either private_key or address is required to read positions.")

    rpc = _get_rpc_url(rpc_url)

    if private_key:
        trading = AvantisTradingContract(
            rpc_url=rpc,
            contract_address=settings.avantis_trading_contract_address,
            private_key=private_key,
        )
        if not trading.address:
            raise ValueError("Failed to derive address from private key")
        trader_address = trading.address
    else:
        # At this point, address cannot be None because we checked above
        assert address is not None, "address must be provided when private_key is None"
        trader_address = Web3.to_checksum_address(address)

    if not pair_indices:
        max_pairs = getattr(settings, "avantis_max_pair_index", 32)
        pair_indices = list(range(max_pairs))

    storage = _get_trading_storage_contract(rpc)
    positions: List[Dict[str, Any]] = []

    def _count_trades(p_idx: int) -> int:
        return storage.functions.openTradesCount(trader_address, p_idx).call()

    for pair_index in pair_indices:
        try:
            # Use openTradesCount to know how many trades exist for this pair
            count = await asyncio.to_thread(_count_trades, pair_index)
            if count == 0:
                continue

            # Iterate through all trade indices (0 to count-1)
            for trade_index in range(count):
                try:
                    def _read_trade():
                        return storage.functions.openTrades(
                            trader_address, int(pair_index), int(trade_index)
                        ).call()

                    trade_raw = await asyncio.to_thread(_read_trade)
                    trade = _decode_trade_struct(trade_raw)

                    if not trade:
                        continue

                    positions.append(
                        {
                            "trader": trade["trader"],
                            "pair_index": trade["pair_index"],
                            "index": trade["index"],
                            "initial_pos_token": trade["initial_pos_token_raw"],
                            "position_size_usdc": trade["position_size_usdc"],
                            "position_size_usdc_raw": trade["position_size_usdc_raw"],
                            "open_price": trade["open_price"],
                            "is_long": trade["is_long"],
                            "leverage": trade["leverage"],
                            "tp": trade["tp"],
                            "sl": trade["sl"],
                            "timestamp": trade["timestamp"],
                        }
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to read position for pair_index={pair_index}, "
                        f"trade_index={trade_index}: {e}"
                    )
        except Exception as e:
            logger.warning(f"Failed to check positions for pair_index={pair_index}: {e}")

    return positions


async def update_tp_sl_via_contract(
    pair_index: int,
    trade_index: int,
    new_tp: Optional[float],
    new_sl: Optional[float],
    private_key: str,
    rpc_url: Optional[str] = None,
    price_update_data: Optional[List[bytes]] = None,
    execution_fee_wei: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Update TP/SL using Trading.updateTpAndSl.
    """
    if not private_key:
        raise ValueError("Private key is required to update TP/SL.")

    if new_tp is None and new_sl is None:
        raise ValueError("At least one of new_tp or new_sl must be provided.")

    rpc = _get_rpc_url(rpc_url)

    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )
    if not trading.address:
        raise ValueError("Failed to derive address from private key")
    trader_address = trading.address

    logger.info(
        f"🛠 Updating TP/SL for trader={trader_address}, pair_index={pair_index}, "
        f"trade_index={trade_index}, new_tp={new_tp}, new_sl={new_sl}"
    )

    storage = _get_trading_storage_contract(rpc)
    trade = storage.functions.openTrades(trader_address, int(pair_index), int(trade_index)).call()
    if trade[0] == "0x0000000000000000000000000000000000000000":
        raise ValueError(
            f"No open trade found for trader={trader_address}, pair={pair_index}, index={trade_index}"
        )

    current_tp_int = int(trade[8])
    current_sl_int = int(trade[9])

    if new_tp is None:
        new_tp_int = current_tp_int
    else:
        new_tp_int = int(new_tp * (10 ** PRICE_DECIMALS))

    if new_sl is None:
        new_sl_int = current_sl_int
    else:
        new_sl_int = int(new_sl * (10 ** PRICE_DECIMALS))

    if price_update_data is None:
        price_update_data = []

    # updateTpAndSl requires value = 1 wei (not execution_fee_wei)
    tx = trading.build_update_tp_sl_tx(
        pair_index=pair_index,
        index=trade_index,
        new_sl=new_sl_int,
        new_tp=new_tp_int,
        price_update_data=price_update_data,
    )
    tx_hash = trading.sign_and_send(tx)
    logger.info(f"🚀 Sent updateTpAndSl tx: {tx_hash}")
    
    # Log BaseScan link for verification
    if BASESCAN_AVAILABLE:
        basescan_url = get_basescan_link(tx_hash)
        logger.info(f"🔗 View on BaseScan: {basescan_url}")

    # Convert string hash to HexBytes for type checker
    tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
    receipt = await asyncio.to_thread(trading.web3.eth.wait_for_transaction_receipt, tx_hash_bytes)
    
    result = _format_receipt(receipt, pair_index=pair_index, action="update_tp_sl")
    
    # Add BaseScan link to result
    if BASESCAN_AVAILABLE:
        result["basescan_url"] = get_basescan_link(tx_hash)
    
    return result


async def update_margin_via_contract(
    pair_index: int,
    trade_index: int,
    update_type: int,
    amount_usdc: float,
    private_key: str,
    rpc_url: Optional[str] = None,
    price_update_data: Optional[List[bytes]] = None,
) -> Dict[str, Any]:
    """
    Update margin (deposit or withdraw) using Trading.updateMargin.
    
    Args:
        pair_index: Trading pair index
        trade_index: Trade index
        update_type: 0 = DEPOSIT, 1 = WITHDRAW
        amount_usdc: Amount in USDC (human-readable, will be converted to 6 decimals)
        private_key: User's private key
        rpc_url: Optional RPC URL
        price_update_data: Optional price update data (defaults to empty list)
        
    Returns:
        Dictionary with transaction receipt
    """
    from eth_account import Account

    if not private_key:
        raise ValueError("Private key is required to update margin.")

    if update_type not in [0, 1]:
        raise ValueError("update_type must be 0 (DEPOSIT) or 1 (WITHDRAW)")

    account = Account.from_key(private_key)
    trader_address = account.address

    rpc = _get_rpc_url(rpc_url)

    # Verify trade exists
    storage = _get_trading_storage_contract(rpc)

    def _read_trade():
        return storage.functions.openTrades(
            trader_address, int(pair_index), int(trade_index)
        ).call()

    trade_raw = await asyncio.to_thread(_read_trade)
    trade = _decode_trade_struct(trade_raw)

    if not trade:
        raise ValueError(
            f"No open trade found for {trader_address} pair={pair_index} index={trade_index}"
        )

    # Convert human USDC amount to 6 decimals
    amount_usdc_raw = int(amount_usdc * (10 ** USDC_DECIMALS))

    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )

    if price_update_data is None:
        price_update_data = []

    logger.info(
        f"💰 Updating margin: trader={trader_address}, pair_index={pair_index}, "
        f"trade_index={trade_index}, type={'DEPOSIT' if update_type == 0 else 'WITHDRAW'}, "
        f"amount={amount_usdc:.2f} USDC"
    )

    tx = trading.build_update_margin_tx(
        pair_index=pair_index,
        index=trade_index,
        update_type=update_type,
        amount_usdc_raw=amount_usdc_raw,
        price_update_data=price_update_data,
    )
    tx_hash = trading.sign_and_send(tx)
    logger.info(f"🚀 Sent updateMargin tx: {tx_hash}")
    
    # Log BaseScan link for verification
    if BASESCAN_AVAILABLE:
        basescan_url = get_basescan_link(tx_hash)
        logger.info(f"🔗 View on BaseScan: {basescan_url}")

    tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
    receipt = await asyncio.to_thread(trading.web3.eth.wait_for_transaction_receipt, tx_hash_bytes)

    result = _format_receipt(
        receipt=receipt,
        pair_index=pair_index,
        action="update_margin",
    )
    
    # Add BaseScan link to result
    if BASESCAN_AVAILABLE:
        result["basescan_url"] = get_basescan_link(tx_hash)
    
    return result


async def cancel_open_limit_order_via_contract(
    pair_index: int,
    index: int,
    private_key: str,
    rpc_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Cancel an open limit order using Trading.cancelOpenLimitOrder.
    
    Args:
        pair_index: Trading pair index
        index: Limit order index
        private_key: User's private key
        rpc_url: Optional RPC URL
        
    Returns:
        Dictionary with transaction receipt
    """
    from eth_account import Account

    if not private_key:
        raise ValueError("Private key is required to cancel limit order.")

    account = Account.from_key(private_key)
    trader_address = account.address

    rpc = _get_rpc_url(rpc_url)

    trading = AvantisTradingContract(
        rpc_url=rpc,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key,
    )

    logger.info(
        f"❌ Canceling limit order: trader={trader_address}, pair_index={pair_index}, index={index}"
    )

    tx = trading.build_cancel_open_limit_order_tx(
        pair_index=pair_index,
        index=index,
    )
    tx_hash = trading.sign_and_send(tx)
    logger.info(f"🚀 Sent cancelOpenLimitOrder tx: {tx_hash}")
    
    # Log BaseScan link for verification
    if BASESCAN_AVAILABLE:
        basescan_url = get_basescan_link(tx_hash)
        logger.info(f"🔗 View on BaseScan: {basescan_url}")

    tx_hash_bytes = HexBytes(tx_hash) if isinstance(tx_hash, str) else tx_hash
    receipt = await asyncio.to_thread(trading.web3.eth.wait_for_transaction_receipt, tx_hash_bytes)

    result = _format_receipt(
        receipt=receipt,
        pair_index=pair_index,
        action="cancel_limit_order",
    )
    
    # Add BaseScan link to result
    if BASESCAN_AVAILABLE:
        result["basescan_url"] = get_basescan_link(tx_hash)
    
    return result


# ==========================================
# 4. Receipt formatter
# ==========================================

def _format_receipt(
    receipt: Any,
    pair_index: int,
    action: str,
    opening_fee: Optional[float] = None,
    total_cost: Optional[float] = None,
    collateral_amount: Optional[float] = None,
) -> Dict[str, Any]:
    tx_hash = receipt.get("transactionHash") if isinstance(receipt, dict) else getattr(
        receipt, "transactionHash", None
    )
    if tx_hash is not None and hasattr(tx_hash, "hex"):
        tx_hash = tx_hash.hex()
    elif isinstance(tx_hash, bytes):
        tx_hash = tx_hash.hex()
    elif not tx_hash:
        tx_hash = "unknown"

    status = receipt.get("status") if isinstance(receipt, dict) else getattr(receipt, "status", None)

    if status == 1 or status == "0x1":
        block_number = receipt.get("blockNumber", 0) if isinstance(receipt, dict) else getattr(
            receipt, "blockNumber", 0
        )
        logger.info(f"✅ {action.capitalize()} Successful! TX: {tx_hash}")

        result: Dict[str, Any] = {
            "success": True,
            "tx_hash": str(tx_hash),
            "pair_index": pair_index,
            "status": "confirmed",
            "block": block_number,
            "receipt": receipt,
        }

        if opening_fee is not None:
            result["opening_fee"] = opening_fee
        if total_cost is not None:
            result["total_cost"] = total_cost
        if collateral_amount is not None:
            result["collateral"] = collateral_amount

        return result

    logger.error(f"❌ Transaction Reverted. TX: {tx_hash}")
    
    # Try to extract revert reason for better error messages
    error_msg = f"Transaction failed/reverted on chain. Hash: {tx_hash}"
    
    # Check if this is a BELOW_MIN_POS error by examining the receipt
    try:
        receipt_str = str(receipt)
        if 'BELOW_MIN_POS' in receipt_str or '42454c4f575f4d494e5f504f53' in receipt_str.lower():
            error_msg = (
                f"Transaction reverted: BELOW_MIN_POS - Position size below contract minimum. "
                f"Your collateral (${collateral_amount or 'unknown'}) × leverage is too small for this pair. "
                f"Try increasing your budget per position to at least $50-100. Hash: {tx_hash}"
            )
    except Exception:
        pass  # If we can't extract reason, use generic message
    
    raise ValueError(error_msg)


# ==========================================
# Rich Trade Helpers (for Chat Page)
# ==========================================

async def get_open_trade_full(
    trader_address: str,
    pair_index: int,
    index: int,
    rpc_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return merged view of:
    - openTrades(trader, pairIndex, index) -> Trade
    - openTradesInfo(trader, pairIndex, index) -> TradeInfo
    - getOpenLimitOrder(trader, pairIndex, index) -> OpenLimitOrder (if exists)
    
    Returns a rich trade object suitable for chat page display.
    """
    rpc = _get_rpc_url(rpc_url)
    storage = _get_trading_storage_contract(rpc)

    def _call_all():
        trade_raw = storage.functions.openTrades(trader_address, pair_index, index).call()
        info_raw = storage.functions.openTradesInfo(trader_address, pair_index, index).call()
        # getOpenLimitOrder will return a zeroed struct if none exist; that's fine.
        olo_raw = storage.functions.getOpenLimitOrder(trader_address, pair_index, index).call()
        return trade_raw, info_raw, olo_raw

    trade_raw, info_raw, olo_raw = await asyncio.to_thread(_call_all)

    trade = _decode_trade_struct(trade_raw)
    # If no trade at all, short-circuit
    if not trade:
        return {}

    trade_info = _decode_trade_info_struct(info_raw)
    open_limit = _decode_open_limit_order_struct(olo_raw)

    return {
        **trade,
        "info": trade_info,
        "open_limit_order": open_limit if open_limit else None,
    }


async def get_all_open_trades_for_trader(
    trader_address: str,
    max_pairs: Optional[int] = None,
    rpc_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Scan across pairs and indexes using openTradesCount and return
    full enriched trades for the given trader.

    This is a good backend source for your 'open trade chat-page'.
    
    Args:
        trader_address: Ethereum address of the trader
        max_pairs: Maximum number of pairs to scan (defaults to settings.avantis_max_pair_index)
        rpc_url: Optional RPC URL (uses settings default if not provided)
        
    Returns:
        List of enriched trade dictionaries with Trade + TradeInfo + OpenLimitOrder
    """
    rpc = _get_rpc_url(rpc_url)
    storage = _get_trading_storage_contract(rpc)

    if max_pairs is None:
        max_pairs = settings.avantis_max_pair_index

    results: List[Dict[str, Any]] = []

    def _count_for_pair(p_idx: int) -> int:
        return storage.functions.openTradesCount(trader_address, p_idx).call()

    # For each pair, use openTradesCount to know how many indices to look at
    for pair_index in range(max_pairs):
        try:
            count = await asyncio.to_thread(_count_for_pair, pair_index)
        except Exception as e:
            logger.debug(f"Could not fetch openTradesCount for pair {pair_index}: {e}")
            continue

        if count == 0:
            continue

        # Trade indices are typically 0..(count-1), but some may be empty;
        # we just iterate a small range and rely on empty trader address to skip.
        for idx in range(count):
            full = await get_open_trade_full(
                trader_address=trader_address,
                pair_index=pair_index,
                index=idx,
                rpc_url=rpc,
            )
            if full:
                results.append(full)

    return results
