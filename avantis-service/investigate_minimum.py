#!/usr/bin/env python3
"""
Investigate Avantis contract minimum position size requirement.
Tests different theories about what the minimum might be based on.
"""
import asyncio
import sys
from web3 import Web3
from avantis_client import get_avantis_client

async def query_contract_minimum():
    """Try to query the contract for minimum position size."""
    print("🔍 Investigating Avantis Contract Minimum Position Size\n")
    print("=" * 60)
    
    # Get client
    private_key = "0x70c49ab0812a73eb3bb2808bc2762610720fae5ede86c4a3c473ca5f9cbb536b"
    client = get_avantis_client(private_key=private_key)
    trader_client = client.get_client()
    
    try:
        await trader_client.load_contracts()
        
        # Try to find Trading contract
        trading_contract = None
        if hasattr(trader_client, 'contracts'):
            contracts = trader_client.contracts
            # Try different contract names
            for name in ['Trading', 'TradingContract', 'PerpetualTrading', 'AvantisTrading']:
                if hasattr(contracts, name):
                    trading_contract = getattr(contracts, name)
                    print(f"✅ Found contract: {name}")
                    break
        
        if trading_contract:
            # Try to call common minimum functions
            min_functions = [
                'minPositionSize',
                'minPositionSizeUSDC',
                'MIN_POSITION_SIZE',
                'getMinPositionSize',
                'minCollateral',
                'MIN_COLLATERAL',
                'getMinCollateral',
                'pairMinPositionSize',
                'pairMinCollateral',
            ]
            
            print("\n📋 Testing contract functions for minimum:")
            for func_name in min_functions:
                try:
                    if hasattr(trading_contract.functions, func_name):
                        func = getattr(trading_contract.functions, func_name)
                        # Try calling with pair index 1 (BTC)
                        try:
                            result = await func(1).call()
                            if result:
                                print(f"  ✅ {func_name}(1) = {result}")
                                # Convert from wei if it's a large number
                                if isinstance(result, int) and result > 1000000:
                                    usdc_value = result / 1e6
                                    print(f"     = ${usdc_value:.2f} USDC")
                        except Exception as e:
                            # Try without parameters
                            try:
                                result = await func().call()
                                if result:
                                    print(f"  ✅ {func_name}() = {result}")
                                    if isinstance(result, int) and result > 1000000:
                                        usdc_value = result / 1e6
                                        print(f"     = ${usdc_value:.2f} USDC")
                            except:
                                pass
                except Exception as e:
                    pass
            
            # Try to get pair info which might contain minimum
            pair_info_functions = [
                'getPairInfo',
                'pairs',
                'pairInfo',
                'getPair',
            ]
            
            print("\n📋 Testing pair info functions:")
            for func_name in pair_info_functions:
                try:
                    if hasattr(trading_contract.functions, func_name):
                        func = getattr(trading_contract.functions, func_name)
                        try:
                            result = await func(1).call()  # BTC pair index
                            if result:
                                print(f"  ✅ {func_name}(1) = {result}")
                                # Check if it's a struct with min fields
                                if isinstance(result, (list, tuple)) and len(result) > 0:
                                    print(f"     Struct fields: {len(result)}")
                        except Exception as e:
                            pass
                except Exception as e:
                    pass
        else:
            print("❌ Could not find Trading contract")
            
    except Exception as e:
        print(f"❌ Error querying contract: {e}")
        import traceback
        traceback.print_exc()

async def test_theories():
    """Test different theories about minimum position size."""
    print("\n" + "=" * 60)
    print("🧪 Testing Theories About Minimum Position Size")
    print("=" * 60)
    
    theories = [
        {
            "name": "Theory 1: Minimum based on collateral only",
            "description": "Contract requires minimum $X collateral regardless of leverage",
            "test": "Try with $15 collateral, 10x leverage"
        },
        {
            "name": "Theory 2: Minimum based on notional value",
            "description": "Contract requires minimum $X notional (collateral × leverage)",
            "test": "If min notional = $150, then need $15 collateral at 10x leverage"
        },
        {
            "name": "Theory 3: Minimum varies by pair",
            "description": "BTC might have higher minimum than other pairs",
            "test": "Try ETH instead of BTC"
        },
        {
            "name": "Theory 4: Minimum includes fees",
            "description": "Minimum might need to account for opening fees",
            "test": "Try with $15.50 to account for fees"
        },
        {
            "name": "Theory 5: Minimum is much higher",
            "description": "Actual minimum might be $20+ or $50+",
            "test": "Would need more funds to test"
        }
    ]
    
    for i, theory in enumerate(theories, 1):
        print(f"\n{theory['name']}")
        print(f"  Description: {theory['description']}")
        print(f"  Test: {theory['test']}")

if __name__ == "__main__":
    print("Avantis Contract Minimum Position Size Investigation\n")
    
    # Run investigation
    asyncio.run(query_contract_minimum())
    asyncio.run(test_theories())
    
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    print("""
Based on testing:
- Contract rejects: $12.5, $12.8, $12.95, $14.0, $14.9, $14.99
- Current balance: $15.00
- Error: BELOW_MIN_POS

Possible explanations:
1. Minimum is $15+ (exceeds current balance)
2. Minimum is based on notional value (collateral × leverage)
3. Minimum varies by trading pair (BTC might be higher)
4. Minimum includes fees that need to be accounted for
5. Contract has a bug or different requirement than documented

Recommendation:
- Deposit more funds ($20-25) to test if minimum is higher
- Try different trading pairs (ETH, SOL) to see if minimum varies
- Check AvantisFi documentation or contact support for actual minimum
    """)

