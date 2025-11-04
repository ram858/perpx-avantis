"""Symbol registry mapping common trading symbols to Avantis pair indices."""
from typing import Dict, Optional


# Symbol to Avantis pair index mapping
# Note: These are placeholder values - actual pair indices need to be fetched from Avantis API
# or configured based on Avantis documentation
SYMBOL_TO_PAIR_INDEX: Dict[str, int] = {
    "BTC": 0,  # BTC/USD - needs to be updated with actual pair index
    "ETH": 1,  # ETH/USD - needs to be updated with actual pair index
    "SOL": 2,  # SOL/USD - needs to be updated with actual pair index
    "AVAX": 3,  # AVAX/USD - needs to be updated with actual pair index
    "MATIC": 4,  # MATIC/USD - needs to be updated with actual pair index
    "ARB": 5,  # ARB/USD - needs to be updated with actual pair index
    "OP": 6,  # OP/USD - needs to be updated with actual pair index
    "LINK": 7,  # LINK/USD - needs to be updated with actual pair index
    "UNI": 8,  # UNI/USD - needs to be updated with actual pair index
    "AAVE": 9,  # AAVE/USD - needs to be updated with actual pair index
    "ATOM": 10,  # ATOM/USD - needs to be updated with actual pair index
    "DOT": 11,  # DOT/USD - needs to be updated with actual pair index
    "ADA": 12,  # ADA/USD - needs to be updated with actual pair index
    "XRP": 13,  # XRP/USD - needs to be updated with actual pair index
    "DOGE": 14,  # DOGE/USD - needs to be updated with actual pair index
    "BNB": 15,  # BNB/USD - needs to be updated with actual pair index
}

# Reverse mapping for pair index to symbol
PAIR_INDEX_TO_SYMBOL: Dict[int, str] = {v: k for k, v in SYMBOL_TO_PAIR_INDEX.items()}


def get_pair_index(symbol: str) -> Optional[int]:
    """
    Get Avantis pair index for a given symbol.
    
    Args:
        symbol: Trading symbol (e.g., "BTC", "ETH")
        
    Returns:
        Pair index if found, None otherwise
    """
    normalized_symbol = symbol.upper().strip()
    return SYMBOL_TO_PAIR_INDEX.get(normalized_symbol)


def get_symbol(pair_index: int) -> Optional[str]:
    """
    Get trading symbol for a given pair index.
    
    Args:
        pair_index: Avantis pair index
        
    Returns:
        Trading symbol if found, None otherwise
    """
    return PAIR_INDEX_TO_SYMBOL.get(pair_index)


def is_symbol_supported(symbol: str) -> bool:
    """
    Check if a symbol is supported.
    
    Args:
        symbol: Trading symbol
        
    Returns:
        True if symbol is supported, False otherwise
    """
    return get_pair_index(symbol) is not None


def get_all_supported_symbols() -> list[str]:
    """
    Get all supported trading symbols.
    
    Returns:
        List of supported symbols
    """
    return list(SYMBOL_TO_PAIR_INDEX.keys())


def update_pair_index(symbol: str, pair_index: int) -> None:
    """
    Update or add a symbol to pair index mapping.
    
    Args:
        symbol: Trading symbol
        pair_index: Avantis pair index
    """
    normalized_symbol = symbol.upper().strip()
    SYMBOL_TO_PAIR_INDEX[normalized_symbol] = pair_index
    PAIR_INDEX_TO_SYMBOL[pair_index] = normalized_symbol


class SymbolNotFoundError(Exception):
    """Raised when a symbol is not found in the registry."""
    pass

