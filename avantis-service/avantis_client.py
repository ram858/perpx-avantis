"""Core Avantis SDK client wrapper.
    
Following official Avantis SDK documentation:
- Configuration: https://sdk.avantisfi.com/configuration.html#trading-configuration
- Introduction: https://sdk.avantisfi.com/introduction.html
- API Reference: https://sdk.avantisfi.com/api_reference.html
"""
import os
import logging
from typing import Optional
from avantis_trader_sdk import TraderClient  # Official SDK
from web3 import Web3
from web3 import AsyncWeb3
from eth_account import Account
from config import settings

logger = logging.getLogger(__name__)


class AvantisClient:
    """Wrapper for Avantis TraderClient.
    
    Supports two modes:
    1. With private key: Full read/write operations (traditional wallets)
    2. Address-only: Read-only operations (Base Accounts - no private key)
    """
    
    def __init__(self, private_key: Optional[str] = None, address: Optional[str] = None):
        """
        Initialize Avantis client for a user.
        
        Args:
            private_key: User's Ethereum private key (for traditional wallets)
                        Required for write operations, optional for read-only
            address: User's Ethereum address (for Base Accounts)
                    Required for read-only operations when no private key
        """
        # Validate inputs
        if not private_key and not address:
            raise ValueError(
                "Either private_key (for traditional wallets) or address (for Base Accounts) must be provided."
            )
        
        self.private_key = private_key
        self.is_base_account = not private_key and address is not None
        
        # Get address
        if private_key:
            # Validate private key format
            if not private_key.startswith("0x"):
                self.private_key = f"0x{private_key}"
            else:
                self.private_key = private_key
            
            # Get account from private key
            self.account = Account.from_key(self.private_key)
            self.address = self.account.address
        else:
            # Base Account mode - use provided address
            if not address:
                raise ValueError("Address is required when private_key is not provided")
            if not address.startswith("0x"):
                self.address = f"0x{address}"
            else:
                self.address = address
            self.account = None
        
        # Initialize Web3 provider
        rpc_url = settings.avantis_rpc_url or self._get_default_rpc_url()
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if not self.web3.is_connected():
            raise ConnectionError(f"Failed to connect to RPC: {rpc_url}")
        
        # Initialize async Web3 (for compatibility, though SDK handles this internally)
        async_web3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(rpc_url))
        
        # Override SDK contract addresses for testnet if needed
        # According to SDK docs: https://sdk.avantisfi.com/configuration.html
        # The SDK uses mainnet addresses by default, so we need to override for testnet
        if settings.is_testnet():
            try:
                import avantis_trader_sdk.config as sdk_config
                import json
                
                # Check if testnet addresses are provided via config
                testnet_addresses = None
                if settings.avantis_testnet_contract_addresses:
                    try:
                        testnet_addresses = json.loads(settings.avantis_testnet_contract_addresses)
                        logger.info("Using testnet addresses from configuration")
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid testnet addresses JSON: {e}")
                
                # Check if testnet addresses exist in SDK config
                if not testnet_addresses and hasattr(sdk_config, 'TESTNET_ADDRESSES'):
                    testnet_addresses = sdk_config.TESTNET_ADDRESSES
                    logger.info("Using SDK testnet contract addresses")
                
                if testnet_addresses:
                    # Override SDK config with testnet addresses
                    # Ensure USDC is set correctly
                    if 'USDC' not in testnet_addresses:
                        testnet_addresses['USDC'] = settings.usdc_token_address
                    
                    sdk_config.CONTRACT_ADDRESSES = testnet_addresses
                    logger.info(f"✅ Overridden SDK config with testnet addresses: {list(testnet_addresses.keys())}")
                else:
                    # SDK doesn't have testnet addresses - this will likely fail
                    logger.error(
                        "❌ No testnet contract addresses configured! "
                        "Set AVANTIS_TESTNET_CONTRACT_ADDRESSES environment variable. "
                        "See find_testnet_addresses.py for instructions."
                    )
                    logger.warning(
                        "Using mainnet addresses on testnet - this will likely fail. "
                        "Contracts don't exist at mainnet addresses on Base Sepolia."
                    )
            except Exception as e:
                logger.error(f"Could not override SDK config: {e}", exc_info=True)
        
        # Initialize Avantis TraderClient
        # Following official SDK configuration: https://sdk.avantisfi.com/configuration.html#trading-configuration
        try:
            # Step 1: Create TraderClient with provider URL (as per SDK docs)
            self.trader_client = TraderClient(provider_url=rpc_url)
            
            # Step 2: Set local signer if private key is provided (as per SDK docs)
            if self.private_key:
                # Traditional wallet: set local signer using SDK's set_local_signer method
                # Reference: https://sdk.avantisfi.com/configuration.html#trading-configuration
                self.trader_client.set_local_signer(self.private_key)
                logger.info(f"✅ TraderClient initialized with local signer for address: {self.address}")
            else:
                # Base Account: read-only mode (no signer)
                # Note: Some operations may require a signer, but read operations should work
                logger.info(f"✅ TraderClient initialized in read-only mode for address: {self.address}")
        except Exception as e:
            raise ValueError(f"Failed to initialize Avantis TraderClient: {str(e)}")
    
    def _get_default_rpc_url(self) -> str:
        """Get default RPC URL based on network."""
        if settings.avantis_network == "base-testnet":
            return "https://sepolia.base.org"  # Base Sepolia testnet
        else:
            return "https://mainnet.base.org"  # Base mainnet
    
    def get_address(self) -> str:
        """Get Ethereum address."""
        return self.address
    
    def get_client(self) -> TraderClient:
        """Get the underlying TraderClient instance."""
        return self.trader_client
    
    def can_write(self) -> bool:
        """Check if client can perform write operations (has private key)."""
        return self.private_key is not None


def get_avantis_client(
    private_key: Optional[str] = None,
    address: Optional[str] = None
) -> AvantisClient:
    """
    Create Avantis client instance for a user.
    
    Args:
        private_key: User's private key (for traditional wallets - enables write operations)
        address: User's address (for Base Accounts - read-only operations)
        
    Returns:
        AvantisClient instance
        
    Note:
        - For Base Accounts: provide address only (read-only operations)
        - For traditional wallets: provide private_key (full read/write operations)
        - For write operations with Base Accounts, use transaction preparation endpoints
    """
    return AvantisClient(private_key=private_key, address=address)

