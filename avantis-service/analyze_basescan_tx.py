#!/usr/bin/env python3
"""
Analyze BaseScan Transaction Examples

This script helps you analyze BaseScan transaction examples and integrate
them into the trading platform. It can:
1. Parse and decode BaseScan transactions
2. Extract trading parameters
3. Compare with our implementation
4. Generate contract call configurations

Usage:
    python analyze_basescan_tx.py <tx_hash>
    python analyze_basescan_tx.py <tx_hash> --compare
    python analyze_basescan_tx.py <tx_hash> --generate-config
"""

import asyncio
import argparse
import sys
from typing import Dict, Any

from basescan_integration import (
    BaseScanParser,
    analyze_basescan_example,
    get_basescan_link,
    get_basescan_contract_link,
)


async def main():
    parser = argparse.ArgumentParser(
        description="Analyze BaseScan transaction examples for Avantis trading integration"
    )
    parser.add_argument(
        "tx_hash",
        help="Transaction hash from BaseScan (with or without 0x prefix)",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare transaction with our implementation parameters",
    )
    parser.add_argument(
        "--generate-config",
        action="store_true",
        help="Generate contract call configuration from BaseScan transaction",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate our implementation against BaseScan example",
    )

    args = parser.parse_args()

    try:
        parser_instance = BaseScanParser()
        
        print("\n" + "=" * 80)
        print("BaseScan Transaction Analyzer")
        print("=" * 80)
        
        # Basic analysis
        analysis = parser_instance.analyze_trading_transaction(args.tx_hash)
        
        print(f"\n📋 Transaction Details:")
        print(f"   Hash: {analysis['tx_hash']}")
        print(f"   Status: {analysis['status']}")
        print(f"   Block: {analysis['block_number']}")
        print(f"   From: {analysis['from']}")
        print(f"   To: {analysis['to']}")
        print(f"   Value: {analysis['value_eth']:.6f} ETH")
        print(f"   Gas Used: {analysis['gas_used']:,}")
        print(f"\n🔗 BaseScan: {analysis['basescan_url']}")
        
        # Function call analysis
        if analysis.get("function_calls"):
            print(f"\n📞 Function Calls ({len(analysis['function_calls'])}):")
            for i, call in enumerate(analysis["function_calls"], 1):
                print(f"\n   Call #{i}:")
                print(f"   Contract: {call['contract']}")
                print(f"   Function: {call['function']}")
                print(f"   Decoded: {'✅' if call['decoded'] else '❌'}")
                
                if call["decoded"] and call["parameters"]:
                    print(f"   Parameters:")
                    for key, value in call["parameters"].items():
                        # Format large numbers
                        if isinstance(value, int) and value > 1000:
                            if value >= 1e18:
                                formatted = f"{value / 1e18:.6f} ETH"
                            elif value >= 1e6:
                                formatted = f"{value / 1e6:.2f} USDC"
                            else:
                                formatted = f"{value:,}"
                            print(f"      {key}: {value} ({formatted})")
                        else:
                            print(f"      {key}: {value}")
        
        # Trading parameters
        if analysis.get("trading_params"):
            print(f"\n📊 Trading Parameters:")
            for key, value in analysis["trading_params"].items():
                print(f"   {key}: {value}")
        
        # Generate config
        if args.generate_config:
            print(f"\n⚙️  Generating Contract Call Configuration...")
            try:
                config = parser_instance.generate_contract_call_from_basescan(args.tx_hash)
                print(f"\n   Contract Address: {config['contract_address']}")
                print(f"   Function: {config['function_name']}")
                print(f"   Value: {config['value_wei']} wei ({config['value_wei'] / 1e18:.6f} ETH)")
                print(f"   Gas Limit: {config['gas_limit']:,}")
                print(f"   Gas Price: {config['gas_price']:,}")
                print(f"\n   Parameters:")
                for key, value in config["parameters"].items():
                    print(f"      {key}: {value}")
                
                # Save to file
                import json
                config_file = f"basescan_config_{args.tx_hash[:10]}.json"
                with open(config_file, "w") as f:
                    json.dump(config, f, indent=2, default=str)
                print(f"\n   ✅ Configuration saved to: {config_file}")
            except Exception as e:
                print(f"   ❌ Failed to generate config: {e}")
        
        # Compare with our implementation
        if args.compare:
            print(f"\n🔍 Comparison Mode:")
            print(f"   To compare with our implementation, provide our parameters.")
            print(f"   Example usage:")
            print(f"   python analyze_basescan_tx.py {args.tx_hash} --validate")
        
        # Validation
        if args.validate:
            print(f"\n✅ Validation Mode:")
            print(f"   This would validate our implementation against the BaseScan example.")
            print(f"   Provide our function call parameters to compare.")
        
        # Contract links
        if analysis.get("function_calls"):
            print(f"\n🔗 Contract Links:")
            for call in analysis["function_calls"]:
                contract_link = get_basescan_contract_link(call["contract"])
                print(f"   {call['contract']}: {contract_link}")
        
        print("\n" + "=" * 80)
        print("Analysis Complete")
        print("=" * 80 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error analyzing transaction: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
