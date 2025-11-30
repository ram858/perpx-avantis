"""
Attempt to withdraw/recover funds from Avantis contracts.
Checks for stuck funds and tries various withdrawal methods.
"""
import asyncio
import logging
from typing import Optional
from web3 import Web3
from avantis_client import get_avantis_client
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def try_emergency_withdrawal(private_key: str):
    """Try to withdraw funds from contract if possible"""
    
    try:
        logger.info("=" * 60)
        logger.info("🔍 CHECKING FOR RECOVERABLE FUNDS")
        logger.info("=" * 60)
        
        # Derive address from private key
        from eth_account import Account
        account = Account.from_key(private_key)
        wallet_address = account.address
        
        logger.info(f"📍 Wallet Address: {wallet_address}")
        
        # 1. Check vault balance (not available via direct contracts, skip for now)
        vault_balance = 0
        logger.info(f"💰 Vault Balance: ${vault_balance:.2f} USDC (vault balance check not implemented)")
        
        # 2. Check wallet USDC balance directly
        try:
            rpc_url = settings.avantis_rpc_url or "https://mainnet.base.org"
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            if not w3.is_connected():
                raise RuntimeError(f"Web3 provider not reachable: {rpc_url}")
            
            usdc_address = Web3.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
            usdc_abi = [{"constant":True,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}]
            usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)
            wallet_balance_wei = usdc_contract.functions.balanceOf(wallet_address).call()
            wallet_balance = float(wallet_balance_wei) / 1e6
            logger.info(f"💵 Wallet Balance: ${wallet_balance:.2f} USDC")
        except Exception as e:
            logger.warning(f"⚠️ Could not check wallet balance: {e}")
            wallet_balance = 0
        
        # 3. Check positions (might have funds locked in positions)
        try:
            from contract_operations import get_positions_via_contract
            positions = await get_positions_via_contract(
                private_key=private_key,
                address=None
            )
            logger.info(f"📊 Open Positions: {len(positions)}")
            if positions:
                total_collateral = sum(float(p.get('collateral', 0)) / 1e6 for p in positions)
                logger.info(f"   Total Collateral in Positions: ${total_collateral:.2f} USDC")
        except Exception as e:
            logger.warning(f"⚠️ Could not check positions: {e}")
        
        # 4. Try to find and call withdrawal functions on Trading contract
        try:
            # Use direct contract access instead of SDK
            from direct_contracts import AvantisTradingContract
            trading_contract = AvantisTradingContract(
                rpc_url=settings.avantis_rpc_url or "https://mainnet.base.org",
                contract_address=settings.avantis_trading_contract_address,
                private_key=private_key
            )
            
            if trading_contract:
                logger.info("\n🔍 Checking Trading Contract for withdrawal functions...")
                
                # Check available functions
                contract_functions = [func for func in dir(trading_contract.contract.functions) if not func.startswith('_')]
                withdrawal_functions = [f for f in contract_functions if 'withdraw' in f.lower() or 'redeem' in f.lower() or 'emergency' in f.lower()]
                
                if withdrawal_functions:
                    logger.info(f"   Found potential withdrawal functions: {withdrawal_functions}")
                else:
                    logger.info("   No obvious withdrawal functions found")
                
                # Try common withdrawal patterns
                # Pattern 1: withdraw(uint256 amount)
                if hasattr(trading_contract.contract.functions, 'withdraw'):
                    try:
                        if vault_balance > 0:
                            logger.info(f"\n🔄 Attempting withdraw({vault_balance} USDC)...")
                            withdraw_amount_wei = int(vault_balance * 1e6)
                            fn = trading_contract.contract.functions.withdraw(withdraw_amount_wei)
                            withdraw_tx = trading_contract.build_transaction(
                                fn=fn,
                                from_address=wallet_address,
                                value_wei=0
                            )
                            tx_hash = trading_contract.sign_and_send(withdraw_tx)
                            logger.info(f"✅ Withdrawal successful! TX: {tx_hash}")
                            return True
                    except Exception as e:
                        logger.warning(f"   ⚠️ withdraw() failed: {e}")
                
                # Pattern 2: withdrawAll()
                if hasattr(trading_contract.contract.functions, 'withdrawAll'):
                    try:
                        if vault_balance > 0:
                            logger.info(f"\n🔄 Attempting withdrawAll()...")
                            fn = trading_contract.contract.functions.withdrawAll()
                            withdraw_tx = trading_contract.build_transaction(
                                fn=fn,
                                from_address=wallet_address,
                                value_wei=0
                            )
                            tx_hash = trading_contract.sign_and_send(withdraw_tx)
                            logger.info(f"✅ Withdrawal successful! TX: {tx_hash}")
                            return True
                    except Exception as e:
                        logger.warning(f"   ⚠️ withdrawAll() failed: {e}")
                
                # Pattern 3: emergencyWithdraw() or emergencyWithdrawal()
                for func_name in ['emergencyWithdraw', 'emergencyWithdrawal']:
                    if hasattr(trading_contract.contract.functions, func_name):
                        try:
                            logger.info(f"\n🔄 Attempting {func_name}()...")
                            fn = getattr(trading_contract.contract.functions, func_name)()
                            withdraw_tx = trading_contract.build_transaction(
                                fn=fn,
                                from_address=wallet_address,
                                value_wei=0
                            )
                            tx_hash = trading_contract.sign_and_send(withdraw_tx)
                            logger.info(f"✅ Emergency withdrawal successful! TX: {tx_hash}")
                            return True
                        except Exception as e:
                            logger.warning(f"   ⚠️ {func_name}() failed: {e}")
                
        except Exception as e:
            logger.error(f"❌ Error checking Trading contract: {e}")
        
        # 5. Check if there's a separate Vault contract
        try:
            # Avantis might use a separate ERC-4626 vault contract
            # Try to find vault contract address
            logger.info("\n🔍 Checking for separate Vault contract...")
            # This would need the actual vault address - might be in SDK or config
            logger.info("   Vault contract address not found in current setup")
        except Exception as e:
            logger.warning(f"⚠️ Could not check vault contract: {e}")
        
        # 6. Check recent transaction receipts for USDC transfers
        try:
            logger.info("\n🔍 Checking recent transaction receipts for USDC transfers...")
            rpc_url = settings.avantis_rpc_url or "https://mainnet.base.org"
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            
            # Check the two "Open Trade" transactions
            tx_hashes = [
                "0x79ae3cc622ec18e23c234035a913a3339b14606bb474046261afe3d44dba7cae",
                "0x701d98a20bfa1fa2072f57435552ee59ae6b929a42bd56adecff5ab24d579b0a"
            ]
            
            usdc_address = Web3.to_checksum_address("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
            transfer_event_signature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            
            total_sent = 0
            for tx_hash in tx_hashes:
                try:
                    receipt = w3.eth.get_transaction_receipt(tx_hash)
                    status = receipt.get('status', 0)
                    logger.info(f"\n  TX {tx_hash[:20]}...")
                    logger.info(f"    Status: {'SUCCESS' if status == 1 else 'REVERTED'}")
                    
                    # Check logs for USDC transfers
                    for log in receipt.get('logs', []):
                        if log.get('address', '').lower() == usdc_address.lower():
                            topics = log.get('topics', [])
                            if len(topics) >= 3 and topics[0].hex().lower() == transfer_event_signature.lower():
                                from_addr = '0x' + topics[1].hex()[-40:]
                                to_addr = '0x' + topics[2].hex()[-40:]
                                amount_wei = int(log.get('data', '0x0').hex(), 16) if log.get('data') else 0
                                amount_usdc = amount_wei / 1e6
                                
                                if amount_usdc > 0.01:
                                    logger.info(f"    💸 USDC Transfer: ${amount_usdc:.2f}")
                                    logger.info(f"       From: {from_addr}")
                                    logger.info(f"       To: {to_addr}")
                                    if from_addr.lower() == wallet_address.lower():
                                        total_sent += amount_usdc
                except Exception as e:
                    logger.warning(f"    ⚠️ Could not check TX {tx_hash[:20]}...: {e}")
            
            if total_sent > 0:
                logger.warning(f"\n⚠️ Total USDC sent in transactions: ${total_sent:.2f}")
                logger.warning("   These funds may be stuck in the contract.")
        
        except Exception as e:
            logger.warning(f"⚠️ Could not check transaction receipts: {e}")
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("📋 SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Vault Balance: ${vault_balance:.2f} USDC")
        logger.info(f"Wallet Balance: ${wallet_balance:.2f} USDC")
        logger.info(f"Total Available: ${vault_balance + wallet_balance:.2f} USDC")
        
        if vault_balance == 0 and wallet_balance == 0:
            logger.warning("\n⚠️ No funds found in vault or wallet.")
            logger.warning("   Funds may be:")
            logger.warning("   1. Stuck in contract (contact Avantis support)")
            logger.warning("   2. Lost in failed transactions")
            logger.warning("   3. In a position that's not showing up")
            logger.warning("\n💡 Recommendation: Contact Avantis support with transaction hashes")
            logger.warning("   They may be able to recover stuck funds or explain what happened.")
        
        return False
        
    except Exception as e:
        logger.error(f"❌ Error during withdrawal attempt: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python try_withdrawal.py <private_key>")
        print("Example: python try_withdrawal.py 0x506123a108b7abd21a6130a7bf27904039fe2c9f9dcb83a4c40daa22c032564f")
        sys.exit(1)
    
    private_key = sys.argv[1]
    asyncio.run(try_emergency_withdrawal(private_key))

