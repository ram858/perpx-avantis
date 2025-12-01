#!/usr/bin/env python3
"""
Test script to diagnose and fix Avantis trade opening issues.
Uses gas estimation to test transactions before sending them.
"""
import asyncio
import sys
import os
from web3 import Web3

# Add avantis-service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'avantis-service'))

from config import settings
from direct_contracts import AvantisTradingContract, TradeParams
from eth_account import Account

# Test private key (from your logs)
TEST_PRIVATE_KEY = "0x5334e38e7caaf59b317d249b26c88110dbbf2d4117ec44014b72b77b8f741758"

def estimate_trade_gas(collateral: float, pair_index: int, leverage: int, is_long: bool, private_key: str):
    """Estimate gas for a trade to see if it would succeed."""
    rpc_url = settings.get_effective_rpc_url()
    
    trading = AvantisTradingContract(
        rpc_url=rpc_url,
        contract_address=settings.avantis_trading_contract_address,
        private_key=private_key
    )
    
    account = Account.from_key(private_key)
    trader_address = account.address
    
    # Convert to on-chain units
    collateral_usdc_int = int(collateral * 1e6)  # USDC has 6 decimals
    execution_fee_wei = int(0.0001 * 10 ** 18)
    
    params = TradeParams(
        trader=trader_address,
        pair_index=pair_index,
        collateral_usdc=collateral_usdc_int,
        leverage=leverage,
        is_long=is_long,
        tp_price=0,
        sl_price=0,
        open_price=0,
        index=0,
        initial_pos_token=0,
        timestamp=0,
    )
    
    slippage_p = int(1.0 * 1e8)  # 1%
    trade_struct = trading.build_trade_struct(params)
    fn = trading.open_trade_function(trade_struct, order_type=0, slippage_p=slippage_p)
    
    try:
        # Try to estimate gas - this will fail if the transaction would revert
        gas_estimate = fn.estimate_gas({
            "from": trader_address,
            "value": execution_fee_wei
        })
        return {"success": True, "gas": gas_estimate}
    except Exception as e:
        error_str = str(e)
        if "BELOW_MIN_POS" in error_str or "execution reverted" in error_str:
            return {"success": False, "error": "BELOW_MIN_POS", "message": error_str}
        return {"success": False, "error": "other", "message": error_str}

async def test_minimum_with_estimation():
    """Test different amounts using gas estimation (no real transactions)."""
    print("=" * 80)
    print("🔍 Testing Avantis Minimum Position Requirements (Gas Estimation)")
    print("=" * 80)
    
    rpc_url = settings.get_effective_rpc_url()
    print(f"RPC URL: {rpc_url}")
    print(f"Trading Contract: {settings.avantis_trading_contract_address}")
    print()
    
    # Test much higher amounts
    test_amounts = [100, 150, 200, 250, 300, 400, 500, 750, 1000]
    
    # Test BTC first
    print("=" * 80)
    print("Testing BTC (pair_index=0) with 40x leverage")
    print("=" * 80)
    
    btc_min = None
    for collateral in test_amounts:
        notional = collateral * 40
        print(f"🧪 Testing ${collateral} collateral (${notional:,.0f} notional)...", end=" ")
        result = estimate_trade_gas(collateral, pair_index=0, leverage=40, is_long=True, private_key=TEST_PRIVATE_KEY)
        
        if result["success"]:
            print(f"✅ SUCCESS! Gas estimate: {result['gas']:,}")
            if btc_min is None:
                btc_min = collateral
                print(f"   💡 BTC minimum found: ${collateral} USDC (${notional:,.0f} notional)")
                break
        else:
            if result["error"] == "BELOW_MIN_POS":
                print(f"❌ BELOW_MIN_POS")
            else:
                print(f"❌ {result['error']}")
    
    print()
    
    # Test ETH
    print("=" * 80)
    print("Testing ETH (pair_index=1) with 25x leverage")
    print("=" * 80)
    
    eth_min = None
    for collateral in test_amounts:
        notional = collateral * 25
        print(f"🧪 Testing ${collateral} collateral (${notional:,.0f} notional)...", end=" ")
        result = estimate_trade_gas(collateral, pair_index=1, leverage=25, is_long=True, private_key=TEST_PRIVATE_KEY)
        
        if result["success"]:
            print(f"✅ SUCCESS! Gas estimate: {result['gas']:,}")
            if eth_min is None:
                eth_min = collateral
                print(f"   💡 ETH minimum found: ${collateral} USDC (${notional:,.0f} notional)")
                break
        else:
            if result["error"] == "BELOW_MIN_POS":
                print(f"❌ BELOW_MIN_POS")
            else:
                print(f"❌ {result['error']}")
    
    print()
    print("=" * 80)
    print("📊 Test Results Summary")
    print("=" * 80)
    
    if btc_min:
        print(f"✅ BTC minimum: ${btc_min} USDC (at 40x leverage = ${btc_min * 40:,.0f} notional)")
    else:
        print("❌ BTC: Could not find minimum (even $1000 failed)")
    
    if eth_min:
        print(f"✅ ETH minimum: ${eth_min} USDC (at 25x leverage = ${eth_min * 25:,.0f} notional)")
    else:
        print("❌ ETH: Could not find minimum (even $1000 failed)")
    
    print()
    print("💡 Recommendation:")
    if btc_min or eth_min:
        min_required = max(btc_min or 0, eth_min or 0)
        print(f"   Use at least ${min_required} USDC per position")
        print(f"   Update AVANTIS_MIN_COLLATERAL in BudgetAndLeverage.ts to {min_required}")
    else:
        print("   ⚠️  Minimum is very high or pair indices are wrong")
        print("   Try checking Avantis documentation for correct pair indices")
    
    return btc_min, eth_min

async def test_real_trade(collateral: float, pair_index: int, leverage: int):
    """Test opening a real trade with the found minimum."""
    print("\n" + "=" * 80)
    print(f"🚀 Testing REAL Trade: ${collateral} collateral, pair_index={pair_index}, leverage={leverage}x")
    print("=" * 80)
    
    try:
        from contract_operations import open_position_via_contract
        
        result = await open_position_via_contract(
            pair_index=pair_index,
            collateral_amount=collateral,
            leverage=leverage,
            is_long=True,
            take_profit=None,
            stop_loss=None,
            private_key=TEST_PRIVATE_KEY
        )
        
        if result.get('tx_hash'):
            print(f"✅✅✅ SUCCESS! Trade opened!")
            print(f"   TX Hash: {result['tx_hash']}")
            print(f"   View on BaseScan: https://basescan.org/tx/{result['tx_hash']}")
            return True
        else:
            print(f"❌ Trade returned but no tx_hash: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Trade failed: {type(e).__name__}: {e}")
        return False

async def main():
    """Run all tests."""
    print("\n🚀 Starting Avantis Trade Testing\n")
    
    # Test with gas estimation (no real transactions)
    btc_min, eth_min = await test_minimum_with_estimation()
    
    # If we found a minimum, test a real trade
    if btc_min:
        print("\n" + "=" * 80)
        print("Testing REAL BTC Trade")
        print("=" * 80)
        success = await test_real_trade(btc_min, pair_index=0, leverage=40)
        if success:
            print("\n✅✅✅ Trade successfully opened! The system is working!")
    
    print("\n✅ Testing complete!\n")

if __name__ == "__main__":
    asyncio.run(main())
