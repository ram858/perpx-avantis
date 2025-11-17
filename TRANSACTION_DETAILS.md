# Transaction Details & Contract Information

## Transaction Hash
**USDC Transfer Transaction**: `0x1ac629081e8220c01f3d2259bd5039306afc45ea5efd4c799b05fa92bc92568d`

**Status**: Confirmed (Success)  
**Block**: 38291918  
**Network**: Base Mainnet  
**Amount**: 20 USDC  
**From**: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`  
**To**: `0x763D460bD420111f1b539ce175f7A769b2cAB39E` (Avantis Trading Contract)  
**Timestamp**: Nov-17-2025 09:53:03 AM +UTC

---

## SDK Version

### Avantis Trader SDK
- **Package**: `avantis-trader-sdk`
- **Version**: `>=0.8.10`
- **Location**: `avantis-service/requirements.txt`

### Other Relevant SDKs
- **Hyperliquid SDK**: `@nktkas/hyperliquid@^0.19.1`
- **Ethers.js**: `ethers@^6.15.0`
- **Web3.py**: `web3>=6.15.0`
- **Viem**: `viem@^1.19.9`

---

## Contract Addresses

### USDC Token Addresses

#### Base Mainnet
- **USDC Address**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Decimals**: 6
- **Network**: Base Mainnet (Chain ID: 8453)
- **Block Explorer**: https://basescan.org

#### Base Testnet (Sepolia)
- **USDC Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Decimals**: 6
- **Network**: Base Sepolia Testnet (Chain ID: 84532)
- **Block Explorer**: https://sepolia.basescan.org

### Avantis Trading Contract
- **Contract Address**: `0x763D460bD420111f1b539ce175f7A769b2cAB39E`
- **Network**: Base Mainnet
- **Note**: This is the contract that received the 20 USDC transfer

### Other Contract Addresses (Referenced in Code)
- **WBTC** (Ethereum Mainnet): `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599`
- **DAI** (Ethereum Mainnet): `0x6B175474E89094C44Da98b954EedeAC495271d0F`

---

## ERC-20 ABI JSON

### Complete ERC-20 Standard ABI

```json
[
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "_from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "_to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "_owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "_spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  }
]
```

### Minimal ERC-20 ABI (Used in Codebase)

```json
[
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
]
```

---

## Transaction Details from Block Explorer

### Transaction Overview
- **Hash**: `0x1ac629081e8220c01f3d2259bd5039306afc45ea5efd4c799b05fa92bc92568d`
- **Status**: ✅ Success
- **Block**: 38291918
- **Timestamp**: 2 hrs ago (Nov-17-2025 09:53:03 AM +UTC)
- **From**: `0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4`
- **To**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC Token Contract)
- **Interacted With**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Circle: USDC Token)

### Transaction Action
**Transfer 20 USDC ($19.99) to `0x763D460bD420111f1b539ce175f7A769b2cAB39E`**

### Transaction Function Call (VERIFIED)
- **Function**: `transfer(address to, uint256 value)`
- **MethodID**: `0xa9059cbb` (transfer function selector)
- **Parameters**:
  - `[0]` (to): `0x763d460bd420111f1b539ce175f7a769b2cab39e` (Avantis Trading Contract)
  - `[1]` (value): `0x1312d00` = 20,000,000 = 20 USDC (6 decimals)

**⚠️ CRITICAL FINDING**: This transaction was confirmed to be a `transfer()` call, NOT an `approve()` call. This confirms the bug where the SDK's `approve_usdc_for_trading()` method performs transfers instead of approvals.

### Transaction Parameters
- **Nonce**: 26
- **Gas Limit**: 45656
- **Gas Price**: 0.001101298 Gwei
- **Total Cost**: 0.00000005 ETH ($0.00)

### ERC-20 Token Transfer Details
- **Token**: USDC (USD Coin)
- **Amount**: 20 USDC
- **Value**: $19.99
- **Recipient**: `0x763D460bD420111f1b539ce175f7A769b2cAB39E`

---

## Network Configuration

### Base Mainnet
- **Chain ID**: 8453
- **RPC URLs**:
  - `https://mainnet.base.org`
  - `https://developer-access-mainnet.base.org`
- **Block Explorer**: https://basescan.org
- **Native Currency**: ETH
- **Native Decimals**: 18

### Base Testnet (Sepolia)
- **Chain ID**: 84532
- **RPC URL**: `https://sepolia.base.org`
- **Block Explorer**: https://sepolia.basescan.org
- **Native Currency**: ETH
- **Native Decimals**: 18

---

## Files Referenced

### Configuration Files
- `avantis-service/config.py` - Main configuration with contract addresses
- `lib/config/network.ts` - Network configuration for frontend
- `avantis-service/requirements.txt` - Python dependencies including SDK version

### Transaction-Related Files
- `USDC_TRANSFER_BUG.md` - Documentation of the transfer bug
- `avantis-service/transaction_preparation.py` - Transaction preparation logic
- `avantis-service/position_queries.py` - Position and approval queries
- `avantis-service/trade_operations.py` - Trading operations

---

## Important Notes

1. **Transaction Type**: This transaction was a **transfer** (not an approval), which is the root cause of the bug documented in `USDC_TRANSFER_BUG.md`.

2. **Contract Address Verification**: The recipient address `0x763D460bD420111f1b539ce175f7A769b2cAB39E` is the Avantis Trading Contract that should have received an **approval** instead of a **transfer**.

3. **SDK Usage**: The codebase uses `avantis-trader-sdk>=0.8.10` for interacting with Avantis contracts. The bug suggests the SDK's `approve_usdc_for_trading()` method may be performing transfers instead of approvals.

4. **Recovery**: The 20 USDC sent to the contract may be recoverable if the contract has withdrawal functions or if Avantis support can assist.

---

## Block Explorer Links

- **Transaction**: https://basescan.org/tx/0x1ac629081e8220c01f3d2259bd5039306afc45ea5efd4c799b05fa92bc92568d
- **USDC Token**: https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- **Avantis Trading Contract**: https://basescan.org/address/0x763D460bD420111f1b539ce175f7A769b2cAB39E
- **Sender Address**: https://basescan.org/address/0x1412C18d693bb2ab22aa7F18e6eCb0CFC7049ef4

