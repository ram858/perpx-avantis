#!/usr/bin/env python3

"""
Check Avantis balance and wallet balance
Verifies if funds are stuck in the contract
"""

import sys
import os
import asyncio
from eth_account import Account
from web3 import Web3

# Add the avantis-service directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'avantis-service'))

from avantis_client import get_avantis_client
from position_queries import get_balance, get_positions

# Configuration
PRIVATE_KEY = '0xab9c15526fc4e452fb4daf4a11b3a705734461781d6e5fb9a1de1961aceec29e'
RPC_URL = 'https://mainnet.base.org'
USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'  # Base mainnet USDC

# USDC ABI (minimal)
USDC_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
]

async def check_balances():
    """Check wallet balance and Avantis vault balance"""
    print('🔍 Checking Wallet and Avantis Balances...\n')
    print('=' * 70)
    
    try:
        # Get wallet address from private key
        account = Account.from_key(PRIVATE_KEY)
        wallet_address = account.address
        
        print(f'📝 Wallet Address: {wallet_address}')
        print(f'🔑 Private Key: {PRIVATE_KEY[:10]}...{PRIVATE_KEY[-4:]}')
        print('')
        
        # Initialize Web3
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            print('❌ Failed to connect to RPC')
            return
        
        # Check ETH balance
        eth_balance = w3.eth.get_balance(wallet_address)
        eth_balance_formatted = float(w3.from_wei(eth_balance, 'ether'))
        print(f'💰 ETH Balance: {eth_balance_formatted:.8f} ETH')
        print(f'   (${eth_balance_formatted * 2500:.2f} @ $2500/ETH)')
        print('')
        
        # Check USDC balance in wallet
        usdc_contract = w3.eth.contract(address=USDC_ADDRESS, abi=USDC_ABI)
        usdc_balance_raw = usdc_contract.functions.balanceOf(wallet_address).call()
        usdc_balance = float(usdc_balance_raw) / 1e6  # USDC has 6 decimals
        print(f'💵 USDC Balance (Wallet): {usdc_balance:.6f} USDC')
        print(f'   (${usdc_balance:.2f})')
        print('')
        
        # Check Avantis balance (vault balance)
        print('📊 Checking Avantis Vault Balance...')
        try:
            avantis_balance_data = await get_balance(private_key=PRIVATE_KEY)
            
            print(f'🏦 Avantis Vault Balance: ${avantis_balance_data.get("usdc_balance", 0):.2f} USDC')
            print(f'   Allowance: ${avantis_balance_data.get("usdc_allowance", 0):.2f} USDC')
            print(f'   Total Collateral: ${avantis_balance_data.get("total_collateral", 0):.2f} USDC')
            print('')
            
            # Check positions
            print('📈 Checking Positions...')
            positions = await get_positions(private_key=PRIVATE_KEY)
            
            if positions and len(positions) > 0:
                print(f'⚠️  Found {len(positions)} open position(s):')
                for i, pos in enumerate(positions, 1):
                    print(f'   Position {i}:')
                    print(f'     Symbol: {pos.get("symbol", "N/A")}')
                    print(f'     Size: {pos.get("size", 0):.2f}')
                    print(f'     PnL: ${pos.get("pnl", 0):.2f}')
                    print(f'     Leverage: {pos.get("leverage", 0)}x')
            else:
                print('✅ No open positions found')
            print('')
            
        except Exception as e:
            print(f'⚠️  Could not check Avantis balance: {e}')
            print('   This might mean the wallet is not connected to Avantis')
            print('')
        
        # Summary
        print('=' * 70)
        print('📊 SUMMARY:')
        print(f'   Wallet Address: {wallet_address}')
        print(f'   ETH: {eth_balance_formatted:.8f} ETH')
        print(f'   USDC (Wallet): {usdc_balance:.2f} USDC')
        
        if 'avantis_balance_data' in locals():
            vault_balance = avantis_balance_data.get("usdc_balance", 0)
            print(f'   USDC (Avantis Vault): ${vault_balance:.2f} USDC')
            
            # Check if funds are stuck
            total_usdc = usdc_balance + vault_balance
            print(f'   Total USDC: ${total_usdc:.2f} USDC')
            print('')
            
            if total_usdc < 10:
                print('⚠️  WARNING: Total USDC is less than expected!')
                print('   Expected: ~$11 USDC')
                print('   Found: ${:.2f} USDC'.format(total_usdc))
                print('')
                print('   Possible causes:')
                print('   1. Funds are stuck in contract approval')
                print('   2. Funds were used in a failed position attempt')
                print('   3. Funds are in a different wallet')
            elif vault_balance > 0 and usdc_balance < 0.01:
                print('✅ Funds are in Avantis vault (ready for trading)')
            elif usdc_balance > 0 and vault_balance < 0.01:
                print('⚠️  Funds are in wallet but not in vault')
                print('   They need to be deposited to vault for trading')
        
        print('')
        print('💡 Next Steps:')
        print('   1. If funds are in vault but no positions: They are available for trading')
        print('   2. If funds are in wallet: They need to be deposited to vault')
        print('   3. If funds are missing: Check transaction history on BaseScan')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(check_balances())

