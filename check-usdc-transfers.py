#!/usr/bin/env python3
"""
Check USDC transfers in transaction receipts
Shows USDC Transfer events from transaction logs
"""

import sys
from web3 import Web3
from decimal import Decimal

# Base network RPC
BASE_RPC = "https://mainnet.base.org"

# USDC token address on Base
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# Transfer event signature: keccak256("Transfer(address,address,uint256)")
TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

def check_transaction(tx_hash: str):
    """Check a transaction for USDC transfers"""
    w3 = Web3(Web3.HTTPProvider(BASE_RPC))
    
    print(f"\n{'='*60}")
    print(f"Checking Transaction: {tx_hash}")
    print(f"{'='*60}\n")
    
    try:
        # Get transaction receipt
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        # Check transaction status
        status = receipt.get('status', 0)
        print(f"Transaction Status: {'✅ SUCCESS' if status == 1 else '❌ REVERTED'}\n")
        
        # Check all logs for USDC transfers
        usdc_transfers = []
        
        for log in receipt.get('logs', []):
            log_address = log.get('address', '')
            
            # Check if this is a USDC token log
            if log_address.lower() == USDC_ADDRESS.lower():
                topics = log.get('topics', [])
                
                # Check if this is a Transfer event
                if len(topics) >= 3:
                    event_signature = topics[0].hex() if hasattr(topics[0], 'hex') else topics[0]
                    
                    if event_signature.lower() == TRANSFER_EVENT_SIGNATURE.lower():
                        # Extract addresses from topics
                        from_addr = '0x' + topics[1].hex()[-40:] if hasattr(topics[1], 'hex') else '0x' + topics[1][-40:]
                        to_addr = '0x' + topics[2].hex()[-40:] if hasattr(topics[2], 'hex') else '0x' + topics[2][-40:]
                        
                        # Extract amount from data
                        data = log.get('data', '0x0')
                        if isinstance(data, bytes):
                            data = data.hex()
                        if not data.startswith('0x'):
                            data = '0x' + data
                        
                        amount_wei = int(data, 16) if data != '0x0' else 0
                        amount_usdc = Decimal(amount_wei) / Decimal(10**6)
                        
                        usdc_transfers.append({
                            'from': from_addr,
                            'to': to_addr,
                            'amount_usdc': float(amount_usdc),
                            'amount_wei': amount_wei
                        })
        
        # Display results
        if usdc_transfers:
            print(f"Found {len(usdc_transfers)} USDC Transfer(s):\n")
            total_sent = 0
            for i, transfer in enumerate(usdc_transfers, 1):
                print(f"Transfer #{i}:")
                print(f"  From: {transfer['from']}")
                print(f"  To:   {transfer['to']}")
                print(f"  Amount: ${transfer['amount_usdc']:.2f} USDC")
                print(f"  Amount (wei): {transfer['amount_wei']}")
                print()
                
                # Track total sent from wallet
                if transfer['from'].lower() == receipt['from'].lower():
                    total_sent += transfer['amount_usdc']
            
            if total_sent > 0:
                print(f"{'='*60}")
                print(f"Total USDC Sent from Wallet: ${total_sent:.2f}")
                print(f"{'='*60}\n")
        else:
            print("❌ No USDC Transfer events found in this transaction\n")
        
        # Show transaction details
        print(f"Transaction Details:")
        print(f"  Block: {receipt.get('blockNumber', 'N/A')}")
        print(f"  From: {receipt.get('from', 'N/A')}")
        print(f"  To: {receipt.get('to', 'N/A')}")
        print(f"  Gas Used: {receipt.get('gasUsed', 0):,}")
        print(f"  Status: {'Success' if status == 1 else 'Reverted'}")
        
    except Exception as e:
        print(f"❌ Error checking transaction: {e}")
        return False
    
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check-usdc-transfers.py <transaction_hash>")
        print("\nExample:")
        print("  python check-usdc-transfers.py 0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a")
        sys.exit(1)
    
    tx_hash = sys.argv[1]
    check_transaction(tx_hash)

