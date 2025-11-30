#!/usr/bin/env python3
"""
End-to-end test script for direct contract integration.

This script tests the full trading flow:
1. Derive address from private key
2. Check USDC balance and allowance
3. Open a small trade
4. Fetch open positions
5. Close the position
6. Verify position is closed

Usage:
    export TEST_PRIVATE_KEY="0x..."
    export AVANTIS_RPC_URL="https://mainnet.base.org"  # or your Alchemy URL
    python3 test_direct_flow.py

Safety:
    - Only runs if TEST_PRIVATE_KEY is set
    - Uses small amounts (10 USDC minimum)
    - Prints Basescan links for verification
"""

import os
import sys
import asyncio
import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Import our modules
from eth_account import Account
from web3 import Web3
from config import settings
from trade_operations import open_position, close_position
from position_queries import get_positions, get_balance, get_usdc_allowance
from symbols import get_pair_index


def get_test_private_key() -> Optional[str]:
    """Get test private key from environment."""
    key = os.getenv("TEST_PRIVATE_KEY")
    if not key:
        logger.error("❌ TEST_PRIVATE_KEY environment variable not set")
        logger.error("   Set it with: export TEST_PRIVATE_KEY='0x...'")
        return None
    
    # Normalize private key format
    if not key.startswith("0x"):
        key = f"0x{key}"
    
    return key


def get_rpc_url() -> str:
    """Get RPC URL from environment or settings."""
    rpc = os.getenv("AVANTIS_RPC_URL") or settings.get_effective_rpc_url()
    return rpc


def print_basescan_link(tx_hash: str, label: str = "Transaction"):
    """Print Basescan link for a transaction."""
    explorer = settings.get_block_explorer_url()
    url = f"{explorer}/tx/{tx_hash}"
    print(f"\n🔗 {label} on Basescan: {url}")


def print_avantis_link(symbol: str = "BTC-USD"):
    """Print Avantis UI link to verify position."""
    url = f"https://www.avantisfi.com/trade?asset={symbol}"
    print(f"\n🔗 Verify position on Avantis UI: {url}")


