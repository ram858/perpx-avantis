#!/usr/bin/env python3
"""Find which pair indices actually exist on the Avantis contract."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'avantis-service'))

from web3 import Web3
from config import settings

def find_valid_pairs():
    """Scan pair indices to find which ones exist."""
    rpc_url = settings.get_effective_rpc_url()
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    storage_address = settings.avantis_trading_storage_contract_address
    storage_abi = [
        {
            "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "name": "pairMinLevPosUSDC",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function",
        }
    ]
    
    storage = w3.eth.contract(address=Web3.to_checksum_address(storage_address), abi=storage_abi)
    
    print("Scanning pair indices 0-50 to find valid pairs...")
    print("=" * 80)
    
    valid_pairs = []
    for i in range(0, 51):
        try:
            min_pos = storage.functions.pairMinLevPosUSDC(i).call()
            min_pos_usdc = min_pos / 1e6
            valid_pairs.append((i, min_pos_usdc))
            print(f"✅ Pair {i:2d}: pairMinLevPosUSDC = ${min_pos_usdc:,.2f} USDC")
        except Exception as e:
            error_str = str(e)
            if "execution reverted" in error_str.lower():
                pass  # Pair doesn't exist, skip
            else:
                print(f"⚠️  Pair {i:2d}: Error: {error_str[:80]}")
    
    print()
    print("=" * 80)
    print(f"Found {len(valid_pairs)} valid pair(s):")
    for pair_idx, min_pos in valid_pairs:
        print(f"  Pair {pair_idx}: Minimum leveraged position = ${min_pos:,.2f} USDC")
    
    if not valid_pairs:
        print("❌ No valid pairs found! The contract may not be configured correctly.")
        print("   Check contract addresses in .env file.")
    
    return valid_pairs

if __name__ == "__main__":
    find_valid_pairs()

