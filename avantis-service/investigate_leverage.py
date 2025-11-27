#!/usr/bin/env python3
"""
Investigate Avantis contract leverage limits.
Queries the contract to find actual maximum leverage supported.
"""
import asyncio
import sys
from web3 import Web3
from avantis_client import get_avantis_client

async def query_contract_leverage():
    """Try to query the contract for leverage limits."""
    print("🔍 Investigating Avantis Contract Leverage Limits\n")
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
            # Try to call common leverage limit functions
            leverage_functions = [
                'maxLeverage',
                'MAX_LEVERAGE',
                'getMaxLeverage',
                'maxLeverageForPair',
                'getMaxLeverageForPair',
                'leverageLimit',
                'LEVERAGE_LIMIT',
                'getLeverageLimit',
            ]
            
            print("\n📋 Testing contract functions for leverage limits:")
            for func_name in leverage_functions:
                try:
                    if hasattr(trading_contract.functions, func_name):
                        func = getattr(trading_contract.functions, func_name)
                        # Try calling with pair index 1 (BTC)
                        try:
                            result = await func(1).call()
                            if result:
                                print(f"  ✅ {func_name}(1) = {result}")
                        except Exception as e:
                            # Try without parameters
                            try:
                                result = await func().call()
                                if result:
                                    print(f"  ✅ {func_name}() = {result}")
                            except:
                                pass
                except Exception as e:
                    pass
            
            # Try to get pair info which might contain leverage limits
            pair_info_functions = [
                'getPairInfo',
                'pairs',
                'pairInfo',
                'getPair',
            ]
            
            print("\n📋 Testing pair info functions for leverage data:")
            for func_name in pair_info_functions:
                try:
                    if hasattr(trading_contract.functions, func_name):
                        func = getattr(trading_contract.functions, func_name)
                        try:
                            result = await func(1).call()  # BTC pair index
                            if result:
                                print(f"  ✅ {func_name}(1) returned data")
                                # Check if it's a struct with leverage fields
                                if isinstance(result, (list, tuple)) and len(result) > 0:
                                    print(f"     Struct fields: {len(result)}")
                                    # Print first few fields to see structure
                                    for i, field in enumerate(result[:5]):
                                        print(f"       Field {i}: {field}")
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

if __name__ == "__main__":
    print("Avantis Contract Leverage Limit Investigation\n")
    
    # Run investigation
    asyncio.run(query_contract_leverage())
    
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    print("""
Based on code analysis:
- Contract validation accepts: 2x-100x
- API layer accepts: 1x-50x
- Frontend validation: 1x-20x
- Manual transaction builder: 1x-100x

Recommendation:
- Standardize to 2x-50x (matches API layer and is reasonable)
- This aligns with most DeFi protocols that support up to 50x leverage
    """)

