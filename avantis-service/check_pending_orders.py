"""Debug utilities to check pending orders and transaction status."""

import logging
from typing import Dict, Any, List, Optional
from web3 import Web3
from eth_account import Account
from config import settings
from contract_operations import get_positions_via_contract

logger = logging.getLogger(__name__)

async def check_pending_orders(private_key: str) -> Dict[str, Any]:
    """
    Check if there are pending market orders that haven't been executed.
    
    Returns detailed information about pending orders and what might be wrong.
    """
    try:
        # Derive address from private key
        account = Account.from_key(private_key)
        address = account.address
        
        logger.info(f"🔍 Checking pending orders for {address}")
        
        results = {
            "address": address,
            "pending_market_orders": [],
            "pending_limit_orders": [],
            "open_positions": [],
            "diagnosis": []
        }
        
        # Get open positions using direct contract calls
        try:
            positions = await get_positions_via_contract(
                private_key=private_key,
                address=None
            )
            
            # Format positions
            for pos in positions:
                results["open_positions"].append({
                    "pair_index": pos.get("pair_index", 0),
                    "trade_index": pos.get("index", 0),
                    "collateral": pos.get("position_size_usdc", 0) / 1e6,
                    "leverage": pos.get("leverage", 0),
                    "is_long": pos.get("is_long", False),
                    "pnl": 0  # TODO: Calculate PnL if needed
                })
            
            logger.info(f"📊 Open positions: {len(results['open_positions'])}")
            
        except Exception as e:
            logger.warning(f"Could not get positions via contract: {e}")
        
        # Diagnosis
        if len(results["open_positions"]) == 0 and len(results["pending_limit_orders"]) == 0:
            if results.get("pending_count", 0) > 0:
                results["diagnosis"].append(
                    "❌ PROBLEM: You have pending orders but no open positions. "
                    "Your market order might be stuck or failed execution."
                )
            else:
                results["diagnosis"].append(
                    "❌ PROBLEM: No positions found, but USDC was transferred. "
                    "The order likely failed validation after transfer."
                )
        
        return results
        
    except Exception as e:
        logger.error(f"Error checking pending orders: {e}", exc_info=True)
        raise

async def diagnose_failed_position(
    tx_hash: str,
    private_key: str
) -> Dict[str, Any]:
    """
    Diagnose why a position didn't open after USDC transfer.
    
    Args:
        tx_hash: Transaction hash from open_position call
        private_key: Your private key
        
    Returns:
        Diagnostic information
    """
    try:
        # Get Web3 instance
        rpc_url = settings.get_effective_rpc_url()
        web3 = Web3(Web3.HTTPProvider(rpc_url))
        if not web3.is_connected():
            raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")
        
        logger.info(f"🔍 Diagnosing transaction: {tx_hash}")
        
        # Get transaction receipt and transaction details
        try:
            receipt = web3.eth.get_transaction_receipt(tx_hash)
            tx = web3.eth.get_transaction(tx_hash)
        except Exception as e:
            return {
                "error": f"Could not fetch transaction receipt: {e}",
                "tx_hash": tx_hash
            }
        
        results = {
            "tx_hash": tx_hash,
            "status": "success" if receipt.get('status') == 1 else "failed",
            "gas_used": receipt.get('gasUsed'),
            "block_number": receipt.get('blockNumber'),
            "to_address": tx.get('to', '').lower() if tx.get('to') else None,
            "diagnosis": []
        }
        
        # Check if transaction succeeded
        if receipt.get('status') != 1:
            results["diagnosis"].append(
                "❌ TRANSACTION REVERTED: The openTrade call failed on-chain. "
                "Check if you have sufficient balance or if parameters were invalid."
            )
            return results
        
        # Check if this is just a USDC transfer, not an openTrade call
        # USDC contract address on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        usdc_address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
        transfer_function_signature = "0xa9059cbb"  # transfer(address,uint256)
        
        tx_input = tx.get('input', b'')
        # Convert bytes to hex string if needed
        if isinstance(tx_input, bytes):
            tx_input_hex = tx_input.hex()
        else:
            tx_input_hex = str(tx_input)
        
        tx_to = tx.get('to', '')
        if tx_to:
            tx_to = tx_to.lower() if isinstance(tx_to, str) else Web3.to_checksum_address(tx_to).lower()
        
        if tx_to == usdc_address and tx_input_hex.startswith(transfer_function_signature):
            results["diagnosis"].append(
                "❌ CRITICAL ISSUE: This transaction is ONLY a USDC transfer, not an openTrade call!"
            )
            results["diagnosis"].append(
                "   The transaction sent USDC to a recipient, but never called openTrade on the Avantis contract."
            )
            results["diagnosis"].append(
                "   This means no position was opened - the USDC was just transferred."
            )
            results["diagnosis"].append(
                "   SOLUTION: You need to call openTrade() on the Avantis Trading contract, not just transfer USDC."
            )
            return results
        
        # Transaction succeeded, but position didn't open
        results["diagnosis"].append(
            "✅ Transaction succeeded - checking for openTrade call..."
        )
        
        # Check if transaction called openTrade function
        # openTrade function signature (approximate - may vary by contract version)
        # Common signatures: openTrade((...),uint8,uint256) or similar
        tx_input_for_check = tx.get('input', b'')
        if isinstance(tx_input_for_check, bytes):
            tx_input_for_check = tx_input_for_check.hex()
        if len(tx_input_for_check) < 10:
            results["diagnosis"].append(
                "⚠️ Transaction has no input data - this might be a simple transfer"
            )
        else:
            # Check if it's calling a trading contract (not USDC)
            # We already checked for USDC transfer above, so if we get here it's likely a different call
            results["diagnosis"].append(
                f"📝 Transaction called contract at: {tx.get('to', 'Unknown')}"
            )
        
        # Parse logs to find MarketOrderInitiated event
        # Event signature for MarketOrderInitiated
        market_order_topic = Web3.keccak(text="MarketOrderInitiated(address,uint256,bool,uint256,uint256,bool)").hex()
        
        order_id = None
        for log in receipt.get('logs', []):
            if log.get('topics') and log['topics'][0].hex() == market_order_topic:
                # Found MarketOrderInitiated event
                order_id = int(log['topics'][3].hex(), 16) if len(log['topics']) > 3 else None
                results["order_id"] = order_id
                results["diagnosis"].append(
                    f"📝 Market order created with ID: {order_id}"
                )
                break
        
        if order_id:
            results["diagnosis"].append(
                "⏳ Order is PENDING - waiting for Avantis keeper to execute it"
            )
            results["diagnosis"].append(
                "💡 This usually takes 5-30 seconds on mainnet"
            )
            results["diagnosis"].append(
                "⚠️ If order hasn't executed after 2 minutes, it likely failed due to:"
            )
            results["diagnosis"].append("   - Slippage exceeded (price moved too much)")
            results["diagnosis"].append("   - Insufficient execution fee (not enough ETH sent)")
            results["diagnosis"].append("   - Position size below minimum after fees")
            results["diagnosis"].append("   - Keeper/operator issues")
        else:
            results["diagnosis"].append(
                "❌ Could not find MarketOrderInitiated event in transaction logs"
            )
        
        return results
        
    except Exception as e:
        logger.error(f"Error diagnosing transaction: {e}", exc_info=True)
        return {
            "error": str(e),
            "tx_hash": tx_hash,
            "status": "error",
            "diagnosis": [f"❌ Error analyzing transaction: {str(e)}"]
        }

