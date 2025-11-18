#!/bin/bash

# Quick script to check ETH balance on Base Sepolia
WALLET_ADDRESS="0x1412c18d693bb2ab22aa7f18e6ecb0cfc7049ef4"
RPC_URL="https://base-sepolia.gateway.tenderly.co"

echo "🔍 Checking ETH Balance on Base Sepolia..."
echo "Wallet: $WALLET_ADDRESS"
echo ""

cd avantis-service && source venv/bin/activate && python3 << PYEOF
from web3 import Web3

rpc = '$RPC_URL'
w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={'timeout': 10}))

if w3.is_connected():
    addr = '$WALLET_ADDRESS'
    balance = w3.eth.get_balance(Web3.to_checksum_address(addr))
    eth_balance = w3.from_wei(balance, 'ether')
    
    print(f"✅ Connected to Base Sepolia (Chain ID: {w3.eth.chain_id})")
    print(f"")
    print(f"💰 ETH Balance: {eth_balance} ETH")
    
    if eth_balance > 0:
        print(f"✅ You have ETH! Ready to trade.")
    else:
        print(f"⚠️  No ETH yet. Get it from:")
        print(f"   • Alchemy: https://www.alchemy.com/faucets/base-sepolia")
        print(f"   • Chainlink: https://faucets.chain.link/base-sepolia")
        print(f"   • QuickNode: https://faucet.quicknode.com/base/sepolia")
else:
    print("❌ Failed to connect to RPC")
PYEOF