async def main():
    """Main test flow."""
    print("=" * 80)
    print("🧪 Avantis Direct Contract Integration Test")
    print("=" * 80)
    
    # 1. Get private key
    private_key = get_test_private_key()
    if not private_key:
        sys.exit(1)
    
    # 2. Derive address
    try:
        account = Account.from_key(private_key)
        address = account.address
        print(f"\n✅ Derived address from private key: {address}")
    except Exception as e:
        logger.error(f"❌ Failed to derive address: {e}")
        sys.exit(1)
    
    # 3. Check RPC connection
    rpc_url = get_rpc_url()
    print(f"\n📡 Using RPC: {rpc_url}")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        logger.error(f"❌ Cannot connect to RPC: {rpc_url}")
        sys.exit(1)
    print("✅ RPC connection successful")
    
    # 4. Check USDC balance and allowance
    print("\n" + "=" * 80)
    print("💰 Checking USDC Balance & Allowance")
    print("=" * 80)
    
    try:
        balance_info = await get_balance(private_key=private_key)
        print(f"   Total Balance: ${balance_info.get('total_balance', 0):.2f} USDC")
        print(f"   Available: ${balance_info.get('available_balance', 0):.2f} USDC")
        print(f"   Margin Used: ${balance_info.get('margin_used', 0):.2f} USDC")
        
        allowance = await get_usdc_allowance(private_key=private_key)
        print(f"   USDC Allowance: ${allowance:.2f} USDC")
        
        if balance_info.get('total_balance', 0) < 10:
            logger.warning("⚠️  Balance is below $10 USDC - trades may fail")
        
        if allowance < 100:
            logger.warning("⚠️  USDC allowance is low - approval may be needed")
    except Exception as e:
        logger.error(f"❌ Failed to check balance: {e}")
        sys.exit(1)
    
    # 5. Get initial positions
    print("\n" + "=" * 80)
    print("📊 Initial Open Positions")
    print("=" * 80)
    
    try:
        initial_positions = await get_positions(private_key=private_key)
        print(f"   Found {len(initial_positions)} open positions")
        for pos in initial_positions:
            print(f"   - {pos.get('symbol', 'N/A')}: {pos.get('size', 0):.2f} USDC, "
                  f"{'LONG' if pos.get('is_long') else 'SHORT'}, "
                  f"Leverage: {pos.get('leverage', 1)}x")
    except Exception as e:
        logger.error(f"❌ Failed to get positions: {e}")
        sys.exit(1)
    
    # 6. Open a test trade
    print("\n" + "=" * 80)
    print("🚀 Opening Test Trade")
    print("=" * 80)
    
    test_symbol = "BTC"
    test_collateral = 10.0  # Minimum $10 USDC
    test_leverage = 5
    test_is_long = True
    
    print(f"   Symbol: {test_symbol}")
    print(f"   Collateral: ${test_collateral} USDC")
    print(f"   Leverage: {test_leverage}x")
    print(f"   Direction: {'LONG' if test_is_long else 'SHORT'}")
    
    # Check if we have enough balance
    if balance_info.get('available_balance', 0) < test_collateral:
        logger.error(f"❌ Insufficient balance: need ${test_collateral}, have ${balance_info.get('available_balance', 0):.2f}")
        sys.exit(1)
    
    try:
        result = await open_position(
            symbol=test_symbol,
            collateral=test_collateral,
            leverage=test_leverage,
            is_long=test_is_long,
            tp=None,  # No TP for test
            sl=None,  # No SL for test
            private_key=private_key
        )
        
        if result.get("success"):
            tx_hash = result.get("tx_hash")
            print(f"\n✅ Trade opened successfully!")
            print(f"   Transaction Hash: {tx_hash}")
            print_basescan_link(tx_hash, "Open Trade Transaction")
            print_avantis_link(f"{test_symbol}-USD")
            
            # Wait a bit for the transaction to be mined
            print("\n⏳ Waiting 10 seconds for transaction to be mined...")
            await asyncio.sleep(10)
        else:
            logger.error(f"❌ Trade opening failed: {result}")
            sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to open trade: {e}", exc_info=True)
        sys.exit(1)
    
    # 7. Fetch positions after opening
    print("\n" + "=" * 80)
    print("📊 Positions After Opening Trade")
    print("=" * 80)
    
    try:
        positions_after = await get_positions(private_key=private_key)
        print(f"   Found {len(positions_after)} open positions")
        
        # Find the position we just opened
        new_position = None
        for pos in positions_after:
            if pos.get('symbol') == test_symbol and pos.get('is_long') == test_is_long:
                new_position = pos
                break
        
        if new_position:
            print(f"\n✅ Found newly opened position:")
            print(f"   Symbol: {new_position.get('symbol')}")
            print(f"   Pair Index: {new_position.get('pair_index')}")
            print(f"   Size: ${new_position.get('size', 0):.2f} USDC")
            print(f"   Entry Price: ${new_position.get('entry_price', 0):.2f}")
            print(f"   Leverage: {new_position.get('leverage', 1)}x")
            print(f"   Direction: {'LONG' if new_position.get('is_long') else 'SHORT'}")
            
            pair_index = new_position.get('pair_index')
        else:
            logger.warning("⚠️  Could not find the newly opened position in the list")
            # Try to use the pair index from the symbol
            pair_index = get_pair_index(test_symbol)
            if pair_index is None:
                logger.error(f"❌ Could not resolve pair_index for {test_symbol}")
                sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to get positions after opening: {e}")
        # Try to continue with pair_index from symbol
        pair_index = get_pair_index(test_symbol)
        if pair_index is None:
            logger.error(f"❌ Could not resolve pair_index for {test_symbol}")
            sys.exit(1)
    
    # 8. Close the position
    print("\n" + "=" * 80)
    print("🔒 Closing Test Position")
    print("=" * 80)
    
    print(f"   Closing position for pair_index: {pair_index}")
    
    try:
        close_result = await close_position(
            pair_index=pair_index,
            private_key=private_key
        )
        
        if close_result.get("success"):
            tx_hash = close_result.get("tx_hash")
            print(f"\n✅ Position closed successfully!")
            print(f"   Transaction Hash: {tx_hash}")
            print_basescan_link(tx_hash, "Close Position Transaction")
            
            # Wait a bit for the transaction to be mined
            print("\n⏳ Waiting 10 seconds for transaction to be mined...")
            await asyncio.sleep(10)
        else:
            logger.error(f"❌ Position closing failed: {close_result}")
            sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to close position: {e}", exc_info=True)
        sys.exit(1)
    
    # 9. Verify position is closed
    print("\n" + "=" * 80)
    print("📊 Final Positions (After Closing)")
    print("=" * 80)
    
    try:
        final_positions = await get_positions(private_key=private_key)
        print(f"   Found {len(final_positions)} open positions")
        
        # Check if our position is still there
        still_open = False
        for pos in final_positions:
            if pos.get('symbol') == test_symbol and pos.get('pair_index') == pair_index:
                still_open = True
                logger.warning(f"⚠️  Position still appears to be open: {pos}")
                break
        
        if not still_open:
            print("✅ Position successfully closed - no longer in positions list")
        else:
            logger.warning("⚠️  Position may still be open - check on-chain")
    except Exception as e:
        logger.error(f"❌ Failed to verify positions: {e}")
    
    # 10. Summary
    print("\n" + "=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)
    print("\n📝 Summary:")
    print(f"   - Address: {address}")
    print(f"   - Test Symbol: {test_symbol}")
    print(f"   - Test Collateral: ${test_collateral} USDC")
    print(f"   - Test Leverage: {test_leverage}x")
    print("\n💡 Next Steps:")
    print("   1. Check the Basescan links above to verify transactions")
    print("   2. Visit Avantis UI to verify the position appeared there")
    print("   3. Verify the position is now closed on Avantis UI")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test failed with error: {e}", exc_info=True)
        sys.exit(1)
