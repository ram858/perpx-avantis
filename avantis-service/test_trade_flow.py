"""Test script to trace trade execution flow and check logs."""

import asyncio
import logging
import sys
import os

# Setup logging to see all trace messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from trade_operations import open_position
from contract_operations import _manual_approve_usdc, open_position_via_contract

async def test_trade_flow():
    """Test the trade flow and check which functions are called."""
    
    # Test parameters
    PRIVATE_KEY = "0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e"
    SYMBOL = "BTC"
    COLLATERAL = 13.0  # Same amount as the transfer
    LEVERAGE = 10
    IS_LONG = True
    
    print("\n" + "="*80)
    print("TESTING TRADE FLOW - TRACING EXECUTION")
    print("="*80)
    print(f"Symbol: {SYMBOL}")
    print(f"Collateral: ${COLLATERAL}")
    print(f"Leverage: {LEVERAGE}x")
    print(f"Direction: {'LONG' if IS_LONG else 'SHORT'}")
    print("="*80 + "\n")
    
    try:
        # This should trigger:
        # 1. open_position() - should log "🚀 [TRACE] open_position() CALLED"
        # 2. open_position_via_contract() - should log "📝 [TRACE] open_position_via_contract() CALLED"
        # 3. _manual_approve_usdc() - might be called, should log "🔐 [TRACE] _manual_approve_usdc() CALLED"
        
        result = await open_position(
            symbol=SYMBOL,
            collateral=COLLATERAL,
            leverage=LEVERAGE,
            is_long=IS_LONG,
            private_key=PRIVATE_KEY
        )
        
        print("\n" + "="*80)
        print("TRADE RESULT:")
        print("="*80)
        print(f"Success: {result.get('success', False)}")
        print(f"TX Hash: {result.get('tx_hash', 'N/A')}")
        print("="*80)
        
    except Exception as e:
        print("\n" + "="*80)
        print("ERROR OCCURRED:")
        print("="*80)
        print(f"Error: {str(e)}")
        print("="*80)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_trade_flow())