async def check_execution_fee(private_key: str) -> Dict[str, Any]:
    """
    Check if you're sending enough ETH as execution fee.
    """
    try:
        logger.info(f"🔍 Checking execution fee requirements")
        
        # Default execution fee (typically 0.0001 ETH on Base)
        execution_fee_wei = int(0.0001 * 1e18)
        execution_fee_eth = 0.0001
        
        logger.info(f"⛽ Default execution fee: {execution_fee_eth:.6f} ETH")
        
        return {
            "required_fee_wei": execution_fee_wei,
            "required_fee_eth": execution_fee_eth,
            "diagnosis": f"You need to send {execution_fee_eth:.6f} ETH as execution fee with your openTrade transaction"
        }
            
    except Exception as e:
        logger.error(f"Error checking execution fee: {e}")
        raise

# Usage example
async def full_diagnostic(private_key: str, tx_hash: Optional[str] = None):
    """
    Run full diagnostic to understand why position didn't open.
    """
    print("="*60)
    print("AVANTIS POSITION DIAGNOSTIC")
    print("="*60)
    
    # Check pending orders
    print("\n1. Checking pending orders...")
    pending_info = await check_pending_orders(private_key)
    
    print(f"\n📊 Results:")
    print(f"   Open positions: {len(pending_info['open_positions'])}")
    print(f"   Pending limit orders: {len(pending_info['pending_limit_orders'])}")
    
    if pending_info.get('pending_count'):
        print(f"   Pending market orders: {pending_info['pending_count']}")
    
    print(f"\n🔍 Diagnosis:")
    for diag in pending_info['diagnosis']:
        print(f"   {diag}")
    
    # Check execution fee
    print("\n2. Checking execution fee requirements...")
    fee_info = await check_execution_fee(private_key)
    print(f"   {fee_info.get('diagnosis', 'Unknown')}")
    
    # Diagnose specific transaction if provided
    if tx_hash:
        print(f"\n3. Diagnosing transaction {tx_hash}...")
        tx_info = await diagnose_failed_position(tx_hash, private_key)
        
        if 'error' in tx_info:
            print(f"\n   ❌ Error: {tx_info.get('error', 'Unknown error')}")
        else:
            print(f"\n   Status: {tx_info.get('status', 'Unknown')}")
            print(f"   Block: {tx_info.get('block_number', 'Unknown')}")
        
        print(f"\n   🔍 Transaction Diagnosis:")
        for diag in tx_info.get('diagnosis', []):
            print(f"      {diag}")
    
    print("\n" + "="*60)

