#!/usr/bin/env python3
"""
Investigate Avantis contract leverage limits.
Queries the contract to find actual maximum leverage supported.
"""
import asyncio
import sys
from web3 import Web3
from config import settings
from direct_contracts import AvantisTradingContract

async def query_contract_leverage():
    """Try to query the contract for leverage limits."""
    print("🔍 Investigating Avantis Contract Leverage Limits\n")
    print("=" * 60)
    
    # Get trading contract
    private_key = "0x70c49ab0812a73eb3bb2808bc2762610720fae5ede86c4a3c473ca5f9cbb536b"
    
    try:
        trading_contract = AvantisTradingContract(
            rpc_url=settings.get_effective_rpc_url(),
            contract_address=settings.avantis_trading_contract_address,
            private_key=private_key
        )
        
        print(f"✅ Found contract: {trading_contract.contract_address}")
        
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
                if hasattr(trading_contract.contract.functions, func_name):
                    func = getattr(trading_contract.contract.functions, func_name)
                    # Try calling with pair index 1 (BTC)
                    try:
                        result = func(1).call()
                        if result:
                            print(f"  ✅ {func_name}(1) = {result}")
                    except Exception as e:
                        # Try without parameters
                        try:
                            result = func().call()
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
                if hasattr(trading_contract.contract.functions, func_name):
                    func = getattr(trading_contract.contract.functions, func_name)
                    try:
                        result = func(1).call()  # BTC pair index
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

